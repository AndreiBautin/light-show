# Architecture

Shape: **a pure core with thin adapters.** There is a real domain here —
musical analysis — so it is isolated; there is no persistence or server, so
there are no further layers.

| Folder          | Holds                                                                                     | May import             |
| --------------- | ----------------------------------------------------------------------------------------- | ---------------------- |
| `src/analysis/` | Bands, beat detection, flash limiter, show state. Pure.                                   | nothing outside itself |
| `src/audio/`    | Web Audio: mic, file, demo synth → spectra                                                | —                      |
| `src/render/`   | WebGL2 renderer, scene and post shaders                                                   | `analysis` types       |
| `src/platform/` | Clock, config, logger: the only homes for `performance.now`, `import.meta.env`, `console` | —                      |
| `src/main.ts`   | Composition root and UI wiring                                                            | everything             |

The rules are in `eslint.config.js`, each with a message saying why.

## One frame, end to end

1. `main.ts` `frame()` runs on `requestAnimationFrame` and reads the time from
   `platform/clock.ts`.
2. `audio/input.ts` `readSpectrum()` copies the `AnalyserNode` FFT
   (2048 points) into a 0..1 `Float32Array`.
3. `analysis/bands.ts` `computeBands()` averages bins into bass (20–150 Hz),
   mid (150–2000 Hz) and treble (2–12 kHz).
4. `analysis/beat.ts` `BeatDetector.feed()` compares bass energy to the
   mean + 1.4σ of the last second, with a 300 ms refractory period.
5. On a beat, `analysis/flash.ts` `FlashLimiter.tryFlash()` decides whether a
   full-screen flash is allowed.
6. `analysis/structure.ts` `StructureTracker.feed()` compares ~1.5 s and ~15 s
   loudness averages to read intensity, build and drop (release);
   `analysis/pitch.ts` `tonalHeight()` gives the melody's register.
7. `analysis/show.ts` `stepShow()` folds all of it into `ShowState`: slow
   envelopes and an integrated `flow` phase that music speeds up but never
   jumps.
8. `render/renderer.ts` `draw()` uploads the state as uniforms (the `SCALARS`
   table maps each to its field);
   `render/scene.frag.ts` draws the shapes as linear HDR into a float target,
   and `render/post.frag.ts` builds a bloom mip chain from it and tonemaps to
   the screen.
