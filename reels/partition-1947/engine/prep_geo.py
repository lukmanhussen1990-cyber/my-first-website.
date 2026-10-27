"""Build the map shapes used in the reel from Natural Earth 10m data.

Usage: python3 prep_geo.py <natural-earth-dir> <out.pkl>

All coordinates are stored in "Mercator degrees": X = longitude,
Y = mercator(latitude) expressed in degrees, so 1 unit is the same size on
both axes and the camera can treat the map as a flat image.
"""
import math
import pickle
import sys

import numpy as np
import shapefile
from shapely.geometry import shape, MultiPolygon, Polygon, LineString, MultiLineString
from shapely.ops import unary_union, linemerge

NE = sys.argv[1].rstrip('/') + '/'
OUT = sys.argv[2]


def merc_y(lat):
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def load(name):
    r = shapefile.Reader(NE + name + '/' + name + '.shp', encoding='utf-8')
    flds = [f[0] for f in r.fields[1:]]
    return [(dict(zip(flds, sr.record)), shape(sr.shape.__geo_interface__)) for sr in r.iterShapeRecords()]


countries = {d['ADM0_A3']: g for d, g in load('ne_10m_admin_0_countries')}
disputed = {d['BRK_NAME']: g for d, g in load('ne_10m_admin_0_disputed_areas')}
states = {}
for d, g in load('ne_10m_admin_1_states_provinces'):
    if d['adm0_a3'] in ('IND', 'PAK', 'BGD'):
        states[(d['adm0_a3'], d['name'])] = g
blines = load('ne_10m_admin_0_boundary_lines_land')

# The whole former princely state of Jammu & Kashmir, shown as one neutral
# grey area with no internal lines (no Line of Control).
KASHMIR_PARTS = ['Jammu and Kashmir', 'Azad Kashmir', 'Gilgit-Baltistan',
                 'Siachen Glacier', 'Aksai Chin', 'Shaksam Valley', 'Demchok']
kashmir = unary_union([disputed[k].buffer(0) for k in KASHMIR_PARTS]).buffer(0.002).buffer(-0.002)

ind = countries['IND'].buffer(0)
pak = countries['PAK'].buffer(0)
bgd = countries['BGD'].buffer(0)

# Not part of British India in 1947: Portuguese and French territories and
# the Sikkim protectorate.
not_british = unary_union([
    states[('IND', 'Goa')],
    states[('IND', 'Dadra and Nagar Haveli and Daman and Diu')],
    states[('IND', 'Puducherry')],
    states[('IND', 'Sikkim')],
]).buffer(0.01)

shapes = {
    'IND_TODAY': ind.difference(kashmir),
    'PAK_TODAY': pak.difference(kashmir),
    'BGD': bgd,
    'KASHMIR': kashmir,
    'IND_1947': ind.difference(kashmir).difference(not_british),
    'PAK_W_1947': pak.difference(kashmir),
    'PAK_E_1947': bgd,
}
shapes['BRITISH_INDIA'] = unary_union([shapes['IND_1947'], shapes['PAK_W_1947'],
                                       shapes['PAK_E_1947'], kashmir]).buffer(0.003).buffer(-0.003)
# Provinces that were cut in two (approximate, modern units on each side).
shapes['PUNJAB_REGION'] = unary_union([states[('PAK', 'Punjab')], states[('IND', 'Punjab')],
                                       states[('IND', 'Haryana')], states[('IND', 'Chandigarh')],
                                       states[('PAK', 'F.C.T.')]]).buffer(0.003).buffer(-0.003)
shapes['BENGAL_REGION'] = unary_union([states[('IND', 'West Bengal')], bgd]).buffer(0.003).buffer(-0.003)


def pick_line(left, right):
    out = []
    for d, g in blines:
        if d['TYPE'] != 'Land' or not d['FEATURECLA'].startswith('International'):
            continue
        if {d['ADM0_LEFT'], d['ADM0_RIGHT']} == {left, right}:
            out.append(g)
    return merge(unary_union(out))


def merge(g):
    return linemerge(g) if isinstance(g, MultiLineString) else g


# The Radcliffe Line = the stretches of today's border that cut Punjab and Bengal.
ind_pak = pick_line('India', 'Pakistan')
ind_bgd = pick_line('Bangladesh', 'India')
lines = {
    'RADCLIFFE_PUNJAB': merge(ind_pak.intersection(states[('IND', 'Punjab')].buffer(0.06))),
    'RADCLIFFE_BENGAL': merge(ind_bgd.intersection(states[('IND', 'West Bengal')].buffer(0.06))),
    'IND_PAK_BORDER': ind_pak,
    'IND_BGD_BORDER': ind_bgd,
}


def to_merc_rings(geom, tol):
    geom = geom.simplify(tol, preserve_topology=True)
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    out = []
    for p in polys:
        if p.is_empty or p.area < 1e-5:
            continue
        rings = [p.exterior] + list(p.interiors)
        out.append([np.array([(x, merc_y(y)) for x, y in r.coords], dtype=np.float64) for r in rings])
    return out


def to_merc_lines(geom, tol):
    geom = geom.simplify(tol)
    parts = geom.geoms if isinstance(geom, MultiLineString) else [geom]
    out = []
    for ln in parts:
        if ln.length < 0.02:
            continue
        pts = np.array([(x, merc_y(y)) for x, y in ln.coords], dtype=np.float64)
        # Draw order: north to south.
        if pts[0, 1] < pts[-1, 1]:
            pts = pts[::-1]
        out.append(pts)
    out.sort(key=lambda a: -a[0, 1])
    return out


def label_point(geom):
    p = geom.representative_point()
    return (p.x, merc_y(p.y))


data = {'shapes': {}, 'lines': {}, 'anchors': {}}
for k, g in shapes.items():
    data['shapes'][k] = to_merc_rings(g, 0.004)
    data['anchors'][k] = label_point(g)
for k, g in lines.items():
    data['lines'][k] = to_merc_lines(g, 0.002)

cities = {
    'DELHI': (77.21, 28.61), 'LAHORE': (74.34, 31.55), 'AMRITSAR': (74.87, 31.63),
    'KARACHI': (67.01, 24.86), 'DHAKA': (90.41, 23.81), 'KOLKATA': (88.36, 22.57),
    'LONDON': (-0.13, 51.51), 'SRINAGAR': (74.80, 34.08),
}
data['cities'] = {k: (lon, merc_y(lat)) for k, (lon, lat) in cities.items()}

with open(OUT, 'wb') as f:
    pickle.dump(data, f)
for k, v in data['shapes'].items():
    print('%-14s polys=%3d pts=%6d' % (k, len(v), sum(len(r) for p in v for r in p)))
for k, v in data['lines'].items():
    print('%-16s parts=%d pts=%d' % (k, len(v), sum(len(p) for p in v)))
