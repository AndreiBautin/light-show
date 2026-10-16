# Architecture

Shape: **a pure core with thin adapters.** There is a real domain here —
musical analysis — so it is isolated; there is no persistence or server, so
there are no further layers.

| Folder               | Holds                                                                                                                                                                                                              | May import                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `src/analysis/`      | The musical core: bands, beats, structure, pitch, flash limiter, show state, the per-frame `ShowPipeline`, the scene director. Pure.                                                                               | nothing outside itself             |
| `src/audio/`         | Web Audio: demo synth, browser tab, mic, file → spectra                                                                                                                                                            | —                                  |
| `src/render/`        | WebGL2: GL helpers (`gl.ts`), scene programs (`renderer.ts`), bloom and composite (`bloom.ts`, `post.frag.ts`), the adaptive-resolution governor (`quality.ts`, pure), and one shader per screensaver in `scenes/` | `analysis` types                   |
| `src/render/scenes/` | The screensavers, each a shader on `SCENE_HEADER`                                                                                                                                                                  | `./common` only                    |
| `src/ui/`            | The page: panel, keys and touch, idle cursor, HUD, plus pure helpers for URLs, gestures and file checks                                                                                                            | the page only, not render or audio |
| `src/platform/`      | Clock, config, logger: the only homes for `performance.now`, `import.meta.env`, `console`                                                                                                                          | —                                  |
| `src/main.ts`        | Composition root: connects the above                                                                                                                                                                               | everything                         |

Each boundary is a lint rule in `eslint.config.js`, with a message saying why.

## One frame, end to end

1. `main.ts` `frame()` runs on `requestAnimationFrame`, reads the time from
   `platform/clock.ts`, and asks `render/quality.ts` `ResolutionGovernor`
   what scale to render at given the last frame's duration.
2. `audio/input.ts` `readSpectrum()` copies the `AnalyserNode` FFT
   (2048 points) into a 0..1 `Float32Array`.
3. `analysis/pipeline.ts` `ShowPipeline.feed()` runs the musical core:
   - `bands.ts` `computeBands()` averages bins into bass (20–150 Hz), mid
     (150–2000 Hz) and treble (2–12 kHz);
   - `beat.ts` `BeatDetector.feed()` compares bass to the mean + 1.4σ of the
     last second; a beat may become a flash only if `flash.ts`
     `FlashLimiter.tryFlash()` allows it (and never under reduced motion);
   - `structure.ts` `StructureTracker.feed()` compares ~1.5 s and ~15 s
     loudness to read intensity, build and drop; `pitch.ts` `tonalHeight()`
     gives the melody's register;
   - `show.ts` `stepShow()` folds it all into `ShowState`: slow envelopes and
     an integrated `flow` phase that music speeds up but never makes jump.
4. `analysis/director.ts` `SceneDirector.feed()` picks the screensaver and a
   fade brightness: auto mode moves on at a drop once a scene has played
   40 s (or after 120 s), dipping through black and swapping at the bottom.
5. `render/renderer.ts` `draw()` waits for that scene's program if it is
   still compiling, uploads the state as uniforms (the `SCALARS` table) and
   draws the scene as linear HDR into a float target at the governed scale.
6. `render/bloom.ts` builds a bloom mip chain from it, and the composite in
   `post.frag.ts` adds the bloom, applies the fade, tonemaps and dithers to
   the canvas.

## Offline and installable

`public/sw.js` is hand-written: it caches the page network-first and the
content-hashed assets cache-first as they load, so there is no precache
manifest to go stale or collide. Updates apply on the next load with no
prompt; a screensaver loses nothing by reloading onto new code. It registers
only in production builds (`config.serviceWorker`), and dev builds unregister
any leftover worker, because `npm run preview` shares the dev port and a
cache-first worker would serve stale dev modules there.

The deploy base path (`/<repo>/` on Pages) lives only in `vite.config.ts`;
the manifest, icons and worker use relative URLs.
