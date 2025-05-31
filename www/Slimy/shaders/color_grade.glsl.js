export const colorGradeShader = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_hueShift;
varying vec2 v_uv;
vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
  return c.z * mix(vec3(1.0), rgb, c.y);
}
void main() {
  float v = texture2D(u_texture, v_uv).r;
  float baseHueA = u_hueShift - 0.4; // dark
  float baseHueB = u_hueShift; // light
  float hue = mix(baseHueA, baseHueB, pow(v, 1.1));
  hue = mod(hue, 1.0); // wrap
  float sat = 0.2 + 0.3 * v;
  vec3 color = hsv2rgb(vec3(hue, sat, v));
  gl_FragColor = vec4(color, 1.0);
}
`;
