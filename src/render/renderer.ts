import type { ShowState } from '../analysis/show';
import { COMPOSITE_SHADER, DOWNSAMPLE_SHADER, UPSAMPLE_SHADER } from './post.frag';
import { SCENES } from './scenes';

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
  /** Draw one frame of scene `scene` (an index into SCENES), dimmed by `brightness` 0..1. */
  draw(state: ShowState, scene: number, brightness: number): void;
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

/** Look of the bloom pass. */
const POST = {
  bloomThreshold: 0.45,
  bloomStrength: 0.7,
  bloomMips: 6,
} as const;

interface Program {
  readonly program: WebGLProgram;
  uniform(name: string): WebGLUniformLocation | null;
}

interface Target {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
}

function link(gl: WebGL2RenderingContext, fragment: string): Program {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program) ?? ''}`);
  }
  // Locations are null for uniforms a shader does not use; uniform*() ignores null.
  return { program, uniform: (name) => gl.getUniformLocation(program, name) };
}

function createTarget(gl: WebGL2RenderingContext, width: number, height: number): Target {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return { texture, framebuffer, width, height };
}

function deleteTarget(gl: WebGL2RenderingContext, target: Target): void {
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

/**
 * Three stages per frame: the scene into an HDR target, a bloom mip chain
 * built from it, and a composite to the screen that adds the bloom and tonemaps.
 */
export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available');
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('Rendering to float textures (EXT_color_buffer_float) is not available');
  }
  gl.bindVertexArray(gl.createVertexArray());

  // Every scene compiles up front, so switching never stalls mid-show.
  const scenes = SCENES.map((s) => {
    const program = link(gl, s.fragment);
    const names = Object.keys(SCALARS) as ScalarName[];
    return {
      program: program.program,
      resolution: program.uniform('uResolution'),
      scalars: names.map((name) => [program.uniform(name), SCALARS[name]] as const),
    };
  });
  const down = link(gl, DOWNSAMPLE_SHADER);
  const up = link(gl, UPSAMPLE_SHADER);
  const composite = link(gl, COMPOSITE_SHADER);

  let sceneTarget: Target | undefined;
  let mips: Target[] = [];

  // Render at CSS-pixel resolution: some scenes are too costly at native density.
  const resize = (): void => {
    const scale = Math.min(window.devicePixelRatio, 1);
    const w = Math.max(1, Math.floor(canvas.clientWidth * scale));
    const h = Math.max(1, Math.floor(canvas.clientHeight * scale));
    if (sceneTarget && canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    if (sceneTarget) deleteTarget(gl, sceneTarget);
    for (const m of mips) deleteTarget(gl, m);
    sceneTarget = createTarget(gl, w, h);
    mips = [];
    let mw = w;
    let mh = h;
    for (let i = 0; i < POST.bloomMips; i++) {
      mw = Math.max(1, Math.floor(mw / 2));
      mh = Math.max(1, Math.floor(mh / 2));
      mips.push(createTarget(gl, mw, mh));
    }
  };

  const drawInto = (target: Target | null, width: number, height: number): void => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const sample = (unit: number, target: Target): void => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
  };

  return {
    draw(state, sceneIndex, brightness) {
      resize();
      const scene = scenes[sceneIndex];
      if (!sceneTarget || !scene) return;
      const src = sceneTarget;

      gl.useProgram(scene.program);
      gl.uniform2f(scene.resolution, src.width, src.height);
      for (const [location, read] of scene.scalars) gl.uniform1f(location, read(state));
      drawInto(src, src.width, src.height);

      // Bloom: threshold into the first mip, then halve down the chain...
      gl.useProgram(down.program);
      gl.uniform1i(down.uniform('uSrc'), 0);
      gl.uniform1f(down.uniform('uThreshold'), POST.bloomThreshold);
      let from = src;
      mips.forEach((mip, i) => {
        sample(0, from);
        gl.uniform2f(down.uniform('uSrcTexel'), 1 / from.width, 1 / from.height);
        gl.uniform2f(down.uniform('uOutSize'), mip.width, mip.height);
        gl.uniform1f(down.uniform('uPrefilter'), i === 0 ? 1 : 0);
        drawInto(mip, mip.width, mip.height);
        from = mip;
      });

      // ...and add each mip back into the one above it.
      gl.useProgram(up.program);
      gl.uniform1i(up.uniform('uSrc'), 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = mips.length - 1; i > 0; i--) {
        const small = mips[i];
        const big = mips[i - 1];
        if (!small || !big) continue;
        sample(0, small);
        gl.uniform2f(up.uniform('uSrcTexel'), 1 / small.width, 1 / small.height);
        gl.uniform2f(up.uniform('uOutSize'), big.width, big.height);
        drawInto(big, big.width, big.height);
      }
      gl.disable(gl.BLEND);

      const bloom = mips[0];
      if (!bloom) return;
      gl.useProgram(composite.program);
      sample(0, src);
      sample(1, bloom);
      gl.uniform1i(composite.uniform('uScene'), 0);
      gl.uniform1i(composite.uniform('uBloom'), 1);
      gl.uniform2f(composite.uniform('uResolution'), canvas.width, canvas.height);
      gl.uniform1f(composite.uniform('uBloomStrength'), POST.bloomStrength / POST.bloomMips);
      gl.uniform1f(composite.uniform('uFlow'), state.flow);
      gl.uniform1f(composite.uniform('uBrightness'), brightness);
      drawInto(null, canvas.width, canvas.height);
    },
  };
}
