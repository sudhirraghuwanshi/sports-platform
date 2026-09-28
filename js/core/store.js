// js/core/store.js
// Simple pub-sub data layer over localStorage.
// Swappable with sync.js (Firebase/Supabase) via the same get/set/on interface.

const KEYS = ["sports", "participants", "fixtures", "matches", "settings"];
const listeners = {};

function keyName(key) {
  return `sp_${key}`;
}

function emit(key) {
  const evtName = `${key}:changed`;
  (listeners[evtName] || []).forEach(cb => {
    try { cb(get(key)); } catch (e) { console.error(e); }
  });
}

export function get(key) {
  try {
    const raw = localStorage.getItem(keyName(key));
    return raw ? JSON.parse(raw) : (key === "settings" ? {} : []);
  } catch (e) {
    console.error("store.get failed", key, e);
    return key === "settings" ? {} : [];
  }
}

export function set(key, value) {
  localStorage.setItem(keyName(key), JSON.stringify(value));
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
}

// Convenience helpers
export function add(key, item) {
  const list = get(key);
  list.push(item);
  set(key, list);
  return item;
}

export function update(key, id, patch) {
  const list = get(key);
  const idx = list.findIndex(x => x.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  set(key, list);
  return list[idx];
}

export function remove(key, id) {
  const list = get(key).filter(x => x.id !== id);
  set(key, list);
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
