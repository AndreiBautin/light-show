/**
 * What we accept from the file picker, checked before anything decodes it.
 * The `accept` attribute is only a hint: drag-and-drop and "All files" bypass it.
 */

/** Large enough for an hour of lossless audio, small enough not to exhaust memory. */
export const MAX_AUDIO_BYTES = 300 * 1024 * 1024;

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'webm'];

export type FileVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export function checkAudioFile(name: string, type: string, size: number): FileVerdict {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  // Some systems report no MIME type at all, so fall back to the extension.
  const looksAudio = type.startsWith('audio/') || (type === '' && AUDIO_EXTENSIONS.includes(ext));
  if (!looksAudio)
    return { ok: false, reason: 'That file is not audio. Pick an MP3, WAV, FLAC or similar.' };
  if (size === 0) return { ok: false, reason: 'That file is empty.' };
  if (size > MAX_AUDIO_BYTES) return { ok: false, reason: 'That file is too large (over 300 MB).' };
  return { ok: true };
}
