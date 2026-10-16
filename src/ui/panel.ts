import { byId } from './dom';

export type SourceId = 'demo' | 'mic' | 'file';

export interface PanelHandlers {
  onSource(source: SourceId, file?: File): void;
  onPick(index: number): void;
  onToggleAuto(): void;
}

export interface Panel {
  /** Reflect which scene is chosen and whether auto mode is on. */
  sync(target: number, auto: boolean): void;
  setStatus(text: string): void;
  setOpen(open: boolean): void;
  toggle(): void;
  /** Briefly name the scene that just came on. */
  caption(text: string): void;
}

/** The intro panel: sound sources, the scene picker, auto mode, status line and caption. */
export function createPanel(sceneNames: readonly string[], handlers: PanelHandlers): Panel {
  const intro = byId('intro', HTMLElement);
  const status = byId('status', HTMLElement);
  const picker = byId('scenes', HTMLElement);
  const autoButton = byId('auto', HTMLButtonElement);
  const captionEl = byId('caption', HTMLElement);
  const fileInput = byId('file', HTMLInputElement);

  byId('demo', HTMLButtonElement).addEventListener('click', () => {
    handlers.onSource('demo');
  });
  byId('mic', HTMLButtonElement).addEventListener('click', () => {
    handlers.onSource('mic');
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handlers.onSource('file', file);
    fileInput.value = '';
  });

  const sceneButtons = sceneNames.map((name, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', () => {
      handlers.onPick(i);
    });
    picker.append(button);
    return button;
  });
  autoButton.addEventListener('click', () => {
    handlers.onToggleAuto();
  });

  let captionTimer: number | undefined;

  return {
    sync(target, auto) {
      sceneButtons.forEach((b, i) => b.classList.toggle('active', i === target));
      autoButton.classList.toggle('active', auto);
      autoButton.textContent = auto ? 'Auto: on' : 'Auto: off';
    },
    setStatus(text) {
      status.textContent = text;
    },
    setOpen(open) {
      intro.classList.toggle('hidden', !open);
    },
    toggle() {
      intro.classList.toggle('hidden');
    },
    caption(text) {
      captionEl.textContent = text;
      captionEl.classList.add('visible');
      window.clearTimeout(captionTimer);
      captionTimer = window.setTimeout(() => {
        captionEl.classList.remove('visible');
      }, 2500);
    },
  };
}
