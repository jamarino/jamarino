export const blurFadeShader = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_fade;
uniform float u_subtract;
uniform vec2 u_texel;
varying vec2 v_uv;
void main() {
  float kernel[25];
  kernel[0]=1.0; kernel[1]=4.0; kernel[2]=6.0; kernel[3]=4.0; kernel[4]=1.0;
  kernel[5]=4.0; kernel[6]=16.0; kernel[7]=24.0; kernel[8]=16.0; kernel[9]=4.0;
  kernel[10]=6.0; kernel[11]=24.0; kernel[12]=36.0; kernel[13]=24.0; kernel[14]=6.0;
  kernel[15]=4.0; kernel[16]=16.0; kernel[17]=24.0; kernel[18]=16.0; kernel[19]=4.0;
  kernel[20]=1.0; kernel[21]=4.0; kernel[22]=6.0; kernel[23]=4.0; kernel[24]=1.0;
  float norm = 256.0;
  vec3 color =
    kernel[0] * texture2D(u_texture, v_uv + u_texel * vec2(-2.0, -2.0)).rgb +
    kernel[1] * texture2D(u_texture, v_uv + u_texel * vec2(-1.0, -2.0)).rgb +
    kernel[2] * texture2D(u_texture, v_uv + u_texel * vec2( 0.0, -2.0)).rgb +
    kernel[3] * texture2D(u_texture, v_uv + u_texel * vec2( 1.0, -2.0)).rgb +
    kernel[4] * texture2D(u_texture, v_uv + u_texel * vec2( 2.0, -2.0)).rgb +
    kernel[5] * texture2D(u_texture, v_uv + u_texel * vec2(-2.0, -1.0)).rgb +
    kernel[6] * texture2D(u_texture, v_uv + u_texel * vec2(-1.0, -1.0)).rgb +
    kernel[7] * texture2D(u_texture, v_uv + u_texel * vec2( 0.0, -1.0)).rgb +
    kernel[8] * texture2D(u_texture, v_uv + u_texel * vec2( 1.0, -1.0)).rgb +
    kernel[9] * texture2D(u_texture, v_uv + u_texel * vec2( 2.0, -1.0)).rgb +
    kernel[10] * texture2D(u_texture, v_uv + u_texel * vec2(-2.0, 0.0)).rgb +
    kernel[11] * texture2D(u_texture, v_uv + u_texel * vec2(-1.0, 0.0)).rgb +
    kernel[12] * texture2D(u_texture, v_uv + u_texel * vec2( 0.0, 0.0)).rgb +
    kernel[13] * texture2D(u_texture, v_uv + u_texel * vec2( 1.0, 0.0)).rgb +
    kernel[14] * texture2D(u_texture, v_uv + u_texel * vec2( 2.0, 0.0)).rgb +
    kernel[15] * texture2D(u_texture, v_uv + u_texel * vec2(-2.0, 1.0)).rgb +
    kernel[16] * texture2D(u_texture, v_uv + u_texel * vec2(-1.0, 1.0)).rgb +
    kernel[17] * texture2D(u_texture, v_uv + u_texel * vec2( 0.0, 1.0)).rgb +
    kernel[18] * texture2D(u_texture, v_uv + u_texel * vec2( 1.0, 1.0)).rgb +
    kernel[19] * texture2D(u_texture, v_uv + u_texel * vec2( 2.0, 1.0)).rgb +
    kernel[20] * texture2D(u_texture, v_uv + u_texel * vec2(-2.0, 2.0)).rgb +
    kernel[21] * texture2D(u_texture, v_uv + u_texel * vec2(-1.0, 2.0)).rgb +
    kernel[22] * texture2D(u_texture, v_uv + u_texel * vec2( 0.0, 2.0)).rgb +
    kernel[23] * texture2D(u_texture, v_uv + u_texel * vec2( 1.0, 2.0)).rgb +
    kernel[24] * texture2D(u_texture, v_uv + u_texel * vec2( 2.0, 2.0)).rgb;
  color /= norm;
  color *= u_fade;
  color = max(color - vec3(u_subtract), 0.0);
  gl_FragColor = vec4(color, 1.0);
}
`;
