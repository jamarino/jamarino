#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_heightmap;
uniform vec2 u_texSize;
uniform vec2 u_canvasSize;
void main() {
    float texAspect = u_texSize.x / u_texSize.y;
    float canvasAspect = u_canvasSize.x / u_canvasSize.y;
    vec2 uv = v_uv;
    if (canvasAspect > texAspect) {
        float scale = texAspect / canvasAspect;
        uv.y = (uv.y - 0.5) * scale + 0.5;
    } else {
        float scale = canvasAspect / texAspect;
        uv.x = (uv.x - 0.5) * scale + 0.5;
    }
    float h = texture(u_heightmap, uv).r;
    outColor = vec4(vec3(h), 1.0);
}
