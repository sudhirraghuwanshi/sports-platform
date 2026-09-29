// js/ui/render.umpire.js
import * as store from "../core/store.js";
import * as auth from "../core/auth.js";
import { getSport } from "../config/sports.config.js";
import { createMatch } from "../core/models.js";
import { createInitialState, applyEvent, undoLast } from "../scoring/scoring.engine.js";
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
  // Prefer the recorded matchId, but fall back to any match already
  // created for this fixture (covers a stale/out-of-date matchId pointer,
  // which previously caused duplicate matches and a "stuck" umpire console
  // pointed at the wrong record). Never create a second match if one
  // already exists for this fixture.
  let match = matches.find(m => m.id === fixture.matchId) || matches.find(m => m.fixtureId === fixture.id);

  if (!match) {
    const initialState = createInitialState(fixture.sportId);
    match = createMatch({ fixtureId: fixture.id, sportId: fixture.sportId, initialState });
    matches.push(match);
    store.set("matches", matches);
    store.update("fixtures", fixture.id, { status: "live", matchId: match.id });
  } else if (fixture.matchId !== match.id) {
    // Heal the pointer without creating a duplicate.
    store.update("fixtures", fixture.id, { matchId: match.id, status: match.endedAt ? "completed" : "live" });
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
  const match = matches.find(m => m.id === fixture.matchId) || matches.find(m => m.fixtureId === fixture.id);
  if (!match) return;

  const sport = getSport(fixture.sportId);
  qs("#umpire-sport-name").textContent = sport.name;
  qs("#umpire-score-display").textContent = scoreLine(match);

  const isCompleted = !!match.endedAt;
  qs("#btn-point-a")?.toggleAttribute("disabled", isCompleted);
  qs("#btn-point-b")?.toggleAttribute("disabled", isCompleted);

  // Snooker frames only close via an explicit "frame won" action, so show
  // an End Frame control for it (awards the current frame to whoever leads
  // and advances to the next frame / decides the match).
  const endFrameBtn = qs("#btn-end-frame");
  if (endFrameBtn) {
    const showEndFrame = fixture.sportId === "snooker";
    endFrameBtn.classList.toggle("hidden", !showEndFrame);
    endFrameBtn.toggleAttribute("disabled", isCompleted);
  }
  const banner = qs("#umpire-completed-banner");
  if (banner) {
    if (isCompleted) {
      banner.textContent = `Match completed${match.result?.summary ? " — " + match.result.summary : ""}. Use Undo to correct the last point if needed.`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

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
    qs("#btn-end-frame")?.addEventListener("click", handleEndFrame);
    qs("#btn-undo")?.addEventListener("click", handleUndo);
    listenersBound = true;
  }
}

function sideNames(ids, participants) {
  if (!ids || ids.length === 0) return "";
  return ids.map(id => participants.find(p => p.id === id)?.name || "TBD").join(" / ");
}

// Map a generic "+1" button press to the scoring event the current sport
// actually understands. Point-based racquet sports use "point"; cue sports
// add a single point to the current frame/points/board.
function scoreEventFor(sportId, side) {
  switch (sportId) {
    case "snooker": return { type: "frame_points", payload: { side, points: 1 } };
    case "billiards": return { type: "points", payload: { side, points: 1 } };
    case "carrom": return { type: "board_points", payload: { side, points: 1 } };
    default: return { type: "point", payload: { side } };
  }
}

function handlePoint(side) {
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === activeFixtureId);
  if (!fixture) return;
  const matches = store.get("matches");
  const match = matches.find(m => m.id === fixture.matchId) || matches.find(m => m.fixtureId === fixture.id);
  if (!match) return;
  if (match.endedAt) return; // match already decided; renderConsole disables the buttons for this too

  const { type, payload } = scoreEventFor(fixture.sportId, side);
  applyEvent(match, type, payload);
  store.set("matches", matches.map(m => (m.id === match.id ? match : m)));

  if (match.endedAt) {
    store.update("fixtures", match.fixtureId, { status: "completed" });
  }
}

// Snooker: close the current frame, awarding it to whichever side leads on
// points (advances to the next frame or ends the match).
function handleEndFrame() {
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === activeFixtureId);
  if (!fixture) return;
  const matches = store.get("matches");
  const match = matches.find(m => m.id === fixture.matchId) || matches.find(m => m.fixtureId === fixture.id);
  if (!match || match.endedAt) return;

  const frame = match.state?.frames?.[match.state.currentFrame];
  if (!frame) return;
  if (frame.a === frame.b) {
    alert("The frame is tied — add a point to the leader before ending it.");
    return;
  }
  const winner = frame.a > frame.b ? "A" : "B";
  applyEvent(match, "frameWon", { side: winner });
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
  const match = matches.find(m => m.id === fixture.matchId) || matches.find(m => m.fixtureId === fixture.id);
  if (!match) return;

  const wasCompleted = !!match.endedAt;
  const undone = undoLast(match);
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
  if (state.sets) {
    return state.sets.map(s => `${s.a}-${s.b}${isDeuce(s) ? " (deuce)" : ""}`).join(" | ");
  }
  if (state.frames) return state.frames.map(f => `${f.a}-${f.b}`).join(" | ");
  if (state.boards) return state.boards.map(b => `${b.a}-${b.b}`).join(" | ");
  if (state.points) return `${state.points.a} - ${state.points.b}`;
  if (state.innings) {
    return state.innings.map(i => `${i.battingSide}: ${i.runs}/${i.wickets} (${i.overs} ov)`).join(" | ");
  }
  if (state.result) return state.result;
  if (state.lanes) return state.lanes.map(l => `Lane ${l.lane}: ${l.timeMs ? (l.timeMs / 1000).toFixed(2) + "s" : "—"}`).join(" | ");
  return "0 - 0";
}

// A set is "in deuce" once both sides have reached at least 19 points and
// are within one point of each other while the leader is at least 20 —
// i.e. play must continue past the normal target score until someone
// leads by 2 (or hits the cap). This makes win-by-2 finishes like 23-21
// visually obvious instead of looking like an unexplained overrun.
function isDeuce(set) {
  const min = Math.min(set.a, set.b);
  const diff = Math.abs(set.a - set.b);
  return min >= 19 && diff < 2 && Math.max(set.a, set.b) >= 20;
}
