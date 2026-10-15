/**
 * "Prism Flow": an abstract field of domain-warped light.
 *
 * - Mid drives the flow speed and the warp, so busier music churns harder.
 * - Bass swells the central bloom and thickens the ribbons.
 * - Treble adds fine filaments and kaleidoscopic folds.
 * - Each beat sends a faint ring outward and nudges the palette.
 * - uFlash is the only full-screen brightness kick, and it is rate-limited upstream.
 */
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uMid;
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
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = r * p * 2.02;
    a *= 0.5;
  }
  return v;
}

// Cool, dark palette: deep navy through teal to violet. Cosine palette
// (Inigo Quilez) with a low base and narrow swing so it never goes warm or bright.
vec3 palette(float t) {
  vec3 a = vec3(0.14, 0.26, 0.42);
  vec3 b = vec3(0.12, 0.22, 0.30);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.55, 0.62, 0.72) + 0.02 * uBeats;
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * (0.08 + 0.35 * uMid);

  // Kaleidoscopic fold: more segments as the treble rises.
  float segments = 3.0 + floor(uTreble * 6.0);
  float ang = atan(uv.y, uv.x);
  float rad = length(uv);
  float seg = 6.28318 / segments;
  ang = abs(mod(ang, seg) - 0.5 * seg);
  vec2 k = mix(uv, rad * vec2(cos(ang), sin(ang)), 0.35 + 0.5 * uTreble);

  // Two levels of domain warping give the liquid, smoke-like flow.
  vec2 q = vec2(fbm(k * 1.6 + t), fbm(k * 1.6 - t + 4.7));
  vec2 r = vec2(fbm(k * 2.0 + 3.0 * q + vec2(1.7, 9.2) + 0.6 * t),
                fbm(k * 2.0 + 3.0 * q + vec2(8.3, 2.8) - 0.4 * t));
  float f = fbm(k * 2.2 + (2.0 + 2.5 * uMid) * r);

  // Ribbons: thin bright contours through the field, thicker with bass.
  float ribbon = abs(sin(f * 12.0 + uTime * 0.6));
  ribbon = pow(1.0 - ribbon, 6.0 - 1.5 * uBass);

  vec3 col = palette(f + 0.25 * length(r) + 0.05 * uTime);
  col *= 0.45 + 1.3 * f * f;
  col += palette(f + 0.5) * ribbon * (1.1 + 0.35 * uBass);

  // Treble filaments.
  float fil = pow(noise(k * 40.0 + uTime * 3.0), 12.0) * uTreble * 1.5;
  col += vec3(0.45, 0.7, 1.0) * fil;

  // Central bloom that breathes with the bass.
  col += palette(0.1 * uTime) * exp(-rad * (5.0 - 1.0 * uBass)) * (0.15 + 0.25 * uBass);

  // Beat ring travelling outward as the pulse decays.
  float ringR = (1.0 - uPulse) * 1.2;
  float ring = exp(-pow((rad - ringR) * 20.0, 2.0)) * uPulse * uPulse;
  col += palette(0.3 + 0.13 * uBeats) * ring * 0.35;

  col *= 1.0 + 0.12 * uFlash;

  // Vignette and gentle tone mapping.
  col *= smoothstep(1.6, 0.2, rad);
  col = col / (1.0 + col);
  col = pow(col, vec3(0.9));
  outColor = vec4(col, 1.0);
}
`;
