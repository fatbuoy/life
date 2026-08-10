import math
import xml.etree.ElementTree as ET

# ---------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------
INPUT_FILE = 'route.gpx'
OUTPUT_FILE = 'route_segmented.gpx'

# Option A: Only include waypoints whose name contains this text (case-insensitive)
# e.g., "Segment", "Day", "End", "Stage"
NAME_FILTER = "Day"  # <-- Set to e.g. "Segment" or leave "" if using Option B below

# Option B: Or list the exact waypoint names you want to split at in order
SEGMENT_WAYPOINT_NAMES = [
    # "Florence", "Greve in Chianti", "Gaiole", "Siena", "Asciano",
    # "Montalcino", "Pienza", "Montepulciano", "Cetona",
    # "San Quirico d'Orcia", "Colle Val d'Elsa", "Volterra", "Lucca", "Pisa"
]
# ---------------------------------------------------------------------

def get_distance(lat1, lon1, lat2, lon2):
    return math.hypot(lat1 - lat2, lon1 - lon2)

def split_gpx():
    tree = ET.parse(INPUT_FILE)
    root = tree.getroot()
    
    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0] + '}'

    # Extract & filter waypoints
    waypoints = []
    for wpt in root.findall(f'.//{ns}wpt'):
        name_el = wpt.find(f'{ns}name')
        wpt_name = name_el.text.strip() if name_el is not None and name_el.text else ""
        
        # Check filters
        keep = False
        if NAME_FILTER and NAME_FILTER.lower() in wpt_name.lower():
            keep = True
        elif SEGMENT_WAYPOINT_NAMES and any(target.lower() in wpt_name.lower() for target in SEGMENT_WAYPOINT_NAMES):
            keep = True
        elif not NAME_FILTER and not SEGMENT_WAYPOINT_NAMES:
            # If no filters set, use all waypoints
            keep = True

        if keep:
            lat = float(wpt.attrib['lat'])
            lon = float(wpt.attrib['lon'])
            waypoints.append((lat, lon, wpt_name))

    print(f"Found {len(waypoints)} matching segment end waypoints:")
    for w in waypoints:
        print(f"  📍 {w[2]}")

    trk = root.find(f'.//{ns}trk')
    all_points = root.findall(f'.//{ns}trkpt')
    
    if not all_points or not trk:
        print("Error: Could not find track points in GPX.")
        return

    # Find closest trackpoint index for each selected waypoint
    split_indices = []
    for wpt in waypoints:
        min_dist = float('inf')
        closest_idx = 0
        for idx, pt in enumerate(all_points):
            plat = float(pt.attrib['lat'])
            plon = float(pt.attrib['lon'])
            dist = get_distance(wpt[0], wpt[1], plat, plon)
            if dist < min_dist:
                min_dist = dist
                closest_idx = idx
        split_indices.append(closest_idx)

    split_indices = sorted(list(set(split_indices)))
    if 0 not in split_indices:
        split_indices.insert(0, 0)
    if len(all_points) - 1 not in split_indices:
        split_indices.append(len(all_points) - 1)

    print(f"\nSplitting track into {len(split_indices) - 1} segments...")

    # Clear old track segments
    for trkseg in trk.findall(f'{ns}trkseg'):
        trk.remove(trkseg)

    # Build new <trkseg> elements
    for i in range(len(split_indices) - 1):
        start_idx = split_indices[i]
        end_idx = split_indices[i + 1] + 1
        
        new_seg = ET.SubElement(trk, f'{ns}trkseg')
        for pt_idx in range(start_idx, end_idx):
            new_seg.append(all_points[pt_idx])

    ET.register_namespace('', ns.strip('{}'))
    tree.write(OUTPUT_FILE, encoding='utf-8', xml_declaration=True)
    print(f"✅ Saved to '{OUTPUT_FILE}'!")

if __name__ == '__main__':
    split_gpx()