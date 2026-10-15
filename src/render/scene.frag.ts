/**
 * "Deep Lamp": slow, gooey blobs of cool light rising and merging in the dark,
 * like a lava lamp seen underwater.
 *
 * Motion runs on uFlow, an integrated phase, so the music can change the pace
 * but never make the scene jump. Everything reacts gently:
 * - Bass swells the blobs and their glow.
 * - Mid (via uFlow) sets the drift speed.
 * - Treble adds a faint shimmer to the blob rims.
 * - Each beat lifts the inner glow a little; uFlash is a barely visible lift
 *   and stays behind the upstream flash limiter.
 */
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uFlow;
uniform float uBass;
uniform float uTreble;
uniform float uPulse;
uniform float uFlash;
uniform float uBeats;

out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

const int BLOBS = 7;

// Each blob rises slowly, sways sideways and wraps from top back to bottom.
vec2 blobCenter(int i, float t, float aspect) {
  float fi = float(i);
  float speed = 0.035 + 0.02 * fract(fi * 0.618);
  float y = mod(fi * 0.37 + t * speed, 1.6) - 0.8;
  float x = (fract(fi * 0.731) - 0.5) * aspect * 0.8
          + 0.18 * sin(t * (0.11 + 0.03 * fi) + fi * 2.1);
  return vec2(x, y);
}

float blobRadius(int i) {
  return 0.11 + 0.07 * fract(float(i) * 0.437);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float aspect = uResolution.x / uResolution.y;
  float t = uFlow;

  // A slow wobble of space makes the blobs organic rather than circular.
  vec2 p = uv + 0.06 * vec2(fbm(uv * 2.0 + t * 0.15), fbm(uv * 2.0 - t * 0.12 + 5.0)) - 0.03;

  // Metaball field: blobs merge smoothly where their fields overlap.
  float field = 0.0;
  for (int i = 0; i < BLOBS; i++) {
    float r = blobRadius(i) * (1.0 + 0.18 * uBass);
    vec2 d = p - blobCenter(i, t, aspect);
    field += r * r / (dot(d, d) + 1e-4);
  }

  // Background: deep navy, a touch lighter near the bottom where the lamp's heat is.
  vec3 bg = mix(vec3(0.010, 0.016, 0.040), vec3(0.020, 0.045, 0.085), smoothstep(0.6, -0.6, uv.y));

  // Blob colour drifts slowly between teal and violet, nudged by the beat count.
  float hueT = 0.5 + 0.5 * sin(t * 0.07 + uv.y * 1.5 + 0.05 * uBeats);
  vec3 teal = vec3(0.05, 0.42, 0.52);
  vec3 violet = vec3(0.28, 0.16, 0.55);
  vec3 blobCol = mix(teal, violet, hueT);

  float body = smoothstep(0.9, 1.25, field);
  float core = smoothstep(1.6, 4.0, field);
  float glow = smoothstep(0.25, 1.0, field) * (1.0 - body);

  vec3 col = bg;
  col += blobCol * glow * (0.25 + 0.25 * uBass);
  col = mix(col, blobCol * 0.75, body);
  col += mix(blobCol, vec3(0.55, 0.85, 1.0), 0.35) * core * (0.35 + 0.25 * uPulse + 0.1 * uBass);

  // Rim light with a faint treble shimmer.
  float rim = body * (1.0 - smoothstep(1.25, 1.7, field));
  col += vec3(0.35, 0.6, 0.9) * rim * (0.12 + 0.25 * uTreble * noise(p * 30.0 + t));

  col *= 1.0 + 0.05 * uFlash;

  // Vignette, soft tone map, fine grain to avoid banding in the dark gradient.
  col *= smoothstep(1.4, 0.3, length(uv * vec2(0.8, 1.0)));
  col = col / (1.0 + col);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;
