// js/ui/filters.js
export function filterFixtures(fixtures, { sportId, categoryId, status } = {}) {
  return fixtures.filter(f => {
    if (sportId && f.sportId !== sportId) return false;
    if (categoryId && f.categoryId !== categoryId) return false;
    if (status && f.status !== status) return false;
    return true;
  });
}

export function populateSportSelect(selectEl, sports) {
  selectEl.innerHTML = `<option value="">All Sports</option>` +
    sports.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
}

export function populateCategorySelect(selectEl, sport) {
  if (!sport) {
    selectEl.innerHTML = `<option value="">All Categories</option>`;
    return;
  }
  selectEl.innerHTML = `<option value="">All Categories</option>` +
    sport.categories.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
}
