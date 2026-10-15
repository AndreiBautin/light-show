# Testing

`npm test` runs Vitest over `src/**/*.test.ts`.

## What is tested, and why

- **Band bin maths** (`bands.test.ts`): an off-by-one here would let the kick
  drive the treble while everything still "works".
- **Beat detection** (`beat.test.ts`): finds a 120 BPM synthetic kick and
  its tempo; stays quiet on a sustained tone and in noisy near-silence;
  honours the refractory period.
- **Flash limiter** (`flash.test.ts`): checked as a property over every
  one-second window, because it is the photosensitivity guarantee.
- **Show state** (`show.test.ts`): flash only when permitted, decay rate,
  stability after a long stall (background tab).
- **Config** (`config.test.ts`): typos fall back to defaults; the flash
  ceiling cannot be configured above 3.

## Deliberately not tested

- **The shader and renderer.** Their output is judged by eye; a pixel test
  would pin today's look and fail on every artistic change. A broken shader
  fails loudly (compile error shown on screen).
- **Web Audio adapters.** They are thin glue over browser APIs that Node
  cannot run; mocking `AnalyserNode` would only assert that we call it.
- **Beat accuracy on real music.** Needs a labelled corpus; the synthetic
  tracks cover the logic, not the tuning. Revisit with section detection.
