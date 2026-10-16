import type { ShowState } from '../analysis/show';
import { createPost } from './bloom';
import {
  createTarget,
  deleteTarget,
  drawInto,
  finishProgram,
  startProgram,
  type Target,
} from './gl';
import { SCENES } from './scenes';

/**
 * Every per-frame scalar a scene reads, and where it comes from in ShowState.
 * The names must match the uniforms in SCENE_HEADER; a test holds them together.
 */
export const SCALARS = {
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
const SCALAR_NAMES = Object.keys(SCALARS) as ScalarName[];

export interface Renderer {
  /**
   * Draw one frame of scene `scene` (an index into SCENES), dimmed by
   * `brightness` 0..1, with the scene rendered at `scale` of canvas size.
   */
  draw(state: ShowState, scene: number, brightness: number, scale: number): void;
}

/** A scene's program: compiling, ready with its uniform locations, or failed. */
type SceneProgram =
  | { readonly kind: 'pending'; readonly program: WebGLProgram }
  | {
      readonly kind: 'ready';
      readonly program: WebGLProgram;
      readonly resolution: WebGLUniformLocation | null;
      readonly scalars: readonly (readonly [
        WebGLUniformLocation | null,
        (s: ShowState) => number,
      ])[];
    }
  | { readonly kind: 'failed' };

// KHR_parallel_shader_compile: lets us ask "done yet?" without blocking.
const COMPLETION_STATUS_KHR = 0x91b1;

/**
 * Three stages per frame: the scene into an HDR target, a bloom mip chain
 * built from it, and a composite to the screen that adds the bloom and tonemaps.
 *
 * Scenes compile in parallel in the background from the start; a scene is
 * only waited for when it is first drawn, so the first frame waits for one
 * shader rather than all of them.
 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  onSceneFailed: (sceneId: string, detail: string) => void,
): Renderer {
  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available');
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('Rendering to float textures (EXT_color_buffer_float) is not available');
  }
  const parallel = gl.getExtension('KHR_parallel_shader_compile') !== null;
  gl.bindVertexArray(gl.createVertexArray());

  const programs: SceneProgram[] = SCENES.map((s) => ({
    kind: 'pending',
    program: startProgram(gl, s.fragment),
  }));
  const post = createPost(gl);

  /** Wait for scene i's program if needed and record the outcome. */
  const resolve = (i: number): SceneProgram | undefined => {
    const p = programs[i];
    if (p?.kind !== 'pending') return p;
    let next: SceneProgram;
    try {
      finishProgram(gl, p.program);
      next = {
        kind: 'ready',
        program: p.program,
        resolution: gl.getUniformLocation(p.program, 'uResolution'),
        scalars: SCALAR_NAMES.map(
          (n) => [gl.getUniformLocation(p.program, n), SCALARS[n]] as const,
        ),
      };
    } catch (err) {
      onSceneFailed(SCENES[i]?.id ?? String(i), err instanceof Error ? err.message : 'unknown');
      next = { kind: 'failed' };
    }
    programs[i] = next;
    return next;
  };

  /** Pick up any background compiles that have finished, without blocking. */
  const collectFinished = (): void => {
    if (!parallel) return;
    programs.forEach((p, i) => {
      if (
        p.kind === 'pending' &&
        gl.getProgramParameter(p.program, COMPLETION_STATUS_KHR) === true
      ) {
        resolve(i);
      }
    });
  };

  let sceneTarget: Target | undefined;

  // Canvas at CSS-pixel resolution; the scene itself at `scale` of that.
  const resize = (scale: number): Target => {
    const ratio = Math.min(window.devicePixelRatio, 1);
    const cw = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const ch = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const sw = Math.max(1, Math.round(cw * scale));
    const sh = Math.max(1, Math.round(ch * scale));
    if (!sceneTarget || sceneTarget.width !== sw || sceneTarget.height !== sh) {
      if (sceneTarget) deleteTarget(gl, sceneTarget);
      sceneTarget = createTarget(gl, sw, sh);
      post.resize(sw, sh);
    }
    return sceneTarget;
  };

  return {
    draw(state, sceneIndex, brightness, scale) {
      const target = resize(scale);
      collectFinished();
      const scene = resolve(sceneIndex);
      if (scene?.kind === 'ready') {
        gl.useProgram(scene.program);
        gl.uniform2f(scene.resolution, target.width, target.height);
        for (const [location, read] of scene.scalars) gl.uniform1f(location, read(state));
        drawInto(gl, target, target.width, target.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      post.run(target, canvas.width, canvas.height, brightness, state.flow);
    },
  };
}
