import { parseGPX } from './gpxParser.js';
import { MapManager } from './mapManager.js';
import { Animator } from './animator.js';

const gpxFiles = [
    'Stage 01 - Gaflei to Sargans.gpx',
    'Stage 02 - Sargans to Weisstannen.gpx',
    'Stage 03 - Weisstannen to Elm.gpx',
    'Stage 04 - Elm to Linthal.gpx',
    'Stage 05 - Linthal to Klausen Pass.gpx',
    'Stage 06 - Klausen Pass to Altdorf.gpx',
    'Stage 07 - Alt Dorf to Engelberg.gpx',
    'Stage 08 - Engelberg to Engstlenalp.gpx',
    'Stage 09 - Engstlenalp to Meiringen.gpx',
    'Stage 10 - Meiringen to Grindelwald.gpx',
    'Stage 11 - Grindelwald to Lauterbrunnen.gpx',
    'Stage 12 - Lauterbrunnen to Mürren.gpx',
    'Stage 13 - Mürren to Griesalp.gpx',
    'Stage 14 - Griesalp to Kandersteg.gpx',
    'Stage 15 - Kandersteg to Adelboden.gpx',
    'Stage 16 - Adelboden to Lenk.gpx',
    'Stage 17 - Lenk to Gstaad.gpx',
    'Stage 18 - Gstaad to L’Etivaz.gpx',
    'Stage 19 - L’Etivaz – Rossinière.gpx',
    'Stage 20 - Rossinière to Caux (Rochers de Naye).gpx',
    'Stage 21 - Caux to Montreux.gpx'
];

let isMetric = true;

const mapManager = new MapManager('map');
const animator = new Animator(mapManager, updateUIProgress);

const btnPlayPause = document.getElementById('btn-play-pause');
const btnRestart = document.getElementById('btn-restart');
const speedRange = document.getElementById('speed-range');
const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
const stageList = document.getElementById('stage-list');
const unitToggleCheckbox = document.getElementById('unit-toggle-checkbox');

const stageBanner = document.getElementById('stage-banner');
const stageNameText = document.getElementById('stage-name-text');
const statDistance = document.getElementById('stat-distance');
const statAscent = document.getElementById('stat-ascent');
const statDescent = document.getElementById('stat-descent');

const labelDistance = document.getElementById('label-distance');
const labelAscent = document.getElementById('label-ascent');
const labelDescent = document.getElementById('label-descent');

const chartBgPath = document.getElementById('chart-bg-path');
const chartBaseLine = document.getElementById('chart-base-line');
const chartProgFill = document.getElementById('chart-prog-fill');
const chartProgPath = document.getElementById('chart-prog-path');
const chartHikerMarker = document.getElementById('chart-hiker-marker');
const elevationChart = document.getElementById('elevation-chart');

const controlPanel = document.getElementById('control-panel');
const mobileToggleHandle = document.getElementById('mobile-toggle-handle');

let loadedStages = [];
let globalCumulativeMetrics = [];
let combinedCoordinates = [];
let isolationActiveIdx = null;
let lastActiveStageId = null;

