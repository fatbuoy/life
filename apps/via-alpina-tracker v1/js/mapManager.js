export class MapManager {
    constructor(containerId) {
        // Initializing MapLibre with a clean, free vector style from CartoDB
        this.map = new maplibregl.Map({
            container: containerId,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [9.5, 46.5], // Central Alps default fallback
            zoom: 7
        });

        this.isReady = false;
        this.map.on('load', () => { this.isReady = true; });
    }

    /**
     * Set up GeoJSON sources and styling layers on the map
     */
    setupLayers(fullRouteCoords) {
        if (!this.map.isStyleLoaded()) {
            setTimeout(() => this.setupLayers(fullRouteCoords), 100);
            return;
        }

        // 1. Full Dimmed Background Route
        this.map.addSource('full-route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: fullRouteCoords }
            }
        });

        this.map.addLayer({
            id: 'full-route-layer',
            type: 'line',
            source: 'full-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#7f8c8d', 'line-width': 4, 'line-opacity': 0.4 }
        });

        // 2. Active Highlighted Route (Completed tracking)
        this.map.addSource('completed-route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [fullRouteCoords[0]] }
            }
        });

        this.map.addLayer({
            id: 'completed-route-layer',
            type: 'line',
            source: 'completed-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#e67e22', 'line-width': 5, 'line-opacity': 1 }
        });

        // 3. Traveling Animation Marker
        this.map.addSource('marker', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: fullRouteCoords[0] }
            }
        });

        this.map.addLayer({
            id: 'marker-layer',
            type: 'circle',
            source: 'marker',
            paint: {
                'circle-radius': 7,
                'circle-color': '#d35400',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        this.fitToRoute(fullRouteCoords);
    }

    /**
     * Smoothly pans and zooms out to fit the entirety of loaded track entries
     */
    fitToRoute(coordinates) {
        const bounds = coordinates.reduce((acc, coord) => {
            return acc.extend(coord);
        }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

        this.map.fitBounds(bounds, { padding: 50, duration: 1500 });
    }

    // 🛑 REPLACE THIS METHOD IN js/mapManager.js

/**
 * Updates positions of dynamic active features frame-by-frame
 */
updatePlayback(completedCoords, currentPoint) {
    if (!this.isReady) return;
    
    const completedSource = this.map.getSource('completed-route');
    const markerSource = this.map.getSource('marker');

    // Only update data if the sources have been successfully initialized
    if (completedSource) {
        completedSource.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: completedCoords }
        });
    }

    if (markerSource) {
        markerSource.setData({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: currentPoint }
        });
    }
}
}