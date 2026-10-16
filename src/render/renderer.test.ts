import { describe, expect, it } from 'vitest';
import { SCALARS } from './renderer';
import { SCENE_HEADER } from './scenes/common';

// A uniform declared in the header but never uploaded reads as 0 forever;
// one uploaded but not declared is silently dropped. Neither raises an error,
// the scene just stops responding to that part of the music.
describe('uniform contract', () => {
  it('uploads exactly the per-frame floats the scene header declares', () => {
    const declared = [...SCENE_HEADER.matchAll(/uniform float (\w+);/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(SCALARS).sort());
  });
});
