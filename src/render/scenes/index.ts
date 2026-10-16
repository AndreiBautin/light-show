import type { Scene } from './common';
import { ECHOES } from './echoes';
import { STARFIELD } from './starfield';

export type { Scene } from './common';

/** Every screensaver, in the order auto mode plays them. Add a scene here. */
export const SCENES: readonly Scene[] = [ECHOES, STARFIELD];
