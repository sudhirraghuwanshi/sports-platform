// js/scoring/scoring.engine.js
// Dispatches score events to the correct sport-specific scorer module.
import { getSport } from "../config/sports.config.js";
import * as racquet from "./racquet.scorer.js";
import * as cue from "./cue.scorer.js";
import * as cricket from "./cricket.scorer.js";
import * as chess from "./chess.scorer.js";
import * as swimming from "./swimming.scorer.js";

export function createInitialState(sportId) {
  const sport = getSport(sportId);
  if (!sport) throw new Error(`Unknown sport: ${sportId}`);

  switch (sport.type) {
    case "racquet":
      return racquet.createInitialState();
    case "cue":
      return cue.createInitialState(sportId);
    case "team":
      return cricket.createInitialState(sport.config);
    case "individual":
      return sportId === "swimming" ? swimming.createInitialState(sport.config) : chess.createInitialState();
    default:
      return {};
  }
}

const POINT_BASED_SPORTS = new Set(["badminton", "table_tennis", "squash", "tennis"]);

// Generic entry point: applyEvent(match, eventType, payload)
export function applyEvent(match, eventType, payload = {}) {
  const sport = getSport(match.sportId);
  if (!sport) throw new Error(`Unknown sport: ${match.sportId}`);

  // Hard guard: once a match has a decided result, no further scoring
  // events should be able to change it. Without this, clicking a scoring
  // button after the deciding set/frame/board had already been won would
  // keep incrementing that same finished unit forever.
  const SCORING_EVENTS = ["point", "frame_points", "frameWon", "points", "board_points", "ball"];
  if (SCORING_EVENTS.includes(eventType) && match.endedAt) {
    console.warn(`Ignored ${eventType} event: match already completed`, match.id);
    return match;
  }

  match.updatedAt = Date.now();

  if (eventType === "point" && POINT_BASED_SPORTS.has(match.sportId)) {
    match.pointHistory = match.pointHistory || [];
    match.pointHistory.push(payload.side);
  }

  switch (match.sportId) {
    case "badminton":
    case "table_tennis":
    case "squash":
      if (eventType === "point") return racquet.applyPoint(match, payload.side, sport.config);
      break;
    case "tennis":
      if (eventType === "point") return racquet.applyPoint(match, payload.side, {
        pointsToWin: sport.config.gamesPerSet, winBy: 2, bestOf: sport.config.bestOf
      });
      break;
    case "snooker":
      if (eventType === "frame_points") return cue.applyFramePoints(match, payload.side, payload.points, sport.config);
      if (eventType === "frameWon") return cue.endFrame(match, payload.side, sport.config);
      break;
    case "billiards":
      if (eventType === "points") return cue.applyBilliardsPoints(match, payload.side, payload.points, sport.config);
      break;
    case "carrom":
      if (eventType === "board_points") return cue.applyBoardPoints(match, payload.side, payload.points, sport.config);
      break;
    case "cricket":
      if (eventType === "ball") return cricket.recordBall(match, payload, sport.config);
      break;
    case "chess":
      if (eventType === "result") return chess.recordResult(match, payload.outcome, sport.config);
      break;
    case "swimming":
      if (eventType === "laneTime") return swimming.recordLaneTime(match, payload.lane, payload.timeMs);
      if (eventType === "finalizeHeat") return swimming.finalizeHeat(match);
      break;
  }
  console.warn(`Unhandled event ${eventType} for sport ${match.sportId}`);
  return match;
}

// Undo the last scored point for point-based racquet sports by rebuilding
// state from scratch and replaying every point except the most recent one.
// Returns true if an undo was performed, false if there was nothing to undo
// or the sport does not support point-history based undo.
export function undoLastPoint(match) {
  if (!POINT_BASED_SPORTS.has(match.sportId)) return false;
  const history = match.pointHistory || [];
  if (history.length === 0) return false;

  const replay = history.slice(0, -1);
  match.state = createInitialState(match.sportId);
  match.events = [];
  match.result = { winnerSide: null, summary: "" };
  match.endedAt = null;
  match.pointHistory = [];

  replay.forEach(side => applyEvent(match, "point", { side }));
  match.updatedAt = Date.now();
  return true;
}

// The "input" events an umpire actually triggers (as opposed to derived
// events like setWon/boardWon that a scorer emits automatically). Only
// these are replayed when undoing, so the scorers regenerate the derived
// events themselves.
const INPUT_EVENT_TYPES = new Set([
  "point", "frame_points", "frameWon", "points", "board_points", "ball", "result", "laneTime"
]);

function replayInputEvent(match, ev) {
  const side = ev.side;
  switch (ev.type) {
    case "point": return applyEvent(match, "point", { side });
    case "frame_points": return applyEvent(match, "frame_points", { side, points: ev.value ?? 1 });
    case "frameWon": return applyEvent(match, "frameWon", { side });
    case "points": return applyEvent(match, "points", { side, points: ev.value ?? 1 });
    case "board_points": return applyEvent(match, "board_points", { side, points: ev.value ?? 1 });
    case "ball": return applyEvent(match, "ball", ev.payload || {});
    case "result": return applyEvent(match, "result", { outcome: ev.outcome });
    case "laneTime": return applyEvent(match, "laneTime", { lane: ev.lane, timeMs: ev.timeMs });
    default: return match;
  }
}

// Generic undo for ALL sports: rebuild state from scratch and replay every
// umpire-input event except the most recent one. For point-based racquet
// sports this defers to the pointHistory-based fast path above.
export function undoLast(match) {
  if (POINT_BASED_SPORTS.has(match.sportId)) return undoLastPoint(match);

  const events = match.events || [];
  let lastInputIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (INPUT_EVENT_TYPES.has(events[i].type)) { lastInputIdx = i; break; }
  }
  if (lastInputIdx === -1) return false;

  const replay = events.slice(0, lastInputIdx).filter(ev => INPUT_EVENT_TYPES.has(ev.type));
  match.state = createInitialState(match.sportId);
  match.events = [];
  match.result = { winnerSide: null, summary: "" };
  match.endedAt = null;

  replay.forEach(ev => replayInputEvent(match, ev));
  match.updatedAt = Date.now();
  return true;
}
