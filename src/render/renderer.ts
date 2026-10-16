import type { ShowState } from '../analysis/show';
import { FRAGMENT_SHADER } from './scene.frag';

// A single oversized triangle covers the screen with no seam down the diagonal.
const VERTEX_SHADER = /* glsl */ `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

/** Every per-frame scalar the scene reads, and where it comes from in ShowState. */
const SCALARS = {
  uFlow: (s: ShowState) => s.flow,
  uBass: (s: ShowState) => s.bass,
  uMid: (s: ShowState) => s.mid,
  uTreble: (s: ShowState) => s.treble,
  uIntensity: (s: ShowState) => s.intensity,
  uBuild: (s: ShowState) => s.build,
  uRelease: (s: ShowState) => s.release,
  uPitch: (s: ShowState) => s.pitch,
  uFlash: (s: ShowState) => s.flash,
} as const;
type ScalarName = keyof typeof SCALARS;

export interface Renderer {
  draw(state: ShowState): void;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(shader) ?? ''}`);
  }
  return shader;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available');

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program) ?? ''}`);
  }
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());

  // Locations are null for uniforms a scene does not use; uniform*() ignores null.
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const names = Object.keys(SCALARS) as ScalarName[];
  const loc = names.map((name) => [gl.getUniformLocation(program, name), SCALARS[name]] as const);

  // Render at CSS-pixel resolution: the raymarched room is too costly at native density.
  const resize = (): void => {
    const scale = Math.min(window.devicePixelRatio, 1);
    const w = Math.floor(canvas.clientWidth * scale);
    const h = Math.floor(canvas.clientHeight * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  return {
    draw(state) {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      for (const [location, read] of loc) gl.uniform1f(location, read(state));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
