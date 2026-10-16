// Composition root: the only file that wires adapters to the analysis core.
import { SceneDirector } from './analysis/director';
import { ShowPipeline } from './analysis/pipeline';
import {
  canShareTabAudio,
  openDemo,
  openFile,
  openMicrophone,
  openTab,
  type AudioInput,
} from './audio/input';
import { browserClock } from './platform/clock';
import { loadConfig } from './platform/config';
import { createLogger } from './platform/logger';
import { ResolutionGovernor } from './render/quality';
import { createRenderer, type Renderer } from './render/renderer';
import { SCENES } from './render/scenes';
import { bindControls } from './ui/controls';
import { byId } from './ui/dom';
import { createHud } from './ui/hud';
import { hideCursorWhenIdle } from './ui/idle';
import { checkAudioFile } from './ui/file-check';
import { createPanel, type SourceId } from './ui/panel';
import { flagFromQuery, queryForScene, sceneFromQuery } from './ui/scene-url';

const { config, warnings } = loadConfig();
const log = createLogger(config.logLevel);
for (const w of warnings) log.warn('config.fallback', { detail: w });

const canvas = byId('stage', HTMLCanvasElement);
const pipeline = new ShowPipeline(config.maxFlashesPerSecond);
const governor = new ResolutionGovernor();
const hud = createHud(flagFromQuery(window.location.search, 'debug'));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
pipeline.setReducedMotion(reducedMotion.matches);
reducedMotion.addEventListener('change', () => {
  pipeline.setReducedMotion(reducedMotion.matches);
});
hideCursorWhenIdle(3000);

// A scene named in the URL is a choice: show it and stay on it.
const requested = sceneFromQuery(
  window.location.search,
  SCENES.map((s) => s.id),
);
const director = new SceneDirector(SCENES.length, requested ?? 0);
if (requested !== undefined) director.setAuto(false);

let input: AudioInput | undefined;
let shownScene = -1;
let lastFrameMs: number | undefined;

const panel = createPanel(
  SCENES,
  {
    onSource: (source, file) => {
      void start(source, file);
    },
    onPick: pick,
    onToggleAuto: toggleAuto,
  },
  { tabAudio: canShareTabAudio(), commit: config.commit },
);

function pick(index: number): void {
  director.setAuto(false);
  director.show(index, browserClock());
  syncChoice();
}

function toggleAuto(): void {
  director.setAuto(!director.auto);
  syncChoice();
}

function syncChoice(): void {
  panel.sync(director.target, director.auto);
  const id = director.auto ? undefined : SCENES[director.target]?.id;
  const query = queryForScene(window.location.search, id);
  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
}

bindControls(canvas, {
  step: (direction) => {
    pick(director.target + direction);
  },
  toggleAuto,
  togglePanel: () => {
    panel.toggle();
  },
});
syncChoice();

function frame(renderer: Renderer): void {
  const now = browserClock();
  const frameMs = lastFrameMs === undefined ? 0 : now - lastFrameMs;
  lastFrameMs = now;
  const scale = document.hidden ? governor.scale : governor.feed(frameMs);
  const { show, drop } = pipeline.feed(
    now,
    input && {
      spectrum: input.readSpectrum(),
      sampleRate: input.sampleRate,
      fftSize: input.fftSize,
    },
  );
  if (drop) log.debug('show.drop', { atMs: Math.round(now) });
  const cut = director.feed(now, drop);
  if (cut.scene !== shownScene) {
    shownScene = cut.scene;
    panel.caption(SCENES[cut.scene]?.name ?? '');
    syncChoice();
  }
  renderer.draw(show, cut.scene, cut.brightness, scale);
  hud.frame(frameMs, scale, SCENES[cut.scene]?.id ?? '');
  requestAnimationFrame(() => {
    frame(renderer);
  });
}

function open(source: SourceId, file: File | undefined): Promise<AudioInput> {
  switch (source) {
    case 'demo':
      return openDemo();
    case 'tab':
      return openTab();
    case 'mic':
      return openMicrophone();
    case 'file':
      return file ? openFile(file) : Promise.reject(new Error('no file'));
  }
}

async function start(source: SourceId, file?: File): Promise<void> {
  if (file) {
    const verdict = checkAudioFile(file.name, file.type, file.size);
    if (!verdict.ok) {
      log.warn('audio.file_rejected', { type: file.type, bytes: file.size });
      panel.setStatus(verdict.reason, 'error');
      return;
    }
  }
  input?.stop();
  input = undefined;
  panel.setSource(undefined);
  panel.setStatus(source === 'tab' ? 'Pick a tab, and tick "Share tab audio".' : 'Starting…');
  try {
    input = await open(source, file);
    pipeline.newSource();
    panel.setSource(source);
    panel.setStatus('');
    panel.setOpen(false);
    log.info('audio.started', { source, sampleRate: input.sampleRate });
  } catch (err) {
    const name = err instanceof Error ? err.name : 'unknown';
    log.warn('audio.failed', { source, error: name });
    panel.setStatus(failureMessage(source, name), 'error');
  }
}

/** What went wrong starting a source, and what to do about it. */
function failureMessage(source: SourceId, error: string): string {
  if (error === 'NoAudioError') {
    return 'That share had no sound. Try again and tick "Share tab audio" in the picker.';
  }
  if (error === 'NotAllowedError') {
    return source === 'tab'
      ? 'Sharing was cancelled. Pick a tab to try again, or use the demo track.'
      : 'Microphone permission was declined. Allow it from the address bar, or use a browser tab or a file.';
  }
  if (error === 'NotFoundError')
    return 'No microphone was found. Try a browser tab or a file instead.';
  if (source === 'file') return 'That file could not be played. Try an MP3, WAV or FLAC.';
  return 'Could not start the sound. Try the demo track, or another source.';
}

if (config.serviceWorker && 'serviceWorker' in navigator) {
  // Relative, so it works under whatever path the site is served from.
  navigator.serviceWorker.register('./sw.js').then(
    () => {
      log.info('pwa.worker_registered', {});
    },
    (err: unknown) => {
      log.warn('pwa.worker_failed', { error: err instanceof Error ? err.name : 'unknown' });
    },
  );
} else if ('serviceWorker' in navigator) {
  // `npm run preview` shares the dev port, so a production worker can be left
  // on this origin; its cache-first assets would serve stale dev modules.
  void navigator.serviceWorker.getRegistrations().then(async (regs) => {
    for (const reg of regs) await reg.unregister();
    if (regs.length > 0) log.info('pwa.worker_removed', { count: regs.length });
  });
}

try {
  const renderer = createRenderer(canvas, (scene, detail) => {
    // The first line of a GLSL info log is the error itself; no user content.
    log.error('render.scene_failed', { scene, detail: detail.split('\n')[0] ?? '' });
  });
  frame(renderer);
} catch (err) {
  log.error('render.unavailable', { error: err instanceof Error ? err.message : 'unknown' });
  panel.setStatus(
    'This browser cannot draw the visuals: WebGL2 is unavailable. Try a recent Chrome, Edge or Firefox with hardware acceleration on.',
    'error',
  );
}
