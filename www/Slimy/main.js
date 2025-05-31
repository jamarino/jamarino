// Import shader sources as ES modules
import { vertexShader } from './shaders/vertex.glsl.js';
import { blurFadeShader } from './shaders/blur_fade.glsl.js';
import { displayShader } from './shaders/display.glsl.js';
import { colorGradeShader } from './shaders/color_grade.glsl.js';
import { sporeUpdateShader } from './shaders/spore_update.glsl.js';
import { sporeRenderVertShader } from './shaders/spore_render_vert.glsl.js';
import { sporeRenderFragShader } from './shaders/spore_render_frag.glsl.js';

const canvas = document.getElementById('simCanvas');

// --- Helper: create shader
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

// --- Helper: create program
function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

// --- Main init ---
function startOrRestartSim() {
  // Clean up old resources if they exist
  if (window._slimeSimCleanup) window._slimeSimCleanup();
  // --- Setup WebGL2 context ONLY ---
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    const msg = document.createElement('div');
    msg.style.position = 'fixed';
    msg.style.top = '0';
    msg.style.left = '0';
    msg.style.width = '100vw';
    msg.style.height = '100vh';
    msg.style.background = 'rgba(0,0,0,0.85)';
    msg.style.color = '#fff';
    msg.style.display = 'flex';
    msg.style.alignItems = 'center';
    msg.style.justifyContent = 'center';
    msg.style.fontSize = '2em';
    msg.style.zIndex = '9999';
    msg.innerHTML =
      'Sorry, your browser does not support WebGL 2.';
    document.body.appendChild(msg);
    return;
  }
  // Ensure EXT_color_buffer_float is enabled for RGBA32F framebuffer support
  const ext = gl.getExtension('EXT_color_buffer_float');
  if (!ext) {
    throw new Error('EXT_color_buffer_float not supported! Rendering to RGBA32F is not possible.');
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Create display texture for post-processing
  function createDisplayTexture() {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }
  const displayTex = createDisplayTexture();

  // Create textures for ping-pong rendering
  function createTexture() {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }
  const texA = createTexture();
  const texB = createTexture();
  let frontTex = texA, backTex = texB;

  // Create framebuffer
  let fb = gl.createFramebuffer();

  // Create shader programs
  const program = createProgram(gl, vertexShader, blurFadeShader);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  const texLoc = gl.getUniformLocation(program, 'u_texture');
  const subLoc = gl.getUniformLocation(program, 'u_subtract');
  const fadeLoc = gl.getUniformLocation(program, 'u_fade');
  const texelLoc = gl.getUniformLocation(program, 'u_texel');

  const displayProgram = createProgram(gl, vertexShader, displayShader);
  const displayTexLoc = gl.getUniformLocation(displayProgram, 'u_texture');

  const colorGradeProgram = createProgram(gl, vertexShader, colorGradeShader);
  const colorGradeTexLoc = gl.getUniformLocation(colorGradeProgram, 'u_texture');

  // Fullscreen quad
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1, 1, 1
  ]), gl.STATIC_DRAW);

  // --- GPU Spore State Simulation ---
  // 2. Spore state texture size (store 1 spore per texel)
  let SPORE_COUNT = Math.floor(20000 * (canvas.width * canvas.height / (1920 * 1080)));
  let sporeTexSize = Math.ceil(Math.sqrt(SPORE_COUNT));

  // 3. Helper: create float texture for spore state (WebGL2 only)
  function createSporeStateTexture() {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sporeTexSize, sporeTexSize, 0, gl.RGBA, gl.FLOAT, null);
    return tex;
  }
  let sporeStateA = createSporeStateTexture();
  let sporeStateB = createSporeStateTexture();
  let sporeStateFront = sporeStateA, sporeStateBack = sporeStateB;

  // Step 2: Check sporeTexSize > 0
  if (sporeTexSize <= 0) {
    console.error('sporeTexSize is not positive:', sporeTexSize);
    throw new Error('sporeTexSize must be > 0');
  }

  // Step 3: Log texture info after creation
  console.log('sporeStateFront/back created:', {
    sporeTexSize,
    SPORE_COUNT,
    width: canvas.width,
    height: canvas.height
  });

  // --- Spore state initialization helper ---
  function initializeSporeStateData(sporeTexSize, SPORE_COUNT, width, height) {
    const sporeStateData = new Float32Array(sporeTexSize * sporeTexSize * 4);
    const centerX = width / 2;
    const centerY = height / 2;
    const diameter = 0.75 * Math.min(width, height);
    const radius = diameter / 2;
    for (let i = 0; i < SPORE_COUNT; i++) {
      const theta = (i / SPORE_COUNT) * Math.PI * 2;
      const x = centerX + Math.cos(theta) * radius;
      const y = centerY + Math.sin(theta) * radius;
      const angle = Math.atan2(centerY - y, centerX - x);
      sporeStateData[i * 4 + 0] = x;
      sporeStateData[i * 4 + 1] = y;
      sporeStateData[i * 4 + 2] = angle;
      sporeStateData[i * 4 + 3] = Math.random() * Math.PI * 2; // phase
    }
    return sporeStateData;
  }
  // Restore spore initialization logic
  const sporeStateData = initializeSporeStateData(sporeTexSize, SPORE_COUNT, canvas.width, canvas.height);
  gl.bindTexture(gl.TEXTURE_2D, sporeStateFront);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sporeTexSize, sporeTexSize, 0, gl.RGBA, gl.FLOAT, sporeStateData);
  gl.bindTexture(gl.TEXTURE_2D, sporeStateBack);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sporeTexSize, sporeTexSize, 0, gl.RGBA, gl.FLOAT, sporeStateData);

  // Dedicated framebuffer for spore state updates
  let sporeStateFB = gl.createFramebuffer();

  // Create shader programs
  const sporeUpdateProgram = createProgram(gl, vertexShader, sporeUpdateShader);
  const sporeUpdatePosLoc = gl.getAttribLocation(sporeUpdateProgram, 'a_position');
  const sporeUpdateStateLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_state');
  const sporeUpdateTrailLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_trail');
  const sporeUpdateWidthLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_width');
  const sporeUpdateHeightLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_height');
  const sporeUpdateSampleDistLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_sampleDist');
  const sporeUpdateNudgeLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_nudge');
  const sporeUpdateMouseLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_mouse');
  const sporeUpdateMouseDownLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_mouseDown');
  const sporeUpdateTimeLoc = gl.getUniformLocation(sporeUpdateProgram, 'u_time');

  // 6. Spore render shader (draw spores as points)
  const sporeRenderProgram = createProgram(gl, sporeRenderVertShader, sporeRenderFragShader);
  const sporeRenderIndexLoc = gl.getAttribLocation(sporeRenderProgram, 'a_index');
  const sporeRenderStateLoc = gl.getUniformLocation(sporeRenderProgram, 'u_state');
  const sporeRenderTexSizeLoc = gl.getUniformLocation(sporeRenderProgram, 'u_texSize');
  const sporeRenderWidthLoc = gl.getUniformLocation(sporeRenderProgram, 'u_width');
  const sporeRenderHeightLoc = gl.getUniformLocation(sporeRenderProgram, 'u_height');

  // 7. Index buffer for spores
  const sporeIndices = new Float32Array(SPORE_COUNT);
  for (let i = 0; i < SPORE_COUNT; i++) sporeIndices[i] = i;
  const sporeIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sporeIndexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sporeIndices, gl.STATIC_DRAW);

  // Create a texture for spores
  const sporesTex = createTexture();

  function checkFramebufferComplete(label) {
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error(`Framebuffer incomplete after ${label}:`, status.toString(16));
      switch (status) {
        case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
          console.error('FRAMEBUFFER_INCOMPLETE_ATTACHMENT'); break;
        case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
          console.error('FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT'); break;
        case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
          console.error('FRAMEBUFFER_INCOMPLETE_DIMENSIONS'); break;
        case gl.FRAMEBUFFER_UNSUPPORTED:
          console.error('FRAMEBUFFER_UNSUPPORTED'); break;
        default:
          console.error('Unknown framebuffer error');
      }
    }
  }

  function render() {
    // 1. Render spores to sporesTex using GPU
    renderSporesGPU();

    // 2. Additively blend sporesTex onto frontTex using display shader
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(displayProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frontTex, 0);
    checkFramebufferComplete('render: sporesTex -> frontTex');
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sporesTex);
    gl.uniform1i(displayTexLoc, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 3. Apply blur and subtraction shader to frontTex -> backTex (first pass)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, backTex, 0);
    checkFramebufferComplete('render: frontTex -> backTex');
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frontTex);
    gl.uniform1i(texLoc, 0);
    gl.uniform1f(subLoc, 0.005); // Fixed value subtract
    gl.uniform1f(fadeLoc, 1); // fade
    gl.uniform2f(texelLoc, 1 / canvas.width, 1 / canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 3b. Apply blur again (second pass) for stronger blur: backTex -> frontTex
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frontTex, 0);
    gl.bindTexture(gl.TEXTURE_2D, backTex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 4. Post-process: copy frontTex to displayTex for color grading
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, displayTex, 0);
    checkFramebufferComplete('render: frontTex -> displayTex');
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(displayProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frontTex);
    gl.uniform1i(displayTexLoc, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 5. Draw to screen using color grading shader
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Animate hue shift
    const hueShift = (performance.now() / 1000 / 60) % 1.0;
    gl.useProgram(colorGradeProgram);
    gl.uniform1f(gl.getUniformLocation(colorGradeProgram, 'u_hueShift'), hueShift);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, displayTex);
    gl.uniform1i(colorGradeTexLoc, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function updateSporesGPU() {
    // Animate nudge factor with time
    const now = performance.now() * 0.001;
    const nudge = 0.25 + 0.12 * Math.min(Math.abs(Math.sin(now * 0.8)), Math.abs(Math.sin(now * 0.6))) + 0.05 * Math.sin(now * 0.23);

    // Update spore state texture using GPGPU shader
    gl.useProgram(sporeUpdateProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sporeStateFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sporeStateBack, 0);
    checkFramebufferComplete('updateSporesGPU: sporeStateBack');
    gl.viewport(0, 0, sporeTexSize, sporeTexSize);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(sporeUpdatePosLoc);
    gl.vertexAttribPointer(sporeUpdatePosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sporeStateFront);
    gl.uniform1i(sporeUpdateStateLoc, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, frontTex);
    gl.uniform1i(sporeUpdateTrailLoc, 1);
    gl.uniform1f(sporeUpdateWidthLoc, canvas.width);
    gl.uniform1f(sporeUpdateHeightLoc, canvas.height);
    gl.uniform1f(sporeUpdateSampleDistLoc, 10.0);
    gl.uniform1f(sporeUpdateNudgeLoc, nudge);
    gl.uniform2f(sporeUpdateMouseLoc, mouseX, mouseY);
    gl.uniform1f(sporeUpdateMouseDownLoc, mouseDown ? 1.0 : 0.0);
    gl.uniform1f(sporeUpdateTimeLoc, now);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Swap state textures
    let tmp = sporeStateFront; sporeStateFront = sporeStateBack; sporeStateBack = tmp;
  }

  function renderSporesGPU() {
    // Render spores as points using state texture
    gl.useProgram(sporeRenderProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sporesTex, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sporeStateFront);
    gl.uniform1i(sporeRenderStateLoc, 0);
    gl.uniform1f(sporeRenderTexSizeLoc, sporeTexSize);
    gl.uniform1f(sporeRenderWidthLoc, canvas.width);
    gl.uniform1f(sporeRenderHeightLoc, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, sporeIndexBuffer);
    gl.enableVertexAttribArray(sporeRenderIndexLoc);
    gl.vertexAttribPointer(sporeRenderIndexLoc, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, SPORE_COUNT);
    gl.disableVertexAttribArray(sporeRenderIndexLoc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  let lastFrameTime = 0;
  const FRAME_MIN_INTERVAL = 1000 / 120; // 120 fps cap

  // Update loop to use GPU update
  function loop(now) {
    if (!lastFrameTime || now - lastFrameTime >= FRAME_MIN_INTERVAL) {
      lastFrameTime = now;
      updateSporesGPU();
      render();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// On first load and on resize, restart the simulation
window.addEventListener('resize', startOrRestartSim);
startOrRestartSim();

// Mouse interaction state
let mouseDown = false;
let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('pointerdown', e => {
  if (e.button === 0) {
    mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  }
});
canvas.addEventListener('pointermove', e => {
  if (mouseDown) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  }
});
canvas.addEventListener('pointerup', e => {
  if (e.button === 0) mouseDown = false;
});
canvas.addEventListener('pointerleave', () => { mouseDown = false; });
