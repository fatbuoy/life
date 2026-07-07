export class MapManager {
    constructor(containerId) {
        this.map = new maplibregl.Map({
            container: containerId,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [9.5, 46.5],
            zoom: 7
        });

        this.isReady = false;
        this.map.on('load', () => { this.isReady = true; });

        this.colors = [
            '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
            '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
        ];

        this.stageRenderCache = {};
    }

    setupLayers(stages) {
        if (!this.map.isStyleLoaded()) {
            setTimeout(() => this.setupLayers(stages), 100);
            return;
        }

        this.stageRenderCache = {};

        stages.forEach((_, idx) => {
            if (this.map.getLayer(`stage-colored-${idx}`)) this.map.removeLayer(`stage-colored-${idx}`);
            if (this.map.getLayer(`stage-dimmed-${idx}`)) this.map.removeLayer(`stage-dimmed-${idx}`);
            if (this.map.getSource(`stage-source-${idx}`)) this.map.removeSource(`stage-source-${idx}`);
        });
        if (this.map.getLayer('bounds-layer')) this.map.removeLayer('bounds-layer');
        if (this.map.getSource('bounds-source')) this.map.removeSource('bounds-source');
        if (this.map.getLayer('moving-marker-layer')) this.map.removeLayer('moving-marker-layer');
        if (this.map.getSource('moving-marker')) this.map.removeSource('moving-marker');

        let allCoords = [];

        stages.forEach((stage, idx) => {
            allCoords = allCoords.concat(stage.coordinates);
            const stageColor = this.colors[idx % this.colors.length];
            stage.color = stageColor;

            this.map.addSource(`stage-source-${idx}`, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', geometry: { type: 'LineString', coordinates: stage.coordinates }, properties: { routeType: 'full' } },
                        { type: 'Feature', geometry: { type: 'LineString', coordinates: [stage.coordinates[0], stage.coordinates[0]] }, properties: { routeType: 'completed' } }
                    ]
                }
            });

            this.map.addLayer({
                id: `stage-dimmed-${idx}`,
                type: 'line',
                source: `stage-source-${idx}`,
                filter: ['==', ['get', 'routeType'], 'full'],
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#b1b404', 'line-width': 2, 'line-opacity': 0.9 }
            });

            this.map.addLayer({
                id: `stage-colored-${idx}`,
                type: 'line',
                source: `stage-source-${idx}`,
                filter: ['==', ['get', 'routeType'], 'completed'],
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': stageColor, 'line-width': 3, 'line-opacity': 1 }
            });
        });

        const boundaryFeatures = stages.map(stage => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: stage.coordinates[0] }
        }));
        
        if (stages.length > 0) {
            const final = stages[stages.length - 1];
            boundaryFeatures.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: final.coordinates[final.coordinates.length - 1] }
            });
        }

        this.map.addSource('bounds-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: boundaryFeatures }
        });

        this.map.addLayer({
            id: 'bounds-layer',
            type: 'circle',
            source: 'bounds-source',
            paint: {
                'circle-radius': 3,
                'circle-color': '#ffffff',
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#09090b'
            }
        });

        this.map.addSource('moving-marker', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'Point', coordinates: allCoords[0] } }
        });

        this.map.addLayer({
            id: 'moving-marker-layer',
            type: 'circle',
            source: 'moving-marker',
            paint: {
                'circle-radius': 7,
                'circle-color': '#09090b',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        this.fitToRoute(allCoords);
    }

    fitToRoute(coordinates) {
        if (coordinates.length === 0) return;
        const bounds = coordinates.reduce((acc, coord) => {
            return acc.extend(coord);
        }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

        this.map.fitBounds(bounds, { padding: 40, duration: 1200 });
    }

    // 🧠 FIX: manualStageIdx lets the engine toggle seamlessly between isolated preview modes and play modes
    updatePlayback(globalIndex, stages, currentPoint, manualStageIdx = null) {
        if (!this.isReady) return;

        stages.forEach((stage, idx) => {
            const source = this.map.getSource(`stage-source-${idx}`);
            if (!source) return;

            let activeCoords;
            let currentCacheKey;

            if (manualStageIdx !== null) {
                // Isolation Mode: Only color the selected stage
                if (idx === manualStageIdx) {
                    currentCacheKey = `manual-isolated-${idx}`;
                    activeCoords = stage.coordinates;
                } else {
                    currentCacheKey = `manual-dimmed-${idx}`;
                    activeCoords = [stage.coordinates[0], stage.coordinates[0]];
                }
            } else {
                // Replay Mode: Color trails cumulatively
                if (globalIndex < stage.startIndex) {
                    currentCacheKey = 'unstarted';
                    activeCoords = [stage.coordinates[0], stage.coordinates[0]];
                } else if (globalIndex >= stage.startIndex && globalIndex <= stage.endIndex) {
                    const offset = globalIndex - stage.startIndex;
                    currentCacheKey = `active-${offset}`;
                    activeCoords = stage.coordinates.slice(0, offset + 1);
                    if (activeCoords.length < 2) activeCoords = [stage.coordinates[0], stage.coordinates[0]];
                } else {
                    currentCacheKey = 'completed';
                    activeCoords = stage.coordinates;
                }
            }

            if (this.stageRenderCache[idx] === currentCacheKey) {
                return; 
            }
            this.stageRenderCache[idx] = currentCacheKey;

            source.setData({
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: { type: 'LineString', coordinates: stage.coordinates }, properties: { routeType: 'full' } },
                    { type: 'Feature', geometry: { type: 'LineString', coordinates: activeCoords }, properties: { routeType: 'completed' } }
                ]
            });
        });

        const markerSource = this.map.getSource('moving-marker');
        if (markerSource) {
            markerSource.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: currentPoint } });
        }
    }
}