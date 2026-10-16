import { SCENE_HEADER, type Scene } from './common';

/**
 * Pipes: the classic one where pipes grow through a 3D grid, turning at
 * random, until the space is full and it starts again. Each pipe is a random
 * walk fixed by its seed, so the picture at any moment is a function of how
 * far it has grown and nothing needs remembering between frames.
 *
 * Pipes are drawn as tube impostors, not raymarched: each segment is a
 * capsule found in screen space, shaded from the reconstructed tube normal,
 * and the nearest one wins a per-pixel depth test. That keeps a few hundred
 * segments at 60 fps.
 *
 * - Flow sets growth speed, so busier music grows faster.
 * - Bass: pipe thickness. Treble: sparkle in the highlights.
 * - Pitch: shifts the palette. A drop sends a pulse of light along every pipe.
 */
export const PIPES: Scene = {
  id: 'pipes',
  name: 'Pipes',
  fragment:
    SCENE_HEADER +
    /* glsl */ `
const int PIPES = 5;
const int STEPS = 34;     // grid steps each pipe grows per round
const float PAUSE = 5.0;  // steps' worth of time to fade out before the next round
const float CELL = 0.42;  // world size of a grid step
const int HALF = 4;       // the grid spans -HALF..HALF on each axis

vec3 axisDir(int i) {
  if (i == 0) return vec3(1, 0, 0);
  if (i == 1) return vec3(-1, 0, 0);
  if (i == 2) return vec3(0, 1, 0);
  if (i == 3) return vec3(0, -1, 0);
  if (i == 4) return vec3(0, 0, 1);
  return vec3(0, 0, -1);
}

// Integer hash: far cheaper than the sin() hash in the inner walk loop.
float ihash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return float(x) / 4294967295.0;
}

float bestZ;
vec3 hitN;
float hitAlong;

// Tube impostor between a and b (view space), with flat ends: joints are drawn
// as balls separately, so straight runs read as one continuous pipe.
void tube(vec2 uv, vec3 a, vec3 b, float radius, float along0, float alongLen) {
  vec2 pa = a.xy * 1.6 / a.z;
  vec2 pb = b.xy * 1.6 / b.z;
  vec2 ba = pb - pa;
  float h = dot(uv - pa, ba) / max(dot(ba, ba), 1e-8);
  if (h < 0.0 || h > 1.0) return;
  vec2 c = pa + ba * h;
  float dist = length(uv - c);
  float z = mix(a.z, b.z, h);
  float r = radius * 1.6 / z;
  if (dist >= r) return;
  float q = dist / r;
  float front = z - radius * sqrt(max(1.0 - q * q, 0.0));
  if (front >= bestZ) return;
  vec2 across = (uv - c) / max(dist, 1e-6);
  hitN = vec3(across * q, -sqrt(max(1.0 - q * q, 0.0)));
  bestZ = front;
  hitAlong = along0 + h * alongLen;
}

void ball(vec2 uv, vec3 c, float radius, float along) {
  vec2 pc = c.xy * 1.6 / c.z;
  float r = radius * 1.6 / c.z;
  float dist = length(uv - pc);
  if (dist >= r) return;
  float q = dist / r;
  float front = c.z - radius * sqrt(max(1.0 - q * q, 0.0));
  if (front >= bestZ) return;
  hitN = vec3((uv - pc) / r, -sqrt(max(1.0 - q * q, 0.0)));
  bestZ = front;
  hitAlong = along;
}

bool inside(vec3 p) {
  return all(lessThanEqual(abs(p), vec3(float(HALF))));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uFlow;
  float lit = 0.5 + 0.5 * uIntensity;

  mat3 view = rotX(0.32 + 0.08 * sin(t * 0.013)) * rotY(t * 0.022);
  float camDist = 6.2;
  vec3 light = normalize(vec3(-0.4, 0.7, -0.6));

  float grown = t * 0.55;
  float roundLen = float(STEPS) + PAUSE;
  float round = floor(grown / roundLen);
  float local = grown - round * roundLen;
  // Fade the finished picture out during the pause, and back in as a round starts.
  float roundFade = smoothstep(roundLen, roundLen - PAUSE * 0.8, local) * smoothstep(0.0, 0.6, local);

  float radius = CELL * (0.17 + 0.05 * uBass);
  float sceneZ = 1e9;
  vec3 col = vec3(0.0);
  vec3 v = vec3(0.0, 0.0, -1.0);

  for (int pi = 0; pi < PIPES; pi++) {
    uint seed = uint(pi) * 7919u + uint(round) * 104729u + 17u;
    // Pipes start one after another, as in the original.
    float steps = clamp(local - float(pi) * 2.5, 0.0, float(STEPS));
    if (steps <= 0.0) continue;

    vec3 cell = floor(vec3(ihash(seed), ihash(seed + 1u), ihash(seed + 2u)) * float(2 * HALF + 1)) - float(HALF);
    int dir = int(ihash(seed + 3u) * 6.0);
    vec3 base = neon(fract(float(pi) * 0.23 + uPitch * 0.5 + ihash(seed + 4u) * 0.2));

    bestZ = sceneZ;
    vec3 a = view * (cell * CELL);
    a.z += camDist;
    ball(uv, a, radius * 1.25, 0.0);
    for (int k = 0; k < STEPS; k++) {
      float fk = float(k);
      if (fk >= steps) break;
      // Turn now and then, always onto a perpendicular axis, and never out of the grid.
      uint ks = seed + uint(k) * 31u + 5u;
      int prevDir = dir;
      if (ihash(ks) < 0.3 || !inside(cell + axisDir(dir))) {
        int axis = dir / 2;
        for (int tries = 0; tries < 4; tries++) {
          int pick = int(ihash(ks + uint(tries) * 977u + 1u) * 4.0);
          int other = (axis + 1 + pick / 2) % 3;
          int cand = other * 2 + (pick % 2);
          if (inside(cell + axisDir(cand))) { dir = cand; break; }
        }
      }
      if (dir != prevDir && k > 0) ball(uv, a, radius * 1.25, fk);
      vec3 next = cell + axisDir(dir);
      // The newest segment is still growing.
      float part = min(1.0, steps - fk);
      vec3 b = view * (mix(cell, next, part) * CELL);
      b.z += camDist;
      tube(uv, a, b, radius, fk, part);
      a = b;
      cell = next;
    }
    // The growing tip is rounded off.
    ball(uv, a, radius, steps);
    if (bestZ < sceneZ) {
      // This pipe is the nearest thing at this pixel so far: shade it.
      vec3 n = hitN;
      float diff = max(dot(n, light), 0.0);
      float spec = pow(max(dot(reflect(-light, n), v), 0.0), 48.0);
      float rim = pow(1.0 - abs(n.z), 3.0);
      // A pulse of light runs along every pipe after a drop.
      float pulse = uRelease * smoothstep(1.5, 0.0, abs(hitAlong - (1.0 - uRelease) * float(STEPS)));
      vec3 shade = base * (0.08 + 0.75 * diff) + base * rim * 0.6
                 + vec3(0.85, 0.95, 1.0) * spec * (0.9 + 1.5 * uTreble)
                 + base * pulse * 2.5;
      col = shade * lit;
      sceneZ = bestZ;
    }
  }

  col *= roundFade;
  col *= 1.0 + 0.05 * uFlash;
  outColor = vec4(col, 1.0);
}
`,
};
