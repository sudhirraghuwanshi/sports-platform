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

    SYNCED_KEYS.forEach(key => {
      const r = ref(db, key);
      onValue(r, snapshot => {
        const val = snapshot.val() || [];
        store.set(key, val); // reuse local store as cache + emit UI updates
      });

      // Push local changes up to Firebase (skip the change that just came
      // from Firebase itself would be ideal, but Firebase's onValue only
      // fires when data actually differs, so this is safe against loops).
      store.on(`${key}:changed`, data => dbSet(r, data));
    });

    enabled = true;
    return true;
  } catch (e) {
    console.error("Failed to init Firebase sync", e);
    return false;
  }
}
