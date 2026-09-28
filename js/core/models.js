// js/core/models.js
import { uid, randomCode } from "./utils.js";

export function createParticipant({ name, gender = "X", team = null, contact = "", categoryIds = [] }) {
  return {
    id: uid("p"),
    name,
    gender,
    team,
    contact,
    categoryIds
  };
}

export function createFixture({ sportId, categoryId, round = "", sides, scheduledAt, venue = "" }) {
  return {
    id: uid("f"),
    sportId,
    categoryId,
    round,
    participants: sides, // [{ side: 'A', participantIds: [...] }, { side: 'B', participantIds: [...] }]
    scheduledAt,
    venue,
    status: "scheduled", // scheduled | live | completed | walkover
    umpireCode: randomCode(4),
    matchId: null
  };
}

export function createMatch({ fixtureId, sportId, initialState }) {
  return {
    id: uid("m"),
    fixtureId,
    sportId,
    startedAt: Date.now(),
    endedAt: null,
    state: initialState,
    result: { winnerSide: null, summary: "" },
    events: []
  };
}

export function validateParticipant(p) {
  return !!(p && p.name && p.name.trim().length > 0);
}

export function validateFixture(f) {
  return !!(f && f.sportId && f.categoryId && Array.isArray(f.participants) && f.participants.length === 2);
}
