# Light Show

Abstract light that moves with your music, in the browser. Play the built-in
demo beat, listen through the microphone, or drop in a file, and slow, gooey
blobs of teal and violet light rise and merge in the dark like a lava lamp:
the bass swells them, busier music quickens their drift, and each beat
warms their cores a little.

## Run it

Double-click **`start-app.bat`**. It installs dependencies on first run,
starts the dev server on <http://localhost:5317> and opens the browser.

Or: `npm install`, then `npm run dev`. Press **F** for fullscreen, **H** to
hide the panel.

`npm run verify` (typecheck, lint, format, tests, build) gates every push.

## The idea that makes it work

Every musical decision — band levels, beat detection, the flash safety limit,
how the show state evolves — is a **pure function of the spectrum and a
timestamp** in `src/analysis/`. The browser only supplies spectra and draws
the result. That is why the beat detector is tested against synthetic kick
tracks instead of by ear, and why lint forbids `analysis/` from touching the
DOM, Web Audio or the clock.

## Safety

Full-screen flashes are limited to 3 per second (WCAG 2.3.1) by
`FlashLimiter`; the limit can be lowered in `.env` but never raised.

## Roadmap

See the original brief in git history (`899fa3a`): section detection
(build/drop), more scenes chosen per section, a timeline view, smart bulbs.
