// js/core/store.js
// Simple pub-sub data layer over localStorage.
// Swappable with sync.js (Firebase/Supabase) via the same get/set/on interface.

const KEYS = ["sports", "participants", "fixtures", "matches", "settings", "registrations"];
const listeners = {};

function keyName(key) {
  return `sp_${key}`;
}

// Tombstones record "this id was explicitly deleted at this time" and are
// persisted to localStorage (so they survive a hard-refresh). Cloud sync
// uses these to know an item must stay deleted even if a slow/late remote
// read still shows the old copy, instead of silently resurrecting it.
function tombstoneKeyName(key) {
  return `sp_tombstones_${key}`;
}

export function getTombstones(key) {
  try {
    const raw = localStorage.getItem(tombstoneKeyName(key));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setTombstones(key, obj) {
  localStorage.setItem(tombstoneKeyName(key), JSON.stringify(obj));
}

function addTombstones(key, ids) {
  if (!ids || ids.length === 0) return;
  const t = getTombstones(key);
  const now = Date.now();
  ids.forEach(id => { t[id] = now; });
  setTombstones(key, t);
}

export function clearTombstone(key, id) {
  const t = getTombstones(key);
  if (id in t) {
    delete t[id];
    setTombstones(key, t);
  }
}

function emit(key) {
  const evtName = `${key}:changed`;
  (listeners[evtName] || []).forEach(cb => {
    try { cb(get(key)); } catch (e) { console.error(e); }
  });
}

export function get(key) {
  const fallback = key === "settings" ? {} : [];
  try {
    const raw = localStorage.getItem(keyName(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    // Defensive: some earlier code paths accidentally stored an object map
    // (e.g. Firebase-shaped { id1: {...}, id2: {...} }) instead of an array
    // for list keys. Coerce it back into an array so callers can always
    // rely on list keys being real arrays.
    if (key !== "settings" && parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      return Object.values(parsed);
    }
    return parsed ?? fallback;
  } catch (e) {
    console.error("store.get failed", key, e);
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(keyName(key), JSON.stringify(value));
  } catch (e) {
    // Most commonly QuotaExceededError from too much accumulated data
    // (long test sessions, big tombstone lists, etc.). Never let this
    // throw uncaught here — an uncaught error during any store.set() call
    // (which can happen at any point, including during page boot) would
    // otherwise silently abort the rest of app.js, meaning even unrelated
    // things like the admin login form's submit handler never get
    // attached, making the page look completely unresponsive.
    console.error("store.set failed for", key, e);
  }
  emit(key);
}

export function on(evtName, cb) {
  listeners[evtName] = listeners[evtName] || [];
  listeners[evtName].push(cb);
  return () => off(evtName, cb);
}

export function off(evtName, cb) {
  listeners[evtName] = (listeners[evtName] || []).filter(fn => fn !== cb);
}

export function init() {
  KEYS.forEach(k => {
    if (localStorage.getItem(keyName(k)) === null) {
      set(k, k === "settings" ? {} : []);
    }
  });

  // Keep every open tab of the SAME browser live in sync with each other.
  // localStorage writes in one tab do not, by themselves, notify other
  // tabs of that same browser (the built-in "storage" event only fires in
  // *other* tabs, never the one that made the change) — without this, a
  // match started on umpire.html in one tab would only ever be visible on
  // a live.html tab open at the same time after that second tab is
  // reloaded, since Firebase cloud sync round-tripping through the server
  // could take longer than a user expects when testing on one device.
  window.addEventListener("storage", e => {
    if (!e.key || !e.key.startsWith("sp_")) return;
    const match = KEYS.find(k => keyName(k) === e.key);
    if (match) emit(match);
  });
}

// Convenience helpers
export function add(key, item) {
  const list = get(key);
  const stamped = { updatedAt: Date.now(), ...item };
  list.push(stamped);
  set(key, list);
  return stamped;
}

export function update(key, id, patch) {
  const list = get(key);
  const idx = list.findIndex(x => x.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
  set(key, list);
  return list[idx];
}

export function remove(key, id) {
  const list = get(key).filter(x => x.id !== id);
  addTombstones(key, [id]);
  set(key, list);
}

// Delete every item in a collection at once (e.g. admin "Clear All"
// buttons), tombstoning every removed id so cloud sync will keep
// enforcing the deletion (retrying until the server confirms it) even
// across a hard-refresh, instead of the deletion silently being lost if
// it happens to race the first cloud sync read.
export function clearAll(key) {
  const list = get(key);
  addTombstones(key, list.map(x => x.id));
  set(key, key === "settings" ? {} : []);
}

export function exportAll() {
  const dump = {};
  KEYS.forEach(k => (dump[k] = get(k)));
  return dump;
}

export function importAll(dump) {
  KEYS.forEach(k => {
    if (dump[k] !== undefined) set(k, dump[k]);
  });
}
