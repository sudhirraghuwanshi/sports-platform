// js/ui/render.register.js
import * as store from "../core/store.js";
import { SPORTS } from "../config/sports.config.js";
import { createRegistration, validateRegistration } from "../core/models.js";
import { qs, qsa } from "../core/utils.js";

export function initRegisterPage() {
  renderSportsCheckboxes();
  bindForm();
  renderMyRegistrations();
}

function renderSportsCheckboxes() {
  const container = qs("#reg-sports-list");
  if (!container) return;
  container.innerHTML = SPORTS.map(sport => `
    <div class="checkbox-group" data-sport-group="${sport.id}">
      <div class="checkbox-row">
        <input type="checkbox" id="sport-${sport.id}" data-sport-toggle="${sport.id}" />
        <label for="sport-${sport.id}" class="checkbox-group-title">${sport.name}</label>
      </div>
      <div class="category-pills">
        ${sport.categories.map(c => `
          <label class="pill-check">
            <input type="checkbox" data-sport="${sport.id}" data-category="${c.id}" disabled />
            ${c.label}
          </label>
        `).join("")}
      </div>
    </div>
  `).join("");

  qsa("[data-sport-toggle]", container).forEach(toggle => {
    toggle.addEventListener("change", () => {
      const group = container.querySelector(`[data-sport-group="${toggle.dataset.sportToggle}"]`);
      const checkboxes = qsa("[data-category]", group);
      checkboxes.forEach(cb => {
        cb.disabled = !toggle.checked;
        if (!toggle.checked) cb.checked = false;
      });
    });
  });
}

function collectSelections() {
  const groups = qsa("#reg-sports-list [data-sport-group]");
  const selections = [];
  groups.forEach(group => {
    const sportId = group.dataset.sportGroup;
    const categoryIds = qsa("[data-category]:checked", group).map(cb => cb.dataset.category);
    if (categoryIds.length > 0) {
      selections.push({ sportId, categoryIds });
    }
  });
  return selections;
}

function bindForm() {
  const form = qs("#registration-form");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const errorEl = qs("#registration-error");
    const successEl = qs("#registration-success");
    errorEl.textContent = "";
    successEl.classList.add("hidden");

    const registration = createRegistration({
      name: qs("#reg-name").value.trim(),
      email: qs("#reg-email").value.trim(),
      phone: qs("#reg-phone").value.trim(),
      gender: qs("#reg-gender").value,
      dob: qs("#reg-dob").value,
      selections: collectSelections()
    });

    if (!validateRegistration(registration)) {
      errorEl.textContent = "Please enter your name and select at least one sport & category.";
      return;
    }

    store.add("registrations", registration);
    form.reset();
    qsa("[data-category]").forEach(cb => (cb.disabled = true));
    successEl.textContent = `Thanks ${registration.name}! Your registration was submitted and is pending confirmation.`;
    successEl.classList.remove("hidden");
    renderMyRegistrations();
  });
}

function renderMyRegistrations() {
  const container = qs("#my-registrations");
  if (!container) return;
  const registrations = store.get("registrations");
  if (registrations.length === 0) {
    container.innerHTML = `<div class="empty-state">No registrations yet. Be the first to sign up!</div>`;
    return;
  }
  container.innerHTML = registrations
    .slice()
    .reverse()
    .map(r => `
      <div class="match-card">
        <div class="match-card-header">
          <strong>${r.name}</strong>
          <span class="badge">${r.status}</span>
        </div>
        <div class="match-meta">
          ${r.selections.map(s => {
            const sport = SPORTS.find(sp => sp.id === s.sportId);
            const labels = s.categoryIds
              .map(cid => sport?.categories.find(c => c.id === cid)?.label || cid)
              .join(", ");
            return `<div><span class="sport-${s.sportId} badge">${sport ? sport.name : s.sportId}</span> ${labels}</div>`;
          }).join("")}
        </div>
      </div>
    `).join("");
}
