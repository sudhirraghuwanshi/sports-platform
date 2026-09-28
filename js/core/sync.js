// js/core/sync.js
// Optional cloud sync adapter (Firebase Realtime Database).
// Disabled by default. Enable via admin settings -> cloudMode = true,
// and provide firebaseConfig in settings.
//
// This module mirrors the store.js interface (get/set/on) so UI code
// does not need to change when cloud mode is toggled on.

import * as store from "./store.js";

let firebaseApp = null;
let db = null;
let enabled = false;

const SYNCED_KEYS = ["sports", "participants", "fixtures", "matches", "registrations"];

export function isEnabled() {
  return enabled;
}

// Firebase Realtime Database can return arrays as plain objects keyed by
// index (e.g. after items were removed leaving gaps). Normalize back to
// a real array either way.
function normalizeToArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") return Object.values(val);
  return [];
}

// Merge two arrays of records (each with an `id`) by taking, for every id
// present on either side, whichever copy has the newer `updatedAt`.
// Items that only exist on one side are always kept (never silently
// dropped) — this is what prevents a stale/lagging remote snapshot from
// wiping out a record (e.g. a match) that was only just created locally.
function mergeById(localArr, remoteArr) {
  const byId = new Map();
  localArr.forEach(item => byId.set(item.id, item));
  remoteArr.forEach(item => {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      return;
    }
    const existingTs = existing.updatedAt || 0;
    const incomingTs = item.updatedAt || 0;
    if (incomingTs > existingTs) byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

export async function init(firebaseConfig) {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.warn("sync.js: no firebaseConfig provided, staying in local mode");
    return false;
  }
  try {
    // Loaded lazily via CDN ES module import to avoid bundling when unused.
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getDatabase, ref, onValue, set: dbSet } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"
    );

    firebaseApp = initializeApp(firebaseConfig);
    db = getDatabase(firebaseApp);

    // Track the JSON we most recently sent/received per key so we can avoid
    // feedback loops between local writes <-> remote echoes.
    const lastPushed = {};
    const lastReceived = {};

    SYNCED_KEYS.forEach(key => {
      const r = ref(db, key);

      onValue(r, snapshot => {
        const remoteArr = normalizeToArray(snapshot.val());
        const remoteJson = JSON.stringify(remoteArr);

        // Ignore the echo of a write we just made ourselves.
        if (remoteJson === lastPushed[key]) return;

        const localArr = store.get(key);
        const merged = mergeById(localArr, remoteArr);
        const mergedJson = JSON.stringify(merged);

        // Prevent the store.set below from re-triggering a push of data
        // that's simply what we just received/merged.
        lastReceived[key] = mergedJson;

        if (mergedJson !== JSON.stringify(localArr)) {
          store.set(key, merged); // updates local cache + notifies UI
        }

        // If the merge added/kept anything the remote didn't have (e.g. a
        // brand-new local match), push the reconciled version back up so
        // every other device converges on the same data too.
        if (mergedJson !== remoteJson) {
          lastPushed[key] = mergedJson;
          dbSet(r, merged);
        }
      });

      // Push local changes up to Firebase, but skip re-pushing data that
      // just arrived from Firebase itself (prevents ping-pong loops).
      store.on(`${key}:changed`, data => {
        const json = JSON.stringify(data);
        if (json === lastReceived[key]) return;
        lastPushed[key] = json;
        dbSet(r, data);
      });
    });

    enabled = true;
    return true;
  } catch (e) {
    console.error("Failed to init Firebase sync", e);
    return false;
  }
}
