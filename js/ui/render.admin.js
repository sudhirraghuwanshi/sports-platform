// js/ui/render.admin.js
import * as store from "../core/store.js";
import * as auth from "../core/auth.js";
import * as sync from "../core/sync.js";
import { SPORTS, getSport } from "../config/sports.config.js";
import { createParticipant, createFixture, validateFixture } from "../core/models.js";
import { generateBracket } from "../core/bracket.js";
import { qs, qsa } from "../core/utils.js";

export function initAdminPage() {
  if (!auth.hasAdminPassword()) {
    auth.setAdminPassword("admin123"); // default; instruct user to change in README
  }

  const loginForm = qs("#admin-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const pass = qs("#admin-pass").value;
      if (auth.loginAdmin(pass)) {
        qs("#admin-login").classList.add("hidden");
        qs("#admin-panel").classList.remove("hidden");
        renderAll();
      } else {
        qs("#admin-login-error").textContent = "Invalid password";
      }
    });
  }

  if (auth.isAdmin()) {
    qs("#admin-login")?.classList.add("hidden");
    qs("#admin-panel")?.classList.remove("hidden");
    renderAll();
  }

  bindParticipantForm();
  bindBulkParticipantForm();
  bindFixtureForm();
  bindGenerateFixturesForm();
  bindCloudSyncForm();
  bindClearRegistrationsButton();

  // Cloud sync connects asynchronously (it lazy-loads Firebase from a CDN),
  // so remote data — e.g. registrations submitted from another device —
  // can arrive well after this page's initial render. Re-render the
  // affected lists whenever the underlying store data changes so nothing
  // gets silently missed.
  store.on("registrations:changed", renderRegistrationsList);
  store.on("participants:changed", renderParticipantsList);
  store.on("fixtures:changed", renderFixturesList);
}

function renderAll() {
  renderSportOptions("#fixture-sport", "#fixture-category");
  renderSportOptions("#gen-sport", "#gen-category");
  renderParticipantsList();
  renderFixturesList();
  renderRegistrationsList();
  renderGenParticipantsList();
  renderFixtureSideSelects();
}

function renderFixtureSideSelects() {
  const participants = store.get("participants");
  const options = participants.map(p => `<option value="${p.id}">${p.name} (${p.gender})</option>`).join("");
  const sideA = qs("#fixture-side-a");
  const sideB = qs("#fixture-side-b");
  if (sideA) sideA.innerHTML = options;
  if (sideB) sideB.innerHTML = options;
}

function renderSportOptions(sportSelector, categorySelector) {
  const sportSelect = qs(sportSelector);
  if (!sportSelect) return;
  sportSelect.innerHTML = SPORTS.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  sportSelect.addEventListener("change", () => renderCategoryOptions(sportSelector, categorySelector));
  renderCategoryOptions(sportSelector, categorySelector);
}

function renderCategoryOptions(sportSelector, categorySelector) {
  const sportSelect = qs(sportSelector);
  const categorySelect = qs(categorySelector);
  const sport = getSport(sportSelect.value);
  categorySelect.innerHTML = sport.categories.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
}

function bindParticipantForm() {
  const form = qs("#participant-form");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = qs("#participant-name").value.trim();
    const gender = qs("#participant-gender").value;
    if (!name) return;
    store.add("participants", createParticipant({ name, gender }));
    form.reset();
    renderParticipantsList();
  });
}

function bindBulkParticipantForm() {
  const form = qs("#bulk-participant-form");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const raw = qs("#bulk-participant-text").value;
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const validGenders = ["M", "F", "X"];
    const participants = store.get("participants");
    lines.forEach(line => {
      const parts = line.split(",").map(s => s.trim());
      const namePart = parts[0];
      const genderPart = (parts[1] || "").toUpperCase();
      if (!namePart) return;
      const gender = validGenders.includes(genderPart) ? genderPart : "X";
      participants.push(createParticipant({ name: namePart, gender }));
    });
    store.set("participants", participants);
    form.reset();
    renderParticipantsList();
    alert(`Added ${lines.length} player(s).`);
  });
}

function renderParticipantsList() {
  const list = qs("#participants-list");
  const participants = store.get("participants");
  if (list) {
    list.innerHTML = participants.map(p => `<li>${p.name} (${p.gender}) <button data-remove-participant="${p.id}">Remove</button></li>`).join("");

    qsa("[data-remove-participant]", list).forEach(btn => {
      btn.addEventListener("click", () => {
        store.remove("participants", btn.dataset.removeParticipant);
        renderParticipantsList();
      });
    });
  }
  renderGenParticipantsList();
  renderFixtureSideSelects();
}

