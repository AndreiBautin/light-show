# Light Show

> **Status: idea.** Nothing is built yet. This README captures the concept so
> the project starts from a clear brief.

Feed it a song and it builds a light show synced to the music — on screen as
visuals, and on real smart bulbs where there are any. It hears the beat, the
drops and the quiet parts, and choreographs to them.

## The wow

Play a track you know and watch the show land exactly on the kick, build
through the riser and explode on the drop — then watch the room's lights do
the same.

## First version

- **Audio in**: drop in a file, or listen through the microphone.
- **Analysis**: tempo and beat grid, energy over time, and sections (intro,
  build, drop, breakdown).
- **Choreography**: visual scenes chosen per section, with effects fired on
  beats and accents.
- **On-screen show**: full-screen visuals that are the main event even with
  no lights.
- **Timeline view**: the song's structure drawn out, so you can see why the
  show does what it does.

## Later

- Smart bulbs (Hue, LIFX, Govee) following the show, with latency
  compensation.
- Hand-editing a show on the timeline and saving it.
- Themes and palettes per mood.
- Export a show as a video.

## The hard parts

- **Musical structure**, not just loudness: finding beats and section changes
  reliably across genres.
- **Timing**: visuals and especially network lights have delay that has to be
  measured and corrected for.
- **Taste**: choreography that feels designed rather than random flashing.
- **Accessibility**: a photosensitivity safeguard limiting flash rates.

## Related

[Spinner](https://github.com/AndreiBautin/dj-visualizer-generator) renders a
spinning-record video from a DJ mix. This is the live, music-reactive
counterpart; the two could share audio analysis later.

## Open questions

- Which smart lights, if any, are available to test with?
- Browser only, or a desktop app for lower-latency light control?
- Pre-analysed files only, or live microphone input from the start?
