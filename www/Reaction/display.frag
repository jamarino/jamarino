#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec2 onePixel = 1.0 / vec2(textureSize(u_texture, 0));
    vec2 uv = v_texCoord;
    vec3 right = texture(u_texture, uv + vec2(onePixel.x, 0.0)).rgb;
    vec3 left  = texture(u_texture, uv - vec2(onePixel.x, 0.0)).rgb;
    vec3 up    = texture(u_texture, uv + vec2(0.0, onePixel.y)).rgb;
    vec3 down  = texture(u_texture, uv - vec2(0.0, onePixel.y)).rgb;
    vec3 dx = right - left;
    vec3 dy = up - down;
    float slope = length(dx) + length(dy);
    float intensity = smoothstep(0.01, 0.3, slope);
    outColor = vec4(vec3(intensity), 1.0);
}