function renderGenParticipantsList() {
  const container = qs("#gen-participants-list");
  if (!container) return;
  const participants = store.get("participants");
  if (participants.length === 0) {
    container.innerHTML = `<span class="hint">Add players first.</span>`;
    return;
  }
  container.innerHTML = participants.map(p => `
    <label class="pill-check">
      <input type="checkbox" data-gen-participant="${p.id}" />
      ${p.name}
    </label>
  `).join("");
}

function bindFixtureForm() {
  const form = qs("#fixture-form");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const sportId = qs("#fixture-sport").value;
    const categoryId = qs("#fixture-category").value;
    const round = qs("#fixture-round").value;
    const scheduledAt = qs("#fixture-datetime").value;
    const venue = qs("#fixture-venue").value;
    const sideAIds = qsa("#fixture-side-a option:checked").map(o => o.value);
    const sideBIds = qsa("#fixture-side-b option:checked").map(o => o.value);

    const fixture = createFixture({
      sportId, categoryId, round,
      sides: [{ side: "A", participantIds: sideAIds }, { side: "B", participantIds: sideBIds }],
      scheduledAt, venue
    });

    if (!validateFixture(fixture)) {
      alert("Please complete all fixture fields.");
      return;
    }

    store.add("fixtures", fixture);
    form.reset();
    renderFixturesList();
    alert(`Fixture created. Umpire code: ${fixture.umpireCode}`);
  });
}

function renderFixturesList() {
  const list = qs("#fixtures-admin-list");
  if (!list) return;
  const fixtures = store.get("fixtures");
  list.innerHTML = fixtures.map(f => `
    <li>
      ${f.sportId} / ${f.categoryId} — ${f.status} — code: ${f.umpireCode}
      <a href="umpire.html#fixture=${f.id}" target="_blank">Open Umpire View</a>
      <button data-remove-fixture="${f.id}">Delete</button>
    </li>
  `).join("");

  qsa("[data-remove-fixture]", list).forEach(btn => {
    btn.addEventListener("click", () => {
      store.remove("fixtures", btn.dataset.removeFixture);
      renderFixturesList();
    });
  });
}

function bindClearRegistrationsButton() {
  const btn = qs("#clear-registrations-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const current = store.get("registrations");
    if (current.length === 0) {
      alert("No registrations to clear.");
      return;
    }
    if (!confirm(`Delete all ${current.length} registration(s)? This also clears them from cloud sync for every device.`)) {
      return;
    }
    store.set("registrations", []);
    renderRegistrationsList();
  });
}

function renderRegistrationsList() {
  const list = qs("#registrations-admin-list");
  if (!list) return;
  const registrations = store.get("registrations");
  if (registrations.length === 0) {
    list.innerHTML = `<div class="empty-state">No registrations yet.</div>`;
    return;
  }
  list.innerHTML = registrations.slice().reverse().map(r => {
    const selectionsText = r.selections.map(s => {
      const sport = getSport(s.sportId);
      const labels = s.categoryIds.map(cid => sport?.categories.find(c => c.id === cid)?.label || cid).join(", ");
      return `<span class="sport-${s.sportId} badge">${sport ? sport.name : s.sportId}</span> ${labels}`;
    }).join("<br/>");
    return `
      <div class="match-card">
        <div class="match-card-header">
          <strong>${r.name}</strong>
          <span class="badge-status">${r.status}</span>
        </div>
        <div class="match-meta">${r.email || ""} ${r.phone || ""}</div>
        <div class="match-meta">${selectionsText}</div>
        <div class="umpire-controls" style="margin-top: var(--space-2);">
          <button class="btn" data-confirm-reg="${r.id}">Confirm</button>
          <button class="btn btn-secondary" data-remove-reg="${r.id}">Remove</button>
        </div>
      </div>
    `;
  }).join("");

  qsa("[data-confirm-reg]", list).forEach(btn => {
    btn.addEventListener("click", () => {
      store.update("registrations", btn.dataset.confirmReg, { status: "confirmed" });
      renderRegistrationsList();
    });
  });

  qsa("[data-remove-reg]", list).forEach(btn => {
    btn.addEventListener("click", () => {
      store.remove("registrations", btn.dataset.removeReg);
      renderRegistrationsList();
    });
  });
}

