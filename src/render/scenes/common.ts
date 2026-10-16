/**
 * What every scene shader starts with: the uniforms the renderer sets each
 * frame (see SCALARS in renderer.ts), the output, and a few helpers. Scenes
 * write linear HDR colour; post.frag.ts adds bloom and tonemaps.
 *
 * Rules every scene follows:
 * - Motion runs on uFlow, an integrated phase. Never scale time by a level.
 * - No whole-screen brightness kick except through uFlash (the flash limiter).
 * - Nothing is tied to individual beats; music shapes rates, sizes and colour.
 */
export const SCENE_HEADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uFlow;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uIntensity;
uniform float uBuild;
uniform float uRelease;
uniform float uPitch;
uniform float uFlash;

out vec4 outColor;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
// Integer hash: much cheaper than the sin() hash inside long loops.
float ihash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return float(x) / 4294967295.0;
}
float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }

// The house palette: cyan through electric blue to magenta, as t goes 0..1.
vec3 neon(float t) {
  vec3 c = mix(vec3(0.05, 0.75, 1.0), vec3(0.12, 0.25, 1.0), smoothstep(0.0, 0.5, t));
  return mix(c, vec3(0.95, 0.12, 0.85), smoothstep(0.5, 1.0, t));
}

// Distance from p to segment ab, and where along it (0..1) the closest point is.
vec2 segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}
`;

export interface Scene {
  /** Stable id, used in the URL (?scene=echoes). */
  readonly id: string;
  /** Shown in the picker. */
  readonly name: string;
  /** One line for the picker: what you see, and what the music does to it. */
  readonly description: string;
  /** Full fragment shader source, starting with SCENE_HEADER. */
  readonly fragment: string;
}
