export const sporeRenderVertShader = `
attribute float a_index;
uniform sampler2D u_state;
uniform float u_texSize;
uniform float u_width;
uniform float u_height;
void main() {
  float idx = a_index;
  float x = mod(idx, u_texSize);
  float y = floor(idx / u_texSize);
  vec2 uv = (vec2(x, y) + 0.5) / u_texSize;
  vec4 state = texture2D(u_state, uv);
  vec2 pos = vec2(state.r / u_width, state.g / u_height) * 2.0 - 1.0;
  gl_Position = vec4(pos, 0, 1);
  gl_PointSize = 8.0;
}
`;
