import { bindTexture, createTarget, deleteTarget, drawInto, linkNow, type Target } from './gl';
import { COMPOSITE_SHADER, DOWNSAMPLE_SHADER, UPSAMPLE_SHADER } from './post.frag';

/** Look of the bloom pass. */
const BLOOM = {
  threshold: 0.45,
  strength: 0.7,
  mips: 6,
} as const;

export interface Post {
  /** Size the mip chain for a scene target of this size. */
  resize(width: number, height: number): void;
  /** Bloom `scene` and composite it to the canvas. */
  run(
    scene: Target,
    canvasWidth: number,
    canvasHeight: number,
    brightness: number,
    flow: number,
  ): void;
}

/**
 * Bloom as a mip chain (threshold, downsample, tent-upsample back up) and the
 * composite that adds it, fades and tonemaps. Uniform locations are looked
 * up once here, not every frame.
 */
export function createPost(gl: WebGL2RenderingContext): Post {
  const down = linkNow(gl, DOWNSAMPLE_SHADER);
  const up = linkNow(gl, UPSAMPLE_SHADER);
  const composite = linkNow(gl, COMPOSITE_SHADER);
  const u = (p: WebGLProgram, name: string): WebGLUniformLocation | null =>
    gl.getUniformLocation(p, name);
  const downU = {
    src: u(down, 'uSrc'),
    texel: u(down, 'uSrcTexel'),
    out: u(down, 'uOutSize'),
    prefilter: u(down, 'uPrefilter'),
    threshold: u(down, 'uThreshold'),
  };
  const upU = { src: u(up, 'uSrc'), texel: u(up, 'uSrcTexel'), out: u(up, 'uOutSize') };
  const compU = {
    scene: u(composite, 'uScene'),
    bloom: u(composite, 'uBloom'),
    resolution: u(composite, 'uResolution'),
    strength: u(composite, 'uBloomStrength'),
    flow: u(composite, 'uFlow'),
    brightness: u(composite, 'uBrightness'),
  };

  let mips: Target[] = [];
  let size = '';

  return {
    resize(width, height) {
      const key = `${width}x${height}`;
      if (key === size) return;
      size = key;
      for (const m of mips) deleteTarget(gl, m);
      mips = [];
      let w = width;
      let h = height;
      for (let i = 0; i < BLOOM.mips; i++) {
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
        mips.push(createTarget(gl, w, h));
      }
    },

    run(scene, canvasWidth, canvasHeight, brightness, flow) {
      // Threshold into the first mip, then halve down the chain...
      gl.useProgram(down);
      gl.uniform1i(downU.src, 0);
      gl.uniform1f(downU.threshold, BLOOM.threshold);
      let from = scene;
      mips.forEach((mip, i) => {
        bindTexture(gl, 0, from);
        gl.uniform2f(downU.texel, 1 / from.width, 1 / from.height);
        gl.uniform2f(downU.out, mip.width, mip.height);
        gl.uniform1f(downU.prefilter, i === 0 ? 1 : 0);
        drawInto(gl, mip, mip.width, mip.height);
        from = mip;
      });

      // ...and add each mip back into the one above it.
      gl.useProgram(up);
      gl.uniform1i(upU.src, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = mips.length - 1; i > 0; i--) {
        const small = mips[i];
        const big = mips[i - 1];
        if (!small || !big) continue;
        bindTexture(gl, 0, small);
        gl.uniform2f(upU.texel, 1 / small.width, 1 / small.height);
        gl.uniform2f(upU.out, big.width, big.height);
        drawInto(gl, big, big.width, big.height);
      }
      gl.disable(gl.BLEND);

      const bloom = mips[0];
      if (!bloom) return;
      gl.useProgram(composite);
      bindTexture(gl, 0, scene);
      bindTexture(gl, 1, bloom);
      gl.uniform1i(compU.scene, 0);
      gl.uniform1i(compU.bloom, 1);
      gl.uniform2f(compU.resolution, canvasWidth, canvasHeight);
      gl.uniform1f(compU.strength, BLOOM.strength / BLOOM.mips);
      gl.uniform1f(compU.flow, flow);
      gl.uniform1f(compU.brightness, brightness);
      drawInto(gl, null, canvasWidth, canvasHeight);
    },
  };
}
