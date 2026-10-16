import { SCENE_HEADER, type Scene } from './common';

/**
 * Ribbons: flat neon bands that loop through space, each the trail of a point
 * flying a smooth 3D path. A band twists as it goes, so it narrows to an edge
 * and widens to a face, and catches a sheen whenever it turns toward you.
 *
 * Each ribbon is its head's path over the last few seconds of flow: the same
 * curve sampled at earlier times, so the tail follows exactly where the head
 * went and nothing jumps.
 *
 * - Bass: ribbon width. Mids: trail length.
 * - Treble: glints along the bright edge.
 * - Pitch: palette, cyan toward magenta. A drop flares the sheen.
 */
export const RIBBONS: Scene = {
  id: 'ribbons',
  name: 'Ribbons',
  description:
    'Twisting neon bands loop through space. Bass widens them; a drop flares their sheen.',
  fragment:
    SCENE_HEADER +
    /* glsl */ `
const int RIBBONS = 4;
const int SAMPLES = 44;

// A smooth looping path; each ribbon gets its own frequencies from its seed.
vec3 path(float r, float t) {
  vec3 f = vec3(0.21, 0.17, 0.13) + 0.06 * vec3(hash(r), hash(r + 1.0), hash(r + 2.0));
  vec3 ph = 6.2832 * vec3(hash(r + 3.0), hash(r + 4.0), hash(r + 5.0));
  return vec3(1.6 * sin(t * f.x + ph.x) + 0.4 * sin(t * f.y * 2.3 + ph.z),
              1.0 * sin(t * f.y + ph.y) + 0.3 * sin(t * f.z * 2.9 + ph.x),
              1.2 * sin(t * f.z + ph.z));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float px = 1.0 / uResolution.y;
  float t = uFlow;
  float lit = 0.5 + 0.5 * uIntensity;
  mat3 view = rotY(t * 0.03) * rotX(0.15 * sin(t * 0.02));

  float span = 5.0 + 5.0 * uMid; // seconds of flow the trail covers
  vec3 col = vec3(0.0);

  for (int ri = 0; ri < RIBBONS; ri++) {
    float r = float(ri) * 9.13;
    vec3 base = neon(fract(uPitch * 0.7 + float(ri) * 0.27));
    float width = 0.05 + 0.04 * uBass;
    // Find the nearest point of this ribbon first, then shade it once: shading
    // every segment would draw each one's rounded end as a ring inside the band.
    float bestQ = 1e9;
    float bestS = 1.0;
    float bestFace = 0.0;
    float bestZ = 4.5;
    float bestHalfW = 1.0;

    vec3 q = view * path(r, t) + vec3(0.0, 0.0, 4.5);
    vec2 prev = q.xy * 1.7 / q.z;
    float prevZ = q.z;
    for (int j = 1; j < SAMPLES; j++) {
      float fj = float(j) / float(SAMPLES - 1);
      vec3 w = view * path(r, t - fj * span) + vec3(0.0, 0.0, 4.5);
      vec2 cur = w.xy * 1.7 / w.z;
      vec2 d = segment(uv, prev, cur);
      float z = mix(prevZ, w.z, d.y);
      float s = (float(j - 1) + d.y) / float(SAMPLES - 1); // 0 head .. 1 tail
      // The band twists along its length; apparent width follows the twist.
      float face = abs(cos(s * 9.0 + t * 0.6 + r));
      float halfW = (width * (0.15 + 0.85 * face) * (1.0 - 0.7 * s)) * 1.7 / z + px;
      float qn = d.x / halfW;
      if (qn < bestQ) {
        bestQ = qn;
        bestS = s;
        bestFace = face;
        bestZ = z;
        bestHalfW = halfW;
      }
      prev = cur;
      prevZ = w.z;
    }
    float aa = 1.5 * px / bestHalfW;
    float body = smoothstep(1.0, 1.0 - aa, bestQ);
    float edge = smoothstep(aa * 1.5, 0.0, abs(bestQ - 1.0 + aa));
    // Sheen when the face turns toward the viewer; a drop flares it.
    float sheen = pow(bestFace, 8.0) * (0.6 + 1.6 * uRelease);
    float glint = uTreble * step(0.92, fract(bestS * 13.0 - t * 0.5)) * 1.5;
    float fade = (1.0 - bestS) * (1.0 - bestS);
    vec3 c = base * (0.35 + 0.65 * bestFace) + vec3(0.85, 0.95, 1.0) * sheen * 0.7;
    vec3 band = (c * body * 0.55 + base * edge * (0.6 + glint)) * fade * lit * (4.5 / bestZ);
    col += band;
  }

  col *= 1.0 + 0.05 * uFlash;
  outColor = vec4(col, 1.0);
}
`,
};
