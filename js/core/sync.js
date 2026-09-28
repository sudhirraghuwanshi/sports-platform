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
    // A tombstoned id means this item was explicitly deleted (by this
    // device or ANY other device/tab) — never let a slow/late/offline
    // remote copy, or a stale device that hasn't learned about the
    // deletion yet, bring it back.
    if (tombstones[item.id]) return;
    byId.set(item.id, item);
  });
  localArr.forEach(item => {
    if (tombstones[item.id]) return; // also strip from local-only side
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
      // Deletions are tracked in their own Firebase path (not just in this
      // device's localStorage) so that EVERY device/tab — including ones
      // that never clicked delete and still have the old item cached
      // locally — learns about the deletion and stops re-pushing it back
      // up. This is what fixes an item reappearing even after a hard
      // refresh: previously the tombstone only lived in the deleting
      // browser's localStorage, so any other open tab/device was
      // completely unaware and would resurrect the item on its next sync.
      const tombstoneRef = ref(db, `${key}__deleted`);

      // Tracks the updatedAt we last knew was synced for each item id, so
      // we only push items whose updatedAt has actually advanced and only
      // remove children that were genuinely deleted locally.
      const lastSyncedById = new Map();
      let gotFirstSnapshot = false;
      let remoteTombstones = {};

      function pushLocalDiff(currentArr) {
        currentArr = toArray(currentArr);
        const currentIds = new Set();
        currentArr.forEach(item => {
          if (remoteTombstones[item.id] || store.getTombstones(key)[item.id]) return; // never re-push a deleted id
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

      // Push any tombstones this device knows about (from store.remove /
      // store.clearAll) up to the shared tombstone path, and make sure the
      // actual data node is deleted too. Runs on every local change and
      // every remote snapshot so it keeps retrying until confirmed.
      function enforceLocalTombstones() {
        const local = store.getTombstones(key);
        Object.entries(local).forEach(([id, ts]) => {
          if (!remoteTombstones[id]) {
            dbSet(ref(db, `${key}__deleted/${id}`), ts).catch(err => reportError(`tombstone ${key}/${id}`, err));
          }
          dbSet(ref(db, `${key}/${id}`), null).catch(err => reportError(`delete ${key}/${id}`, err));
        });
      }

      function applyRemoteTombstonesLocally() {
        // If the server knows about a deletion this device doesn't have
        // recorded yet (e.g. it was deleted from a different tab), strip
        // that item out of this device's local cache too, so it can never
        // be re-pushed from here either.
        const localArr = toArray(store.get(key));
        const hasAny = localArr.some(item => remoteTombstones[item.id]);
        if (hasAny) {
          store.set(key, localArr.filter(item => !remoteTombstones[item.id]));
        }
      }

      onValue(
        tombstoneRef,
        snapshot => {
          remoteTombstones = snapshot.val() || {};
          applyRemoteTombstonesLocally();
          enforceLocalTombstones();
        },
        err => reportError(`read ${key}__deleted`, err)
      );

      onValue(
        collectionRef,
        snapshot => {
          const val = snapshot.val() || {};
          const remoteArr = Object.values(val);
          const localArr = store.get(key);
          const localTombstones = store.getTombstones(key);
          const combinedTombstones = { ...remoteTombstones, ...localTombstones };
          const merged = mergeById(localArr, remoteArr, combinedTombstones);

          // Clear any local tombstone once the server confirms the item is
          // truly gone, so it doesn't linger in localStorage forever.
          Object.keys(localTombstones).forEach(id => {
            if (!Object.prototype.hasOwnProperty.call(val, id)) {
              store.clearTombstone(key, id);
            }
          });
          enforceLocalTombstones();

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
        enforceLocalTombstones();
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
