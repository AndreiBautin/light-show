/**
 * Screensaver manners: once nothing has moved for a while, hide the cursor.
 * Any pointer movement or key brings it straight back.
 */
export function hideCursorWhenIdle(afterMs: number): void {
  let timer: number | undefined;
  const wake = (): void => {
    document.body.classList.remove('idle');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      document.body.classList.add('idle');
    }, afterMs);
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown'] as const) {
    window.addEventListener(type, wake, { passive: true });
  }
  wake();
}
