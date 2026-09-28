// js/scoring/cue.scorer.js
// Handles Snooker (frames), Billiards (points/time), Carrom (boards).

export function createInitialState(sportId) {
  if (sportId === "snooker") return { frames: [{ a: 0, b: 0 }], currentFrame: 0 };
  if (sportId === "billiards") return { points: { a: 0, b: 0 }, startedAt: Date.now() };
  if (sportId === "carrom") return { boards: [{ a: 0, b: 0 }], currentBoard: 0 };
  return {};
}

export function applyFramePoints(match, side, points, config) {
  const s = side.toLowerCase();
  const frame = match.state.frames[match.state.currentFrame];
  frame[s] += points;
  match.events.push({ ts: Date.now(), type: "frame_points", side: s.toUpperCase(), value: points });
  return match;
}

export function endFrame(match, winnerSide, config) {
  match.events.push({ ts: Date.now(), type: "frameWon", side: winnerSide });
  const frames = match.state.frames;
  const wonA = frames.filter(f => f.a > f.b).length;
  const wonB = frames.filter(f => f.b > f.a).length;
  if (wonA === config.framesToWin || wonB === config.framesToWin) {
    match.result.winnerSide = wonA > wonB ? "A" : "B";
    match.result.summary = `${wonA}-${wonB} frames`;
    match.endedAt = Date.now();
  } else {
    frames.push({ a: 0, b: 0 });
    match.state.currentFrame += 1;
  }
  return match;
}

export function applyBilliardsPoints(match, side, points, config) {
  const s = side.toLowerCase();
  match.state.points[s] += points;
  match.events.push({ ts: Date.now(), type: "points", side: s.toUpperCase(), value: points });
  if (match.state.points[s] >= config.targetPoints) {
    match.result.winnerSide = side.toUpperCase();
    match.result.summary = `${match.state.points.a}-${match.state.points.b}`;
    match.endedAt = Date.now();
  }
  return match;
}

export function applyBoardPoints(match, side, points, config) {
  const s = side.toLowerCase();
  const board = match.state.boards[match.state.currentBoard];
  board[s] += points;
  match.events.push({ ts: Date.now(), type: "board_points", side: s.toUpperCase(), value: points });

  if (board[s] >= config.pointsToWin) {
    match.events.push({ ts: Date.now(), type: "boardWon", side: side.toUpperCase() });
    const boards = match.state.boards;
    const wonA = boards.filter(b => b.a >= config.pointsToWin).length;
    const wonB = boards.filter(b => b.b >= config.pointsToWin).length;
    if (wonA === config.boardsToWin || wonB === config.boardsToWin) {
      match.result.winnerSide = wonA > wonB ? "A" : "B";
      match.result.summary = `${wonA}-${wonB} boards`;
      match.endedAt = Date.now();
    } else {
      boards.push({ a: 0, b: 0 });
      match.state.currentBoard += 1;
    }
  }
  return match;
}
