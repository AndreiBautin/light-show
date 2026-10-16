import { SCENE_HEADER, type Scene } from './common';

/**
 * Rain: falling columns of glyphs, the digital-rain look, in the house blue.
 * Three layers at different depths fall at different sizes and speeds, so the
 * rain has parallax; the far layer is dim and the near one bright.
 *
 * Glyphs are drawn from a 5x7 grid of hashed bits rather than a font, and each
 * cell swaps its glyph now and then. A column's head is white-hot and its
 * trail cools to blue.
 *
 * - Flow sets the fall speed, so a drop speeds the rain up.
 * - Treble: how many columns are falling. Pitch: tint, cyan toward magenta.
 */
export const RAIN: Scene = {
  id: 'rain',
  name: 'Rain',
  description: 'Digital rain in three depths. Hats bring more columns; the melody shifts the hue.',
  fragment:
    SCENE_HEADER +
    /* glsl */ `
// One glyph cell. local is 0..1 inside the cell; returns ink coverage 0..1.
float glyph(vec2 local, float id) {
  // 5x7 bits with a margin, mirrored left-right so shapes read as characters.
  vec2 g = local * vec2(7.0, 9.0) - vec2(1.0, 1.0);
  if (g.x < 0.0 || g.y < 0.0 || g.x >= 5.0 || g.y >= 7.0) return 0.0;
  vec2 bit = floor(g);
  float bx = min(bit.x, 4.0 - bit.x);
  float on = step(0.5, hash2(vec2(bx, bit.y) + id * 13.1));
  vec2 f = fract(g) - 0.5;
  return on * smoothstep(0.5, 0.3, max(abs(f.x), abs(f.y)));
}

vec3 layer(vec2 uv, float cols, float speed, float depth, float t, float lit) {
  vec2 p = uv * cols;
  float column = floor(p.x);
  float ch = hash(column * 1.31 + depth * 7.0);
  // Only some columns fall; more with the treble.
  float falling = step(ch, 0.3 + 0.35 * uTreble);
  float row = floor(p.y);
  vec2 local = fract(p);
  // Head position in rows, falling with flow; each column its own speed and phase.
  float v = speed * (0.6 + 0.8 * hash(column + 3.3));
  float head = fract(ch * 7.7 - t * v * 0.05) * (cols * 2.4) - cols * 0.7;
  float behind = row - head; // positive above the head, the way it fell from
  float len = 5.0 + 10.0 * hash(column + 9.1);
  float trail = behind >= 0.0 && behind < len ? pow(1.0 - behind / len, 1.6) : 0.0;
  float isHead = behind >= 0.0 && behind < 1.0 ? 1.0 : 0.0;
  float id = floor(hash2(vec2(column, row)) * 50.0 + t * (0.5 + hash2(vec2(row, column))));
  float ink = glyph(local, id);
  vec3 tint = neon(clamp(uPitch * 0.8 + (hash(column) - 0.5) * 0.3, 0.0, 1.0));
  vec3 c = tint * trail * falling + vec3(0.8, 0.95, 1.0) * isHead * falling * 1.6;
  return c * ink * depth * lit;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uFlow;
  float lit = 0.5 + 0.5 * uIntensity;
  vec3 col = vec3(0.0);
  // Far to near: smaller, slower, dimmer at the back. Offsets keep columns from lining up.
  col += layer(uv + vec2(0.37, 0.0), 64.0, 0.6, 0.25, t, lit);
  col += layer(uv + vec2(0.11, 0.0), 40.0, 0.9, 0.55, t, lit);
  col += layer(uv, 24.0, 1.3, 1.0, t, lit);
  col *= 1.0 + 0.05 * uFlash;
  outColor = vec4(col, 1.0);
}
`,
};
