"""Exact vector geometry of the logo (24x24 design grid, y down).

Contours are listed so an even-odd fill reproduces the mark; CENTERLINES
describe the stroke skeleton used for the light-beam build.
"""
import numpy as np

OUTER = [
    (22.3977, 7.0896), (20.0871, 7.0896), (20.0871, 0.0676), (12.5777, 6.4218),
    (12.5777, 0.1577), (11.4223, 0.1577), (11.4223, 6.3543), (4.4904, 0.0),
    (4.4904, 7.0896), (1.6023, 7.0896), (1.6023, 17.4872), (4.4905, 17.4872),
    (4.4905, 24.0), (11.4225, 17.6409), (11.4225, 23.8414), (12.5779, 23.8414),
    (12.5779, 17.7945), (19.5097, 23.9752), (19.5097, 17.4873), (22.3979, 17.4873),
]
HOLES = [
    [(18.932, 2.5586), (18.932, 7.0896), (13.577, 7.0896)],
    [(5.6458, 2.6262), (10.5149, 7.0896), (5.6458, 7.0896)],
    [(2.7576, 16.332), (2.7576, 8.245), (10.6052, 8.245), (4.4903, 14.3597), (4.4903, 16.332)],
    [(5.6458, 21.3724), (5.6458, 17.4872), (5.6459, 14.8384), (11.4222, 9.062),
     (11.4222, 16.0731), (5.6458, 21.3724)],
    [(18.3544, 21.3972), (12.5778, 16.2463), (12.5778, 9.0618), (18.3544, 14.8384)],
    [(21.2426, 16.332), (19.5096, 16.332), (19.5096, 14.3597), (13.3948, 8.245),
     (21.2426, 8.245)],
]

STROKE = 1.1554
O = (12.0, 7.6673)          # the node where every diagonal meets


def _m(p):                   # mirror across the spine
    return (24.0 - p[0], p[1])


A1 = (5.068, 1.313)
B1 = (5.068, 7.6673)
FL = (2.18, 7.6673)
FB = (2.18, 16.9096)
FJ = (5.068, 16.9096)
D2E = (5.068, 14.599)
TIP = (5.068, 22.686)
D3E = (12.0, 16.327)

# skeleton segments: (name, start, end, start_time, duration) in seconds
# times are relative to the beam build start
SKELETON = [
    ("spine_up", O, (12.0, 0.1577), 0.00, 0.95),
    ("spine_dn", O, (12.0, 23.8414), 0.00, 1.25),
    ("bar_l", O, FL, 0.55, 0.95),
    ("bar_r", O, _m(FL), 0.55, 0.95),
    ("d1_l", O, A1, 1.45, 0.75),
    ("d1_r", O, _m(A1), 1.45, 0.75),
    ("d2_l", O, D2E, 1.45, 0.75),
    ("d2_r", O, _m(D2E), 1.45, 0.75),
    ("v1_l", A1, B1, 2.20, 0.55),
    ("v1_r", _m(A1), _m(B1), 2.20, 0.55),
    ("f1_l", FL, FB, 1.50, 0.80),
    ("f1_r", _m(FL), _m(FB), 1.50, 0.80),
    ("f2_l", FB, FJ, 2.30, 0.35),
    ("f2_r", _m(FB), _m(FJ), 2.30, 0.35),
    ("v2_l", D2E, TIP, 2.20, 0.70),
    ("v2_r", _m(D2E), _m(TIP), 2.20, 0.70),
    ("d3_l", TIP, D3E, 2.90, 0.70),
    ("d3_r", _m(TIP), _m(D3E), 2.90, 0.70),
]


def to_world(p):
    """Design grid (y down, 0..24) -> world units (y up, centred on the mark)."""
    return np.array([p[0] - 12.0, 12.0 - p[1]], dtype=np.float64)


def contours_world():
    return [np.array([to_world(p) for p in c]) for c in [OUTER] + HOLES]


def contour_lengths(c):
    d = np.diff(np.vstack([c, c[:1]]), axis=0)
    return np.hypot(d[:, 0], d[:, 1])
