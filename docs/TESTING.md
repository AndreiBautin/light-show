# Testing

`npm test` runs Vitest over `src/**/*.test.ts`.

## What is tested, and why

- **Band bin maths** (`bands.test.ts`): an off-by-one here would let the kick
  drive the treble while everything still "works".
- **Beat detection** (`beat.test.ts`): finds a 120 BPM synthetic kick and
  its tempo; stays quiet on a sustained tone and in noisy near-silence;
  honours the refractory period.
- **Song structure** (`structure.test.ts`): one drop at a quiet-to-loud
  change, none on steady music at any level (the false-positive that would
  make the show fire constantly), build during a rise, low intensity in a
  breakdown, no NaN in silence.
- **Tonal height** (`pitch.test.ts`): ordering of notes, equal octaves, the
  kick not dragging the melody down, no answer in silence.
- **Flow** (`show.test.ts`): the phase never jumps however suddenly the
  music changes.
- **Flash limiter** (`flash.test.ts`): checked as a property over every
  one-second window, because it is the photosensitivity guarantee.
- **Show state** (`show.test.ts`): flash only when permitted, decay rate,
  stability after a long stall (background tab).
- **Config** (`config.test.ts`): typos fall back to defaults; the flash
  ceiling cannot be configured above 3.

## Deliberately not tested

- **The shaders and renderer.** Their output is judged by eye; a pixel test
  would pin today's look and fail on every artistic change. A scene that fails
  to compile is logged (`render.scene_failed`) and drawn black while the rest
  keep working. The one cheap static check that pays is in
  `scenes/scenes.test.ts`: GLSL reserved words used as names, which shipped
  once and only showed as a black screen.
- **The service worker.** Verified by hand against a production build
  (registered, controlling, renders with the server stopped); Node has no
  worker runtime to test it in.
- **Web Audio adapters.** They are thin glue over browser APIs that Node
  cannot run; mocking `AnalyserNode` would only assert that we call it.
- **Structure and pitch on real music.** The thresholds are tuned on
  synthetic curves and the demo track; real genres will need tuning by ear.
- **Beat accuracy on real music.** Needs a labelled corpus; the synthetic
  tracks cover the logic, not the tuning. Revisit with section detection.
