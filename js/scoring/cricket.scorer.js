// js/scoring/cricket.scorer.js
export function createInitialState(config) {
  return {
    innings: [
      { battingSide: "A", runs: 0, wickets: 0, overs: 0, balls: 0 }
    ],
    currentInnings: 0
  };
}

function ballsToOversStr(balls) {
  const overs = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${overs}.${rem}`;
}

export function recordBall(match, { runs = 0, isWicket = false, isExtra = false }, config) {
  const inn = match.state.innings[match.state.currentInnings];
  inn.runs += runs;
  if (isWicket) inn.wickets += 1;
  if (!isExtra) {
    inn.balls += 1;
  }
  inn.overs = ballsToOversStr(inn.balls);

  match.events.push({ ts: Date.now(), type: "ball", runs, isWicket, isExtra });

  const totalBalls = config.oversPerInnings * 6;
  const inningsOver = inn.balls >= totalBalls || inn.wickets >= (config.playersPerTeam - 1);

  if (inningsOver) {
    if (match.state.currentInnings + 1 < config.inningsCount) {
      match.state.innings.push({
        battingSide: inn.battingSide === "A" ? "B" : "A",
        runs: 0, wickets: 0, overs: 0, balls: 0
      });
      match.state.currentInnings += 1;
    } else {
      finalizeMatch(match);
    }
  }
  return match;
}

function finalizeMatch(match) {
  const [first, second] = match.state.innings;
  if (!second) return;
  const winnerSide = second.runs > first.runs ? second.battingSide : first.battingSide;
  match.result.winnerSide = winnerSide;
  match.result.summary = `${first.battingSide} ${first.runs}/${first.wickets} vs ${second.battingSide} ${second.runs}/${second.wickets}`;
  match.endedAt = Date.now();
}
