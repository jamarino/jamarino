#version 300 es
precision mediump float;
uniform sampler2D u_input;
uniform float da;
uniform float db;
uniform float f;
uniform float k;
uniform float t;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
    ivec2 texSize = textureSize(u_input, 0);
    vec2 onePixel = 1.0 / vec2(texSize);
    // 5x5 Laplacian kernel (binomial/Gaussian-weighted, sum = 0)
    float kernel[25];
    kernel[ 0] = 1.0;  kernel[ 1] = 4.0;  kernel[ 2] = 6.0;  kernel[ 3] = 4.0;  kernel[ 4] = 1.0;
    kernel[ 5] = 4.0;  kernel[ 6] = 16.0; kernel[ 7] = 24.0; kernel[ 8] = 16.0; kernel[ 9] = 4.0;
    kernel[10] = 6.0;  kernel[11] = 24.0; kernel[12] = -220.0; kernel[13] = 24.0; kernel[14] = 6.0;
    kernel[15] = 4.0;  kernel[16] = 16.0; kernel[17] = 24.0; kernel[18] = 16.0; kernel[19] = 4.0;
    kernel[20] = 1.0;  kernel[21] = 4.0;  kernel[22] = 6.0;  kernel[23] = 4.0;  kernel[24] = 1.0;
    for (int i = 0; i < 25; ++i) kernel[i] /= 220.0;
    float laplaceA = 0.0;
    float laplaceB = 0.0;
    int idx = 0;
    float A = texture(u_input, v_texCoord).r;
    float B = texture(u_input, v_texCoord).g;
    for (int j = -2; j <= 2; ++j) {
        for (int i = -2; i <= 2; ++i) {
            vec2 offset = vec2(float(i), float(j)) * onePixel;
            vec3 s = texture(u_input, v_texCoord + offset).rgb;
            laplaceA += s.r * kernel[idx];
            laplaceB += s.g * kernel[idx];
            idx++;
        }
    }
    // Gray-Scott equations
    float reaction = A * B * B;
    float dA = da * laplaceA - reaction + f * (1.0 - A);
    float dB = db * laplaceB + reaction - (k + f) * B;
    float newA = A + dA * t;
    float newB = B + dB * t;

    newA = clamp(newA, 0.0, 1.0);
    newB = clamp(newB, 0.0, 1.0);
    outColor = vec4(newA, newB, 0.0, 1.0);
}
