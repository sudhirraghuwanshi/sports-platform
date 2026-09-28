// js/config/sports.config.js
// Single source of truth for sport & category definitions.

export const SPORTS = [
  {
    id: "badminton",
    name: "Badminton",
    type: "racquet",
    scoringFormat: "sets",
    config: { pointsToWin: 21, winBy: 2, capAt: 30, bestOf: 3 },
    categories: [
      { id: "mens_singles", label: "Men's Singles", format: "singles", gender: "M" },
      { id: "womens_singles", label: "Women's Singles", format: "singles", gender: "F" },
      { id: "mens_doubles", label: "Men's Doubles", format: "doubles", gender: "M" },
      { id: "womens_doubles", label: "Women's Doubles", format: "doubles", gender: "F" },
      { id: "mixed_doubles", label: "Mixed Doubles", format: "doubles", gender: "X" }
    ]
  },
  {
    id: "tennis",
    name: "Tennis",
    type: "racquet",
    scoringFormat: "tennis_sets",
    config: { gamesPerSet: 6, tiebreakAt: 6, bestOf: 3, advantage: true },
    categories: [
      { id: "mens_singles", label: "Men's Singles", format: "singles", gender: "M" },
      { id: "womens_singles", label: "Women's Singles", format: "singles", gender: "F" },
      { id: "mixed_doubles", label: "Mixed Doubles", format: "doubles", gender: "X" }
    ]
  },
  {
    id: "table_tennis",
    name: "Table Tennis",
    type: "racquet",
    scoringFormat: "sets",
    config: { pointsToWin: 11, winBy: 2, bestOf: 5 },
    categories: [
      { id: "mens_singles", label: "Men's Singles", format: "singles", gender: "M" },
      { id: "womens_singles", label: "Women's Singles", format: "singles", gender: "F" },
      { id: "doubles", label: "Doubles", format: "doubles", gender: "X" }
    ]
  },
  {
    id: "squash",
    name: "Squash",
    type: "racquet",
    scoringFormat: "sets",
    config: { pointsToWin: 11, winBy: 2, bestOf: 5 },
    categories: [
      { id: "mens_singles", label: "Men's Singles", format: "singles", gender: "M" },
      { id: "womens_singles", label: "Women's Singles", format: "singles", gender: "F" }
    ]
  },
  {
    id: "snooker",
    name: "Snooker",
    type: "cue",
    scoringFormat: "frames",
    config: { framesToWin: 3, bestOfFrames: 5, ballValues: [1, 2, 3, 4, 5, 6, 7] },
    categories: [
      { id: "open_singles", label: "Open Singles", format: "singles", gender: "X" }
    ]
  },
  {
    id: "billiards",
    name: "Billiards",
    type: "cue",
    scoringFormat: "points_timed",
    config: { targetPoints: 100, timeLimitMins: 30 },
    categories: [
      { id: "open_singles", label: "Open Singles", format: "singles", gender: "X" }
    ]
  },
  {
    id: "carrom",
    name: "Carrom",
    type: "cue",
    scoringFormat: "boards",
    config: { pointsToWin: 25, boardsToWin: 2, bestOfBoards: 3 },
    categories: [
      { id: "mens_singles", label: "Men's Singles", format: "singles", gender: "M" },
      { id: "womens_singles", label: "Women's Singles", format: "singles", gender: "F" },
      { id: "doubles", label: "Doubles", format: "doubles", gender: "X" }
    ]
  },
  {
    id: "chess",
    name: "Chess",
    type: "individual",
    scoringFormat: "result",
    config: { timeControl: "rapid_15+10", resultValues: { win: 1, draw: 0.5, loss: 0 } },
    categories: [
      { id: "open", label: "Open", format: "singles", gender: "X" },
      { id: "u16", label: "Under 16", format: "singles", gender: "X" }
    ]
  },
  {
    id: "swimming",
    name: "Swimming",
    type: "individual",
    scoringFormat: "timed_heats",
    config: { events: ["50m Freestyle", "100m Freestyle", "50m Backstroke"], lanes: 8 },
    categories: [
      { id: "mens", label: "Men", format: "individual", gender: "M" },
      { id: "womens", label: "Women", format: "individual", gender: "F" }
    ]
  },
  {
    id: "cricket",
    name: "Cricket",
    type: "team",
    scoringFormat: "innings_overs",
    config: { oversPerInnings: 20, playersPerTeam: 11, inningsCount: 2 },
    categories: [
      { id: "open", label: "Open", format: "team", gender: "X" }
    ]
  }
];

export function getSport(sportId) {
  return SPORTS.find(s => s.id === sportId) || null;
}

export function getCategory(sportId, categoryId) {
  const sport = getSport(sportId);
  if (!sport) return null;
  return sport.categories.find(c => c.id === categoryId) || null;
}