function formatDistance(km) {
    if (isMetric) return `${km.toFixed(1)} km`;
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi`;
}

function formatElevation(meters, isAscent = true) {
    const symbol = isAscent ? '↗ ' : '↘ ';
    if (isMetric) return `${symbol}${Math.round(meters)}m`;
    const feet = meters * 3.28084;
    return `${symbol}${Math.round(feet)}ft`;
}

function getActiveStageForIndex(index) {
    return loadedStages.find(s => index >= s.startIndex && index <= s.endIndex) || loadedStages[0];
}

async function autoLoadGpxFolder() {
    combinedCoordinates = [];
    loadedStages = [];
    globalCumulativeMetrics = [];
    let globalIndexOffset = 0;

    let totalRunningDist = 0;
    let totalRunningAsc = 0;
    let totalRunningDesc = 0;
    let absolutePrevPoint = null;

    for (const filename of gpxFiles) {
        try {
            const response = await fetch(`gpx/${filename}`);
            if (!response.ok) throw new Error(`HTTP network error code ${response.status}`);
            
            const text = await response.text();
            const cleanFallback = filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
            const prettyFallback = cleanFallback.charAt(0).toUpperCase() + cleanFallback.slice(1);

            const stageData = parseGPX(text, prettyFallback);
            const ptCount = stageData.coordinates.length;
            if (ptCount === 0) continue;

            loadedStages.push({
                name: stageData.name,
                distance: stageData.distance,
                ascent: stageData.ascent,
                descent: stageData.descent,
                coordinates: stageData.coordinates,
                startIndex: globalIndexOffset,
                endIndex: globalIndexOffset + ptCount - 1,
                id: `stage-item-${loadedStages.length}`,
                color: mapManager.colors[loadedStages.length % mapManager.colors.length]
            });

            stageData.coordinates.forEach((coord) => {
                const currentEle = coord[2];
                if (absolutePrevPoint) {
                    const stepDist = calculateHaversine(absolutePrevPoint[1], absolutePrevPoint[0], coord[1], coord[0]);
                    totalRunningDist += stepDist;

                    const eleDiff = currentEle - absolutePrevPoint[2];
                    if (eleDiff > 0) totalRunningAsc += eleDiff;
                    else totalRunningDesc += Math.abs(eleDiff);
                }

                globalCumulativeMetrics.push({
                    distance: Math.round(totalRunningDist * 10) / 10,
                    ascent: Math.round(totalRunningAsc),
                    descent: Math.round(totalRunningDesc),
                    elevation: currentEle
                });

                absolutePrevPoint = coord;
            });

            combinedCoordinates = combinedCoordinates.concat(stageData.coordinates);
            globalIndexOffset += ptCount;

        } catch (error) {
            console.error(`Preload asset breakdown error [gpx/${filename}]:`, error);
        }
    }

    if (combinedCoordinates.length > 0) {
        isolationActiveIdx = null;
        mapManager.setupLayers(loadedStages);
        animator.setCoordinates(combinedCoordinates, loadedStages);

        renderStageList(loadedStages);
        buildSvgChartProfile(globalCumulativeMetrics.map(p => p.elevation));

        stageBanner.classList.remove('hidden');
        updateUIProgress(0, globalCumulativeMetrics.length, loadedStages[0]);
    }
}

function renderStageList(stages) {
    stageList.innerHTML = '';
    stages.forEach((stage, idx) => {
        const li = document.createElement('li');
        li.id = stage.id;
        li.style.setProperty('--stage-color', stage.color);
        
        li.innerHTML = `
            <span class="stage-item-name">📍 ${stage.name}</span>
            <span class="stage-item-distance">${formatDistance(stage.distance)}</span>
        `;
        
        li.addEventListener('click', () => {
            animator.pause();
            btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
            document.body.classList.remove('is-playing');
            controlPanel.classList.remove('expanded');
            if (btnToggleDrawer) btnToggleDrawer.innerHTML = '<i class="fas fa-bars"></i>';
            
            if (isolationActiveIdx === idx) {
                isolationActiveIdx = null;
                animator.setBounds(0, combinedCoordinates.length - 1);
                animator.currentIndex = 0; 
                mapManager.fitToRoute(combinedCoordinates);
                
                if (typeof mapManager.clearSelection === 'function') {
                    mapManager.clearSelection();
                } else {
                    mapManager.updatePlayback(0, loadedStages, combinedCoordinates[0], null);
                }
                
                buildSvgChartProfile(globalCumulativeMetrics.map(p => p.elevation));
                updateUIProgress(0, globalCumulativeMetrics.length, loadedStages[0]);
                return;
            }
            
            isolationActiveIdx = idx;
            animator.setBounds(stage.startIndex, stage.endIndex);
            animator.currentIndex = stage.startIndex;
            
            mapManager.fitToRoute(stage.coordinates);
            mapManager.updatePlayback(stage.startIndex, loadedStages, stage.coordinates[0], isolationActiveIdx);
            
            updateUIProgress(stage.startIndex, globalCumulativeMetrics.length, stage);
        });

        stageList.appendChild(li);
    });
}

function buildSvgChartProfile(elevations, highlightColor = '#3b82f6') {
    if (elevations.length === 0) return;
    elevationChart.style.setProperty('--chart-line-color', highlightColor);
    if (chartHikerMarker) chartHikerMarker.style.setProperty('--chart-line-color', highlightColor);

    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = (maxEle - minEle) || 1;

    const width = 400;
    const height = 50; 
    const pointsCount = elevations.length;

    let pathString = "";
    elevations.forEach((ele, index) => {
        const x = (index / (pointsCount - 1)) * width;
        const y = height - ((ele - minEle) / eleRange) * (height - 5) + 5;
        pathString += `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    const closedBgPath = `${pathString} L ${width} 60 L 0 60 Z`;
    chartBgPath.setAttribute('d', closedBgPath);
    
    if (chartBaseLine) chartBaseLine.setAttribute('d', pathString);
    chartProgPath.setAttribute('d', pathString);
    if (chartProgFill) chartProgFill.setAttribute('d', '');
    
    elevationChart.dataset.minEle = minEle;
    elevationChart.dataset.maxEle = maxEle;
    elevationChart.dataset.pointsCount = pointsCount;
}

