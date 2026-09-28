// js/core/bracket.js
// Generates rounds of pairings for round-robin and single-elimination (knockout) formats.
// Both return: [{ roundLabel, pairs: [[idA, idB|null], ...] }]

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateRoundRobin(participantIds, { shuffleOrder = true } = {}) {
  let ids = shuffleOrder ? shuffle(participantIds) : participantIds.slice();
  if (ids.length < 2) return [];
  if (ids.length % 2 !== 0) ids.push(null); // bye slot

  const n = ids.length;
  const rounds = [];
  const rotating = ids.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    const roundIds = [ids[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = roundIds[i];
      const b = roundIds[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push({ roundLabel: `Round ${r + 1}`, pairs });
    rotating.unshift(rotating.pop());
  }

  return rounds;
}

export function generateKnockout(participantIds, { shuffleOrder = true } = {}) {
  let ids = shuffleOrder ? shuffle(participantIds) : participantIds.slice();
  if (ids.length < 2) return [];

  // Pad to next power of 2 with byes (null)
  let size = 1;
  while (size < ids.length) size *= 2;
  while (ids.length < size) ids.push(null);

  const rounds = [];
  let currentIds = ids;
  let roundNum = 1;
  const totalRounds = Math.log2(size);

  while (currentIds.length >= 2) {
    const pairs = [];
    for (let i = 0; i < currentIds.length; i += 2) {
      pairs.push([currentIds[i], currentIds[i + 1] ?? null]);
    }
    const remaining = totalRounds - roundNum + 1;
    const label = remaining === 1 ? "Final" : remaining === 2 ? "Semifinal" : remaining === 3 ? "Quarterfinal" : `Round ${roundNum}`;
    rounds.push({ roundLabel: label, pairs });
    // Placeholder advance: winners unknown ahead of time, so next round slots are TBD (null vs null)
    currentIds = new Array(pairs.length).fill(null);
    roundNum++;
  }

  return rounds;
}

export function generateBracket(format, participantIds, opts) {
  return format === "round_robin"
    ? generateRoundRobin(participantIds, opts)
    : generateKnockout(participantIds, opts);
}
