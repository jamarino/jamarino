// erosionSim.js
// Core logic for Erosion Simulation using WebGL2

import { makeNoise2D } from "./simplex/2d.js";

export class ErosionSim {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) {
            alert('WebGL2 not supported!');
            return;
        }
        // Bind resize handler
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
        this.init();
    }

    handleResize() {
        // Resize canvas to fill window
        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(window.innerWidth * dpr);
        const height = Math.round(window.innerHeight * dpr);
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            if (this.gl) {
                this.createDisplayBuffer();
            }
        }
    }

    init() {
        // Create display buffer (framebuffer + texture) matching canvas size
        this.createDisplayBuffer();
        // Create terrain texture (1024x1024, float32)
        this.createTerrainTexture();
        this.reset();
    }

    reset() {
        // TODO: Generate random terrain heightmap
        // TODO: Reset simulation state
        this.draw();
    }

    start() {
        // TODO: Start simulation loop
        this.running = true;
        this.loop();
    }

    loop() {
        if (!this.running) return;
        // TODO: Perform erosion step
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    draw() {
        // Render terrain to canvas as grayscale
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.2, 0.2, 0.3, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (!this.terrainProgram) {
            this.terrainProgram = this.createTerrainProgram();
            this.terrainQuad = this.createFullscreenQuad();
        }

        gl.useProgram(this.terrainProgram.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.terrainTexture);
        gl.uniform1i(this.terrainProgram.uniforms.u_heightmap, 0);
        gl.uniform2f(this.terrainProgram.uniforms.u_texSize, 1024.0, 1024.0);
        gl.uniform2f(this.terrainProgram.uniforms.u_canvasSize, this.canvas.width * 1.0, this.canvas.height * 1.0);

        gl.bindVertexArray(this.terrainQuad.vao);
        // Fix: Use gl.drawArrays with correct vertex count and unbind VAO after
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.useProgram(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    createFullscreenQuad() {
        const gl = this.gl;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        // Fullscreen quad: (x, y) in NDC
        const verts = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer after setup
        gl.bindVertexArray(null);
        return { vao, vbo };
    }

    createTerrainProgram() {
        const gl = this.gl;
        // Vertex shader: pass through
        const vsSource = `#version 300 es
        layout(location=0) in vec2 a_pos;
        out vec2 v_uv;
        void main() {
            v_uv = (a_pos + 1.0) * 0.5;
            gl_Position = vec4(a_pos, 0, 1);
        }`;
        // Fragment shader: sample heightmap, output grayscale
        const fsSource = `#version 300 es
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
        }`;
        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Shader link error: ' + gl.getProgramInfoLog(program));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return {
            program,
            uniforms: {
                u_heightmap: gl.getUniformLocation(program, 'u_heightmap'),
                u_texSize: gl.getUniformLocation(program, 'u_texSize'),
                u_canvasSize: gl.getUniformLocation(program, 'u_canvasSize'),
            }
        };
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    createDisplayBuffer() {
        const gl = this.gl;
        // Release previous if any
        if (this.displayTexture) gl.deleteTexture(this.displayTexture);
        if (this.displayFBO) gl.deleteFramebuffer(this.displayFBO);
        // Create texture
        this.displayTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.displayTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // Create framebuffer
        this.displayFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.displayFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.displayTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    createTerrainTexture() {
        const gl = this.gl;
        // Release previous if any
        if (this.terrainTexture) gl.deleteTexture(this.terrainTexture);
        // Create 1024x1024 float32 texture for terrain heightmap
        this.terrainTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.terrainTexture);
        // Generate a simple combination of sine functions for terrain
        const size = 1024;
        let front = new Float32Array(size * size);
        let back = new Float32Array(size * size);

        // add octaves of simplex noise
        const gradientFactor = 0.8;
        const scaleFactor = .5;
        const simplex = makeNoise2D(123);
        let octaves = [
            { scale: scaleFactor * 1.0 / 64,  weight: 0.5,  xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 32,  weight: 0.25, xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 16,  weight: 0.15, xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 8,   weight: 0.07, xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 4,   weight: 0.03, xoff: Math.random() * 1000, yoff: Math.random() * 1000 }
        ];

        // remove random offsets for debugging
        for (let octave of octaves) {
            octave.xoff = 0;
            octave.yoff = 0;
        }

        for (let octave of octaves) {
            for (let y = 0; y < size; ++y) {
                for (let x = 0; x < size; ++x) {
                    // sample front buffer to determine gradient
                    let height = front[y * size + x];
                    let dx = 0, dy = 0;
                    if (x > 0) dx = height - front[y * size + (x - 1)];
                    if (y > 0) dy = height - front[(y - 1) * size + x];

                    
                    const fx = (x + octave.xoff) * octave.scale;
                    const fy = (y + octave.yoff) * octave.scale;
                    let n = simplex(fx, fy);
                    let nx = simplex(fx-1, fy);
                    let ny = simplex(fx, fy-1);
                    
                    dx += (n - nx);
                    dy += (n - ny);
                    let gradient = Math.sqrt(dx * dx + dy * dy);

                    n = (n + 1) / 2.0; // Normalize to [0,1]
                    n = n / (1.0 + (gradientFactor * gradient)); // Scale by gradient factor
                    back[y * size + x] = height + n * octave.weight;
                }
            }

            // Swap buffers for next octave
            [front, back] = [back, front];
        }


        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, size, size, 0, gl.RED, gl.FLOAT, back);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}
