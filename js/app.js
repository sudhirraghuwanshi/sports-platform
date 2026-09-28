// js/app.js
// Entry point: initializes store, service worker, and the correct page module
// based on which HTML page is loaded (each page includes this same script).
import * as store from "./core/store.js";
import * as sync from "./core/sync.js";
import { firebaseConfig } from "./config/firebase.config.js";

store.init();

// Cloud sync auto-connects for every visitor using the config baked into
// js/config/firebase.config.js (no per-device setup required). An admin can
// still override this at runtime via the Admin panel's Cloud Sync form,
// which takes priority if it has been explicitly configured there.
const settings = store.get("settings");
const activeFirebaseConfig = settings?.cloudMode && settings?.firebaseConfig
  ? settings.firebaseConfig
  : firebaseConfig;

if (activeFirebaseConfig?.apiKey) {
  sync.init(activeFirebaseConfig).then(ok => {
    if (ok) console.info("Cloud sync enabled — updates will appear on all devices.");
  });
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
}

boot();
