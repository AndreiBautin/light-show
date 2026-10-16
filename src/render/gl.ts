/** Small WebGL2 helpers shared by the scene and post passes. */

// A single oversized triangle covers the screen with no seam down the diagonal.
const VERTEX_SHADER = /* glsl */ `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

export interface Target {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
}

/**
 * Start compiling and linking a full-screen program. Does not wait: drivers
 * compile in the background, and asking for the result is what blocks. Call
 * `finishProgram` when the program is first needed.
 */
export function startProgram(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return program;
}

/** Wait for a program started with `startProgram`; throws with the driver's log if it failed. */
export function finishProgram(gl: WebGL2RenderingContext, program: WebGLProgram): void {
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  const logs = (gl.getAttachedShaders(program) ?? [])
    .map((s) => gl.getShaderInfoLog(s) ?? '')
    .filter((l) => l.trim().length > 0);
  throw new Error(logs.join('\n') || (gl.getProgramInfoLog(program) ?? 'link failed'));
}

/** Compile, link and check in one go, for programs needed immediately. */
export function linkNow(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  const program = startProgram(gl, fragment);
  finishProgram(gl, program);
  return program;
}

export function createTarget(gl: WebGL2RenderingContext, width: number, height: number): Target {
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

export function deleteTarget(gl: WebGL2RenderingContext, target: Target): void {
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

/** Draw the full-screen triangle into a target, or the canvas when `target` is null. */
export function drawInto(
  gl: WebGL2RenderingContext,
  target: Target | null,
  width: number,
  height: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function bindTexture(gl: WebGL2RenderingContext, unit: number, target: Target): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, target.texture);
}
