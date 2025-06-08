// main.js
// Entry point for Erosion Simulation

const canvas = document.getElementById('glcanvas');
let sim = null;

window.addEventListener('DOMContentLoaded', async () => {
    // Dynamically load ErosionSim after DOM is ready
    const module = await import('./erosionSim.js');
    const ErosionSim = module.ErosionSim;
    sim = new ErosionSim(canvas);
    await sim.init();
    sim.start();
});