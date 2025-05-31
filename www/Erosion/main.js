// main.js
// Entry point for Erosion Simulation

const canvas = document.getElementById('glcanvas');
let sim = null;

window.addEventListener('DOMContentLoaded', () => {
    // Dynamically load ErosionSim after DOM is ready
    import('./erosionSim.js').then(module => {
        const ErosionSim = module.ErosionSim;
        sim = new ErosionSim(canvas);
        sim.start();
    });
});