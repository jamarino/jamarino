#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_heightmap;
void main() {
    // Get the texture size in texels
    ivec2 texSize = textureSize(u_heightmap, 0);
    ivec2 coord = ivec2(gl_FragCoord.xy); // - ivec2(0, 0); // (0,0) if viewport matches texture
    ivec2 top_coord = clamp(coord + ivec2(0, -1), ivec2(0), texSize - ivec2(1));
    ivec2 left_coord = clamp(coord + ivec2(-1, 0), ivec2(0), texSize - ivec2(1));
    
    float center = texelFetch(u_heightmap, coord, 0).r;
    float left   = texelFetch(u_heightmap, left_coord, 0).r;
    float top    = texelFetch(u_heightmap, top_coord, 0).r;
    
    outColor = vec4(center, left - center, top - center, 1.0);
}
