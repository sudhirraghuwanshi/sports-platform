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

## Enabling Cloud Sync (optional)
By default all data is stored in the browser's localStorage (per-device only).
To sync scores across devices in real time:
1. Create a Firebase project and enable Realtime Database.
2. In `js/core/sync.js`, call `init(firebaseConfig)` with your project's config
   (do this from an admin settings screen or directly in `app.js`).
3. Firebase client config keys are safe to expose publicly; secure your data
   using Firebase Realtime Database security rules instead.

## License
MIT
