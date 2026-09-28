// js/ui/render.umpire.js
import * as store from "../core/store.js";
import * as auth from "../core/auth.js";
import { getSport } from "../config/sports.config.js";
import { createMatch } from "../core/models.js";
import { createInitialState, applyEvent, undoLastPoint } from "../scoring/scoring.engine.js";
import { qs } from "../core/utils.js";

let activeFixtureId = null;
let listenersBound = false;

export function initUmpirePage() {
  const params = new URLSearchParams(location.hash.replace("#", ""));
  activeFixtureId = params.get("fixture");

  const loginForm = qs("#umpire-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const code = qs("#umpire-code").value.trim();
      if (auth.loginUmpire(activeFixtureId, code)) {
        qs("#umpire-login").classList.add("hidden");
        qs("#umpire-console").classList.remove("hidden");
        startOrResumeMatch();
      } else {
        qs("#umpire-login-error").textContent = "Invalid code";
      }
    });
  }

  if (auth.canScoreFixture(activeFixtureId)) {
    qs("#umpire-login")?.classList.add("hidden");
    qs("#umpire-console")?.classList.remove("hidden");
    startOrResumeMatch();
  }

  store.on("matches:changed", renderConsole);
}

function startOrResumeMatch() {
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === activeFixtureId);
  if (!fixture) return;

  let matches = store.get("matches");
  let match = matches.find(m => m.id === fixture.matchId);

  if (!match) {
    const initialState = createInitialState(fixture.sportId);
    match = createMatch({ fixtureId: fixture.id, sportId: fixture.sportId, initialState });
    matches.push(match);
    store.set("matches", matches);
    store.update("fixtures", fixture.id, { status: "live", matchId: match.id });
  }
  renderConsole();
}

function renderConsole() {
  const consoleEl = qs("#umpire-console");
  if (!consoleEl || consoleEl.classList.contains("hidden")) return;

  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === activeFixtureId);
  if (!fixture) return;
  const matches = store.get("matches");
  const match = matches.find(m => m.id === fixture.matchId);
  if (!match) return;

  const sport = getSport(fixture.sportId);
  qs("#umpire-sport-name").textContent = sport.name;
  qs("#umpire-score-display").textContent = scoreLine(match);

  const participants = store.get("participants");
  const sideA = fixture.participants.find(s => s.side === "A");
  const sideB = fixture.participants.find(s => s.side === "B");
  const nameA = sideNames(sideA?.participantIds, participants) || "A";
  const nameB = sideNames(sideB?.participantIds, participants) || "B";
  qs("#umpire-side-a-name").textContent = nameA;
  qs("#umpire-side-b-name").textContent = nameB;

  if (!listenersBound) {
    qs("#btn-point-a")?.addEventListener("click", () => handlePoint("A"));
    qs("#btn-point-b")?.addEventListener("click", () => handlePoint("B"));
    qs("#btn-undo")?.addEventListener("click", handleUndo);
    listenersBound = true;
  }
}

function sideNames(ids, participants) {
  if (!ids || ids.length === 0) return "";
  return ids.map(id => participants.find(p => p.id === id)?.name || "TBD").join(" / ");
}

function handlePoint(side) {
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === activeFixtureId);
  if (!fixture) return;
  const matches = store.get("matches");
  const match = matches.find(m => m.id === fixture.matchId);
  if (!match) return;

  applyEvent(match, "point", { side });
  store.set("matches", matches.map(m => (m.id === match.id ? match : m)));

  if (match.endedAt) {
    store.update("fixtures", match.fixtureId, { status: "completed" });
  }
}

function handleUndo() {
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === activeFixtureId);
  if (!fixture) return;
  const matches = store.get("matches");
  const match = matches.find(m => m.id === fixture.matchId);
  if (!match) return;

  const wasCompleted = !!match.endedAt;
  const undone = undoLastPoint(match);
  if (!undone) {
    alert("Nothing to undo yet.");
    return;
  }

  store.set("matches", matches.map(m => (m.id === match.id ? match : m)));

  if (wasCompleted && !match.endedAt) {
    store.update("fixtures", match.fixtureId, { status: "live" });
  }
}

function scoreLine(match) {
  const state = match.state || {};
  if (state.sets) return state.sets.map(s => `${s.a}-${s.b}`).join(" | ");
  return JSON.stringify(state);
}
