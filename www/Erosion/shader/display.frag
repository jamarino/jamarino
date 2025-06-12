#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_heightmap;
void main() {
    vec4 terrain = texture(u_heightmap, v_uv);
    float h = terrain.r;
    vec3 color;
    if (h < 20.0) {
        color = vec3(0.0, 0.2, 0.8); // blue
    } else if (h < 30.0) {
        color = vec3(1.0, 1.0, 0.2); // yellow
    } else if (h < 60.0) {
        color = vec3(0.2, 0.8, 0.2); // green
    } else if (h < 120.0) {
        color = vec3(0.5, 0.5, 0.5); // grey
    } else {
        color = vec3(1.0, 1.0, 1.0); // white
    }

    vec3 lightDir = normalize(vec3(-1, -1, .3));
    vec3 sunlightColor = vec3(1.0, 0.9, 0.75);
    vec3 skyColor = vec3(0.3, 0.4, 0.8);

    vec3 normal = normalize(cross(vec3(0, -1, terrain.b), vec3(1, 0, terrain.g)));
    float light = dot(normal, lightDir);
    light = smoothstep(0.01, 0.1, light);

    color = mix(sunlightColor * color, skyColor * color, light);

    outColor = vec4(color.rgb, 1.0);
}
