import type { ShowState } from '../analysis/show';
import { FRAGMENT_SHADER } from './scene.frag';

// A single oversized triangle covers the screen with no seam down the diagonal.
const VERTEX_SHADER = /* glsl */ `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

const UNIFORMS = [
  'uResolution',
  'uFlow',
  'uBass',
  'uTreble',
  'uPulse',
  'uFlash',
  'uBeats',
] as const;
type UniformName = (typeof UNIFORMS)[number];

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
  const loc = {} as Record<UniformName, WebGLUniformLocation | null>;
  for (const name of UNIFORMS) loc[name] = gl.getUniformLocation(program, name);

  // Render below native resolution on dense screens: the field is soft anyway.
  const resize = (): void => {
    const scale = Math.min(window.devicePixelRatio, 1.5);
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
      gl.uniform2f(loc.uResolution, canvas.width, canvas.height);
      gl.uniform1f(loc.uFlow, state.flow);
      gl.uniform1f(loc.uBass, state.bass);
      gl.uniform1f(loc.uTreble, state.treble);
      gl.uniform1f(loc.uPulse, state.pulse);
      gl.uniform1f(loc.uFlash, state.flash);
      gl.uniform1f(loc.uBeats, state.beats);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
