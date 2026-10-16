/**
 * The ?debug overlay: frame rate, render scale and scene, so performance can
 * be checked on a real machine without devtools.
 */
export interface Hud {
  frame(frameMs: number, scale: number, scene: string): void;
}

export function createHud(enabled: boolean): Hud {
  if (!enabled) return { frame: () => undefined };
  const el = document.createElement('div');
  el.id = 'hud';
  document.body.append(el);
  let frames = 0;
  let elapsed = 0;
  return {
    frame(frameMs, scale, scene) {
      frames++;
      elapsed += frameMs;
      // Update twice a second: a number that changes every frame is unreadable.
      if (elapsed < 500) return;
      const fps = (frames * 1000) / elapsed;
      el.textContent = `${fps.toFixed(0)} fps · ${Math.round(scale * 100)}% · ${scene}`;
      frames = 0;
      elapsed = 0;
    },
  };
}
