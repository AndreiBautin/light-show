import { SCENE_HEADER, type Scene } from './common';

/**
 * Echoes: the classic bouncing-polygon screensaver, played by the music. Neon wireframe
 * shapes bounce around an invisible box in 3D on pure black, each trailing a
 * fan of fading echoes of where it has just been. The box turns slowly, so
 * the shapes tumble in depth and nearer lines draw thicker and brighter.
 *
 * - Bass: the big shape's size and glow.
 * - Mids: how long the echo trails are, and the second shape's brightness.
 * - Treble: sparks that run along the lines.
 * - Pitch: hue, from cyan (low) toward magenta (high).
 *
 * Song structure shapes the whole picture: intensity sets how bright it is, a
 * build pulls the shapes toward the middle, and a drop throws them outward.
 * Nothing is tied to individual beats.
 *
 * Every vertex position is a function of uFlow, an integrated phase, so echoes
 * are just the same shape at an earlier flow and nothing ever jumps.
 */
export const ECHOES: Scene = {
  id: 'echoes',
  name: 'Echoes',
  fragment:
    SCENE_HEADER +
    /* glsl */ `
const int SHAPES = 3;
const int VERTS = 5;   // vertices per shape; edges join them in a loop
const int ECHOES = 14;


// Triangle wave in -1..1: a point that bounces between two walls at constant speed.
float bounce(float x) { return abs(fract(x) - 0.5) * 4.0 - 1.0; }


// Each vertex's bounce speed and starting phase, filled once per pixel:
// the echo loop reads them hundreds of times.
vec3 vSpeed[SHAPES * VERTS];
vec3 vPhase[SHAPES * VERTS];
vec3 shapeBox[SHAPES];

void setup() {
  // Build pulls the shapes in; a drop throws them out.
  float spread = 1.0 - 0.3 * uBuild + 0.3 * uRelease;
  for (int s = 0; s < SHAPES; s++) {
    // Each shape bounces in its own box; the first is the big one the bass plays.
    float size = s == 0 ? 1.0 * (0.85 + 0.3 * uBass) : (s == 1 ? 0.8 : 0.6);
    shapeBox[s] = size * spread * vec3(1.4, 0.95, 1.0);
    for (int v = 0; v < VERTS; v++) {
      float seed = float(s) * 7.0 + float(v) * 1.37;
      vSpeed[s * VERTS + v] = 0.018 + 0.02 * vec3(hash(seed), hash(seed + 1.1), hash(seed + 2.3));
      vPhase[s * VERTS + v] = vec3(hash(seed + 3.7), hash(seed + 4.1), hash(seed + 5.9));
    }
  }
}

// One vertex of one shape at flow time t, in world space.
vec3 vertex(int shape, int v, float t) {
  vec3 x = t * vSpeed[shape * VERTS + v] + vPhase[shape * VERTS + v];
  return vec3(bounce(x.x), bounce(x.y), bounce(x.z)) * shapeBox[shape];
}

// Perspective projection of a world point; z holds the depth for thickness.
vec3 project(vec3 p, mat3 view) {
  vec3 q = view * p + vec3(0.0, 0.0, 4.2);
  return vec3(q.xy * 1.85 / q.z, q.z);
}

vec3 shapeColour(int shape) {
  return neon(uPitch + (float(shape) - 1.0) * 0.3);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float px = 1.0 / uResolution.y;
  float t = uFlow;
  float lit = 0.45 + 0.55 * uIntensity;
  setup();

  // The invisible box turns slowly so the shapes tumble through depth.
  mat3 view = rotX(0.35 * sin(t * 0.021)) * rotY(t * 0.035);

  // Longer trails when the mids are busy.
  float trail = 0.25 + 0.35 * uMid;
  vec3 col = vec3(0.0);

  for (int s = 0; s < SHAPES; s++) {
    vec3 base = shapeColour(s) * lit;
    float gain = s == 0 ? 0.8 + 0.6 * uBass : (s == 1 ? 0.6 + 0.6 * uMid : 0.7);
    for (int e = 0; e < ECHOES; e++) {
      float fe = float(e);
      float te = t - fe * trail;
      // The newest outline is brightest; echoes fade and cool toward blue.
      float fade = pow(1.0 - fe / float(ECHOES), 2.2);
      vec3 echoCol = mix(base, vec3(0.08, 0.15, 0.8) * lit, fe / float(ECHOES) * 0.6);
      vec3 prev = project(vertex(s, VERTS - 1, te), view);
      for (int v = 0; v < VERTS; v++) {
        vec3 cur = project(vertex(s, v, te), view);
        vec2 d = segment(uv, prev.xy, cur.xy);
        float z = mix(prev.z, cur.z, d.y);
        // Nearer lines are thicker and brighter.
        float near = 4.2 / z;
        float w = px * (1.1 + 1.4 * near) * (e == 0 ? 1.4 : 1.0);
        float core = smoothstep(w, w * 0.25, d.x);
        float halo = exp(-d.x / (w * 6.0)) * 0.12;
        float sparkle = 1.0;
        if (e == 0) {
          // Sparks run along the newest outline with the treble.
          float run = fract(d.y * 3.0 - t * 0.4 + float(v) * 0.37);
          sparkle += uTreble * 3.0 * smoothstep(0.04, 0.0, abs(run - 0.5));
        }
        col += echoCol * (core + halo) * fade * gain * near * near * sparkle;
        prev = cur;
      }
    }
  }

  col *= 1.0 + 0.05 * uFlash;
  // Linear HDR out; post.frag.ts adds the bloom and tonemaps.
  outColor = vec4(col, 1.0);
}
`,
};
