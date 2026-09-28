// js/scoring/chess.scorer.js
export function createInitialState() {
  return { result: null };
}

export function recordResult(match, outcome, config) {
  // outcome: 'A' | 'B' | 'draw'
  match.events.push({ ts: Date.now(), type: "result", value: outcome });
  if (outcome === "draw") {
    match.result.winnerSide = null;
    match.result.summary = "Draw";
  } else {
    match.result.winnerSide = outcome;
    match.result.summary = `${outcome} wins`;
  }
  match.endedAt = Date.now();
  return match;
}