/* Updated UI Progress Thumb Positioner using percentages to eliminate squishing distortion */
function updateSvgProgressThumb(globalIndex, singleStageElevations = null) {
    const width = 400;
    const height = 50;
    const minEle = parseFloat(elevationChart.dataset.minEle);
    const maxEle = parseFloat(elevationChart.dataset.maxEle);
    const eleRange = (maxEle - minEle) || 1;

    let currentX = 0;
    let currentY = 0;

    if (singleStageElevations) {
        const x = (globalIndex / (singleStageElevations.length - 1)) * width;
        const ele = singleStageElevations[globalIndex][2];
        const y = height - ((ele - minEle) / eleRange) * (height - 5) + 5;
        
        currentX = x;
        currentY = y;
        
        const fullPathD = chartBgPath.getAttribute('d').split(' L')[0]; 
        const pathCommands = fullPathD.match(/[ML]\s[^ML]+/g) || [];
        let subPathD = "";
        const targetCount = Math.min(globalIndex + 1, pathCommands.length);
        for(let i=0; i < targetCount; i++) {
            subPathD += pathCommands[i];
        }
        if (subPathD) {
            chartProgPath.setAttribute('d', subPathD);
            const closedProgPath = `${subPathD} L ${x.toFixed(1)} 60 L 0 60 Z`;
            if (chartProgFill) chartProgFill.setAttribute('d', closedProgPath);
        }
    } else {
        const totalPoints = parseInt(elevationChart.dataset.pointsCount);
        const fullPathD = chartBgPath.getAttribute('d').split(' L')[0]; 
        const pathCommands = fullPathD.match(/[ML]\s[^ML]+/g) || [];
        
        let subPathD = "";
        const targetCount = Math.min(globalIndex + 1, pathCommands.length);
        for(let i=0; i < targetCount; i++) {
            subPathD += pathCommands[i];
        }

        if (subPathD) {
            chartProgPath.setAttribute('d', subPathD);
            const lastCoord = pathCommands[targetCount - 1].replace(/[ML]\s/, "").split(" ");
            currentX = parseFloat(lastCoord[0]);
            currentY = parseFloat(lastCoord[1]);
            
            const closedProgPath = `${subPathD} L ${currentX.toFixed(1)} 60 L 0 60 Z`;
            if (chartProgFill) chartProgFill.setAttribute('d', closedProgPath);
        }
    }

    // Positions the un-distorted vector Hiker Icon precisely over the line coordinate grid
    if (chartHikerMarker) {
        chartHikerMarker.style.display = 'block';
        chartHikerMarker.style.left = `${(currentX / width) * 100}%`;
        chartHikerMarker.style.top = `${(currentY / 60) * 100}%`;
    }
}

