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
    updatedAt: Date.now(),
    endedAt: null,
    state: initialState,
    result: { winnerSide: null, summary: "" },
    events: [],
    pointHistory: []
  };
}

export function validateParticipant(p) {
  return !!(p && p.name && p.name.trim().length > 0);
}

export function validateFixture(f) {
  return !!(f && f.sportId && f.categoryId && Array.isArray(f.participants) && f.participants.length === 2);
}

export function createRegistration({ name, email = "", phone = "", gender = "X", dob = "", selections = [] }) {
  // selections: [{ sportId, categoryIds: [...] }]
  return {
    id: uid("r"),
    name,
    email,
    phone,
    gender,
    dob,
    selections,
    status: "pending", // pending | confirmed | rejected
    createdAt: Date.now()
  };
}

export function validateRegistration(r) {
  return !!(
    r &&
    r.name && r.name.trim().length > 0 &&
    Array.isArray(r.selections) &&
    r.selections.length > 0 &&
    r.selections.every(s => s.sportId && Array.isArray(s.categoryIds) && s.categoryIds.length > 0)
  );
}
