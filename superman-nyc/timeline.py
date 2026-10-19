"""Shared timeline, layout and trajectories (pure Python; imported by Blender scripts,
simulations, compositing and sound design so that everything stays in sync).

World: metres, X = east, Y = north (Manhattan grid north), Z = up.
The avenue runs along Y (one-way northbound), the cross street along X.
"""
import math

FPS = 30
DURATION = 40.0
N_FRAMES = int(DURATION * FPS)          # 1200 frames: 0 .. 1199

# ----------------------------------------------------------------------------- shots
# (name, first frame, last frame inclusive, camera object)
SHOTS = [
    ("s1_ordinary", 0, 179, "CamPhone"),
    ("s2_sky", 180, 359, "CamPhone"),
    ("s3_hostile", 360, 599, "CamPhone"),
    ("s4a_cctv", 600, 704, "CamCCTV"),
    ("s4b_chaos", 705, 869, "CamPhone"),
    ("s5_closeup", 870, 1049, "CamPhone"),
    ("s6_drop", 1050, 1184, "CamPhone"),
]
BLACK_FROM = 1185                       # last 0.5 s: black end card

CAPTIONS = [
    # (start s, end s, text, style)
    (0.00, 2.75, "WHAT IF SUPERMAN ATTACKED NEW YORK?", "title"),
    (3.00, 5.80, "NEW YORK CITY. 2:37 PM.", "caption"),
    (7.00, 11.00, "THEN SOMETHING APPEARED ABOVE US…", "caption"),
    (15.00, 19.00, "HE WASN’T HERE TO SAVE ANYONE.", "caption"),
    (24.00, 28.70, "THE ENTIRE STREET ERUPTED INTO CHAOS.", "caption"),
    (31.00, 34.60, "HE LOOKED RIGHT AT US.", "caption"),
    (38.00, 40.00, "WOULD YOU SURVIVE THIS?", "final"),
]

# ----------------------------------------------------------------------------- layout
AVE_HALF = 10.0          # avenue roadway half width
AVE_WALK = 6.0           # avenue sidewalk width
BLX = AVE_HALF + AVE_WALK            # building line x = +-16
ST_HALF = 5.0            # cross street roadway half width
ST_WALK = 4.5
BLY = ST_HALF + ST_WALK              # building line y = +-9.5
BLOCK = 80.0             # street spacing along the avenue (centre to centre)
CURB_H = 0.15

# Target tower (NE corner) with a 45 deg chamfer facing the intersection
TOWER = dict(x0=BLX, x1=62.0, y0=BLY, y1=52.0, chamfer=18.0, height=212.0, floor_h=4.0, lobby_h=8.0)
# chamfer face runs from A (west end) to B (south end)
CHAMFER_A = (TOWER["x0"], TOWER["y0"] + TOWER["chamfer"])
CHAMFER_B = (TOWER["x0"] + TOWER["chamfer"], TOWER["y0"])
DAMAGE_Z = (44.0, 60.0)          # damaged floors on the chamfer (+ wrap onto both faces)

# SW corner building (operator hides behind its south-east corner in scene 5)
SW_CORNER = (-BLX, -33.0)

# Sun: Manhattan-grid azimuth (clockwise from grid north) and elevation (deg)
SUN_AZ = 196.0
SUN_EL = 52.0


def sun_dir():
    """Unit vector pointing from the scene toward the sun."""
    az, el = math.radians(SUN_AZ), math.radians(SUN_EL)
    return (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))


# ----------------------------------------------------------------------------- key times (s)
T_RUMBLE = 4.0
T_BOOM1 = 6.0
T_WAKE = 9.25            # Superman blasts past the tower; wake hits the street
T_STOP = 12.2            # abrupt stop above the intersection
T_EYES = 13.4            # eyes begin to glow
T_BEAM_ON = 14.0
T_BEAM_OFF = 16.6
T_FUMBLE = (17.0, 17.9)  # operator nearly drops the phone
T_TAKEOFF = 19.4         # leaves the hover, streaks between skyscrapers
T_TAXI_BRAKE = 21.0
T_DESCEND = 29.6         # descends into the intersection (scene 5)
T_LOOK = 31.2            # turns his head to the camera
T_LAUNCH = 35.0
T_DROP = 35.3            # phone released
T_PHONE_LAND = 35.78
T_PASS = 36.25           # silhouette passes overhead of the phone
T_IMPACT = 36.75         # tremendous impact behind the camera
T_CUT = BLACK_FROM / FPS  # 39.5 s