function updateUIProgress(current, total, activeStage) {
    if (!activeStage) return;

    if (isolationActiveIdx !== null) {
        labelDistance.textContent = "Stage Distance";
        labelAscent.textContent = "Stage Ascent";
        labelDescent.textContent = "Stage Descent";

        stageNameText.textContent = activeStage.name;
        statDistance.textContent = formatDistance(activeStage.distance);
        statAscent.textContent = formatElevation(activeStage.ascent, true);
        statDescent.textContent = formatElevation(activeStage.descent, false);

        const stageEles = activeStage.coordinates.map(c => c[2]);
        buildSvgChartProfile(stageEles, activeStage.color);
        
        const localOffset = current - activeStage.startIndex;
        updateSvgProgressThumb(localOffset, activeStage.coordinates);
        
        if (lastActiveStageId !== activeStage.id) {
            document.querySelectorAll('#stage-list li').forEach(li => li.classList.remove('active-stage-item'));
            const currentLi = document.getElementById(activeStage.id);
            if (currentLi) currentLi.classList.add('active-stage-item');
            lastActiveStageId = activeStage.id;
        }
    } else {
        labelDistance.textContent = "Total Distance";
        labelAscent.textContent = "Total Ascent";
        labelDescent.textContent = "Total Descent";

        if (current === 0 && !animator.isPlaying) {
            stageNameText.textContent = "Marion & Rishi do Via Alpina!";
            
            const totalDistanceAllStages = loadedStages.reduce((sum, s) => sum + s.distance, 0);
            const totalAscentAllStages = loadedStages.reduce((sum, s) => sum + s.ascent, 0);
            const totalDescentAllStages = loadedStages.reduce((sum, s) => sum + s.descent, 0);

            statDistance.textContent = formatDistance(totalDistanceAllStages);
            statAscent.textContent = formatElevation(totalAscentAllStages, true);
            statDescent.textContent = formatElevation(totalDescentAllStages, false);
            
            document.querySelectorAll('#stage-list li').forEach(li => li.classList.remove('active-stage-item'));
            lastActiveStageId = null;
            
            if (chartProgFill) chartProgFill.setAttribute('d', '');
            if (chartProgPath) chartProgPath.setAttribute('d', ''); 
            if (chartHikerMarker) chartHikerMarker.style.display = 'none';
        } else {
            stageNameText.textContent = activeStage.name;
            
            const metrics = globalCumulativeMetrics[current] || { distance: 0, ascent: 0, descent: 0 };
            statDistance.textContent = formatDistance(metrics.distance);
            statAscent.textContent = formatElevation(metrics.ascent, true);
            statDescent.textContent = formatElevation(metrics.descent, false);

            if (lastActiveStageId !== activeStage.id) {
                document.querySelectorAll('#stage-list li').forEach(li => li.classList.remove('active-stage-item'));
                const currentLi = document.getElementById(activeStage.id);
                if (currentLi) {
                    currentLi.classList.add('active-stage-item');
                    currentLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                lastActiveStageId = activeStage.id;
            }
            updateSvgProgressThumb(current);
        }
    }

    if (current === animator.endBound) {
        btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
        document.body.classList.remove('is-playing');
    }
}

function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ==========================================================================
   INTERACTIVE SCRUBBING & MAP BINDING CONTROLLER WIRES
   ========================================================================== */

// 1. Chart Click Scrubbing Execution
const chartContainer = document.querySelector('.chart-container');
if (chartContainer) {
    chartContainer.addEventListener('click', (e) => {
        if (combinedCoordinates.length === 0) return;
        
        const rect = chartContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        
        const totalTargetPoints = animator.endBound - animator.startBound;
        const targetIndex = animator.startBound + Math.round(percentage * totalTargetPoints);
        
        animator.currentIndex = Math.max(animator.startBound, Math.min(animator.endBound, targetIndex));
        animator.triggerUIUpdate(animator.currentIndex);
    });
}

// 2. Map Canvas Feature Click Scrubbing Execution
mapManager.map.on('load', () => {
    mapManager.map.on('click', (e) => {
        if (combinedCoordinates.length === 0) return;
        
        const clickedLngLat = e.lngLat;
        let closestIndex = animator.startBound;
        let minDistanceSq = Infinity;
        
        // Fast bounding coordinate approximation loop mapping vector distance spaces
        for (let i = animator.startBound; i <= animator.endBound; i++) {
            const coord = combinedCoordinates[i];
            const dLng = coord[0] - clickedLngLat.lng;
            const dLat = coord[1] - clickedLngLat.lat;
            const distSq = (dLng * dLng) + (dLat * dLat);
            
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestIndex = i;
            }
        }
        
        // Ensure accuracy within click target ranges (~3-5km geometric footprint)
        if (minDistanceSq < 0.015) {
            animator.currentIndex = closestIndex;
            animator.triggerUIUpdate(closestIndex);
        }
    });
});

