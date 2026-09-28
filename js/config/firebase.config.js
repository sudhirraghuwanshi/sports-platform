// js/config/firebase.config.js
// Firebase client config is safe to commit/expose publicly — it just tells
// the browser which project to talk to. Access control is handled by your
// Firebase Realtime Database security rules, not by hiding these values.
//
// Fill this in once (from Firebase Console -> Project settings -> Your apps)
// and push it to the repo. Every visitor's browser will then automatically
// connect to the same shared database — no per-device setup needed.
//
// Leave apiKey empty ("") to keep the app running in local-only mode.

export const firebaseConfig = {
  apiKey: "AIzaSyAVS6C5M7dsxBViEtumLxzqIVVzgq1MaQk",
  authDomain: "sports-platform-4334.firebaseapp.com",
  databaseURL: "https://sports-platform-4334-default-rtdb.firebaseio.com",
  projectId: "sports-platform-4334",
  storageBucket: "sports-platform-4334.firebasestorage.app",
  messagingSenderId: "618153873193",
  appId: "1:618153873193:web:c3b45b73537005f5ff3138"
};
