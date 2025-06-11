#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_heightmap;
void main() {
    //float h = texture(u_heightmap, v_uv).r;
    vec4 terrain = texture(u_heightmap, v_uv);
    outColor = vec4(0, 20.0 * terrain.gb, 1.0);
}
