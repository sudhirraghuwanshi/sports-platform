// js/ui/matchModal.js
// Reusable modal for viewing full details of a fixture/match, used by
// fixtures and live pages so match cards become clickable.
import * as store from "../core/store.js";
import { getSport, getCategory } from "../config/sports.config.js";
import { formatDate, qs } from "../core/utils.js";

function ensureModalRoot() {
  let root = qs("#match-detail-modal");
  if (root) return root;
  root = document.createElement("div");
  root.id = "match-detail-modal";
  root.className = "modal-overlay hidden";
  root.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" aria-label="Close" data-modal-close>&times;</button>
      <div id="match-detail-content"></div>
    </div>
  `;
  document.body.appendChild(root);
  root.addEventListener("click", e => {
    if (e.target === root || e.target.closest("[data-modal-close]")) closeMatchModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMatchModal();
  });
  return root;
}

export function closeMatchModal() {
  const root = qs("#match-detail-modal");
  root?.classList.add("hidden");
}

function participantNames(ids, participants) {
  if (!ids || ids.length === 0) return "TBD";
  return ids.map(id => participants.find(p => p.id === id)?.name || "TBD").join(" / ");
}

function scoreLine(match) {
  if (!match) return "Not started yet";
  const state = match.state || {};
  if (state.sets) {
    return state.sets.map(s => `${s.a}-${s.b}${isDeuce(s) ? " (deuce)" : ""}`).join(" | ");
  }
  if (state.frames) return state.frames.map(f => `${f.a}-${f.b}`).join(" | ");
  if (state.boards) return state.boards.map(b => `${b.a}-${b.b}`).join(" | ");
  if (state.points) return `${state.points.a} - ${state.points.b}`;
  if (state.innings) return state.innings.map(i => `${i.battingSide}: ${i.runs}/${i.wickets} (${i.overs} ov)`).join(" | ");
  return "In progress";
}

// See render.umpire.js for the matching rationale.
function isDeuce(set) {
  const min = Math.min(set.a, set.b);
  const diff = Math.abs(set.a - set.b);
  return min >= 19 && diff < 2 && Math.max(set.a, set.b) >= 20;
}

export function openMatchModal(fixtureId) {
  const root = ensureModalRoot();
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === fixtureId);
  if (!fixture) return;

  const matches = store.get("matches");
  const match = matches.find(m => m.id === fixture.matchId);
  const participants = store.get("participants");
  const sport = getSport(fixture.sportId);
  const category = getCategory(fixture.sportId, fixture.categoryId);
  const sideA = fixture.participants.find(s => s.side === "A");
  const sideB = fixture.participants.find(s => s.side === "B");

  qs("#match-detail-content", root).innerHTML = `
    <h3>${sport?.name || fixture.sportId} — ${category?.label || fixture.categoryId}</h3>
    <p class="hint">${fixture.round || ""}</p>
    <div class="modal-score">
      ${participantNames(sideA?.participantIds, participants)}
      <span class="vs">vs</span>
      ${participantNames(sideB?.participantIds, participants)}
    </div>
    <div class="modal-score" style="font-size: 1.4rem;">${scoreLine(match)}</div>
    <div class="modal-row"><span>Status</span><span class="badge-status">${fixture.status}</span></div>
    <div class="modal-row"><span>Scheduled</span><span>${formatDate(fixture.scheduledAt)}</span></div>
    <div class="modal-row"><span>Venue</span><span>${fixture.venue || "TBD"}</span></div>
    ${match?.result?.summary ? `<div class="modal-row"><span>Result</span><span>${match.result.summary}</span></div>` : ""}
    ${fixture.status !== "completed" ? `<div class="modal-row"><span>Umpire Code</span><span>${fixture.umpireCode}</span></div>` : ""}
  `;
  root.classList.remove("hidden");
}