# ----------------------------------------------------------------------------- Superman path
# (time s, x, y, z) control points; Catmull-Rom between them.
SUPERMAN_PATH = [
    (5.0, 10.0, 1500.0, 330.0),
    (6.0, 4.0, 1000.0, 270.0),
    (7.0, -2.0, 560.0, 190.0),
    (8.0, 1.0, 250.0, 118.0),
    (8.8, 5.0, 80.0, 70.0),
    (9.25, 7.0, 26.0, 52.0),      # close pass by the tower's chamfer
    (9.6, 3.0, -6.0, 46.0),
    (10.0, -2.0, -24.0, 55.0),
    (10.45, -5.0, -22.0, 72.0),   # top of the loop, high above the operator
    (10.95, -3.0, -8.0, 62.0),
    (11.5, -0.5, 1.0, 40.0),
    (12.2, 0.0, 0.0, 31.0),       # stop
    (13.0, 0.1, 0.05, 31.3),
    (16.0, -0.1, 0.0, 31.6),
    (19.0, 0.2, 0.1, 31.2),
    (19.4, 0.0, 0.0, 31.4),
    (19.8, 2.0, -30.0, 36.0),     # takeoff: streaks south down the avenue, over the operator
    (20.3, 4.0, -110.0, 55.0),
    (21.0, 0.0, -260.0, 95.0),
    (22.0, 120.0, -330.0, 160.0),  # climbs and arcs east
    (23.5, 250.0, -120.0, 170.0),
    (25.0, 180.0, 160.0, 150.0),   # circling high between the towers
    (26.5, 20.0, 280.0, 130.0),
    (27.6, -40.0, 150.0, 95.0),
    (28.6, -12.0, 40.0, 50.0),
    (29.6, -2.0, 8.0, 14.0),      # dropping into the intersection
    (30.6, 1.0, 3.0, 4.6),
    (31.6, 0.5, 2.5, 4.3),
    (33.5, 0.2, 2.0, 4.5),
    (35.0, 0.0, 2.0, 4.4),        # launch
    (35.35, -3.5, -6.0, 5.0),
    (35.8, -9.0, -19.0, 4.3),
    (36.05, -13.0, -26.8, 3.0),   # low enough to cross the dropped phone's view
    (36.25, -17.0, -33.2, 3.0),   # over the dropped phone
    (36.75, -26.6, -52.0, 3.0),   # impact into the plaza tower's lobby
    (40.0, -26.8, -52.3, 2.9),
]


# ----------------------------------------------------------------------------- operator (phone)
# (time s, x, y, eye height) of the person filming
OPERATOR_PATH = [
    (0.0, -13.0, -46.0, 1.55), (4.4, -13.05, -40.6, 1.55), (5.6, -13.1, -39.0, 1.55),
    (14.5, -13.2, -38.8, 1.55), (17.0, -13.4, -41.0, 1.52), (23.5, -13.4, -41.2, 1.52),
    (25.5, -18.5, -40.5, 1.45), (27.8, -17.0, -34.6, 1.3), (28.8, -16.25, -33.7, 1.05),
    (35.25, -16.2, -33.7, 1.0),
]
PHONE_REST = (-16.05, -34.15, 0.19)       # where the dropped phone comes to rest (on the plaza paving)


def operator_pos(t):
    return catmull(OPERATOR_PATH, t)


def catmull(points, t):
    """Centripetal-free uniform Catmull-Rom over (t, x, y, z) points with non-uniform times."""
    if t <= points[0][0]:
        return points[0][1:]
    if t >= points[-1][0]:
        return points[-1][1:]
    for i in range(len(points) - 1):
        if points[i][0] <= t <= points[i + 1][0]:
            break
    p0 = points[max(i - 1, 0)]
    p1, p2 = points[i], points[i + 1]
    p3 = points[min(i + 2, len(points) - 1)]
    t1, t2 = p1[0], p2[0]
    u = (t - t1) / (t2 - t1)
    out = []
    for k in range(1, 4):
        # tangents scaled for non-uniform spacing
        m1 = (p2[k] - p0[k]) / (t2 - p0[0]) * (t2 - t1) if p0 is not p1 else (p2[k] - p1[k])
        m2 = (p3[k] - p1[k]) / (p3[0] - t1) * (t2 - t1) if p3 is not p2 else (p2[k] - p1[k])
        h00 = 2 * u ** 3 - 3 * u ** 2 + 1
        h10 = u ** 3 - 2 * u ** 2 + u
        h01 = -2 * u ** 3 + 3 * u ** 2
        h11 = u ** 3 - u ** 2
        out.append(h00 * p1[k] + h10 * m1 + h01 * p2[k] + h11 * m2)
    return tuple(out)


def superman_pos(t):
    return catmull(SUPERMAN_PATH, t)


def superman_vel(t, dt=1e-3):
    a, b = superman_pos(t - dt), superman_pos(t + dt)
    return tuple((b[i] - a[i]) / (2 * dt) for i in range(3))


# ----------------------------------------------------------------------------- heat vision
def beam_target(t):
    """Point on the tower the heat vision hits (sweeps across the chamfer)."""
    ax, ay = CHAMFER_A
    bx, by = CHAMFER_B
    u = (t - T_BEAM_ON) / (T_BEAM_OFF - T_BEAM_ON)
    u = min(max(u, 0.0), 1.0)
    # sweep from beyond the west face onto the chamfer and off the south face
    s = -0.25 + 1.5 * (0.5 - 0.5 * math.cos(math.pi * u))
    if s < 0:      # on the west face (x = x0), north of A
        x, y = ax, ay - s * 20.0
    elif s > 1:    # on the south face (y = y0), east of B
        x, y = bx + (s - 1) * 20.0, by
    else:
        x, y = ax + (bx - ax) * s, ay + (by - ay) * s
    z = 52.0 + 4.0 * math.sin(u * 2.7) - 2.0 * u
    return (x, y, z)


def frame_time(frame):
    return frame / FPS
