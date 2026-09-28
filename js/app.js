// js/app.js
// Entry point: initializes store, service worker, and the correct page module
// based on which HTML page is loaded (each page includes this same script).
import * as store from "./core/store.js";
import * as sync from "./core/sync.js";
import { firebaseConfig } from "./config/firebase.config.js";

// Surface ANY uncaught error/rejection visibly on the page instead of it
// silently aborting script execution. This has previously masked real
// bugs: an uncaught error anywhere during boot (even in an unrelated
// module) can stop the rest of app.js from running at all, which means
// things like the admin login form's submit handler never get attached —
// making the whole page look broken/unresponsive with zero visible clue
// why, which is exactly what a page-freezing bug looks like to a user.
window.addEventListener("error", e => {
  console.error("[uncaught error]", e.error || e.message);
  showFatalBanner(`Script error: ${e.message}`);
});
window.addEventListener("unhandledrejection", e => {
  console.error("[unhandled promise rejection]", e.reason);
  showFatalBanner(`Script error: ${e.reason?.message || e.reason}`);
});

function showFatalBanner(text) {
  let el = document.getElementById("global-fatal-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "global-fatal-banner";
    el.style.cssText =
      "background:#f8d7da;color:#721c24;padding:8px 16px;font-size:13px;font-weight:600;text-align:center;";
    document.body.prepend(el);
  }
  el.textContent = `\u26a0\ufe0f ${text} \u2014 please screenshot this and hard-refresh.`;
}

try {
  store.init();
} catch (e) {
  console.error("store.init failed", e);
  showFatalBanner(`Startup error: ${e.message}`);
}

// --- Visible cloud-sync status badge (works on every page, no DevTools needed) ---
function ensureSyncBadge() {
  let badge = document.getElementById("global-sync-badge");
  if (badge) return badge;
  badge = document.createElement("span");
  badge.id = "global-sync-badge";
  badge.style.cssText =
    "display:inline-block;margin-left:8px;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;vertical-align:middle;";
  const header = document.querySelector(".app-header .brand");
  if (header) header.appendChild(badge);
  else document.body.prepend(badge);
  return badge;
}

function setSyncBadge(text, kind) {
  const badge = ensureSyncBadge();
  const colors = {
    connecting: ["#fff3cd", "#856404"],
    connected: ["#d4edda", "#155724"],
    error: ["#f8d7da", "#721c24"],
    off: ["#e2e3e5", "#383d41"],
  };
  const [bg, fg] = colors[kind] || colors.off;
  badge.style.background = bg;
  badge.style.color = fg;
  badge.textContent = text;
  badge.title = text;
}

// Cloud sync auto-connects for every visitor using the config baked into
// js/config/firebase.config.js (no per-device setup required). An admin can
// still override this at runtime via the Admin panel's Cloud Sync form,
// which takes priority if it has been explicitly configured there.
const settings = store.get("settings");
const activeFirebaseConfig = settings?.cloudMode && settings?.firebaseConfig
  ? settings.firebaseConfig
  : firebaseConfig;

if (activeFirebaseConfig?.apiKey) {
  setSyncBadge("Cloud sync: connecting…", "connecting");
  sync.onError(err => {
    console.error(`[cloud sync error] ${err.context}: ${err.message}`);
    setSyncBadge(`Cloud sync error [${err.context}]: ${err.message}`, "error");
  });
  sync.init(activeFirebaseConfig).then(ok => {
    if (ok) {
      console.info("Cloud sync enabled — updates will appear on all devices.");
      setSyncBadge("Cloud sync: connected ✓", "connected");
    } else {
      const err = sync.getLastError();
      const msg = err ? `${err.context}: ${err.message}` : "unknown error";
      console.warn(
        "Cloud sync failed to start" + (err ? ` [${err.context}]: ${err.message}` : ""),
        "— open the Admin panel's Cloud Sync section for details, or check this console for the exact Firebase error."
      );
      setSyncBadge(`Cloud sync failed: ${msg}`, "error");
    }
  });
} else {
  setSyncBadge("Cloud sync: OFF (no config)", "off");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(err => {
      console.warn("Service worker registration failed", err);
    });
  });

  // Once a newly-deployed service worker takes control of this page, reload
  // automatically so the visitor always ends up running the latest JS —
  // no more "still not working" from a stale cached script needing a
  // second manual refresh after a deploy.
  let refreshedOnce = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshedOnce) return;
    refreshedOnce = true;
    window.location.reload();
  });
}

const page = document.body.dataset.page;

async function boot() {
  try {
    switch (page) {
      case "fixtures": {
        const { initFixturesPage } = await import("./ui/render.fixtures.js");
        initFixturesPage();
        break;
      }
      case "live": {
        const { initLivePage } = await import("./ui/render.live.js");
        initLivePage();
        break;
      }
      case "umpire": {
        const { initUmpirePage } = await import("./ui/render.umpire.js");
        initUmpirePage();
        break;
      }
      case "register": {
        const { initRegisterPage } = await import("./ui/render.register.js");
        initRegisterPage();
        break;
      }
      case "admin": {
        const { initAdminPage } = await import("./ui/render.admin.js");
        initAdminPage();
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error(`Failed to initialize page "${page}"`, e);
    showFatalBanner(`Failed to load this page's script (${e.message}). Try a hard-refresh.`);
  }
}

boot();
