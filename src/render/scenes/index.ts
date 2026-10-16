import type { Scene } from './common';
import { ECHOES } from './echoes';
import { MAZE } from './maze';
import { PIPES } from './pipes';
import { RAIN } from './rain';
import { RIBBONS } from './ribbons';
import { STARFIELD } from './starfield';

export type { Scene } from './common';

/** Every screensaver, in the order auto mode plays them. Add a scene here. */
export const SCENES: readonly Scene[] = [ECHOES, STARFIELD, PIPES, RIBBONS, RAIN, MAZE];
