# Backlog

Hardening pass after the screensaver collection went live. Each item says
what was wrong and what done looks like; all are done, in git history.
Anything verified only partly says so.

## UI

- [x] **U1 Idle chrome.** The cursor and caption stay on screen during a
      screensaver. Done: cursor hides after 3 s still, returns on movement.
- [x] **U2 Panel layout.** Sources and scenes are one undifferentiated list.
      Done: labelled "Sound" and "Screensaver" sections, the active source
      marked, scene buttons with a one-line description on hover/focus.
- [x] **U3 Tab/system audio.** The only ways to feed real music are a mic
      (room noise) or a file. Done: a "Listen to a tab" source via
      `getDisplayMedia` audio, so Spotify/YouTube in another tab drives it.
      _Not verified end to end: the tab picker is a browser dialog the test
      browser cannot drive. The error paths are covered by messages per
      failure; the success path needs one try by hand in Chrome._
- [x] **U4 Touch.** Phones cannot change scene or reopen the panel. Done:
      swipe left/right changes scene, tap toggles the panel.
- [x] **U5 Accessibility.** No visible focus ring, no reduced-motion
      handling. Done: focus-visible styles, `prefers-reduced-motion` slows
      flow, buttons have accessible names and pressed state.
- [x] **U6 Error states.** WebGL failure and mic denial show bare text.
      Done: styled messages that say what to do next.

## Performance

- [x] **P1 Uniform lookups per frame.** The post passes call
      `getUniformLocation` every frame. Done: looked up once at link time.
- [x] **P2 Adaptive resolution.** A slow GPU drops frames with no recourse.
      Done: a pure controller lowers render scale when frames run long and
      raises it when there is headroom; renderer honours it.
- [x] **P3 Startup compile.** All six scenes compile before the first frame.
      Done: the first scene compiles first; the rest compile in idle time
      (using `KHR_parallel_shader_compile` where available).
- [x] **P4 Debug HUD.** Performance is impossible to check in the field.
      Done: `?debug` shows fps, render scale and scene.
- [x] **P5 Dead per-frame work.** `ShowState.pulse`/`beats` are computed
      and uploaded but no scene reads them. Done: removed.

## Security

- [x] **S1 Content-Security-Policy.** None today. Done: a strict CSP in the
      production HTML (`script-src 'self'`, no inline, no remote origins).
- [x] **S2 Service worker hygiene.** It caches any same-origin GET,
      including opaque or error responses, and old hashed assets forever.
      Done: only `basic` 200s cached; superseded assets pruned.
- [x] **S3 Untrusted file input.** Any file is decoded with no size or type
      check. Done: audio MIME and a size cap checked first, a clear message
      otherwise.
- [x] **S4 Supply chain.** No dependency update or audit. Done: Dependabot
      for npm and Actions, `npm audit` in CI, least-privilege workflow
      permissions.

## Clean code / architecture

- [x] **C1 main.ts does too much.** Loop, audio switching, picker, keys and
      caption in one file. Done: UI wiring in `src/ui/`, main is composition.
- [x] **C2 Duplicated GLSL.** `ihash` is copied into two scenes. Done: one
      copy in `SCENE_HEADER`.
- [x] **C3 Renderer is one function.** Scene programs, bloom chain and
      composite are tangled. Done: bloom/composite in their own module.
- [x] **C4 Scene boundary unenforced.** A scene could import anything.
      Done: lint lets `render/scenes/` import only `./common` and siblings.

## Test coverage

- [x] **T1 Uniform contract.** Nothing checks that the uniforms the header
      declares match what the renderer uploads. Done: a test that fails on
      a mismatch either way.
- [x] **T2 Director edges.** Untested: picking during a fade, toggling auto
      mid-fade, a single scene. Done: covered.
- [x] **T3 URL parsing.** `?scene=` handling lives in main and is untested.
      Done: pure, tested function.
- [x] **T4 Coverage floor.** No coverage measured. Done: v8 coverage with a
      floor on `src/analysis/` in `verify`.

## Documentation

- [x] **D1 README.** No live link or pictures. Done: link, screenshot,
      install-as-app instructions.
- [x] **D2 Scene catalogue.** What each scene does with the music is only in
      shader comments. Done: `docs/SCENES.md` table, plus how to add one.
- [x] **D3 Testing and architecture docs.** Out of date after this pass.
      Done: updated alongside each change.
- [x] **D4 Repo metadata.** No description, homepage or topics on GitHub.
      Done: set.

## Next

Proposed, not started:

- **Crossfade scenes** instead of dipping through black (render both during
  the change; costs a second scene draw for 1.6 s).
- **Per-scene settings** (speed, palette, density) remembered per browser.
- **More scenes**: a morphing "flowerbox" solid, 3D text with your own words,
  a fish-tank, original flying objects (not the trademarked toasters).
- **Tune the analysis on real music**: thresholds are set on synthetic
  tracks and the demo; a few genres by ear would sharpen drops and builds.
- **Share card**: an Open Graph image and description so the link previews
  well when posted.
