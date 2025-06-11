#version 300 es
layout(location=0) in vec2 a_pos;
uniform vec2 u_texSize;
uniform vec2 u_canvasSize;
out vec2 v_uv;
void main() {
    // Calculate aspect ratios
    float texAspect = u_texSize.x / u_texSize.y;
    float canvasAspect = u_canvasSize.x / u_canvasSize.y;
    vec2 pos = a_pos;
    // Stretch quad to fill canvas, but keep terrain square
    if (canvasAspect > texAspect) {
        // Canvas is wider than texture: stretch X
        pos.y *= canvasAspect / texAspect;
    } else {
        // Canvas is taller than texture: stretch Y
        pos.x *= texAspect / canvasAspect;
    }
    v_uv = (a_pos + 1.0) * 0.5;
    gl_Position = vec4(pos, 0, 1);
}
