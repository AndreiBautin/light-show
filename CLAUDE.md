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
- `erasableSyntaxOnly` is on: no TS parameter properties or enums.
- The demo source in `audio/input.ts` exists so the show (and its checks)
  work without a microphone; keep it.
