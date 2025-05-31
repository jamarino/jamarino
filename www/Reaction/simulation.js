// simulation.js

let gl;
let simulationTextureA;
let simulationTextureB;
let frameBufferA;
let frameBufferB;
let useAToB = true;

function createSimulationTextures() {
    const canvas = gl.canvas;
    const texWidth = canvas.width;
    const texHeight = canvas.height;

    // Enable float textures
    if (!gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('EXT_color_buffer_float not supported');
    }

    // Helper to create a float texture
    function makeTexture(data) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA32F, texWidth, texHeight, 0,
            gl.RGBA, gl.FLOAT, data
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    // Initial data (red with green spots), now as Float32Array
    const data = new Float32Array(texWidth * texHeight * 4);
    for (let i = 0; i < texWidth * texHeight; i++) {
        data[i * 4 + 0] = 1.0; // A (red)
        data[i * 4 + 1] = 0.01; // B (green)
        data[i * 4 + 2] = 0.0;
        data[i * 4 + 3] = 1.0;
    }
    simulationTextureA = makeTexture(data);
    simulationTextureB = makeTexture(null);

    const numSpots = 3;
    for (let i = 0; i < numSpots; i++) {
        addRandomSpots();
    }

    // Framebuffers
    frameBufferA = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, simulationTextureA, 0);
    frameBufferB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, simulationTextureB, 0);
}

