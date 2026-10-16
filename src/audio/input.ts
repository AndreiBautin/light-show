/**
 * Web Audio adapter. Turns a microphone or a file into a stream of
 * normalised spectra; knows nothing about beats or visuals.
 */

export const FFT_SIZE = 2048;

export interface AudioInput {
  readonly sampleRate: number;
  readonly fftSize: number;
  /** Fills and returns a 0..1 magnitude per bin (length FFT_SIZE / 2). */
  readSpectrum(): Float32Array;
  stop(): void;
}

function createAnalyser(ctx: AudioContext): AnalyserNode {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  // Light smoothing: enough to steady the bands, little enough to keep onsets sharp.
  analyser.smoothingTimeConstant = 0.35;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -15;
  return analyser;
}

function wrap(ctx: AudioContext, analyser: AnalyserNode, onStop: () => void): AudioInput {
  const bytes = new Uint8Array(analyser.frequencyBinCount);
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  return {
    sampleRate: ctx.sampleRate,
    fftSize: analyser.fftSize,
    readSpectrum() {
      analyser.getByteFrequencyData(bytes);
      for (let i = 0; i < bytes.length; i++) spectrum[i] = (bytes[i] ?? 0) / 255;
      return spectrum;
    },
    stop() {
      onStop();
      void ctx.close();
    },
  };
}

export async function openMicrophone(): Promise<AudioInput> {
  // Processing tuned for speech would duck and gate the music, so turn it off.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const analyser = createAnalyser(ctx);
  ctx.createMediaStreamSource(stream).connect(analyser);
  return wrap(ctx, analyser, () => {
    for (const track of stream.getTracks()) track.stop();
  });
}

export async function openFile(file: File): Promise<AudioInput> {
  const url = URL.createObjectURL(file);
  const element = new Audio(url);
  element.loop = true;
  const ctx = new AudioContext();
  const analyser = createAnalyser(ctx);
  const source = ctx.createMediaElementSource(element);
  source.connect(analyser);
  analyser.connect(ctx.destination);
  await element.play();
  return wrap(ctx, analyser, () => {
    element.pause();
    URL.revokeObjectURL(url);
  });
}

/**
 * A synthesised 124 BPM track (intro, build, drop, breakdown) so the show can be tried
 * without a microphone or a file. Scheduled on the audio clock, a bar ahead.
 *
 * Silent: the analyser still sees the full signal, but the speakers get it
 * through a zero gain. The graph must still reach the destination, or the
 * browser stops pulling audio through the analyser.
 */
export function openDemo(): Promise<AudioInput> {
  const ctx = new AudioContext();
  const analyser = createAnalyser(ctx);
  const out = ctx.createGain();
  out.gain.value = 0.6;
  out.connect(analyser);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  analyser.connect(mute).connect(ctx.destination);

  const beat = 60 / 124;
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;

  const kick = (t: number): void => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.4);
  };
  const hat = (t: number): void => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(hp).connect(g).connect(out);
    src.start(t);
  };
  const chords = [220, 174.6, 196, 164.8];
  const pad = (t: number, root: number, cutoffHz: number, level: number): void => {
    for (const ratio of [1, 1.25, 1.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = root * ratio;
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = cutoffHz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.3);
      g.gain.linearRampToValueAtTime(0, t + beat * 4);
      osc.connect(lp).connect(g).connect(out);
      osc.start(t);
      osc.stop(t + beat * 4);
    }
  };
  const lead = (t: number, hz: number): void => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + beat);
  };
  // A rising then falling phrase, so pitch-driven motion has something to follow.
  const melody = [440, 523, 659, 784, 880, 784, 659, 523];

  // 16-bar arrangement: intro, build, drop, breakdown. The show reads these as
  // structure, so the demo exercises builds and drops as well as beats.
  let bar = 0;
  let nextBar = ctx.currentTime + 0.1;
  const schedule = (): void => {
    while (nextBar < ctx.currentTime + 1) {
      const section = bar % 16;
      const root = chords[bar % chords.length] ?? 220;
      if (section < 4) {
        // Intro: soft, dark pad and a few hats.
        pad(nextBar, root, 600, 0.04);
        hat(nextBar + beat * 2.5);
      } else if (section < 8) {
        // Build: kick enters, hats double, the pad opens up bar by bar.
        const rise = (section - 4) / 4;
        pad(nextBar, root, 700 + 2500 * rise, 0.045 + 0.02 * rise);
        for (let i = 0; i < 4; i++) kick(nextBar + i * beat);
        const hats = section < 6 ? 4 : 8;
        for (let i = 0; i < hats; i++) hat(nextBar + (i * 4 * beat) / hats + beat / hats);
      } else if (section < 14) {
        // Drop: everything, with a melody.
        pad(nextBar, root, 3000, 0.07);
        for (let i = 0; i < 4; i++) kick(nextBar + i * beat);
        for (let i = 0; i < 8; i++) hat(nextBar + (i * beat) / 2 + beat / 4);
        for (let i = 0; i < 4; i++)
          lead(nextBar + i * beat, melody[(section * 4 + i) % melody.length] ?? 440);
      } else {
        // Breakdown: pad alone.
        pad(nextBar, root, 900, 0.035);
      }
      bar++;
      nextBar += beat * 4;
    }
  };
  schedule();
  const timer = setInterval(schedule, 250);
  return Promise.resolve(
    wrap(ctx, analyser, () => {
      clearInterval(timer);
    }),
  );
}
