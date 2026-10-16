# Interview guide

Everything here is true of the repository as it stands. If a claim is not
in the code, it is not in this document.

## 30 seconds

> "Light Show is the classic 90s and 2000s screensavers, Mystify, Pipes,
> Starfield, the Maze, rebuilt in WebGL and driven by music. You give it
> sound, a browser tab playing Spotify, the mic or a file, and it reads the
> bass, mids, treble, the melody's register and the song's structure, so a
> drop can send the starfield into warp or move it on to the next
> screensaver. It's a static site with no server, installable and offline,
> and the musical logic is a pure, tested core that the shaders just read."

## Lead with these three points

1. **A pure core with thin adapters.** Every musical decision lives in
   `src/analysis/` as plain functions of a spectrum and a timestamp. Lint
   forbids that folder from touching the DOM, Web Audio or the clock, so I
   test beat and drop detection against synthetic tracks, not by ear.
2. **Motion is an integrated phase.** Scenes never see time; they see
   `flow`, which music speeds up but can't make jump. The naive
   `time * loudness` teleports the picture minutes into a song. That one
   decision is also why every scene's trails, pipes and paths are a
   function of `flow` with nothing remembered between frames.
3. **Safety is a tested guarantee.** Full-screen flashes are capped at 3 a
   second (the WCAG limit) by a limiter that's checked as a property over
   every one-second window, end to end, and reduced-motion turns flashes
   off entirely.

## One frame, end to end

`main.ts` runs each frame on `requestAnimationFrame`. It reads the time from
`platform/clock.ts` and copies the analyser's FFT through `audio/input.ts`.
`analysis/pipeline.ts` turns that into bands (`bands.ts`), a beat
(`beat.ts`, which only ever feeds the flash limiter), structure
(`structure.ts`: intensity, build, drop), pitch (`pitch.ts`), and folds it
into a smoothed `ShowState` in `show.ts`. `analysis/director.ts` decides
which screensaver is on and the fade brightness. `render/renderer.ts`
uploads the state as uniforms and draws the scene shader into a float
texture at a resolution `render/quality.ts` chooses from frame times, then
`render/bloom.ts` adds bloom and tonemaps to the screen.

## Decisions and trade-offs

| Decision                                  | Alternatives                             | Why                                                                                                    | Trade-off                                                                  |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Pure analysis core, time passed in        | Logic inside the render loop             | Deterministic, unit-testable with synthetic signals                                                    | A little plumbing: `ShowPipeline` exists to carry state                    |
| `flow` phase instead of `time × level`    | Scaling time by loudness                 | Music changes speed, never position, so nothing jumps                                                  | Can't seek: the picture depends on the whole history of the song           |
| Raw WebGL2 and GLSL, no engine            | Three.js, a canvas library               | 50 KB bundle, no runtime dependencies, full control of every pixel                                     | No scene graph: Pipes draws tubes as screen-space impostors I had to write |
| Scenes are stateless functions of `flow`  | Simulations that update state each frame | Echo trails and growing pipes are just the same function at earlier `flow`; nothing to store or desync | Per-pixel recomputation: Pipes re-walks its pipes for every pixel          |
| Scene change on a drop, dip through black | Fixed timer, hard cut                    | Changes land on a musical moment; the swap happens at zero brightness                                  | A song with no drops changes only at the 2-minute ceiling                  |
| Hand-written service worker               | Workbox precache                         | 75 lines, nothing to go stale, no precache manifest to brick on a duplicate                            | Offline only after one full load                                           |
| GitHub Pages                              | Cloudflare, Netlify, Vercel              | Static site, repo already on GitHub, no new account or secret                                          | No response headers: CSP must be a meta tag, no HSTS or `frame-ancestors`  |
| Adaptive render scale                     | Fixed resolution                         | Holds frame rate on weak GPUs                                                                          | Picture softens when it steps down                                         |

## Security, in one breath

"There's no server, so most of the usual list is absent by construction:
no accounts, no database, nothing to inject into. The real risks are script
injection, which could reach a granted microphone, so there's a strict CSP
with no inline script and the DOM is only written with `textContent`;
untrusted input, so picked files are type- and size-checked before
decoding; and the supply chain, so there are no runtime dependencies,
actions are pinned to SHAs, and CI runs an audit and a full-history secret
scan." Details: `docs/SECURITY.md`.

## Data

There is none to persist: no database, no storage, no accounts. Audio is
analysed in the browser and discarded. The only "demo data" is a silent
synthesised track (`audio/input.ts`) with an intro, build, drop and
breakdown, so every reaction can be seen without a microphone.

## Deployment

Push to `main` runs verify, builds with the Pages base path and commit,
deploys, then a smoke test fetches the live site until it serves that
commit and checks the CSP, manifest and worker. CI separately runs verify,
`npm audit` and gitleaks on every push and PR, and branch protection
requires them. Details: `docs/DEPLOYMENT.md`.

## Testing

67 tests across 15 files, with a coverage floor on the pure modules
(95% lines; 99% today). What I'd point at: the flash limit tested as a
property; drop detection that must not fire on steady music at any level;
a director test that caught a real bug, where changing scene mid-fade
flashed the old scene back for a frame; and a contract test that the
shader's uniforms match what the renderer uploads, because that fails
silently. Deliberately not tested: shader output (judged by eye; a pixel
test would pin today's look), and the Web Audio adapters. Details:
`docs/TESTING.md`.

## Deliberate simplifications

| Not built                  | Why not                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| A backend or accounts      | Nothing needs saving; a server would only add risk and cost                                    |
| Beat-synced strobing       | The brief was "not on the nose", and it is the photosensitivity risk                           |
| A crossfade between scenes | Would draw two scenes at once for 1.6 s; the dip through black is cheaper and reads well       |
| Saved settings             | Nothing to set yet; scene links (`?scene=`) cover sharing                                      |
| WebGPU or a CPU fallback   | WebGL2 with float targets covers current desktop browsers; anything older gets a clear message |
| Real-music tuning corpus   | Thresholds are tuned on synthetic tracks and the demo; noted as the main open item             |

## Likely questions

**"Isn't this over-engineered for a screensaver?"**
"The structure is small: one pure folder and thin adapters. It earns its
place because the hard part, deciding what the music is doing, is the part
I can't eyeball. Without the pure core, I couldn't have tested that a drop
fires once and not on every loud bar."

**"What's the weakest part?"**
"The analysis thresholds. They're tuned on synthetic tracks and my demo, so
on some genres a drop will be missed or a build read late. The next step
would be a small labelled set of real songs."

**"How does it hold 60 fps?"**
"Each scene is one full-screen shader, and the costly ones are written to
keep work out of the inner loops. Echoes went from 29 to 60 fps by
hashing its per-vertex constants once per pixel instead of once per echo. There's a
governor that lowers render scale if frames run long, and `?debug` shows
it live."

**"What would you do differently?"**
"I'd have built the scene system first. I started with one scene and
reworked it several times before the shape settled into 'a shader plus a
registry'."

**"How do you know the deploy works?"**
"The workflow doesn't trust its own green tick: after deploying it fetches
the live page until it serves that commit, and checks the CSP, manifest
and worker are there."

## Things not to say

- Not "it detects BPM": the detector estimates tempo but nothing uses it.
- Not "works in every browser": it needs WebGL2 with float render targets;
  tab audio is Chromium-only.
- Not "production-ready" or "AI": say what is deployed, tested and
  documented.
- Not "the beat drives the visuals": the beat only gates the rate-limited
  flash; bands, structure and pitch drive everything else.
- Not "offline from the first visit": offline after one full load.
