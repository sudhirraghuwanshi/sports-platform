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

// Merge local + remote item lists by id. Remote is treated as the source of
// truth for *existence*: if an item was deleted on another device, remote
// will no longer have it, and we must not resurrect it just because some
// other stale browser tab/device still has an old copy cached locally —
// that was the previous bug (deleted fixtures/matches kept reappearing).
// The only exception is a short grace window for items that were *just*
// created/edited locally and haven't reached the server yet (e.g. brief
// network hiccup) — those are kept so we don't lose in-flight edits.
const RESURRECTION_GRACE_MS = 20000;

function toArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") return Object.values(val);
  return [];
}

function mergeById(localArr, remoteArr, tombstones) {
  localArr = toArray(localArr);
  remoteArr = toArray(remoteArr);
  tombstones = tombstones || {};
  const now = Date.now();
  const byId = new Map();
  remoteArr.forEach(item => {
    // A tombstoned id means this item was explicitly deleted locally (or on
    // another device) — never let a slow/late/offline remote copy bring it
    // back, no matter how the timing of the sync connection lines up. This
    // is what fixes deleted fixtures/matches reappearing after a hard
    // refresh: the tombstone persists in localStorage independent of
    // whether the delete had actually reached the server yet.
    if (tombstones[item.id]) return;
    byId.set(item.id, item);
  });
  localArr.forEach(item => {
    const existing = byId.get(item.id);
    if (!existing) {
      // Local-only item: keep only if it's brand new (still propagating
      // up). Otherwise it was almost certainly deleted elsewhere and this
      // is just a stale local cache that should stop resurrecting it.
      const ts = item.updatedAt || 0;
      if (now - ts < RESURRECTION_GRACE_MS) byId.set(item.id, item);
      return;
    }
    const existingTs = existing.updatedAt || 0;
    const incomingTs = item.updatedAt || 0;
    if (incomingTs >= existingTs) byId.set(item.id, item);
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
      let gotFirstSnapshot = false;

      function pushLocalDiff(currentArr) {
        currentArr = toArray(currentArr);
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
          const tombstones = store.getTombstones(key);
          const merged = mergeById(localArr, remoteArr, tombstones);

          // Enforce every pending tombstone against the server on every
          // snapshot, regardless of connection timing. This is what makes
          // a "Clear All" click stick even if it happened before the very
          // first snapshot arrived (previously that window could silently
          // drop the deletion, letting the item come back after a
          // hard-refresh). Once the server confirms the id is really gone,
          // the tombstone is removed so it doesn't linger forever.
          Object.keys(tombstones).forEach(id => {
            if (val && Object.prototype.hasOwnProperty.call(val, id)) {
              dbSet(ref(db, `${key}/${id}`), null).catch(err => reportError(`delete ${key}/${id}`, err));
            } else {
              store.clearTombstone(key, id);
            }
          });

          // Record what we now believe is synced for every item in the
          // merged result so the pushLocalDiff call below won't needlessly
          // re-push items that just arrived from Firebase.
          merged.forEach(item => lastSyncedById.set(item.id, item.updatedAt || 0));

          if (JSON.stringify(merged) !== JSON.stringify(localArr)) {
            store.set(key, merged); // updates local cache + notifies UI
          }

          if (!gotFirstSnapshot) {
            gotFirstSnapshot = true;
            // Flush any local change (create/edit/delete) that happened
            // *before* this first snapshot arrived. Previously the
            // store.on subscription below was only registered at this
            // point, meaning a change made in that window (e.g. clicking
            // "Generate All Fixtures" or "Clear All" right after page
            // load, before Firebase's first response came back) was
            // silently dropped — never pushed to the server at all. That
            // in turn let stale remote data "reappear" alongside brand
            // new local data, producing duplicate sets. Calling this here
            // with the freshest local state guarantees nothing is missed.
            pushLocalDiff(store.get(key));
          }
        },
        err => reportError(`read ${key}`, err)
      );

      // Always listen for local changes from the very start (not gated on
      // the first remote snapshot) so nothing created/edited/deleted
      // before Firebase responds is ever silently lost. pushLocalDiff
      // itself no-ops until gotFirstSnapshot is true.
      store.on(`${key}:changed`, data => {
        if (!gotFirstSnapshot) return; // will be flushed by the onValue handler above once it fires
        pushLocalDiff(data);
      });
    });

    enabled = true;
    return true;
  } catch (e) {
    reportError("init", e);
    console.error("Failed to init Firebase sync", e);
    return false;
  }
}