// Utility to load shader source from a file (async)
async function loadShaderSource(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load shader: ${url}`);
    }
    return await response.text();
}

async function createShaderFromFile(type, url) {
    const source = await loadShaderSource(url);
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

let displayProgram;
let displayVAO;

// Updated createDisplayProgram to load shaders from files
async function createDisplayProgram() {
    const vs = await createShaderFromFile(gl.VERTEX_SHADER, 'display.vert');
    const fs = await createShaderFromFile(gl.FRAGMENT_SHADER, 'display.frag');
    displayProgram = gl.createProgram();
    gl.attachShader(displayProgram, vs);
    gl.attachShader(displayProgram, fs);
    gl.linkProgram(displayProgram);
    if (!gl.getProgramParameter(displayProgram, gl.LINK_STATUS)) {
        console.error('Program link failed:', gl.getProgramInfoLog(displayProgram));
        return;
    }
    // Set up a fullscreen quad
    displayVAO = gl.createVertexArray();
    gl.bindVertexArray(displayVAO);
    const quadVerts = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(displayProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
}

// --- Simulation convolution shader setup ---
let simProgram;
let simVAO;

// Updated createSimProgram to load shaders from files
async function createSimProgram() {
    const vs = await createShaderFromFile(gl.VERTEX_SHADER, 'sim.vert');
    const fs = await createShaderFromFile(gl.FRAGMENT_SHADER, 'sim.frag');
    simProgram = gl.createProgram();
    gl.attachShader(simProgram, vs);
    gl.attachShader(simProgram, fs);
    gl.linkProgram(simProgram);
    if (!gl.getProgramParameter(simProgram, gl.LINK_STATUS)) {
        console.error('Simulation program link failed:', gl.getProgramInfoLog(simProgram));
        return;
    }
    // Fullscreen quad
    simVAO = gl.createVertexArray();
    gl.bindVertexArray(simVAO);
    const quadVerts = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(simProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
}

// Add a function to run the convolution kernel over the simulation buffer
function runSimulationConvolution(params) {
    // Ping-pong: read from one, write to the other
    const srcTex = useAToB ? simulationTextureA : simulationTextureB;
    const dstFbo = useAToB ? frameBufferB : frameBufferA;
    gl.useProgram(simProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(gl.getUniformLocation(simProgram, 'u_input'), 0);
    // Set simulation parameters
    gl.uniform1f(gl.getUniformLocation(simProgram, 'da'), params.da);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'db'), params.db);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'f'), params.f);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'k'), params.k);
    gl.uniform1f(gl.getUniformLocation(simProgram, 't'), params.t);
    gl.bindVertexArray(simVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    useAToB = !useAToB;
}

let simParams = { da: 2.0, db: 0.5, f: 0.03, k: 0.05, t: 0.2 };
let simStartTime = performance.now();

function updateSimulation() {
    // Use slider values if available
    let params = simParams;
    if (window.grayScottParams) {
        const now = performance.now();
        const elapsed = (now - simStartTime) / 1000.0;
        const evolve = window.grayScottParams.evolve || 0.0;
        // Apply time-based variation to f and k for simulation input only
        const fVariation = (Math.sin(elapsed * 0.3) + Math.sin(elapsed * 0.5 + 10.0)) / 2.0;
        const kVariation = (Math.sin(elapsed * 0.8) + Math.sin(elapsed * 0.2 + 37.0)) / 2.0;
        params = {
            da: window.grayScottParams.da,
            db: window.grayScottParams.db,
            f: window.grayScottParams.f + evolve * fVariation,
            k: window.grayScottParams.k + evolve * kVariation,
            t: window.grayScottParams.t
        };
    }
    runSimulationConvolution(params);
}

function renderToScreen() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(displayProgram);
    gl.activeTexture(gl.TEXTURE0);
    // Display the most recently written texture
    const tex = useAToB ? simulationTextureB : simulationTextureA;
    const prevTex = useAToB ? simulationTextureA : simulationTextureB;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(displayProgram, 'u_texture'), 0);
    // Bind previous frame texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(gl.getUniformLocation(displayProgram, 'u_prevTexture'), 1);
    gl.activeTexture(gl.TEXTURE0); // restore default
    gl.bindVertexArray(displayVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
}

let mouseDown = false;
let mousePos = { x: 0, y: 0 };

function setupCanvasInteraction(canvas) {
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            mouseDown = true;
            updateMousePos(e, canvas);
        }
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseDown = false;
    });
    canvas.addEventListener('mouseleave', () => { mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
        updateMousePos(e, canvas);
    });
}

function updateMousePos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    mousePos.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
}

function injectAtMouse() {
    if (!mouseDown) return;
    const radius = 16;
    const texWidth = gl.canvas.width;
    const texHeight = gl.canvas.height;
    // Flip y axis for mouse position to match WebGL texture coordinates
    const mouseY = texHeight - mousePos.y;
    // Always inject into the currently read texture (so next sim step sees it)
    const tex = useAToB ? simulationTextureA : simulationTextureB;
    // Read-modify-write (slow, but fine for small area)
    const x0 = Math.max(0, Math.floor(mousePos.x - radius));
    const x1 = Math.min(texWidth - 1, Math.ceil(mousePos.x + radius));
    const y0 = Math.max(0, Math.floor(mouseY - radius));
    const y1 = Math.min(texHeight - 1, Math.ceil(mouseY + radius));
    const size = (x1 - x0 + 1) * (y1 - y0 + 1);
    const pixels = new Float32Array(size * 4);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.readPixels(x0, y0, x1 - x0 + 1, y1 - y0 + 1, gl.RGBA, gl.FLOAT, pixels);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = x - mousePos.x;
            const dy = y - mouseY;
            if (dx * dx + dy * dy <= radius * radius) {
                const idx = ((y - y0) * (x1 - x0 + 1) + (x - x0)) * 4;
                pixels[idx + 0] = Math.min(1.0, pixels[idx + 0] + 0.08);
                pixels[idx + 1] = Math.min(1.0, pixels[idx + 1] + 0.08);
            }
        }
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1, gl.RGBA, gl.FLOAT, pixels);
}

function addRandomSpots() {
    const texWidth = gl.canvas.width;
    const texHeight = gl.canvas.height;
    const margin = 5;
    const tex = useAToB ? simulationTextureA : simulationTextureB;
    const numSpots = 1;
    for (let s = 0; s < numSpots; s++) {
        const cx = Math.floor(Math.random() * (texWidth - 2 * margin)) + margin;
        const cy = Math.floor(Math.random() * (texHeight - 2 * margin)) + margin;
        const pixels = new Float32Array(9 * 4);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.readPixels(cx, cy, 3, 3, gl.RGBA, gl.FLOAT, pixels);
        pixels[0 * 4 + 0] = 0.9;
        pixels[1 * 4 + 1] = 0.8;
        pixels[2 * 4 + 0] = 0.9;
        pixels[3 * 4 + 1] = 0.8;
        pixels[4 * 4 + 1] = 1.0;
        pixels[5 * 4 + 1] = 0.8;
        pixels[6 * 4 + 0] = 0.9;
        pixels[7 * 4 + 1] = 0.8;
        pixels[8 * 4 + 0] = 0.9;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, cx, cy, 3, 3, gl.RGBA, gl.FLOAT, pixels);
    }
}

let lastSpotTime = performance.now();

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    injectAtMouse();
    // Add random spots every ~1 second
    let now = performance.now();
    if (now - lastSpotTime > 5000) {
        addRandomSpots();
        lastSpotTime = now;
    }
    for (let i = 0; i < 15; i++) {
        updateSimulation();
    }
    renderToScreen();
}

function animationLoop() {
    render();
    requestAnimationFrame(animationLoop);
}

async function initializeSimulation(glContext) {
    gl = glContext;
    createSimulationTextures();
    await createDisplayProgram();
    await createSimProgram();
    useAToB = true;
    setupCanvasInteraction(gl.canvas);
}

export { initializeSimulation, animationLoop };