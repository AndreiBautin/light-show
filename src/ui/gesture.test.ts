import { describe, expect, it } from 'vitest';
import { classifyTouch } from './gesture';

describe('classifyTouch', () => {
  it('reads a sideways swipe: left for next, right for previous', () => {
    expect(classifyTouch(-120, 10, 200)).toBe('next');
    expect(classifyTouch(120, -10, 200)).toBe('previous');
  });

  it('reads a short, still touch as a tap', () => {
    expect(classifyTouch(3, 4, 120)).toBe('tap');
  });

  // A diagonal drag or a slow press must not change the scene by accident.
  it('ignores diagonal drags, long holds and small wobbles', () => {
    expect(classifyTouch(-80, 70, 200)).toBe('none');
    expect(classifyTouch(-120, 0, 1500)).toBe('none');
    expect(classifyTouch(30, 0, 200)).toBe('none');
    expect(classifyTouch(2, 2, 600)).toBe('none');
  });
});
