// js/scoring/racquet.scorer.js
// Badminton, Table Tennis, Squash use point-based sets with win-by-2 (+ optional cap).
// Tennis uses a slightly different game/set structure (see applyTennisPoint).

export function createInitialState() {
  return { sets: [{ a: 0, b: 0 }], currentSet: 0, sets_won: { a: 0, b: 0 } };
}

export function applyPoint(match, side, config) {
  const s = side.toLowerCase(); // 'a' | 'b'
  const other = s === "a" ? "b" : "a";
  const { sets } = match.state;
  const set = sets[match.state.currentSet];
  set[s] += 1;

  const leader = Math.max(set.a, set.b);
  const diff = Math.abs(set.a - set.b);
  const capped = config.capAt && leader >= config.capAt;
  const setWon = capped || (leader >= config.pointsToWin && diff >= config.winBy);

  match.events.push({ ts: Date.now(), type: "point", side: s.toUpperCase() });

  if (setWon) {
    const winnerSide = set.a > set.b ? "A" : "B";
    match.events.push({ ts: Date.now(), type: "setWon", side: winnerSide });

    const setsWonA = sets.filter(x => x.a > x.b).length;
    const setsWonB = sets.filter(x => x.b > x.a).length;
    const setsNeeded = Math.ceil(config.bestOf / 2);

    if (setsWonA === setsNeeded || setsWonB === setsNeeded) {
      match.result.winnerSide = setsWonA > setsWonB ? "A" : "B";
      match.result.summary = sets.map(x => `${x.a}-${x.b}`).join(", ");
      match.endedAt = Date.now();
    } else {
      sets.push({ a: 0, b: 0 });
      match.state.currentSet += 1;
    }
  }
  return match;
}

export function undoLast(match) {
  // Simplified undo: recompute from event log excluding last scoring event.
  const events = match.events.slice(0, -1);
  match.events = [];
  match.state = createInitialState();
  match.result = { winnerSide: null, summary: "" };
  match.endedAt = null;
  return events; // caller should replay via applyPoint if needed
}
