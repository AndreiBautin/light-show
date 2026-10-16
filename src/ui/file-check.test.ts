import { describe, expect, it } from 'vitest';
import { MAX_AUDIO_BYTES, checkAudioFile } from './file-check';

describe('checkAudioFile', () => {
  it('accepts audio by MIME type, or by extension when the type is missing', () => {
    expect(checkAudioFile('song.mp3', 'audio/mpeg', 5e6).ok).toBe(true);
    expect(checkAudioFile('Song.FLAC', '', 5e6).ok).toBe(true);
  });

  // "All files" in the picker, or a drag, hands us anything at all.
  it('rejects non-audio, even with an audio-looking name', () => {
    expect(checkAudioFile('notes.txt', 'text/plain', 100).ok).toBe(false);
    expect(checkAudioFile('trick.mp3', 'application/x-msdownload', 100).ok).toBe(false);
    expect(checkAudioFile('noext', '', 100).ok).toBe(false);
  });

  it('rejects empty and oversized files', () => {
    expect(checkAudioFile('a.wav', 'audio/wav', 0).ok).toBe(false);
    expect(checkAudioFile('a.wav', 'audio/wav', MAX_AUDIO_BYTES + 1).ok).toBe(false);
  });
});
