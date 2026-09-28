// js/ui/render.live.js
import * as store from "../core/store.js";
import { getSport, getCategory } from "../config/sports.config.js";
import { openMatchModal } from "./matchModal.js";
import { qs, qsa } from "../core/utils.js";

export function initLivePage() {
  store.on("matches:changed", render);
  store.on("fixtures:changed", render);
  render();
}

function render() {
  const container = qs("#live-list");
  if (!container) return;

  const fixtures = store.get("fixtures");

  // De-duplicate: keep only the single most-recently-updated live match per
  // fixture, in case a stale/duplicate match record ever ends up in the
  // store (e.g. from earlier test data or a sync race).
  const byFixture = new Map();
  store.get("matches").filter(m => !m.endedAt).forEach(m => {
    const existing = byFixture.get(m.fixtureId);
    if (!existing || (m.updatedAt || 0) > (existing.updatedAt || 0)) {
      byFixture.set(m.fixtureId, m);
    }
  });
  const matches = Array.from(byFixture.values());

  if (matches.length === 0) {
    // A fixture only becomes a "live match" once an umpire actually opens
    // umpire.html and logs in with that fixture's umpire code — that's the
    // moment a match record is created. Until then it correctly stays as
    // a "scheduled" fixture on the Fixtures page instead of appearing
    // here, which can otherwise look like a sync bug when fixtures were
    // just generated but no one has started scoring any of them yet.
    const scheduledCount = fixtures.filter(f => f.status === "scheduled").length;
    container.innerHTML =
      scheduledCount > 0
        ? `<p class="empty-state">No live matches right now. ${scheduledCount} fixture(s) are scheduled but not started yet — open <a href="./fixtures.html">Fixtures</a> for the umpire code, then start scoring on <a href="./umpire.html">Umpire Console</a>.</p>`
        : `<p class="empty-state">No live matches right now.</p>`;
    return;
  }

  container.innerHTML = matches.map(m => renderLiveCard(m, fixtures)).join("");

  qsa("[data-fixture-id]", container).forEach(card => {
    card.addEventListener("click", () => openMatchModal(card.dataset.fixtureId));
  });
}

function renderLiveCard(match, fixtures) {
  const fixture = fixtures.find(f => f.id === match.fixtureId);
  const sport = getSport(match.sportId);
  const category = fixture ? getCategory(fixture.sportId, fixture.categoryId) : null;

  return `
    <div class="match-card live" data-fixture-id="${fixture?.id || ""}" data-match-id="${match.id}">
      <span class="badge-live">LIVE</span>
      <h3>${sport?.name || match.sportId} — ${category?.label || ""}</h3>
      <div class="score-row">${renderScoreLine(match)}</div>
    </div>
  `;
}

function renderScoreLine(match) {
  const state = match.state || {};
  if (state.sets) {
    return state.sets.map(s => `${s.a}-${s.b}`).join(" | ");
  }
  if (state.frames) {
    return state.frames.map(f => `${f.a}-${f.b}`).join(" | ");
  }
  if (state.boards) {
    return state.boards.map(b => `${b.a}-${b.b}`).join(" | ");
  }
  if (state.points) {
    return `${state.points.a} - ${state.points.b}`;
  }
  if (state.innings) {
    return state.innings.map(i => `${i.battingSide}: ${i.runs}/${i.wickets} (${i.overs} ov)`).join(" | ");
  }
  return "";
}
