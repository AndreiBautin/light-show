export interface ControlHandlers {
  step(direction: 1 | -1): void;
  toggleAuto(): void;
  togglePanel(): void;
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

/** Keyboard shortcuts, and double-click on the stage for fullscreen. */
export function bindControls(stage: HTMLElement, handlers: ControlHandlers): void {
  window.addEventListener('keydown', (e) => {
    // Leave browser and OS shortcuts alone.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key.toLowerCase()) {
      case 'f':
        toggleFullscreen();
        break;
      case 'h':
        handlers.togglePanel();
        break;
      case 'a':
        handlers.toggleAuto();
        break;
      case 'arrowright':
        handlers.step(1);
        break;
      case 'arrowleft':
        handlers.step(-1);
        break;
    }
  });
  stage.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
  });
}
