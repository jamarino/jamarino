#version 300 es
precision mediump float;
in vec2 a_position;
out vec2 v_texCoord;
void main() {
    v_texCoord = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0, 1);
}
