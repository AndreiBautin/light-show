import { byId } from './dom';

export type SourceId = 'demo' | 'tab' | 'mic' | 'file';

export interface PanelScene {
  readonly name: string;
  readonly description: string;
}

export interface PanelHandlers {
  onSource(source: SourceId, file?: File): void;
  onPick(index: number): void;
  onToggleAuto(): void;
}

export type StatusKind = 'info' | 'error';

export interface Panel {
  /** Reflect which scene is chosen and whether auto mode is on. */
  sync(target: number, auto: boolean): void;
  /** Mark the sound source that is playing, or none. */
  setSource(source: SourceId | undefined): void;
  setStatus(text: string, kind?: StatusKind): void;
  setOpen(open: boolean): void;
  toggle(): void;
  /** Briefly name the scene that just came on. */
  caption(text: string): void;
}

/** The intro panel: sound sources, the scene picker, auto mode, status line and caption. */
export function createPanel(
  scenes: readonly PanelScene[],
  handlers: PanelHandlers,
  options: { readonly tabAudio: boolean; readonly commit: string | undefined },
): Panel {
  const intro = byId('intro', HTMLElement);
  const status = byId('status', HTMLElement);
  const picker = byId('scenes', HTMLElement);
  const about = byId('scene-about', HTMLElement);
  const autoButton = byId('auto', HTMLButtonElement);
  const captionEl = byId('caption', HTMLElement);
  const fileInput = byId('file', HTMLInputElement);
  const fileLabel = byId('file-label', HTMLElement);

  const sourceButtons = {
    demo: byId('demo', HTMLButtonElement),
    tab: byId('tab', HTMLButtonElement),
    mic: byId('mic', HTMLButtonElement),
  } as const;
  sourceButtons.tab.hidden = !options.tabAudio;
  if (options.commit) byId('build', HTMLElement).textContent = ` · build ${options.commit}`;
  for (const [id, button] of Object.entries(sourceButtons)) {
    button.addEventListener('click', () => {
      handlers.onSource(id as keyof typeof sourceButtons);
    });
  }
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handlers.onSource('file', file);
    fileInput.value = '';
  });

  let target = 0;
  const describe = (i: number): void => {
    about.textContent = scenes[i]?.description ?? '';
  };
  const sceneButtons = scenes.map((scene, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = scene.name;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      handlers.onPick(i);
    });
    // Preview a scene's description on hover or focus; fall back to the chosen one.
    button.addEventListener('pointerenter', () => {
      describe(i);
    });
    button.addEventListener('focus', () => {
      describe(i);
    });
    button.addEventListener('pointerleave', () => {
      describe(target);
    });
    button.addEventListener('blur', () => {
      describe(target);
    });
    picker.append(button);
    return button;
  });
  autoButton.addEventListener('click', () => {
    handlers.onToggleAuto();
  });

  let captionTimer: number | undefined;

  return {
    sync(next, auto) {
      target = next;
      sceneButtons.forEach((b, i) => {
        b.setAttribute('aria-pressed', String(i === next));
      });
      describe(next);
      autoButton.setAttribute('aria-pressed', String(auto));
    },
    setSource(source) {
      for (const [id, button] of Object.entries(sourceButtons)) {
        button.setAttribute('aria-pressed', String(id === source));
      }
      fileLabel.classList.toggle('active', source === 'file');
    },
    setStatus(text, kind = 'info') {
      status.textContent = text;
      status.dataset.kind = kind;
      // Errors interrupt a screen reader; progress messages wait their turn.
      status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      if (text && kind === 'error') intro.classList.remove('hidden');
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
