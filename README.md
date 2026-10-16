# Light Show

Classic 90s/2000s screensavers, rebuilt in WebGL and played by your music.
Six scenes, all neon on black: **Echoes** (bouncing polygons with trails),
**Starfield** (warp on the drop), **Pipes**, **Ribbons**, **Rain** (digital
rain) and **Maze** (a corridor fly-through). Play the built-in demo track
(silent: it only drives the visuals), listen through the microphone, or drop
in a file.

Each scene reads the same musical state: bass, mids, treble, the melody's
register, and the song's structure (intensity, builds, drops). Auto mode
changes scene on a drop once a scene has had its run, dipping through black.
The beat itself never strobes the screen.

## Run it

Double-click **`start-app.bat`**. It installs dependencies on first run,
starts the dev server on <http://localhost:5317> and opens the browser.

Or: `npm install`, then `npm run dev`.

Keys: **← →** change screensaver · **A** auto on/off · **F** fullscreen ·
**H** hide the panel. `?scene=pipes` links straight to one scene.

`npm run verify` (typecheck, lint, format, tests, build) gates every push and
every deploy. Pushing to `main` deploys to GitHub Pages
(`.github/workflows/pages.yml`); the site installs as an app and works offline.

## The idea that makes it work

Every musical decision — band levels, beat detection, song structure, the
flash safety limit, which scene plays — is a **pure function of the spectrum
and a timestamp** in `src/analysis/`. Scenes never see time directly: they
move on `flow`, a phase the music speeds up but can never make jump. That is
why the detectors are tested against synthetic tracks instead of by ear, and
why every screensaver's trails, pipes and paths are a function of `flow`
alone, with nothing remembered between frames.

## Safety

Full-screen flashes are limited to 3 per second (WCAG 2.3.1) by
`FlashLimiter`; the limit can be lowered in `.env` but never raised.
