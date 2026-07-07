import { parseGPX } from './gpxParser.js';
import { MapManager } from './mapManager.js';
import { Animator } from './animator.js';

const mapManager = new MapManager('map');
const animator = new Animator(mapManager, updateUIProgress);

const gpxInput = document.getElementById('gpx-input');
const playbackControls = document.getElementById('playback-controls');
const stageCountEl = document.getElementById('stage-count');
const currentStatsEl = document.getElementById('current-stats');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnRestart = document.getElementById('btn-restart');
const speedRange = document.getElementById('speed-range');

// Banner DOM Selections
const stageBanner = document.getElementById('stage-banner');
const bannerStageName = document.getElementById('banner-stage-name');
const statDistance = document.getElementById('stat-distance');
const statAscent = document.getElementById('stat-ascent');
const statDescent = document.getElementById('stat-descent');

gpxInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    let combinedCoordinates = [];
    let stageMetadata = [];
    let globalIndexOffset = 0;

    for (const file of files) {
        const text = await file.text();
        const stageData = parseGPX(text, file.name);
        
        const ptCount = stageData.coordinates.length;
        if (ptCount === 0) continue;

        // Build metadata ranges mapping coordinates index boundaries
        stageMetadata.push({
            name: stageData.name,
            distance: stageData.distance,
            ascent: stageData.ascent,
            descent: stageData.descent,
            startIndex: globalIndexOffset,
            endIndex: globalIndexOffset + ptCount - 1
        });

        combinedCoordinates = combinedCoordinates.concat(stageData.coordinates);
        globalIndexOffset += ptCount;
    }

    if (combinedCoordinates.length > 0) {
        mapManager.setupLayers(combinedCoordinates);
        // Pass both parameters to animator initialization pipeline
        animator.setCoordinates(combinedCoordinates, stageMetadata);

        stageCountEl.textContent = files.length;
        playbackControls.classList.remove('hidden');
        stageBanner.classList.remove('hidden'); // Reveal Banner
        btnPlayPause.textContent = "▶ Play";
    }
});

btnPlayPause.addEventListener('click', () => {
    if (animator.isPlaying) {
        animator.pause();
        btnPlayPause.textContent = "▶ Play";
    } else {
        animator.start();
        btnPlayPause.textContent = "⏸ Pause";
    }
});

btnRestart.addEventListener('click', () => {
    animator.stop();
    btnPlayPause.textContent = "▶ Play";
});

speedRange.addEventListener('input', (e) => {
    animator.setSpeed(e.target.value);
});

// Update function now receives contextual active stage properties mapping telemetry data
function updateUIProgress(current, total, activeStage) {
    const percent = Math.round((current / total) * 100);
    currentStatsEl.textContent = `${percent}% Completed`;
    
    if (activeStage) {
        bannerStageName.textContent = activeStage.name;
        statDistance.textContent = `${activeStage.distance} km`;
        statAscent.textContent = `+${activeStage.ascent}m`;
        statDescent.textContent = `-${activeStage.descent}m`;
    }

    if (current === total - 1) {
        btnPlayPause.textContent = "▶ Play";
    }
}