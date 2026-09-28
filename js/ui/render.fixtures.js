// js/ui/render.fixtures.js
import * as store from "../core/store.js";
import { SPORTS, getSport, getCategory } from "../config/sports.config.js";
import { filterFixtures, populateSportSelect, populateCategorySelect } from "./filters.js";
import { openMatchModal } from "./matchModal.js";
import { formatDate, qs, qsa } from "../core/utils.js";

let currentFilters = {};

export function initFixturesPage() {
  const sportSelect = qs("#filter-sport");
  const categorySelect = qs("#filter-category");
  const statusChips = document.querySelectorAll("[data-status-chip]");

  populateSportSelect(sportSelect, SPORTS);

  sportSelect.addEventListener("change", () => {
    currentFilters.sportId = sportSelect.value || undefined;
    currentFilters.categoryId = undefined;
    populateCategorySelect(categorySelect, getSport(sportSelect.value));
    render();
  });

  categorySelect.addEventListener("change", () => {
    currentFilters.categoryId = categorySelect.value || undefined;
    render();
  });

  statusChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const status = chip.dataset.statusChip;
      currentFilters.status = currentFilters.status === status ? undefined : status;
      statusChips.forEach(c => c.classList.toggle("active", c === chip && !!currentFilters.status));
      render();
    });
  });

  store.on("fixtures:changed", render);
  store.on("matches:changed", render);
  render();
}

function render() {
  const container = qs("#fixtures-list");
  if (!container) return;
  const fixtures = filterFixtures(store.get("fixtures"), currentFilters);
  const participants = store.get("participants");

  if (fixtures.length === 0) {
    container.innerHTML = `<p class="empty-state">No fixtures found.</p>`;
    return;
  }

  container.innerHTML = fixtures
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .map(f => renderFixtureCard(f, participants))
    .join("");

  qsa("[data-fixture-id]", container).forEach(card => {
    card.addEventListener("click", () => openMatchModal(card.dataset.fixtureId));
  });
}

function participantNames(ids, participants) {
  return ids.map(id => participants.find(p => p.id === id)?.name || "TBD").join(" / ");
}

function renderFixtureCard(fixture, participants) {
  const sport = getSport(fixture.sportId);
  const category = getCategory(fixture.sportId, fixture.categoryId);
  const sideA = fixture.participants.find(s => s.side === "A");
  const sideB = fixture.participants.find(s => s.side === "B");

  return `
    <div class="match-card status-${fixture.status}" data-fixture-id="${fixture.id}">
      <div class="match-card-header">
        <span class="badge sport-${fixture.sportId}">${sport?.name || fixture.sportId}</span>
        <span class="badge-status">${fixture.status}</span>
      </div>
      <h3>${category?.label || fixture.categoryId} — ${fixture.round || ""}</h3>
      <div class="match-sides">
        <span>${participantNames(sideA?.participantIds || [], participants)}</span>
        <span class="vs">vs</span>
        <span>${participantNames(sideB?.participantIds || [], participants)}</span>
      </div>
      <div class="match-meta">
        <span>${formatDate(fixture.scheduledAt)}</span>
        <span>${fixture.venue || ""}</span>
      </div>
    </div>
  `;
}
