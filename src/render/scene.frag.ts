/**
 * "Deep Lamp", in 3D: glossy blobs of light drifting through a dark volume,
 * raymarched as a smooth-union field and seen by a camera that slowly orbits.
 *
 * - Bass layer: a few big, slow blobs at the back that swell with the low end.
 * - Mid layer: smaller blobs nearer the camera for chords and vocals. They rise
 *   with the melody's pitch and shade from teal (low) to violet (high).
 * - Treble layer: dust motes on three depth planes, so they parallax as the
 *   camera moves; more appear with hats and cymbals.
 *
 * Nothing is tied to individual beats. Sizes follow slow band envelopes, and
 * song structure shapes the whole picture: intensity sets how lit it is, a
 * build draws the blobs together, and a drop releases them outward.
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

const int BASS_BLOBS = 4;
const int MID_BLOBS = 6;
const int BLOBS = BASS_BLOBS + MID_BLOBS;

vec4 blob[BLOBS]; // xyz centre, w radius

// Build pulls everything toward the centre; a drop throws it back out.
float gatherScale() {
  return 1.0 - (0.4 * uBuild - 0.5 * uRelease);
}

// A blob that rises, sways in x and z, and wraps from top back to bottom.
vec3 drifter(float seed, float t, float speed, float sway, float depth) {
  float y = mod(seed * 0.37 + t * speed, 3.2) - 1.6;
  float x = (fract(seed * 0.731) - 0.5) * 2.0 + sway * sin(t * (0.10 + 0.03 * seed) + seed * 2.1);
  float z = depth + 0.5 * sin(t * (0.07 + 0.02 * seed) + seed * 4.3);
  return vec3(x, y, z);
}

void placeBlobs(float t) {
  float g = gatherScale();
  for (int i = 0; i < BASS_BLOBS; i++) {
    float fi = float(i) + 0.5;
    vec3 c = drifter(fi, t, 0.05 + 0.02 * fract(fi * 0.618), 0.25, -0.6);
    float r = (0.38 + 0.12 * fract(fi * 0.437)) * (0.75 + 0.45 * uBass);
    blob[i] = vec4(c * g, r);
  }
  float lift = (uPitch - 0.5) * 1.0;
  for (int i = 0; i < MID_BLOBS; i++) {
    float fi = float(i) + 10.0;
    vec3 c = drifter(fi, t, 0.08 + 0.04 * fract(fi * 0.618), 0.45, 0.4);
    c.y = clamp(c.y + lift, -1.6, 1.6);
    float r = (0.16 + 0.08 * fract(fi * 0.437)) * (0.6 + 0.7 * uMid);
    blob[BASS_BLOBS + i] = vec4(c * g, r);
  }
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Distance, plus how much of the surface belongs to the mid layer (0 = bass).
vec2 field(vec3 p) {
  float bass = 1e3;
  float mid = 1e3;
  for (int i = 0; i < BASS_BLOBS; i++) bass = smin(bass, length(p - blob[i].xyz) - blob[i].w, 0.45);
  for (int i = BASS_BLOBS; i < BLOBS; i++) mid = smin(mid, length(p - blob[i].xyz) - blob[i].w, 0.3);
  float d = smin(bass, mid, 0.35);
  float w = clamp(0.5 + 0.5 * (bass - mid) / 0.35, 0.0, 1.0);
  return vec2(d, w);
}

vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1.0, -1.0) * 0.003;
  return normalize(k.xyy * field(p + k.xyy).x + k.yyx * field(p + k.yyx).x
                 + k.yxy * field(p + k.yxy).x + k.xxx * field(p + k.xxx).x);
}

// Motes on one depth plane, seen through the ray.
float motes(vec3 ro, vec3 rd, float planeZ, float scale, float t) {
  float s = (planeZ - ro.z) / rd.z;
  if (s <= 0.0) return 0.0;
  vec2 q = (ro + rd * s).xy * scale + vec2(0.0, -t * 0.35 * scale);
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(cell + planeZ);
  float show = step(h, 0.06 + 0.4 * uTreble);
  vec2 jitter = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
  float size = 0.06 + 0.06 * hash(cell + 1.3);
  float twinkle = 0.6 + 0.4 * sin(t * 2.0 + h * 40.0);
  return smoothstep(size, size * 0.3, length(f - jitter)) * show * twinkle;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uFlow;
  placeBlobs(t);

  // Camera: a slow, shallow orbit so depth reads without ever feeling like motion sickness.
  float a = 0.35 * sin(t * 0.045);
  vec3 ro = vec3(4.2 * sin(a), 0.25 * sin(t * 0.031), 4.2 * cos(a));
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.6 + rt * uv.x + up * uv.y);

  float lit = 0.45 + 0.55 * uIntensity;
  vec3 bg = mix(vec3(0.006, 0.010, 0.028), vec3(0.016, 0.036, 0.075), smoothstep(0.6, -0.6, uv.y));
  bg *= 0.8 + 0.5 * uIntensity;
  vec3 col = bg;

  // Treble motes behind the blobs.
  col += vec3(0.45, 0.75, 1.0) * motes(ro, rd, -2.5, 3.0, t) * (0.05 + 0.25 * uTreble) * lit;

  float s = 0.0;
  float glow = 0.0;
  vec2 hit = vec2(1e3, 0.0);
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * s;
    hit = field(p);
    glow += 0.012 / (0.04 + hit.x * hit.x);
    if (hit.x < 0.002 || s > 9.0) break;
    s += hit.x * 0.9;
  }

  vec3 bassCol = vec3(0.03, 0.30, 0.42) * lit;
  vec3 midCol = mix(vec3(0.06, 0.48, 0.55), vec3(0.36, 0.20, 0.66), uPitch) * lit;
  vec3 rimCol = vec3(0.40, 0.65, 0.95);

  if (hit.x < 0.01) {
    vec3 p = ro + rd * s;
    vec3 n = normalAt(p);
    vec3 albedo = mix(bassCol, midCol, hit.y);
    vec3 light = normalize(vec3(0.4, 0.8, 0.5));
    float diff = 0.25 + 0.75 * max(dot(n, light), 0.0);
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    float spec = pow(max(dot(reflect(rd, n), light), 0.0), 40.0);
    // Light seems to come from inside: thin edges glow, cores stay deep.
    vec3 surf = albedo * diff * 0.9 + albedo * 0.35;
    surf += rimCol * fres * (0.25 + 0.5 * uRelease) * lit;
    surf += vec3(0.7, 0.85, 1.0) * spec * 0.35 * lit;
    float fog = exp(-0.12 * max(s - 3.0, 0.0));
    col = mix(col, surf, fog);
  }
  col += mix(bassCol, midCol, 0.5) * glow * 0.02;

  // Nearer motes in front of the blobs.
  col += vec3(0.45, 0.75, 1.0) * motes(ro, rd, 0.9, 5.0, t) * (0.04 + 0.25 * uTreble) * lit;
  col += vec3(0.45, 0.75, 1.0) * motes(ro, rd, 2.2, 8.0, t) * (0.03 + 0.2 * uTreble) * lit;

  col *= 1.0 + 0.05 * uFlash;

  col *= smoothstep(1.45, 0.3, length(uv * vec2(0.8, 1.0)));
  col = col / (1.0 + col);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;
