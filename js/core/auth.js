// js/core/auth.js
// Lightweight, client-only role gate. Not for high-security use.
import * as store from "./store.js";

const ADMIN_KEY = "sp_admin_pass";
const SESSION_KEY = "sp_session";
const DEFAULT_ADMIN_PASSWORD = "admin123";

// Some sessions live entirely in memory when Storage APIs are unavailable
// or throwing (private browsing, disabled cookies/storage, quota exhausted).
// Falling back to these keeps the app usable instead of appearing to
// silently reject a correct password.
let memorySession = null;

export function setAdminPassword(pass) {
  try {
    localStorage.setItem(ADMIN_KEY, pass);
  } catch (e) {
    console.error("setAdminPassword failed", e);
  }
}

export function hasAdminPassword() {
  try {
    return !!localStorage.getItem(ADMIN_KEY);
  } catch (e) {
    console.error("hasAdminPassword failed", e);
    return false;
  }
}

export function loginAdmin(pass) {
  let stored = null;
  try {
    stored = localStorage.getItem(ADMIN_KEY);
  } catch (e) {
    console.error("loginAdmin read failed", e);
  }
  // Accept the entered password if it matches the stored one, OR — when no
  // password could be read/stored at all (storage disabled/broken) — accept
  // the documented default so an admin is never locked out by a storage
  // quirk. This is a client-only convenience gate, not real security.
  const ok = (stored && stored === pass) || (!stored && pass === DEFAULT_ADMIN_PASSWORD);
  if (ok) {
    const session = { role: "admin", at: Date.now() };
    memorySession = session;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error("loginAdmin session write failed (using in-memory session)", e);
    }
    return true;
  }
  return false;
}

export function loginUmpire(fixtureId, code) {
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === fixtureId);
  if (fixture && fixture.umpireCode === code) {
    const session = { role: "umpire", fixtureId, at: Date.now() };
    memorySession = session;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error("loginUmpire session write failed (using in-memory session)", e);
    }
    return true;
  }
  return false;
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to in-memory session */
  }
  return memorySession;
}

export function logout() {
  memorySession = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    /* ignore */
  }
}

export function isAdmin() {
  const s = getSession();
  return !!s && s.role === "admin";
}

export function canScoreFixture(fixtureId) {
  const s = getSession();
  if (!s) return false;
  if (s.role === "admin") return true;
  return s.role === "umpire" && s.fixtureId === fixtureId;
}
