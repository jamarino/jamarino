import { initializeSimulation, animationLoop } from './simulation.js';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext('webgl2');

if (!gl) {
    console.error('WebGL 2 is not available in your browser.');
}

async function init() {
    await initializeSimulation(gl);
}

window.onload = async () => {
    await init();
    animationLoop();
};

window.onresize = async () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    await initializeSimulation(gl);
};