// js/ui/render.admin.js
import * as store from "../core/store.js";
import * as auth from "../core/auth.js";
import * as sync from "../core/sync.js";
import { SPORTS, getSport } from "../config/sports.config.js";
import { createParticipant, createFixture, validateFixture } from "../core/models.js";
import { generateBracket } from "../core/bracket.js";
import { qs, qsa } from "../core/utils.js";

export function initAdminPage() {
  console.log("[admin] initAdminPage running");
  if (!auth.hasAdminPassword()) {
    auth.setAdminPassword("admin123"); // default; instruct user to change in README
  }

  function doLogin() {
    const pass = qs("#admin-pass")?.value ?? "";
    console.log("[admin] login attempt");
    if (auth.loginAdmin(pass)) {
      console.log("[admin] login OK");
      qs("#admin-login")?.classList.add("hidden");
      qs("#admin-panel")?.classList.remove("hidden");
      renderAll();
    } else {
      console.log("[admin] login rejected — password mismatch");
      const errEl = qs("#admin-login-error");
      if (errEl) errEl.textContent = "Invalid password. If you forgot it, click \u201cReset to admin123\u201d below.";
    }
  }

  const loginForm = qs("#admin-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      doLogin();
    });
  } else {
    console.warn("[admin] #admin-login-form not found in DOM");
  }
  // Fallback: also handle a direct click on the submit button, in case the
  // form's submit event is ever suppressed/intercepted for any reason.
  qs("#admin-login-form button[type=submit]")?.addEventListener("click", e => {
    e.preventDefault();
    doLogin();
  });

  // Escape hatch: if the stored admin password on this device somehow
  // diverged from the documented default (e.g. it was changed once during
  // testing and forgotten, or corrupted), this lets you recover access
  // without needing DevTools/localStorage surgery.
  qs("#reset-admin-pass-btn")?.addEventListener("click", () => {
    if (confirm("Reset the admin password on this device back to admin123?")) {
      auth.setAdminPassword("admin123");
      qs("#admin-login-error").textContent = "Password reset to admin123. Try logging in again.";
    }
  });

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
  bindClearFixturesButton();
  bindEventFilters();

  // Cloud sync connects asynchronously (it lazy-loads Firebase from a CDN),
  // so remote data — e.g. registrations submitted from another device —
  // can arrive well after this page's initial render. Re-render the
  // affected lists whenever the underlying store data changes so nothing
  // gets silently missed.
  store.on("registrations:changed", () => {
    syncRegistrationsToParticipants();
    renderRegistrationsList();
    renderParticipantsList();
  });
  store.on("participants:changed", renderParticipantsList);
  store.on("fixtures:changed", renderFixturesList);
}

function renderAll() {
  syncRegistrationsToParticipants();
  renderSportOptions("#fixture-sport", "#fixture-category");
  renderSportOptions("#gen-sport", "#gen-category");
  renderParticipantsList();
  renderFixturesList();
  renderRegistrationsList();
  renderGenParticipantsList();
  renderFixtureSideSelects();
}

// Registered players live in the "registrations" collection, while fixtures
// are built from the "participants" pool. To make registered players show up
// automatically (and be usable when creating fixtures) we mirror each
// registration into a participant record tagged with its registrationId and
// the events (sport + category) the player signed up for. Manually-added
// participants (no registrationId) are left untouched.
function syncRegistrationsToParticipants() {
  const registrations = store.get("registrations");
  const participants = store.get("participants");
  const regIds = new Set(registrations.map(r => r.id));
  let changed = false;

  registrations.forEach(r => {
    let p = participants.find(x => x.registrationId === r.id);
    if (!p) {
      p = {
        ...createParticipant({ name: r.name, gender: r.gender }),
        registrationId: r.id,
        selections: r.selections || []
      };
      participants.push(p);
      changed = true;
    } else {
      const newSel = JSON.stringify(r.selections || []);
      if (p.name !== r.name || p.gender !== r.gender || JSON.stringify(p.selections || []) !== newSel) {
        p.name = r.name;
        p.gender = r.gender;
        p.selections = r.selections || [];
        p.updatedAt = Date.now();
        changed = true;
      }
    }
  });

  // Drop derived participants whose source registration was removed.
  for (let i = participants.length - 1; i >= 0; i--) {
    const p = participants[i];
    if (p.registrationId && !regIds.has(p.registrationId)) {
      participants.splice(i, 1);
      changed = true;
    }
  }

  if (changed) store.set("participants", participants);
}

