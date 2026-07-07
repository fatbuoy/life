/**
 * Parses a GPX file string, extracting geometry and calculating key trail metrics.
 */
export function parseGPX(xmlText, fallbackName = "Unknown Stage") {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    
    const nameTags = xml.getElementsByTagName('name');
    let stageName = "";

    if (nameTags.length > 0) {
        stageName = nameTags[0].textContent.trim();
    }

    if (!stageName) {
        stageName = fallbackName;
    }

    stageName = stageName.replace(/\.gpx$/i, "");

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
        const ele = eleNode ? parseFloat(eleNode.textContent) : 0;

        if (!isNaN(lat) && !isNaN(lon)) {
            // Include elevation data directly as the 3rd element in the coordinate array
            const currentCoord = [lon, lat, ele];
            coordinates.push(currentCoord);

            if (prevPoint) {
                totalDistance += calculateHaversine(prevPoint.lat, prevPoint.lon, lat, lon);

                const eleDiff = ele - prevPoint.ele;
                if (eleDiff > 0) totalAscent += eleDiff;
                else totalDescent += Math.abs(eleDiff);
            }

            prevPoint = { lat, lon, ele };
        }
    });

    return {
        name: stageName,
        coordinates: coordinates,
        distance: Math.round(totalDistance * 10) / 10,
        ascent: Math.round(totalAscent),
        descent: Math.round(totalDescent)
    };
}

function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}