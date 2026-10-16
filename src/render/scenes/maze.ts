import { SCENE_HEADER, type Scene } from './common';

/**
 * Maze: the first-person flight down endless corridors, as neon on black.
 *
 * The path is a chain of four-cell legs that alternate between going forward
 * (+z) and sideways (left or right, by hash). Forward legs always advance, so
 * the path can never cross itself and never needs remembering: only a window
 * of legs around the camera is built each frame, relative to the leg two
 * behind it. Moving that origin shifts everything by whole cells, which fract()
 * cannot see, so the textures never jump. Side alcoves give the walls depth.
 *
 * Walls are found by stepping the view ray cell to cell (DDA) on the grid.
 *
 * - Flow sets walking speed. Bass: glow of the wall lines.
 * - Treble: data sparks on the panels. Pitch: hue. A drop flares the lines.
 */
export const MAZE: Scene = {
  id: 'maze',
  name: 'Maze',
  description: 'A walk through neon corridors. Bass lights the walls; hats spark the panels.',
  fragment:
    SCENE_HEADER +
    /* glsl */ `
const int LEG = 4;
const int BEHIND = 2;
const int WINDOW = 9;

int firstLeg;
vec2 legStart[WINDOW];
vec2 legDir[WINDOW];

vec2 dirOf(int leg) {
  if (leg % 2 == 0) return vec2(0.0, 1.0);
  return vec2(ihash(uint(leg) * 2654435761u) < 0.5 ? -1.0 : 1.0, 0.0);
}

void buildPath(int k0) {
  firstLeg = k0 - BEHIND;
  vec2 p = vec2(0.0);
  for (int j = 0; j < WINDOW; j++) {
    legStart[j] = p;
    legDir[j] = dirOf(firstLeg + j);
    p += legDir[j] * float(LEG);
  }
}

// Centre of the path at distance s (in cells) from the start of the window.
vec2 pathPoint(float s) {
  int j = clamp(int(floor(s / float(LEG))), 0, WINDOW - 1);
  return legStart[j] + legDir[j] * (s - float(j * LEG)) + 0.5;
}

bool open(vec2 cell) {
  for (int j = 0; j < WINDOW; j++) {
    vec2 d = legDir[j];
    vec2 rel = cell - legStart[j];
    float along = dot(rel, d);
    float side = dot(rel, vec2(-d.y, d.x));
    if (along < 0.0 || along > float(LEG)) continue;
    if (side == 0.0) return true;
    // One-cell alcoves off the middle of a leg.
    if (abs(side) == 1.0 && along >= 1.0 && along <= float(LEG - 2)) {
      uint h = uint(firstLeg + j) * 8u + uint(along) * 2u + (side > 0.0 ? 1u : 0u);
      if (ihash(h + 99u) < 0.3) return true;
    }
  }
  return false;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uFlow;
  float lit = 0.5 + 0.5 * uIntensity;

  float walked = t * 0.45;
  int k0 = int(floor(walked / float(LEG)));
  buildPath(k0);
  float s = walked - float(k0 * LEG) + float(BEHIND * LEG);

  vec2 here = pathPoint(s);
  // Look ahead along the path, averaged so corners are turned smoothly.
  vec2 ahead = 0.5 * (pathPoint(s + 1.0) + pathPoint(s + 2.2));
  vec3 ro = vec3(here.x, 0.5 + 0.03 * sin(t * 0.7), here.y);
  vec3 fw = normalize(vec3(ahead.x - here.x, 0.0, ahead.y - here.y));
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * 0.9 + rt * uv.x + up * uv.y);

  // DDA across the grid until a solid cell.
  vec2 cell = floor(ro.xz);
  vec2 stepDir = sign(rd.xz);
  vec2 inv = 1.0 / max(abs(rd.xz), vec2(1e-5));
  vec2 side = (stepDir * (cell - ro.xz) + stepDir * 0.5 + 0.5) * inv;
  float tWall = 1e3;
  vec2 hitCell = cell;
  bool hitX = false;
  for (int i = 0; i < 40; i++) {
    if (side.x < side.y) {
      tWall = side.x; side.x += inv.x; cell.x += stepDir.x; hitX = true;
    } else {
      tWall = side.y; side.y += inv.y; cell.y += stepDir.y; hitX = false;
    }
    if (!open(cell)) { hitCell = cell; break; }
    if (i == 39) tWall = 1e3;
  }
  float tFloor = rd.y < 0.0 ? -ro.y / rd.y : (1.0 - ro.y) / rd.y;

  vec3 line = neon(fract(uPitch * 0.8 + 0.05));
  float glow = (0.6 + 0.9 * uBass + 1.2 * uRelease) * lit;
  vec3 col = vec3(0.0);
  float dist;

  if (tWall < tFloor) {
    dist = tWall;
    vec3 p = ro + rd * tWall;
    float u = fract(hitX ? p.z : p.x);
    float v = p.y;
    // Panel edges, a trim line top and bottom, and a faint centre seam.
    float e = min(min(u, 1.0 - u), min(v, 1.0 - v));
    float edges = smoothstep(0.03, 0.0, e) + 0.5 * smoothstep(0.012, 0.0, abs(v - 0.12)) + 0.5 * smoothstep(0.012, 0.0, abs(v - 0.88));
    vec3 panel = vec3(0.006, 0.012, 0.03) * (0.8 + 0.4 * hash2(hitCell));
    // Data sparks with the treble.
    vec2 gp = vec2(u, v) * vec2(16.0, 22.0);
    vec2 g = floor(gp);
    float dot = smoothstep(0.32, 0.2, length(fract(gp) - 0.5));
    float spark = dot * step(0.97 - 0.04 * uTreble, hash2(g + hitCell * 17.0 + floor(t * 2.0)));
    col = panel + line * edges * glow + line * spark * 0.5 * (0.3 + uTreble) * lit;
  } else {
    dist = tFloor;
    vec3 p = ro + rd * tFloor;
    vec2 f = fract(p.xz);
    float grid = smoothstep(0.02, 0.0, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    if (rd.y < 0.0) {
      // Floor: dark with a cool grid.
      col = vec3(0.004, 0.008, 0.02) + line * grid * 0.35 * glow;
    } else {
      // Ceiling: a light panel in each cell, in the accent colour.
      float panel = smoothstep(0.02, 0.0, max(abs(f.x - 0.5), abs(f.y - 0.5)) - 0.18);
      col = vec3(0.004, 0.006, 0.016) + neon(fract(uPitch * 0.8 + 0.6)) * panel * 0.5 * glow + line * grid * 0.15 * glow;
    }
  }

  // Fall off into the dark, so the maze has depth and no visible end.
  col *= exp(-0.22 * dist);
  col *= 1.0 + 0.05 * uFlash;
  outColor = vec4(col, 1.0);
}
`,
};
