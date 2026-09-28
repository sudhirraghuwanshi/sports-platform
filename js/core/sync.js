// js/core/sync.js
// Optional cloud sync adapter (Firebase Realtime Database).
// Disabled by default. Enable via admin settings -> cloudMode = true,
// and provide firebaseConfig in settings.
//
// Design: each collection (fixtures, matches, ...) is stored in Firebase as
// an object map keyed by item id (matches/<id>, fixtures/<id>, ...) rather
// than as a single array blob. Every local change is diffed against the
// last-synced snapshot and only the specific items that changed are pushed
// to their own child path. This avoids whole-collection overwrites, so a
// lagging/incomplete remote read can never wipe out a record (e.g. a match
// you just created and are actively scoring) — the worst case is a brief
// delay before other devices see the very newest edit.

import * as store from "./store.js";

let firebaseApp = null;
let db = null;
let enabled = false;
let lastError = null;
const errorListeners = [];

const SYNCED_KEYS = ["sports", "participants", "fixtures", "matches", "registrations"];

export function isEnabled() {
  return enabled;
}

export function getLastError() {
  return lastError;
}

export function onError(cb) {
  errorListeners.push(cb);
}

function reportError(context, err) {
  lastError = { context, message: err?.message || String(err), at: Date.now() };
  console.error(`sync.js [${context}]`, err);
  errorListeners.forEach(cb => {
    try { cb(lastError); } catch (e) { console.error(e); }
  });
}

// Merge local + remote item lists by id: for each id present on either
// side, keep whichever copy has the newer `updatedAt` (ties favor local so
// we never lose in-flight edits due to a stale/incomplete remote read).
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

    SYNCED_KEYS.forEach(key => {
      const collectionRef = ref(db, key);

      // Tracks the updatedAt we last knew was synced for each item id, so
      // we only push items whose updatedAt has actually advanced and only
      // remove children that were genuinely deleted locally.
      const lastSyncedById = new Map();

      function pushLocalDiff(currentArr) {
        const currentIds = new Set();
        currentArr.forEach(item => {
          currentIds.add(item.id);
          const known = lastSyncedById.get(item.id);
          const itemTs = item.updatedAt || 0;
          if (known === undefined || known !== itemTs) {
            lastSyncedById.set(item.id, itemTs);
            dbSet(ref(db, `${key}/${item.id}`), item).catch(err => reportError(`write ${key}/${item.id}`, err));
          }
        });
        // Propagate local deletions.
        Array.from(lastSyncedById.keys()).forEach(id => {
          if (!currentIds.has(id)) {
            lastSyncedById.delete(id);
            dbSet(ref(db, `${key}/${id}`), null).catch(err => reportError(`delete ${key}/${id}`, err));
          }
        });
      }

      onValue(
        collectionRef,
        snapshot => {
          const val = snapshot.val() || {};
          const remoteArr = Object.values(val);
          const localArr = store.get(key);
          const merged = mergeById(localArr, remoteArr);

          // Record what we now believe is synced for every item in the
          // merged result so the local "changed" handler below won't
          // needlessly re-push items that just arrived from Firebase.
          merged.forEach(item => lastSyncedById.set(item.id, item.updatedAt || 0));

          if (JSON.stringify(merged) !== JSON.stringify(localArr)) {
            store.set(key, merged); // updates local cache + notifies UI
          }
        },
        err => reportError(`read ${key}`, err)
      );

      // One-time bootstrap: push whatever already exists locally (e.g.
      // data created before cloud sync was ever enabled) up to Firebase.
      pushLocalDiff(store.get(key));

      // Push local changes up to Firebase as they happen, diffed per item.
      store.on(`${key}:changed`, data => pushLocalDiff(data));
    });

    enabled = true;
    return true;
  } catch (e) {
    reportError("init", e);
    console.error("Failed to init Firebase sync", e);
    return false;
  }
}
