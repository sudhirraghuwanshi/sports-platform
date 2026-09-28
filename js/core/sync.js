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
    // feedback loops between local writes <-> remote echoes, and so a
    // momentarily-empty remote database doesn't wipe out real local data.
    const lastPushed = {};
    const lastReceived = {};

    SYNCED_KEYS.forEach(key => {
      const r = ref(db, key);

      onValue(r, snapshot => {
        const val = snapshot.val();
        const remoteJson = JSON.stringify(val ?? []);

        // Ignore the echo of a write we just made ourselves.
        if (remoteJson === lastPushed[key]) return;

        const hasRemoteData = val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0);
        if (!hasRemoteData) {
          // Remote is empty (e.g. brand-new database, or first connect).
          // Seed it from whatever we already have locally instead of
          // wiping local data with an empty value.
          const localVal = store.get(key);
          if (localVal && localVal.length > 0) {
            lastPushed[key] = JSON.stringify(localVal);
            dbSet(r, localVal);
          }
          return;
        }

        lastReceived[key] = remoteJson;
        store.set(key, val); // reuse local store as cache + emit UI updates
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
