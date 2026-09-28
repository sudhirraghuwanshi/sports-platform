// js/app.js
// Entry point: initializes store, service worker, and the correct page module
// based on which HTML page is loaded (each page includes this same script).
import * as store from "./core/store.js";
import * as sync from "./core/sync.js";

store.init();

const settings = store.get("settings");
if (settings?.cloudMode && settings?.firebaseConfig) {
  sync.init(settings.firebaseConfig).then(ok => {
    if (ok) console.info("Cloud sync enabled — updates will appear on all devices.");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(err => {
      console.warn("Service worker registration failed", err);
    });
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
