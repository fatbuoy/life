/**
 * Parses a GPX file string, extracting geometry and calculating key trail metrics.
 */
export function parseGPX(xmlText, fallbackName = "Unknown Stage") {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    
    // 1. Get Stage Name
    const nameNode = xml.querySelector('trk > name') || xml.querySelector('name');
    const stageName = nameNode ? nameNode.textContent.trim() : fallbackName;

    const trkpts = xml.querySelectorAll('trkpt');
    const coordinates = [];
    
    let totalDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    let prevPoint = null;

    trkpts.forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        const eleNode = pt.querySelector('ele');
        const ele = eleNode ? parseFloat(eleNode.textContent) : null;

        if (!isNaN(lat) && !isNaN(lon)) {
            const currentCoord = [lon, lat];
            coordinates.push(currentCoord);

            if (prevPoint) {
                // Calculate distance step
                totalDistance += calculateHaversine(prevPoint.lat, prevPoint.lon, lat, lon);

                // Calculate elevation splits if data exists
                if (ele !== null && prevPoint.ele !== null) {
                    const eleDiff = ele - prevPoint.ele;
                    if (eleDiff > 0) totalAscent += eleDiff;
                    else totalDescent += Math.abs(eleDiff);
                }
            }

            prevPoint = { lat, lon, ele };
        }
    });

    return {
        name: stageName,
        coordinates: coordinates,
        distance: Math.round(totalDistance * 10) / 10, // Round to 1 decimal place
        ascent: Math.round(totalAscent),
        descent: Math.round(totalDescent)
    };
}

// Distance calculation helper (Haversine Formula)
function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}