function bindGenerateFixturesForm() {
  const form = qs("#generate-fixtures-form");
  if (!form) return;

  qs("#gen-select-all")?.addEventListener("click", () => {
    qsa("[data-gen-participant]").forEach(cb => (cb.checked = true));
  });
  qs("#gen-select-none")?.addEventListener("click", () => {
    qsa("[data-gen-participant]").forEach(cb => (cb.checked = false));
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const errorEl = qs("#generate-fixtures-error");
    const successEl = qs("#generate-fixtures-success");
    errorEl.textContent = "";
    successEl.classList.add("hidden");

    const sportId = qs("#gen-sport").value;
    const categoryId = qs("#gen-category").value;
    const format = qs("#gen-format").value;
    const startAt = qs("#gen-start-datetime").value;
    const intervalHours = Number(qs("#gen-interval-hours").value) || 2;
    const venue = qs("#gen-venue").value;
    const participantIds = qsa("[data-gen-participant]:checked").map(cb => cb.dataset.genParticipant);

    if (participantIds.length < 2) {
      errorEl.textContent = "Select at least 2 players.";
      return;
    }
    if (!startAt) {
      errorEl.textContent = "Please set a start date/time.";
      return;
    }

    const rounds = generateBracket(format, participantIds);
    if (rounds.length === 0) {
      errorEl.textContent = "Could not generate fixtures for the selected players.";
      return;
    }

    const fixtures = store.get("fixtures");
    let matchCursor = new Date(startAt);
    let created = 0;

    rounds.forEach(round => {
      round.pairs.forEach(([aId, bId]) => {
        if (!aId || !bId) return; // skip byes / TBD slots
        const fixture = createFixture({
          sportId,
          categoryId,
          round: round.roundLabel,
          sides: [
            { side: "A", participantIds: [aId] },
            { side: "B", participantIds: [bId] }
          ],
          scheduledAt: matchCursor.toISOString().slice(0, 16),
          venue
        });
        fixtures.push(fixture);
        matchCursor = new Date(matchCursor.getTime() + intervalHours * 3600 * 1000);
        created++;
      });
    });

    store.set("fixtures", fixtures);
    form.reset();
    renderFixturesList();
    successEl.textContent = `Generated ${created} fixture(s) across ${rounds.length} round(s).`;
    successEl.classList.remove("hidden");
  });
}

function bindCloudSyncForm() {
  const form = qs("#cloud-sync-form");
  if (!form) return;

  sync.onError(err => {
    const statusEl = qs("#cloud-sync-status");
    if (statusEl) {
      statusEl.textContent = `\u26a0\ufe0f Sync error [${err.context}]: ${err.message}`;
      statusEl.style.color = "var(--color-live)";
    }
  });

  const settings = store.get("settings");
  const cfg = settings.firebaseConfig || {};
  ["apiKey", "authDomain", "databaseURL", "projectId", "storageBucket", "messagingSenderId", "appId"].forEach(field => {
    const el = qs(`#cs-${field}`);
    if (el && cfg[field]) el.value = cfg[field];
  });
  updateCloudSyncStatus();

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const firebaseConfig = {
      apiKey: qs("#cs-apiKey").value.trim(),
      authDomain: qs("#cs-authDomain").value.trim(),
      databaseURL: qs("#cs-databaseURL").value.trim(),
      projectId: qs("#cs-projectId").value.trim(),
      storageBucket: qs("#cs-storageBucket").value.trim(),
      messagingSenderId: qs("#cs-messagingSenderId").value.trim(),
      appId: qs("#cs-appId").value.trim()
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
      qs("#cloud-sync-status").textContent = "Please provide at least apiKey and databaseURL.";
      return;
    }

    const currentSettings = store.get("settings");
    store.set("settings", { ...currentSettings, cloudMode: true, firebaseConfig });

    qs("#cloud-sync-status").textContent = "Connecting...";
    const ok = await sync.init(firebaseConfig);
    updateCloudSyncStatus(ok);
  });

  qs("#cloud-sync-disable")?.addEventListener("click", () => {
    const currentSettings = store.get("settings");
    store.set("settings", { ...currentSettings, cloudMode: false });
    qs("#cloud-sync-status").textContent = "Cloud sync disabled. Reload the page to fully stop syncing. Data stays local from now on.";
  });
}

function updateCloudSyncStatus(justConnected) {
  const statusEl = qs("#cloud-sync-status");
  if (!statusEl) return;
  statusEl.style.color = "";
  const settings = store.get("settings");
  const lastError = sync.getLastError();
  if (justConnected === false) {
    statusEl.textContent = lastError
      ? `\u26a0\ufe0f Could not connect [${lastError.context}]: ${lastError.message}`
      : "Could not connect. Double-check your Firebase config values.";
    statusEl.style.color = "var(--color-live)";
    return;
  }
  if (sync.isEnabled() || (justConnected && settings.cloudMode)) {
    statusEl.textContent = "✅ Cloud sync is active — changes will appear on all devices in real time.";
  } else if (settings.cloudMode) {
    statusEl.textContent = "Cloud sync is saved but not yet connected on this page load. Reload to activate.";
  } else {
    statusEl.textContent = "Cloud sync is off. Data is only stored on this device.";
  }
}
