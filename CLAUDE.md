# Light Show — notes for whoever comes next

- `npm run verify` must be green before reporting work done; the pre-push
  hook runs it.
- **`src/analysis/` is pure.** Time is a parameter, spectra are plain arrays.
  New musical logic goes here with tests; lint blocks DOM/adapter imports.
- **Never raise the flash ceiling.** `uFlash` is the only full-screen
  brightness kick and must only be set through `FlashLimiter`. Any new
  scene effect that brightens the whole screen on beats must go through it too.
- Port **5317** is pinned in `vite.config.ts`, `start-app.bat` and
  `.claude/launch.json` — change all three together.
- `stepShow` clamps frame gaps to 100 ms so a backgrounded tab does not
  produce a giant jump; tests that span >100 ms must step in smaller frames.
- **Never scale time by a music level in a shader.** Motion runs on
  `ShowState.flow`, an integrated phase; music changes its rate only.
  `uTime * level` makes the scene teleport minutes into a song.
- `erasableSyntaxOnly` is on: no TS parameter properties or enums.
- The demo source in `audio/input.ts` exists so the show (and its checks)
  work without a microphone; keep it.
- **New screensaver:** one file in `src/render/scenes/` built on
  `SCENE_HEADER` (read its rules), registered in `scenes/index.ts`. Scenes
  output linear HDR; `post.frag.ts` owns bloom and tonemapping. Keep each at
  60 fps: anything costly per-pixel but constant per frame (hashes, random
  constants) goes outside the inner loops.
- Browser-pane screenshots can show a cropped frame when the pane is scaled;
  pin the viewport (`resize_window`) before judging layout.
- **Service worker:** production only. `npm run preview` serves it on the dev
  port; dev builds unregister it again on load. If the dev app ever looks
  stale, check Application → Service workers first.
- Pushing `main` deploys to Pages after `verify`. The base path lives only in
  `vite.config.ts`; keep every other URL relative.
