import { describe, expect, it } from 'vitest';
import { SCENES } from './index';

// GLSL ES 3.00 reserves these for future use; declaring one fails compilation,
// which in the browser only shows as a black scene. `active` already did once.
const RESERVED = [
  'active',
  'asm',
  'cast',
  'class',
  'common',
  'double',
  'enum',
  'extern',
  'external',
  'filter',
  'fixed',
  'goto',
  'half',
  'inline',
  'input',
  'interface',
  'long',
  'namespace',
  'noinline',
  'output',
  'partition',
  'public',
  'resource',
  'sample',
  'short',
  'sizeof',
  'static',
  'superp',
  'template',
  'this',
  'typedef',
  'union',
  'unsigned',
  'using',
  'varying',
  'attribute',
];
const DECLARED = /\b(?:float|int|uint|bool|[iu]?vec[234]|mat[234])\s+([A-Za-z_]\w*)/g;

describe('scenes', () => {
  it('have unique ids', () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SCENES.map((s) => [s.id, s.fragment] as const))(
    '%s declares no GLSL reserved word',
    (_id, source) => {
      const names = [...source.matchAll(DECLARED)].map((m) => m[1]);
      expect(names.filter((n) => n !== undefined && RESERVED.includes(n))).toEqual([]);
    },
  );
});
