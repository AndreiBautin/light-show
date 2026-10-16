import { classifyTouch } from './gesture';

export interface ControlHandlers {
  step(direction: 1 | -1): void;
  toggleAuto(): void;
  togglePanel(): void;
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

/**
 * Keyboard shortcuts; on the stage, double-click for fullscreen; and on touch
 * screens, swipe to change scene and tap to show or hide the panel.
 */
export function bindControls(stage: HTMLElement, handlers: ControlHandlers): void {
  window.addEventListener('keydown', (e) => {
    // Leave browser and OS shortcuts alone, and keys meant for a focused control.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onControl = e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement;
    switch (e.key.toLowerCase()) {
      case 'f':
        toggleFullscreen();
        break;
      case 'h':
      case 'escape':
        handlers.togglePanel();
        break;
      case 'a':
        handlers.toggleAuto();
        break;
      case 'arrowright':
        if (!onControl) handlers.step(1);
        break;
      case 'arrowleft':
        if (!onControl) handlers.step(-1);
        break;
    }
  });

  stage.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
  });

  let start: { x: number; y: number; t: number } | undefined;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  });
  stage.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || !start) return;
    const gesture = classifyTouch(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t);
    start = undefined;
    if (gesture === 'next') handlers.step(1);
    else if (gesture === 'previous') handlers.step(-1);
    else if (gesture === 'tap') handlers.togglePanel();
  });
  stage.addEventListener('pointercancel', () => {
    start = undefined;
  });
}
