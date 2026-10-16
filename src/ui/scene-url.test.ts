import { describe, expect, it } from 'vitest';
import { flagFromQuery, queryForScene, sceneFromQuery } from './scene-url';

const IDS = ['echoes', 'starfield', 'pipes'];

describe('sceneFromQuery', () => {
  it('finds a named scene, forgiving case and spaces', () => {
    expect(sceneFromQuery('?scene=pipes', IDS)).toBe(2);
    expect(sceneFromQuery('?scene=%20Starfield%20', IDS)).toBe(1);
  });

  // A shared link to a scene that was later renamed must fall back to auto,
  // not pin the viewer to scene 0 as if they had chosen it.
  it('treats an unknown or empty scene as no choice', () => {
    expect(sceneFromQuery('?scene=toasters', IDS)).toBeUndefined();
    expect(sceneFromQuery('?scene=', IDS)).toBeUndefined();
    expect(sceneFromQuery('', IDS)).toBeUndefined();
  });
});

describe('queryForScene', () => {
  it('sets and clears the scene, keeping other parameters', () => {
    expect(queryForScene('?debug', 'pipes')).toBe('?debug=&scene=pipes');
    expect(queryForScene('?scene=pipes&debug=1', undefined)).toBe('?debug=1');
    expect(queryForScene('?scene=pipes', undefined)).toBe('');
  });
});

describe('flagFromQuery', () => {
  it('reads a bare or truthy flag, and nothing else', () => {
    expect(flagFromQuery('?debug', 'debug')).toBe(true);
    expect(flagFromQuery('?debug=1', 'debug')).toBe(true);
    expect(flagFromQuery('?debug=0', 'debug')).toBe(false);
    expect(flagFromQuery('?debug=false', 'debug')).toBe(false);
    expect(flagFromQuery('?scene=pipes', 'debug')).toBe(false);
  });
});
