/**
 * "Deep Lamp": three layers of cool light drifting in the dark, each played by
 * a different part of the music.
 *
 * - Bass layer: a few big, slow blobs that swell with the low end.
 * - Mid layer: medium blobs for chords and vocals. They rise with the melody's
 *   pitch and shade from teal (low) to violet (high).
 * - Treble layer: small bubbles that appear with hats and cymbals.
 *
 * Song structure shapes the whole picture: intensity sets how lit and full it
 * is, a build draws the blobs toward the centre, and a drop releases them
 * outward with a surge that fades over a few seconds. The beat itself has no
 * visual of its own.
 *
 * Motion runs on uFlow, an integrated phase, so nothing ever jumps.
 */
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
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

// Build pulls everything toward the centre; a drop throws it back out.
vec2 gather(vec2 c) {
  float g = 0.45 * uBuild - 0.55 * uRelease;
  return c * (1.0 - g);
}

// A blob that rises, sways and wraps from top back to bottom.
vec2 drifter(float seed, float t, float speed, float sway, float aspect) {
  float y = mod(seed * 0.37 + t * speed, 1.8) - 0.9;
  float x = (fract(seed * 0.731) - 0.5) * aspect * 0.85
          + sway * sin(t * (0.10 + 0.03 * seed) + seed * 2.1);
  return vec2(x, y);
}

const int BASS_BLOBS = 4;
const int MID_BLOBS = 6;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float aspect = uResolution.x / uResolution.y;
  float t = uFlow;

  vec2 p = uv + 0.06 * vec2(fbm(uv * 2.0 + t * 0.15), fbm(uv * 2.0 - t * 0.12 + 5.0)) - 0.03;

  // Bass layer.
  float bassField = 0.0;
  for (int i = 0; i < BASS_BLOBS; i++) {
    float fi = float(i);
    float r = (0.15 + 0.06 * fract(fi * 0.437)) * (0.65 + 0.55 * uBass);
    vec2 c = gather(drifter(fi + 0.5, t, 0.025 + 0.01 * fract(fi * 0.618), 0.12, aspect));
    vec2 d = p - c;
    bassField += r * r / (dot(d, d) + 1e-4);
  }

  // Mid layer: lifted by pitch.
  float midField = 0.0;
  float lift = (uPitch - 0.5) * 0.6;
  for (int i = 0; i < MID_BLOBS; i++) {
    float fi = float(i) + 10.0;
    float r = (0.07 + 0.04 * fract(fi * 0.437)) * (0.35 + 0.95 * uMid);
    vec2 c = drifter(fi, t, 0.045 + 0.02 * fract(fi * 0.618), 0.22, aspect);
    c.y = clamp(c.y + lift, -0.95, 0.95);
    vec2 d = p - gather(c);
    midField += r * r / (dot(d, d) + 1e-4);
  }

  // Colours. Intensity lifts brightness and saturation together.
  float lit = 0.45 + 0.55 * uIntensity;
  vec3 bg = mix(vec3(0.008, 0.012, 0.032), vec3(0.018, 0.040, 0.080), smoothstep(0.6, -0.6, uv.y));
  bg *= 0.8 + 0.5 * uIntensity;

  vec3 bassCol = vec3(0.03, 0.30, 0.42) * lit;
  vec3 midCol = mix(vec3(0.06, 0.48, 0.55), vec3(0.36, 0.20, 0.66), uPitch) * lit;
  vec3 rimCol = vec3(0.40, 0.65, 0.95);

  vec3 col = bg;

  float bBody = smoothstep(0.9, 1.25, bassField);
  float bGlow = smoothstep(0.25, 1.0, bassField) * (1.0 - bBody);
  float bCore = smoothstep(1.6, 4.0, bassField);
  col += bassCol * bGlow * 0.5;
  col = mix(col, bassCol, bBody);
  col += bassCol * bCore * 0.6;

  float mBody = smoothstep(0.9, 1.2, midField);
  float mGlow = smoothstep(0.3, 1.0, midField) * (1.0 - mBody);
  float mCore = smoothstep(1.6, 4.0, midField);
  col += midCol * mGlow * 0.45;
  col = mix(col, midCol * 0.9 + col * 0.25, mBody);
  col += mix(midCol, rimCol, 0.4) * mCore * 0.5;

  // Rim light on both layers; a drop brightens it and fades out with the release.
  float rims = bBody * (1.0 - smoothstep(1.25, 1.7, bassField))
             + mBody * (1.0 - smoothstep(1.2, 1.6, midField));
  col += rimCol * rims * (0.10 + 0.35 * uRelease) * lit;

  // Treble layer: bubbles rising faster than the blobs; more appear with more treble.
  vec2 bp = uv * vec2(9.0, 9.0) + vec2(0.0, -t * 0.6);
  vec2 cell = floor(bp);
  vec2 f = fract(bp) - 0.5;
  float h = hash(cell);
  float show = step(h, 0.08 + 0.55 * uTreble);
  vec2 jitter = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
  jitter.x += 0.12 * sin(t * 1.3 + h * 6.28);
  float size = 0.05 + 0.06 * hash(cell + 1.3);
  float bubble = smoothstep(size, size * 0.4, length(f - jitter));
  float twinkle = 0.6 + 0.4 * sin(t * 3.0 + h * 40.0);
  col += vec3(0.45, 0.75, 1.0) * bubble * show * twinkle * (0.12 + 0.5 * uTreble) * lit;

  col *= 1.0 + 0.05 * uFlash;

  col *= smoothstep(1.45, 0.3, length(uv * vec2(0.8, 1.0)));
  col = col / (1.0 + col);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;
