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

// Generic entry point: applyEvent(match, eventType, payload)
export function applyEvent(match, eventType, payload = {}) {
  const sport = getSport(match.sportId);
  if (!sport) throw new Error(`Unknown sport: ${match.sportId}`);

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