// A participant is eligible for an event if they registered for that exact
// sport + category. Manually-added participants (no selections) stay
// available for every event so the manual workflow isn't restricted.
function participantEligible(p, sportId, categoryId) {
  if (!p.selections || p.selections.length === 0) return true;
  return p.selections.some(
    s => s.sportId === sportId && (!categoryId || (s.categoryIds || []).includes(categoryId))
  );
}

// Re-render the fixture-creation player pickers whenever the selected event
// (sport/category) changes, so only players registered for that event show.
function bindEventFilters() {
  qs("#fixture-sport")?.addEventListener("change", () => {
    renderCategoryOptions("#fixture-sport", "#fixture-category");
    renderFixtureSideSelects();
  });
  qs("#fixture-category")?.addEventListener("change", renderFixtureSideSelects);
  qs("#gen-sport")?.addEventListener("change", () => {
    renderCategoryOptions("#gen-sport", "#gen-category");
    renderGenParticipantsList();
  });
  qs("#gen-category")?.addEventListener("change", renderGenParticipantsList);
}

function renderFixtureSideSelects() {
  const sportId = qs("#fixture-sport")?.value;
  const categoryId = qs("#fixture-category")?.value;
  const participants = store
    .get("participants")
    .filter(p => participantEligible(p, sportId, categoryId));
  const options = participants.length
    ? participants.map(p => `<option value="${p.id}">${p.name} (${p.gender})</option>`).join("")
    : `<option value="" disabled>No players registered for this event</option>`;
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
    list.innerHTML = participants.map(p => {
      const events = (p.selections || []).map(s => {
        const sport = getSport(s.sportId);
        const labels = (s.categoryIds || [])
          .map(cid => sport?.categories.find(c => c.id === cid)?.label || cid)
          .join(", ");
        return `<span class="sport-${s.sportId} badge">${sport ? sport.name : s.sportId}</span> ${labels}`;
      }).join("<br/>");
      const eventsHtml = events
        ? `<div class="match-meta" style="margin-top:4px;">${events}</div>`
        : `<div class="match-meta" style="margin-top:4px;"><span class="hint">Manually added (all events)</span></div>`;
      return `<li>
        <div><strong>${p.name}</strong> (${p.gender}) <button data-remove-participant="${p.id}">Remove</button></div>
        ${eventsHtml}
      </li>`;
    }).join("");

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
  const sportId = qs("#gen-sport")?.value;
  const categoryId = qs("#gen-category")?.value;
  const participants = store
    .get("participants")
    .filter(p => participantEligible(p, sportId, categoryId));
  if (participants.length === 0) {
    container.innerHTML = `<span class="hint">No players registered for this event yet.</span>`;
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
    store.clearAll("registrations");
    renderRegistrationsList();
  });
}

function bindClearFixturesButton() {
  const btn = qs("#clear-fixtures-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const fixtures = store.get("fixtures");
    const matches = store.get("matches");
    if (fixtures.length === 0 && matches.length === 0) {
      alert("No fixtures or matches to clear.");
      return;
    }
    if (
      !confirm(
        `Delete all ${fixtures.length} fixture(s) and ${matches.length} match(es)? This also clears them from cloud sync for every device (e.g. old test data on the Live Scores page).`
      )
    ) {
      return;
    }
    store.clearAll("fixtures");
    store.clearAll("matches");
    renderFixturesList();
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
