import { SCENE_HEADER, type Scene } from './common';

/**
 * Starfield: the classic flight through space. Stars sit in depth slices that
 * slide toward the viewer and wrap round, so the field is endless. Each star
 * streaks along its line out from the centre, more as the music drives harder.
 *
 * - Flow (busier music) sets cruising speed; a drop is the jump to warp.
 * - Bass: a faint nebula glow at the vanishing point.
 * - Treble: more stars.
 * - Pitch: the tint of the coloured stars, cyan toward magenta.
 */
export const STARFIELD: Scene = {
  id: 'starfield',
  name: 'Starfield',
  fragment:
    SCENE_HEADER +
    /* glsl */ `
const int LAYERS = 14;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uFlow;
  float lit = 0.5 + 0.5 * uIntensity;
  float px = 1.0 / uResolution.y;

  // A slow roll, so the flight never feels like a static wallpaper.
  float roll = 0.12 * sin(t * 0.017);
  uv = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * uv;
  float r = length(uv);
  vec2 radial = uv / max(r, 1e-4);

  // How far stars smear: always a little, a lot on the jump to warp.
  float streak = 1.0 + 3.0 * uIntensity + 22.0 * uRelease * uRelease;

  vec3 col = vec3(0.0);
  for (int i = 0; i < LAYERS; i++) {
    float fi = float(i);
    // depth runs 0 (far) to 1 (passing the viewer), then the layer wraps.
    float depth = fract(fi / float(LAYERS) + t * 0.035);
    float scale = mix(26.0, 0.9, depth);
    vec2 p = uv * scale + vec2(fi * 17.3, fi * 31.7);
    vec2 cell = floor(p);
    float h = hash2(cell + fi);
    if (h > 0.07 + 0.08 * uTreble) continue;
    vec2 star = cell + 0.5 + (vec2(hash2(cell + 1.7), hash2(cell + 9.1)) - 0.5) * 0.7;
    // Work in screen units so stars stay pinpoints however near their layer is.
    vec2 d = (p - star) / scale;
    float along = dot(d, radial);
    float across = dot(d, vec2(-radial.y, radial.x));
    // The streak trails back toward the centre, the way the star came from.
    float len = 0.004 * streak * depth * depth;
    float back = along - clamp(along, -len, 0.0);
    float dist = length(vec2(back, across));
    float w = px * (0.7 + 2.2 * depth);
    // Core only: a halo would be clipped square at the cell edge. Bloom adds the glow.
    float core = smoothstep(w, 0.0, dist);
    // Fade in from the distance and out as the layer passes.
    float fade = smoothstep(0.0, 0.25, depth) * smoothstep(1.0, 0.85, depth);
    vec3 tint = h < 0.015 ? neon(uPitch + (hash2(cell + 4.4) - 0.5) * 0.5) : vec3(0.75, 0.85, 1.0);
    col += tint * core * fade * (0.5 + 2.5 * depth * depth) * lit;
  }

  // Nebula glow at the vanishing point, breathing with the bass.
  col += neon(uPitch * 0.6 + 0.2) * exp(-r * 5.0) * (0.04 + 0.12 * uBass) * lit;

  col *= 1.0 + 0.05 * uFlash;
  outColor = vec4(col, 1.0);
}
`,
};