btnPlayPause.addEventListener('click', () => {
    if (animator.isPlaying) {
        animator.pause();
        btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
        document.body.classList.remove('is-playing');
    } else {
        if (isolationActiveIdx !== null && animator.currentIndex >= animator.endBound) {
            animator.currentIndex = loadedStages[isolationActiveIdx].startIndex;
        }
        animator.start();
        btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
        document.body.classList.add('is-playing');
    }
});

btnRestart.addEventListener('click', () => {
    animator.pause();
    btnPlayPause.textContent = "▶";
    document.body.classList.remove('is-playing');
    
    if (isolationActiveIdx !== null) {
        // Clear active isolation stage mode entirely and return back to full route overview
        isolationActiveIdx = null;
        animator.setBounds(0, combinedCoordinates.length - 1);
        animator.stop();
        
        mapManager.fitToRoute(combinedCoordinates);
        if (typeof mapManager.clearSelection === 'function') {
            mapManager.clearSelection();
        } else {
            mapManager.updatePlayback(0, loadedStages, combinedCoordinates[0], null);
        }
        buildSvgChartProfile(globalCumulativeMetrics.map(p => p.elevation));
        updateUIProgress(0, globalCumulativeMetrics.length, loadedStages[0]);
    } else {
        // Standard global animation frame rewind
        buildSvgChartProfile(globalCumulativeMetrics.map(p => p.elevation));
        animator.stop();
        updateUIProgress(0, globalCumulativeMetrics.length, loadedStages[0]);
    }
});

speedRange.addEventListener('input', (e) => {
    animator.setSpeed(e.target.value);
});

if (unitToggleCheckbox) {
    unitToggleCheckbox.addEventListener('change', function() {
        isMetric = !this.checked;
        renderStageList(loadedStages);
        if (loadedStages.length > 0) {
            const currentActive = isolationActiveIdx !== null ? loadedStages[isolationActiveIdx] : getActiveStageForIndex(animator.currentIndex);
            updateUIProgress(animator.currentIndex, globalCumulativeMetrics.length, currentActive);
        }
    });
}

if (mobileToggleHandle) {
// UNIFIED CONTROL PANEL ACTION MANAGER
const togglePanelAction = (e) => {
    e.stopPropagation();
    const isExpanded = controlPanel.classList.toggle('expanded');
    if (btnToggleDrawer) {
        btnToggleDrawer.innerHTML = isExpanded 
            ? '<i class="fas fa-chevron-down"></i>' 
            : '<i class="fas fa-bars"></i>';
    }
};

if (mobileToggleHandle) {
    mobileToggleHandle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault(); 
        togglePanelAction(e);
    }, { passive: false });

    mobileToggleHandle.addEventListener('click', (e) => {
        togglePanelAction(e);
    });
}

if (btnToggleDrawer) {
    btnToggleDrawer.addEventListener('click', (e) => {
        togglePanelAction(e);
    });
}
}

autoLoadGpxFolder();