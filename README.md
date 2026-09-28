# Sports Platform

A lightweight, static, multi-sport fixtures & live scoring platform for 9 sports
(Badminton, Tennis, Table Tennis, Squash, Snooker, Billiards, Carrom, Chess, Swimming, Cricket),
built with vanilla JS/HTML/CSS and deployable on GitHub Pages with no backend required.

## Features
- Fixture creation & management (Admin)
- Live scoring console for umpires (passcode-gated per fixture)
- Public live scoreboard & fixtures list with sport/category/status filters
- Sport-specific scoring engines (sets, frames, boards, overs, timed results)
- Offline-first PWA (installable, service-worker cached app shell)
- Data stored locally (localStorage) by default; optional Firebase Realtime Database sync for cross-device updates

## Project Structure
```
index.html          Landing page
fixtures.html        Fixture list + filters
live.html            Live scoreboard (spectator)
umpire.html          Umpire scoring console (passcode required)
admin.html           Admin panel (participants, fixtures)
manifest.json        PWA manifest
service-worker.js    Offline caching
css/                 base, layout, components, sport-themes
js/config/           sports.config.js — sport & category definitions
js/core/             store.js, models.js, auth.js, sync.js, utils.js
js/scoring/          scoring.engine.js + per-sport scorers
js/ui/               render.*.js per page + filters.js
data/seed.json       Example seed data (optional import)
```

## Running Locally
No build step required. Serve the folder with any static server, e.g.:
```
npx serve .
```
or Python:
```
python3 -m http.server 8000
```
Then open http://localhost:8000

## Default Admin Password
The first time you open admin.html, a default password `admin123` is set automatically.
**Change this before real use** by clearing `localStorage` key `sp_admin_pass` and calling
`auth.setAdminPassword('yourNewPassword')` from the browser console, or edit
[js/ui/render.admin.js](js/ui/render.admin.js).

## Deploying to GitHub Pages
1. Push this repository to GitHub (see commands below).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then **Save**.
5. Wait for the green checkmark under the **Actions** tab, then visit:
   `https://<your-username>.github.io/<repo-name>/`

## Enabling Cloud Sync (optional, for cross-device live updates)
By default all data is stored in the browser's localStorage — **each device/browser has
its own separate copy**, which is why scores entered on one phone/laptop won't show up
on another. To make live scores, fixtures, and registrations sync across **every visitor
automatically, with zero per-device setup**:

1. Go to the [Firebase Console](https://console.firebase.google.com/), create a free project.
2. In the project, open **Build → Realtime Database** and click **Create Database**
   (choose test mode to start, then tighten security rules before going live).
3. Open **Project settings → General**, scroll to "Your apps", click the web icon (`</>`)
   to register a web app, and copy the resulting config values
   (apiKey, authDomain, databaseURL, projectId, appId, etc.).
4. Paste those values into [js/config/firebase.config.js](js/config/firebase.config.js)
   in this repo, commit, and push:
   ```js
   export const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.firebaseio.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456"
   };
   ```
5. Once deployed, **every visitor's browser auto-connects** to the same shared
   database on page load — no admin login or per-device configuration required.
   Fixtures, live scores, and registrations will sync in real time everywhere.

Firebase client config keys are safe to commit/expose publicly; secure your data
using Firebase Realtime Database security rules instead of hiding the config.
The Admin panel also has an optional "Cloud Sync" override form if you ever want
a single browser to temporarily point at a different database for testing.

## License
MIT
