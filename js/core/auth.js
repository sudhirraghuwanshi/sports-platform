// js/core/auth.js
// Lightweight, client-only role gate. Not for high-security use.
import * as store from "./store.js";

const ADMIN_KEY = "sp_admin_pass";
const SESSION_KEY = "sp_session";

export function setAdminPassword(pass) {
  localStorage.setItem(ADMIN_KEY, pass);
}

export function hasAdminPassword() {
  return !!localStorage.getItem(ADMIN_KEY);
}

export function loginAdmin(pass) {
  const stored = localStorage.getItem(ADMIN_KEY);
  if (stored && stored === pass) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role: "admin", at: Date.now() }));
    return true;
  }
  return false;
}

export function loginUmpire(fixtureId, code) {
  const fixtures = store.get("fixtures");
  const fixture = fixtures.find(f => f.id === fixtureId);
  if (fixture && fixture.umpireCode === code) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role: "umpire", fixtureId, at: Date.now() }));
    return true;
  }
  return false;
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
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
