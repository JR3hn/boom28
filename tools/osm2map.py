"""Bygger data/vassaro-map.json från en OpenStreetMap-export (map.osm).
Kartdata © OpenStreetMap-bidragsgivare, ODbL 1.0. Utdata är en härledd databas under ODbL.
Användning: python3 osm2map.py map.osm ../data/vassaro-map.json"""
import sys, json, math
import xml.etree.ElementTree as ET
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import linemerge, polygonize, unary_union

src, dst = sys.argv[1], sys.argv[2]
r = ET.parse(src).getroot()
nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in r.iter('node')}
tags = lambda e: {t.get('k'): t.get('v') for t in e.findall('tag')}
ways = {w.get('id'): w for w in r.iter('way')}
wpts = lambda w: [nodes[n.get('ref')] for n in w.findall('nd') if n.get('ref') in nodes]

# --- Ön (relation "Vässarön") bestämmer origo och skala
rel = next(e for e in r.iter('relation') if tags(e).get('name') == 'Vässarön')
outer = [wpts(ways[m.get('ref')]) for m in rel.findall('member') if m.get('type') == 'way' and m.get('ref') in ways]
lats = [p[0] for w in outer for p in w]; lons = [p[1] for w in outer for p in w]
lat0, lon0 = (min(lats) + max(lats)) / 2, (min(lons) + max(lons)) / 2
MX = 111320 * math.cos(math.radians(lat0)); MZ = 110540
height_m = (max(lats) - min(lats)) * MZ
UNIT = height_m / 10.0                      # ön är 10 enheter hög, som tidigare
def P(lat, lon): return ((lon - lon0) * MX / UNIT, -(lat - lat0) * MZ / UNIT)

# --- Kustlinje → polygoner (alla öar i utdraget)
coast_lines = [LineString([P(*p) for p in wpts(w)]) for w in r.iter('way') if tags(w).get('natural') == 'coastline' and len(wpts(w)) > 1]
merged = linemerge(coast_lines)
land = unary_union([p for p in polygonize(merged) if p.area > 0.0004])
# vatten inuti land (sjöar) dras bort
lakes = [Polygon([P(*p) for p in wpts(w)]) for w in r.iter('way') if tags(w).get('natural') == 'water' and len(wpts(w)) > 3 and wpts(w)[0] == wpts(w)[-1]]
if lakes: land = land.difference(unary_union(lakes))
EXT = 14
land = land.intersection(box(-EXT, -EXT, EXT, EXT))
print('land polys', len(getattr(land, 'geoms', [land])), 'unit m', round(UNIT, 1))

def ring(c, nd=4): return [[round(x, nd), round(z, nd)] for x, z in list(c.coords)[:-1]]
def polyjson(g, min_area=0.0004):
    out = []
    for p in getattr(g, 'geoms', [g]):
        if p.is_empty or p.area < min_area or p.geom_type != 'Polygon': continue
        out.append({'outer': ring(p.exterior), 'holes': [ring(h) for h in p.interiors]})
    return out
def lines(g):
    res = []
    for p in getattr(g, 'geoms', [g]):
        if p.geom_type != 'Polygon': continue
        res.append(ring(p.exterior)); res += [ring(h) for h in p.interiors]
    return res

W = 0.011
coast = land.buffer(W, join_style=1).difference(land.buffer(-W, join_style=1)).simplify(0.004)
contours = [{'depth': d, 'rings': lines(land.buffer(b, join_style=1).simplify(0.012))}
            for b, d in [(0.09, 3), (0.2, 6), (0.35, 10), (0.6, 20), (0.97, 30)]]

# --- Vägar och stigar
ROAD = {'unclassified', 'track', 'service', 'residential', 'tertiary'}
PATH = {'path', 'footway', 'steps', 'cycleway', 'bridleway'}
roads = []
for w in r.iter('way'):
    t = tags(w); h = t.get('highway')
    if h in ROAD or h in PATH:
        pts = [P(*p) for p in wpts(w)]
        if len(pts) > 1 and land.buffer(0.03).contains(LineString(pts).interpolate(0.5, normalized=True)):
            roads.append({'type': 'road' if h in ROAD else 'path', 'name': t.get('name', ''),
                          'points': [[round(x, 4), round(z, 4)] for x, z in pts]})

# --- Byggnader (ritas som små bläckrutor, som på sjökort)
buildings = []
for w in r.iter('way'):
    if 'building' in tags(w):
        pts = wpts(w)
        if len(pts) > 3: buildings.append([[round(c, 4) for c in P(*p)] for p in pts[:-1]])

# --- Namngivna platser (för att placera stopp med "osm": "Tunet")
places = {}
for e in list(r.iter('way')) + list(r.iter('node')):
    n = tags(e).get('name')
    if not n: continue
    if e.tag == 'node': x, z = P(float(e.get('lat')), float(e.get('lon')))
    else:
        pts = [P(*p) for p in wpts(e)]
        if not pts: continue
        g = Polygon(pts) if len(pts) > 3 and pts[0] == pts[-1] else LineString(pts) if len(pts) > 1 else Point(pts[0])
        c = g.representative_point() if g.geom_type == 'Polygon' else g.centroid
        x, z = c.x, c.y
    places.setdefault(n, [round(x, 4), round(z, 4)])

# --- Namn att skriva på sjökortet: vikar/sund (kursivt, vatten) och öar/skär (upprätt)
labels = []
seen = set()
for e in list(r.iter('node')) + list(r.iter('way')):
    t = tags(e); n = t.get('name')
    kind = 'water' if t.get('natural') in ('bay', 'strait') else 'islet' if t.get('place') in ('islet', 'island') else None
    if not n or not kind or n in seen or n == 'Vässarön': continue
    if e.tag == 'node': x, z = P(float(e.get('lat')), float(e.get('lon')))
    else:
        pts = [P(*p) for p in wpts(e)]
        if len(pts) < 2: continue
        g = Polygon(pts) if len(pts) > 3 and pts[0] == pts[-1] else LineString(pts)
        c = g.representative_point() if g.geom_type == 'Polygon' else g.centroid; x, z = c.x, c.y
    if abs(x) > EXT or abs(z) > EXT: continue
    seen.add(n); labels.append({'name': n, 'kind': kind, 'at': [round(x, 3), round(z, 3)]})

out = {
  '_source': 'Kartdata © OpenStreetMap-bidragsgivare, tillgänglig under Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright',
  'license': 'ODbL-1.0',
  'geo': {'lat0': lat0, 'lon0': lon0, 'metersPerUnit': UNIT, 'mx': MX, 'mz': MZ},
  'land': polyjson(land.simplify(0.003)),
  'coast': polyjson(coast, 0.00005),
  'contours': contours,
  'roads': roads,
  'buildings': buildings,
  'places': places,
 'labels': labels,
}
json.dump(out, open(dst, 'w'), separators=(',', ':'), ensure_ascii=False)
import os
print('labels', len(labels), 'roads', len(roads), 'buildings', len(buildings), 'bytes', os.path.getsize(dst))
for n in ['Tunet', 'Djuphamn', 'Storgårn', 'Vässarö Kapell']: print(n, places.get(n))
