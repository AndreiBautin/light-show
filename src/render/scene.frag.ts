/**
 * "Deep Lamp": you stand inside a giant cyberpunk lava lamp. Ribbed glass
 * curves all round, neon rings run along its base and crown, the floor is wet
 * and reflective, and glowing blobs rise, sink and wander through the haze.
 * The blobs light the space, pooling colour on the floor, showing in its
 * reflection and blooming through the haze; that is what makes the space read.
 *
 * - Bass layer: a few big, slow blobs that swell with the low end.
 * - Mid layer: smaller blobs for chords and vocals. They ride higher with the
 *   melody's pitch and each lean cyan or magenta; a higher melody tips them
 *   all toward magenta. Bass blobs are electric blue.
 * - Treble layer: dust in the air, catching the light; more with hats and cymbals.
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

const float FLOOR_Y = -1.4;
const float CEIL_Y = 3.6;
const vec2 LAMP_C = vec2(0.0, -3.2); // lamp axis in xz
const float LAMP_R = 6.5;

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

const int BASS_BLOBS = 4;
const int MID_BLOBS = 5;
const int BLOBS = BASS_BLOBS + MID_BLOBS;

vec4 blob[BLOBS];    // xyz centre, w radius
vec3 blobCol[BLOBS]; // emitted colour

// Lava-lamp travel: a slow rise and sink, never a wrap, while wandering
// across the room and through its depth.
vec3 drifter(float seed, float t, float speed, float lo, float hi) {
  float ph = t * speed + seed * 2.39;
  float y = mix(lo, hi, 0.5 - 0.5 * cos(ph));
  float x = 1.9 * sin(t * (0.031 + 0.011 * fract(seed * 0.71)) + seed * 1.7);
  float z = -3.6 + 2.4 * sin(t * (0.023 + 0.009 * fract(seed * 0.37)) + seed * 3.1);
  return vec3(x, y, z);
}

void placeBlobs(float t, float lit) {
  // Build pulls everything toward the middle of the room; a drop throws it out.
  float g = 1.0 - (0.4 * uBuild - 0.45 * uRelease);
  vec3 mid0 = vec3(0.0, 0.0, -3.2);
  vec3 bassCol = vec3(0.03, 0.22, 0.95);
  for (int i = 0; i < BASS_BLOBS; i++) {
    float fi = float(i) + 0.5;
    float r = (0.45 + 0.15 * fract(fi * 0.437)) * (0.75 + 0.45 * uBass);
    vec3 c = drifter(fi, t, 0.09 + 0.03 * fract(fi * 0.618), FLOOR_Y + r * 0.8, 1.2);
    blob[i] = vec4(mid0 + (c - mid0) * g, r);
    blobCol[i] = bassCol * lit;
  }
  float lift = (uPitch - 0.5) * 1.2;
  for (int i = 0; i < MID_BLOBS; i++) {
    float fi = float(i) + 10.0;
    float r = (0.24 + 0.1 * fract(fi * 0.437)) * (0.65 + 0.6 * uMid);
    vec3 c = drifter(fi, t, 0.14 + 0.05 * fract(fi * 0.618), FLOOR_Y + 0.5, 1.9);
    c.y = clamp(c.y + lift, FLOOR_Y + r, 2.4);
    blob[BASS_BLOBS + i] = vec4(mid0 + (c - mid0) * g, r);
    // Each blob has its own lean toward cyan or magenta; higher melody tips them all toward magenta.
    float hue = smoothstep(0.35, 0.65, uPitch + (fract(fi * 0.37) - 0.5) * 0.9);
    blobCol[BASS_BLOBS + i] = mix(vec3(0.02, 0.75, 1.0), vec3(0.85, 0.08, 0.9), hue) * lit;
  }
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float uWobble; // set per frame from uFlow

// Molten wax: blobs are taller than wide, merge generously and wobble as they go.
float blobs(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < BLOBS; i++) {
    vec3 q = p - blob[i].xyz;
    q.y *= 0.82;
    d = smin(d, length(q) - blob[i].w, 0.7);
  }
  float w = sin(p.x * 3.1 + uWobble * 0.7) * sin(p.y * 2.7 - uWobble * 0.5) * sin(p.z * 2.9 + uWobble * 0.6);
  return d + 0.045 * w;
}

vec3 blobNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0) * 0.003;
  return normalize(k.xyy * blobs(p + k.xyy) + k.yyx * blobs(p + k.yyx)
                 + k.yxy * blobs(p + k.yxy) + k.xxx * blobs(p + k.xxx));
}

// Colour of the blob surface at p: a blend of the nearby blobs' colours.
vec3 blobColour(vec3 p) {
  vec3 c = vec3(0.0);
  float w = 0.0;
  for (int i = 0; i < BLOBS; i++) {
    float d = max(length(p - blob[i].xyz) - blob[i].w, 0.0);
    float k = 1.0 / (0.06 + d * d * 5.0);
    c += blobCol[i] * k;
    w += k;
  }
  return c / w;
}

float march(vec3 ro, vec3 rd, float tMax, int steps) {
  float s = 0.0;
  for (int i = 0; i < 80; i++) {
    if (i >= steps) break;
    float d = blobs(ro + rd * s);
    if (d < 0.002) return s;
    s += d * 0.9;
    if (s > tMax) break;
  }
  return -1.0;
}

// Glowing, glassy lava: bright where the surface turns away, deep in the core.
vec3 shadeBlob(vec3 p, vec3 rd) {
  vec3 n = blobNormal(p);
  vec3 c = blobColour(p);
  float facing = max(dot(n, -rd), 0.0);
  float fres = pow(1.0 - facing, 2.5);
  vec3 key = normalize(vec3(-0.3, 1.0, 0.4));
  float spec = pow(max(dot(reflect(rd, n), key), 0.0), 60.0);
  // Lit from inside like lamp wax: a hot core where the blob is thickest,
  // falling to deep blue at the silhouette, then a thin neon rim.
  vec3 deep = c * 0.12;
  vec3 hot = c * 1.6;
  vec3 col = mix(deep, hot, pow(facing, 3.0));
  col += mix(c, vec3(0.6, 0.85, 1.0), 0.4) * fres * (0.9 + 1.5 * uRelease);
  col += vec3(0.85, 0.95, 1.0) * spec * 0.15;
  return col;
}

// Light the blobs throw onto a room surface.
vec3 roomLight(vec3 p, vec3 n) {
  vec3 l = vec3(0.0);
  for (int i = 0; i < BLOBS; i++) {
    vec3 d = blob[i].xyz - p;
    float dist = max(length(d) - blob[i].w, 0.05);
    float lam = max(dot(n, normalize(d)), 0.0);
    l += blobCol[i] * blob[i].w * blob[i].w * lam / (dist * dist + 0.15);
  }
  return l;
}

// Haze: light scattered from each blob along the view ray up to tEnd.
vec3 haze(vec3 ro, vec3 rd, float tEnd) {
  vec3 h = vec3(0.0);
  for (int i = 0; i < BLOBS; i++) {
    vec3 oc = blob[i].xyz - ro;
    float tc = clamp(dot(oc, rd), 0.0, tEnd);
    float d = length(oc - rd * tc);
    float r = blob[i].w;
    // Wide scatter for the room's haze, plus a tight halo that reads as bloom.
    h += blobCol[i] * r * r * (1.0 / (d * d + 0.35 * r + 0.05) + 1.5 * exp(-6.0 * max(d - r, 0.0)));
  }
  return h;
}

float dust(vec3 ro, vec3 rd, float planeZ, float scale, float t, float tEnd) {
  float s = (planeZ - ro.z) / rd.z;
  if (s <= 0.0 || s > tEnd) return 0.0;
  vec2 q = (ro + rd * s).xy * scale + vec2(0.3 * sin(t * 0.05) * scale, -t * 0.06 * scale);
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(cell + planeZ);
  float show = step(h, 0.05 + 0.35 * uTreble);
  vec2 jitter = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
  float size = 0.04 + 0.05 * hash(cell + 1.3);
  float twinkle = 0.5 + 0.5 * sin(t * 1.5 + h * 40.0);
  return smoothstep(size, 0.0, length(f - jitter)) * show * twinkle;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uFlow;
  float lit = 0.5 + 0.5 * uIntensity;
  uWobble = t;
  placeBlobs(t, lit);

  // Camera: low in the room, drifting slowly, as if someone were wandering.
  vec3 ro = vec3(1.1 * sin(t * 0.021), -0.4 + 0.15 * sin(t * 0.017), 2.2 + 0.4 * sin(t * 0.013));
  vec3 target = vec3(0.4 * sin(t * 0.017 + 1.0), -0.2, -3.5);
  vec3 fw = normalize(target - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.2 + rt * uv.x + up * uv.y);

  // Lamp surfaces: an analytic floor, crown and curved glass wall, all seen from inside.
  float tFloor = rd.y < 0.0 ? (FLOOR_Y - ro.y) / rd.y : 1e3;
  float tCeil = rd.y > 0.0 ? (CEIL_Y - ro.y) / rd.y : 1e3;
  vec2 oc = ro.xz - LAMP_C;
  float qa = dot(rd.xz, rd.xz);
  float qb = dot(oc, rd.xz);
  float qc = dot(oc, oc) - LAMP_R * LAMP_R;
  float tWall = (-qb + sqrt(max(qb * qb - qa * qc, 0.0))) / max(qa, 1e-5);
  float tRoom = min(min(tFloor, tCeil), tWall);
  float tBlob = march(ro, rd, min(tRoom, 18.0), 80);

  vec3 cyan = vec3(0.10, 0.75, 1.0);
  vec3 magenta = vec3(0.85, 0.15, 0.85);
  vec3 col;
  float tEnd;
  if (tBlob > 0.0) {
    tEnd = tBlob;
    col = shadeBlob(ro + rd * tBlob, rd);
  } else if (tFloor <= tRoom) {
    tEnd = tFloor;
    vec3 p = ro + rd * tFloor;
    vec3 n = vec3(0.0, 1.0, 0.0);
    // Wet dark metal: puddles are mirror-smooth, the rest is rougher.
    float wet = smoothstep(0.45, 0.6, noise(p.xz * 0.7));
    float mott = 0.75 + 0.25 * noise(p.xz * 1.3) + 0.08 * noise(p.xz * 9.0);
    col = vec3(0.008, 0.014, 0.03) * mott + roomLight(p, n) * 0.55 * mott;
    // Neon light from the base ring, falling off away from the glass.
    float edge = length(p.xz - LAMP_C) / LAMP_R;
    col += cyan * 0.06 * smoothstep(0.6, 1.0, edge) * lit;
    float rough = mix(0.06, 0.008, wet);
    vec3 rr = reflect(rd, n);
    rr = normalize(rr + rough * vec3(noise(p.xz * 6.0) - 0.5, 0.0, noise(p.xz * 6.0 + 7.0) - 0.5));
    float tr = march(p + n * 0.01, rr, 12.0, 64);
    float fres = mix(0.1, 0.35, wet) + 0.6 * pow(1.0 - max(rr.y, 0.0), 4.0);
    vec3 refl;
    if (tr > 0.0) {
      refl = shadeBlob(p + rr * tr, rr);
    } else {
      // Reflected neon: the base ring seen in the wet floor.
      vec2 o2 = p.xz - LAMP_C;
      float b2 = dot(o2, rr.xz);
      float a2 = dot(rr.xz, rr.xz);
      float tw = (-b2 + sqrt(max(b2 * b2 - a2 * (dot(o2, o2) - LAMP_R * LAMP_R), 0.0))) / max(a2, 1e-5);
      float yw = p.y + rr.y * tw;
      refl = cyan * exp(-abs(yw - FLOOR_Y - 0.25) * 18.0) * 1.5 * lit + haze(p, rr, 8.0) * 0.04;
    }
    col += refl * fres * exp(-0.12 * max(tr, 0.0));
  } else if (tCeil < tWall) {
    tEnd = tCeil;
    vec3 p = ro + rd * tCeil;
    float rad = length(p.xz - LAMP_C) / LAMP_R;
    col = vec3(0.004, 0.008, 0.02) + roomLight(p, vec3(0.0, -1.0, 0.0)) * 0.06;
    col += magenta * exp(-abs(rad - 0.92) * 40.0) * 0.6 * lit;
    col += cyan * exp(-abs(rad - 0.55) * 60.0) * 0.25 * lit;
  } else {
    tEnd = tWall;
    vec3 p = ro + rd * tWall;
    vec2 radial = (p.xz - LAMP_C) / LAMP_R;
    float ang = atan(radial.y, radial.x);
    vec3 n = -vec3(radial.x, 0.0, radial.y);
    // Ribbed glass: light catches the ridges, and the blobs glow through it.
    float rib = 0.6 + 0.4 * pow(abs(cos(ang * 36.0)), 6.0);
    col = vec3(0.01, 0.022, 0.05) * rib + roomLight(p, n) * 0.25 * rib;
    float fresW = pow(1.0 - abs(dot(n, rd)), 3.0);
    col += cyan * 0.03 * fresW * rib;
    // Neon: a cyan ring at the base, a magenta one at the crown, faint vertical strips.
    float ringLo = exp(-abs(p.y - FLOOR_Y - 0.25) * 18.0);
    float ringHi = exp(-abs(p.y - CEIL_Y + 0.3) * 14.0);
    float strip = pow(abs(cos(ang * 3.0 + 0.4)), 300.0) * smoothstep(CEIL_Y, FLOOR_Y, p.y);
    col += (cyan * (ringLo * 1.5 + strip * 0.35) + magenta * ringHi * 0.9) * lit;
  }

  // Distance fog, so the back of the room dissolves into dark blue.
  vec3 fogCol = vec3(0.006, 0.014, 0.036) * (0.8 + 0.6 * uIntensity);
  col = mix(fogCol, col, exp(-0.07 * max(tEnd - 2.0, 0.0)));
  col += haze(ro, rd, tEnd) * 0.09;

  vec3 dustCol = vec3(0.55, 0.78, 1.0) * (0.05 + 0.3 * uTreble) * lit;
  col += dustCol * dust(ro, rd, -1.0, 4.0, t, tEnd);
  col += dustCol * dust(ro, rd, 1.0, 7.0, t + 13.0, tEnd);
  col += dustCol * dust(ro, rd, 2.6, 11.0, t + 29.0, tEnd);

  col *= 1.0 + 0.05 * uFlash;

  col *= 1.0 - 0.55 * pow(length(uv * vec2(0.75, 1.0)), 2.2);
  col = aces(col * 1.1);
  col = pow(col, vec3(0.92));
  col += (hash(gl_FragCoord.xy + fract(t * 7.0)) - 0.5) * 0.012;
  outColor = vec4(col, 1.0);
}
`;
