// Composition root: the only file that wires adapters to the analysis core.
import { computeBands } from './analysis/bands';
import { BeatDetector } from './analysis/beat';
import { FlashLimiter } from './analysis/flash';
import { tonalHeight } from './analysis/pitch';
import { StructureTracker } from './analysis/structure';
import { INITIAL_SHOW, stepShow, type ShowState } from './analysis/show';
import { openDemo, openFile, openMicrophone, type AudioInput } from './audio/input';
import { createRenderer } from './render/renderer';
import { browserClock } from './platform/clock';
import { loadConfig } from './platform/config';
import { createLogger } from './platform/logger';

const { config, warnings } = loadConfig();
const log = createLogger(config.logLevel);
for (const w of warnings) log.warn('config.fallback', { detail: w });

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`missing #${id}`);
  return el;
}

const canvas = byId('stage', HTMLCanvasElement);
const intro = byId('intro', HTMLElement);
const status = byId('status', HTMLElement);
const micButton = byId('mic', HTMLButtonElement);
const demoButton = byId('demo', HTMLButtonElement);
const fileInput = byId('file', HTMLInputElement);

let input: AudioInput | undefined;
let beats = new BeatDetector();
let structure = new StructureTracker();
let flashes = new FlashLimiter(config.maxFlashesPerSecond);
let show: ShowState = INITIAL_SHOW;

const SILENT = { bass: 0, mid: 0, treble: 0 };

function frame(renderer: ReturnType<typeof createRenderer>): void {
  const now = browserClock();
  let bands = SILENT;
  let beat = false;
  let pitch: number | undefined;
  if (input) {
    const spectrum = input.readSpectrum();
    bands = computeBands(spectrum, input.sampleRate, input.fftSize);
    beat = beats.feed(now, bands.bass);
    pitch = tonalHeight(spectrum, input.sampleRate, input.fftSize);
  }
  const energy = 0.5 * bands.bass + 0.35 * bands.mid + 0.15 * bands.treble;
  const reading = structure.feed(now, energy);
  if (reading.release === 1) log.debug('show.drop', { atMs: Math.round(now) });
  const flashAllowed = beat && flashes.tryFlash(now);
  show = stepShow(show, { timeMs: now, bands, beat, flashAllowed, structure: reading, pitch });
  renderer.draw(show);
  requestAnimationFrame(() => {
    frame(renderer);
  });
}

async function start(open: () => Promise<AudioInput>, source: string): Promise<void> {
  input?.stop();
  input = undefined;
  status.textContent = 'Starting…';
  try {
    input = await open();
    beats = new BeatDetector();
    structure = new StructureTracker();
    flashes = new FlashLimiter(config.maxFlashesPerSecond);
    status.textContent = '';
    intro.classList.add('hidden');
    log.info('audio.started', { source, sampleRate: input.sampleRate });
  } catch (err) {
    const name = err instanceof Error ? err.name : 'unknown';
    log.warn('audio.failed', { source, error: name });
    status.textContent =
      name === 'NotAllowedError'
        ? 'Microphone permission was declined. Allow it in the browser, or play a file instead.'
        : 'Could not start audio. Try another file, or the microphone.';
  }
}

micButton.addEventListener('click', () => {
  void start(openMicrophone, 'mic');
});
demoButton.addEventListener('click', () => {
  void start(openDemo, 'demo');
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void start(() => openFile(file), 'file');
  fileInput.value = '';
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } else if (e.key === 'h' || e.key === 'H') {
    intro.classList.toggle('hidden');
  }
});
canvas.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
});

try {
  const renderer = createRenderer(canvas);
  frame(renderer);
} catch (err) {
  log.error('render.unavailable', { error: err instanceof Error ? err.name : 'unknown' });
  status.textContent = 'This browser cannot run the visuals (WebGL2 is unavailable).';
}
