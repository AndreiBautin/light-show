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
 * A synthesised 124 BPM groove (kick, hat, pad) so the show can be tried
 * without a microphone or a file. Scheduled on the audio clock, a bar ahead.
 */
export function openDemo(): Promise<AudioInput> {
  const ctx = new AudioContext();
  const analyser = createAnalyser(ctx);
  const out = ctx.createGain();
  out.gain.value = 0.6;
  out.connect(analyser);
  analyser.connect(ctx.destination);

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
  const pad = (t: number, root: number): void => {
    for (const ratio of [1, 1.25, 1.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = root * ratio;
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.3);
      g.gain.linearRampToValueAtTime(0, t + beat * 4);
      osc.connect(lp).connect(g).connect(out);
      osc.start(t);
      osc.stop(t + beat * 4);
    }
  };

  let bar = 0;
  let nextBar = ctx.currentTime + 0.1;
  const schedule = (): void => {
    while (nextBar < ctx.currentTime + 1) {
      for (let i = 0; i < 4; i++) {
        kick(nextBar + i * beat);
        hat(nextBar + i * beat + beat / 2);
      }
      pad(nextBar, chords[bar % chords.length] ?? 220);
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
