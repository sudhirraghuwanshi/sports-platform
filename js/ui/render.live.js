// js/ui/render.live.js
import * as store from "../core/store.js";
import { getSport, getCategory } from "../config/sports.config.js";
import { qs } from "../core/utils.js";

export function initLivePage() {
  store.on("matches:changed", render);
  store.on("fixtures:changed", render);
  render();
}

function render() {
  const container = qs("#live-list");
  if (!container) return;

  const matches = store.get("matches").filter(m => !m.endedAt);
  const fixtures = store.get("fixtures");

  if (matches.length === 0) {
    container.innerHTML = `<p class="empty-state">No live matches right now.</p>`;
    return;
  }

  container.innerHTML = matches.map(m => renderLiveCard(m, fixtures)).join("");
}

function renderLiveCard(match, fixtures) {
  const fixture = fixtures.find(f => f.id === match.fixtureId);
  const sport = getSport(match.sportId);
  const category = fixture ? getCategory(fixture.sportId, fixture.categoryId) : null;

  return `
    <div class="match-card live" data-match-id="${match.id}">
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
