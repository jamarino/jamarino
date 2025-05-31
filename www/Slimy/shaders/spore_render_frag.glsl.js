export const sporeRenderFragShader = `
precision mediump float;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(1,1,1,0.8);
}
`;
