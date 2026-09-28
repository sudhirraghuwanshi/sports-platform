// js/ui/render.admin.js
import * as store from "../core/store.js";
import * as auth from "../core/auth.js";
import { SPORTS, getSport } from "../config/sports.config.js";
import { createParticipant, createFixture, validateFixture } from "../core/models.js";
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
  bindFixtureForm();
}

function renderAll() {
  renderSportOptions();
  renderParticipantsList();
  renderFixturesList();
  renderRegistrationsList();
}

function renderSportOptions() {
  const sportSelect = qs("#fixture-sport");
  if (!sportSelect) return;
  sportSelect.innerHTML = SPORTS.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  sportSelect.addEventListener("change", renderCategoryOptions);
  renderCategoryOptions();
}

function renderCategoryOptions() {
  const sportSelect = qs("#fixture-sport");
  const categorySelect = qs("#fixture-category");
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

function renderParticipantsList() {
  const list = qs("#participants-list");
  if (!list) return;
  const participants = store.get("participants");
  list.innerHTML = participants.map(p => `<li>${p.name} (${p.gender}) <button data-remove-participant="${p.id}">Remove</button></li>`).join("");

  qsa("[data-remove-participant]", list).forEach(btn => {
    btn.addEventListener("click", () => {
      store.remove("participants", btn.dataset.removeParticipant);
      renderParticipantsList();
    });
  });
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
    const sideAIds = qs("#fixture-side-a").value.split(",").map(s => s.trim()).filter(Boolean);
    const sideBIds = qs("#fixture-side-b").value.split(",").map(s => s.trim()).filter(Boolean);

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
