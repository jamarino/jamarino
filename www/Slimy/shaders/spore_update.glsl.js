export const sporeUpdateShader = `
precision highp float;
uniform sampler2D u_state;
uniform sampler2D u_trail;
uniform float u_width;
uniform float u_height;
uniform float u_sampleDist;
uniform float u_time;
uniform float u_nudge;
uniform vec2 u_mouse;
uniform float u_mouseDown;
varying vec2 v_uv;
void main() {
  vec4 state = texture2D(u_state, v_uv);
  float x = state.r;
  float y = state.g;
  float angle = state.b;
  float phase = state.a;
  float speed = 2.0;
  float phaseSpeed = 0.01 + 0.02 * fract(sin(dot(v_uv, vec2(93.9898,18.233))) * 13758.5453);
  float bestValue = -1.0;
  float bestOffset = 0.0;
  float offsets[5];
  offsets[0] = -0.2617994; // -15deg
  offsets[1] = -0.0872665; // -5deg
  offsets[2] = 0.0;        // 0deg
  offsets[3] = 0.0872665;  // +5deg
  offsets[4] = 0.2617994;  // +15deg
  for (int i = 0; i < 5; i++) {
    float sampleAngle = angle + offsets[i];
    float sx = x + cos(sampleAngle) * u_sampleDist;
    float sy = y + sin(sampleAngle) * u_sampleDist;
    float u = clamp(sx / u_width, 0.0, 1.0);
    float v = clamp(sy / u_height, 0.0, 1.0);
    float value = texture2D(u_trail, vec2(u, v)).r;
    if (value > bestValue) {
      bestValue = value;
      bestOffset = offsets[i];
    }
  }
  if (bestValue > 0.1) {
      angle += bestOffset * u_nudge;
  }
  phase += phaseSpeed;
  angle += sin(phase) * 0.01;

  // Repel from mouse if active (invert y axis for canvas)
  if (u_mouseDown > 0.5) {
    float dx = x - u_mouse.x;
    float dy = y - (u_height - u_mouse.y);
    float dist = sqrt(dx*dx + dy*dy);
    float repelRadius = 300.0;
    if (dist < repelRadius && dist > 1.0) {
      float repelStrength = (1.0 - dist / repelRadius);
      float repelForce = 8.0 * repelStrength * repelStrength; // quadratic falloff
      float repelAngle = atan(dy, dx);
      angle += (repelAngle - angle) * repelStrength * 0.1;
      x += cos(repelAngle) * repelForce;
      y += sin(repelAngle) * repelForce;
    }
  }

  x += cos(angle) * speed;
  y += sin(angle) * speed;
  if (x < 0.0) {
    x = 0.0;
    angle = 3.1415926 - angle;
  } else if (x > u_width) {
    x = u_width;
    angle = 3.1415926 - angle;
  }
  if (y < 0.0) {
    y = 0.0;
    angle = -angle;
  } else if (y > u_height) {
    y = u_height;
    angle = -angle;
  }
  gl_FragColor = vec4(x, y, angle, phase);
}
`;
