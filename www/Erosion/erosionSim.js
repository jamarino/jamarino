// erosionSim.js
// Core logic for Erosion Simulation using WebGL2

import { makeNoise2D } from "./simplex/2d.js";

// Helper to load shader source from a file (returns a Promise)
async function loadShaderSource(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load shader: ${url}`);
    return await response.text();
}

// Helper to create and compile a shader from file
async function createShaderFromFile(gl, type, url) {
    const source = await loadShaderSource(url);
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
}

export class ErosionSim {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) {
            alert('WebGL2 not supported!');
            return;
        }
        const ext = this.gl.getExtension('EXT_color_buffer_float');
        if (!ext) {
            alert('EXT_color_buffer_float not supported!');
            return;
        }
        // Bind resize handler
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
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

    async init() {
        // Create display buffer (framebuffer + texture) matching canvas size
        this.createDisplayBuffer();
        // Create simulation textures (front/back) for ping-pong
        this.createSimulationTextures();
        this.initSimulationTextures();
        await this.createTerrainProgram();
        await this.createDisplayProgram();
        this.createFullscreenQuad();
    }

    start() {
        this.running = true;
        this.loop();
    }

    loop() {
        if (!this.running) return;
        this.simulate();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    simulate() {
        const gl = this.gl;
        // Use ping-pong technique for simulation
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.simFrontFBO);
        gl.viewport(0, 0, 1024, 1024);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.terrainProgram.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.simBack);
        gl.uniform1i(this.terrainProgram.uniforms.u_heightmap, 0);
        // gl.uniform2f(this.terrainProgram.uniforms.u_texSize, 1024.0, 1024.0);

        // Draw fullscreen quad to simulate terrain
        gl.bindVertexArray(this.terrainQuad.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);

        // Swap both textures and framebuffers for next iteration
        [this.simFront, this.simBack] = [this.simBack, this.simFront];
        [this.simFrontFBO, this.simBackFBO] = [this.simBackFBO, this.simFrontFBO];

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    draw() {
        // Render terrain to canvas as grayscale
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.2, 0.2, 0.3, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.displayProgram.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.simFront);
        gl.uniform1i(this.displayProgram.uniforms.u_heightmap, 0);
        gl.uniform2f(this.displayProgram.uniforms.u_texSize, 1024.0, 1024.0);
        gl.uniform2f(this.displayProgram.uniforms.u_canvasSize, this.canvas.width * 1.0, this.canvas.height * 1.0);

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
        this.terrainQuad = { vao, vbo };
    }

    async createTerrainProgram() {
        const gl = this.gl;
        // Load shaders from external files
        const vs = await createShaderFromFile(gl, gl.VERTEX_SHADER, 'shader/terrain.vert');
        const fs = await createShaderFromFile(gl, gl.FRAGMENT_SHADER, 'shader/terrain.frag');
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Shader link error: ' + gl.getProgramInfoLog(program));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        this.terrainProgram = {
            program,
            uniforms: {
                u_heightmap: gl.getUniformLocation(program, 'u_heightmap'),
                u_texSize: gl.getUniformLocation(program, 'u_texSize'),
                u_canvasSize: gl.getUniformLocation(program, 'u_canvasSize'),
            }
        };
    }

    async createDisplayProgram() {
        const gl = this.gl;
        // Load shaders from external files
        const vs = await createShaderFromFile(gl, gl.VERTEX_SHADER, 'shader/display.vert');
        const fs = await createShaderFromFile(gl, gl.FRAGMENT_SHADER, 'shader/display.frag');
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Shader link error: ' + gl.getProgramInfoLog(program));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        this.displayProgram = {
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

    createSimulationTextures() {
        const gl = this.gl;
        const size = 1024;
        // Release previous if any
        if (this.simFront) gl.deleteTexture(this.simFront);
        if (this.simBack) gl.deleteTexture(this.simBack);
        if (this.simFrontFBO) gl.deleteFramebuffer(this.simFrontFBO);
        if (this.simBackFBO) gl.deleteFramebuffer(this.simBackFBO);
        // Create two float32 RGBA textures for simulation
        this.simFront = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.simFront);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.simBack = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.simBack);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // Create framebuffers for ping-pong
        this.simFrontFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.simFrontFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.simFront, 0);

        this.simBackFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.simBackFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.simBack, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    initSimulationTextures() {
        
        // Generate a simple combination of sine functions for terrain
        const size = 1024;
        let front = new Float32Array(size * size);
        let back = new Float32Array(size * size);

        // add octaves of simplex noise
        const gradientFactor = 80;
        const scaleFactor = 1;
        const simplex = makeNoise2D(123);
        let octaves = [
            { scale: scaleFactor * 1.0 / 256,  weight:    1, xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 128,  weight:  0.4, xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 32,   weight: 0.10, xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 16,   weight: 0.05, xoff: Math.random() * 1000, yoff: Math.random() * 1000 },
            { scale: scaleFactor * 1.0 / 2,    weight: 0.03, xoff: Math.random() * 1000, yoff: Math.random() * 1000 }
        ];

        let simplexLine = new Float32Array(size + 1);
        let simplexPrevLine = new Float32Array(size + 1);

        for (let octave of octaves) {
            for (let y = 0; y < size; ++y) {
                let fy = (y + octave.yoff) * octave.scale;
                for (let x = -1; x < size; ++x) { 
                    // fill simplex line with noise values
                    let fx = (x + octave.xoff) * octave.scale;
                    let n = simplex(fx, fy);
                    simplexLine[x+1] = (n + 1) / 2.0; // Normalize to [0,1]
                }

                for (let x = 0; x < size; ++x) {
                    // sample front buffer to determine gradient
                    let height = front[y * size + x];
                    let dx = 0, dy = 0;
                    if (x > 0) dx = height - front[y * size + (x - 1)];
                    if (y > 0) dy = height - front[(y - 1) * size + x];

                    let n = simplexLine[x]; // offet by 1 since cache starts at -1
                    let nx = simplexLine[x-1];
                    let ny = simplexPrevLine[x];

                    dx += octave.weight * (n - nx);
                    dy += octave.weight * (n - ny);
                    let gradient = Math.sqrt(dx * dx + dy * dy);
                    n = n / (1.0 + (gradientFactor * gradient));
                    back[y * size + x] = height + n * octave.weight;
                }

                // Swap lines for next iteration
                [simplexPrevLine, simplexLine] = [simplexLine, simplexPrevLine];
            }

            // Swap buffers for next octave
            [front, back] = [back, front];
        }

        // copy noise into all RGBA channels (avoid uninitialized values)
        var rgba = new Float32Array(size * size * 4);
        for (let i = 0; i < size * size; ++i) {
            rgba[i * 4 + 0] = front[i]; // R (height)
            rgba[i * 4 + 1] = 0.0;      // G
            rgba[i * 4 + 2] = 0.0;      // B
            rgba[i * 4 + 3] = 1.0;      // A (safe default)
        }

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.simFront);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, rgba);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        // Also initialize simBack to avoid uninitialized reads
        gl.bindTexture(gl.TEXTURE_2D, this.simBack);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, rgba);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}
