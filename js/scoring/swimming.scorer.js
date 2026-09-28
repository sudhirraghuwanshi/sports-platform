// js/scoring/swimming.scorer.js
export function createInitialState(config) {
  return { lanes: Array.from({ length: config.lanes }, (_, i) => ({ lane: i + 1, participantId: null, timeMs: null })) };
}

export function recordLaneTime(match, laneNumber, timeMs) {
  const lane = match.state.lanes.find(l => l.lane === laneNumber);
  if (!lane) return match;
  lane.timeMs = timeMs;
  match.events.push({ ts: Date.now(), type: "laneTime", lane: laneNumber, timeMs });
  return match;
}

export function finalizeHeat(match) {
  const withTimes = match.state.lanes.filter(l => l.timeMs != null);
  withTimes.sort((a, b) => a.timeMs - b.timeMs);
  match.result.winnerSide = withTimes[0] ? withTimes[0].participantId : null;
  match.result.summary = withTimes.map(l => `L${l.lane}: ${l.timeMs}ms`).join(", ");
  match.endedAt = Date.now();
  return match;
}
