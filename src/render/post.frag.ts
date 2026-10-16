/**
 * Post-processing. The scene renders linear HDR colour; these passes turn it
 * into the final image. On a black screen of neon lines, bloom is most of the look.
 *
 * Bloom is the usual mip chain: a thresholded 13-tap downsample to half size,
 * further 13-tap downsamples, then 9-tap tent upsamples added back up the
 * chain. Each step is cheap and the wide, soft glow comes from the small mips.
 */

/** Downsample `uSrc` into a target half its size; `uPrefilter` 1 also thresholds. */
export const DOWNSAMPLE_SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;
uniform vec2 uOutSize;
uniform float uPrefilter;
uniform float uThreshold;
out vec4 outColor;

vec3 s(vec2 uv, float x, float y) { return texture(uSrc, uv + vec2(x, y) * uSrcTexel).rgb; }

void main() {
  vec2 uv = gl_FragCoord.xy / uOutSize;
  vec3 A = s(uv, -2.0, -2.0), B = s(uv, 0.0, -2.0), C = s(uv, 2.0, -2.0);
  vec3 D = s(uv, -1.0, -1.0), E = s(uv, 1.0, -1.0);
  vec3 F = s(uv, -2.0, 0.0), G = s(uv, 0.0, 0.0), H = s(uv, 2.0, 0.0);
  vec3 I = s(uv, -1.0, 1.0), J = s(uv, 1.0, 1.0);
  vec3 K = s(uv, -2.0, 2.0), L = s(uv, 0.0, 2.0), M = s(uv, 2.0, 2.0);
  vec3 c = (D + E + I + J) * 0.125
         + (A + B + F + G + B + C + G + H + F + G + K + L + G + H + L + M) * 0.03125;
  if (uPrefilter > 0.5) {
    // Soft-knee threshold, and a clamp so a single hot pixel cannot flicker the glow.
    c = min(c, vec3(16.0));
    float br = max(c.r, max(c.g, c.b));
    float knee = uThreshold * 0.5;
    float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    c *= max(soft, br - uThreshold) / max(br, 1e-4);
  }
  outColor = vec4(c, 1.0);
}
`;

/** Tent-filtered upsample of `uSrc`, added (by blending) into the next larger mip. */
export const UPSAMPLE_SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;
uniform vec2 uOutSize;
out vec4 outColor;

vec3 s(vec2 uv, float x, float y) { return texture(uSrc, uv + vec2(x, y) * uSrcTexel).rgb; }

void main() {
  vec2 uv = gl_FragCoord.xy / uOutSize;
  vec3 c = s(uv, -1.0, -1.0) + 2.0 * s(uv, 0.0, -1.0) + s(uv, 1.0, -1.0)
         + 2.0 * s(uv, -1.0, 0.0) + 4.0 * s(uv, 0.0, 0.0) + 2.0 * s(uv, 1.0, 0.0)
         + s(uv, -1.0, 1.0) + 2.0 * s(uv, 0.0, 1.0) + s(uv, 1.0, 1.0);
  outColor = vec4(c / 16.0, 1.0);
}
`;

/** Bloom, tonemap and grain, straight to the screen. */
export const COMPOSITE_SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uBloomStrength;
uniform float uFlow;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = texture(uScene, uv).rgb;
  col += texture(uBloom, uv).rgb * uBloomStrength;

  col = aces(col * 1.3);
  col = pow(col, vec3(0.92));
  col += (hash(gl_FragCoord.xy + fract(uFlow * 7.0)) - 0.5) * 0.012;
  outColor = vec4(col, 1.0);
}
`;
