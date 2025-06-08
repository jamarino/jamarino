#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_heightmap;
void main() {
    float h = texture(u_heightmap, v_uv).r;
    outColor = vec4(vec3(h), 1.0);
}
