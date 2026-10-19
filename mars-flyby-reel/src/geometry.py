"""Scene geometry: observer on Earth, Moon placement, camera models.

All positions are in km in the inertial frame of science.py
(+X anti-Sun, +Z ecliptic north). The Sun direction is the same for every
scene, so every phase and terminator in the reel is mutually consistent.
"""
import math

import numpy as np

import science as sc

KM = 1e3
R_E = sc.R_EARTH / KM
R_M = sc.R_MARS / KM
R_L = sc.R_MOON / KM
SUN = sc.SUN_DIR.copy()                     # unit vector toward the Sun
SPIN_AXIS = np.array([0.0, math.sin(math.radians(23.44)), math.cos(math.radians(23.44))])
SIDEREAL_RATE = 2 * math.pi / 86164.1       # rad/s

T_HOOK = -0.30 * 3600                       # hook moment, s from Mars closest approach
ALT_ANTISUN = 13.0                          # Sun 13 deg below the western horizon
ALT_MARS_HOOK = 2.8
MOON_OFFSET = (2.75, 1.35)                  # Moon vs Mars in the hook frame (deg right, deg up)


def unit(v):
    return v / np.linalg.norm(v)


def rot_axis(axis, ang):
    axis = unit(axis)
    K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K


def mars_km(t):
    return sc.mars_pos(t) / KM


def _solve_zenith():
    """Zenith with the anti-Sun point at 13 deg and Mars at 2.8 deg altitude (hook)."""
    m_geo = unit(mars_km(T_HOOK))
    X = np.array([1.0, 0, 0])
    best = None
    # analytic: z = a X + b m + c (X x m), with z.X = s1, z.m = s2, |z| = 1
    s1, s2 = math.sin(math.radians(ALT_ANTISUN)), math.sin(math.radians(ALT_MARS_HOOK))
    for _ in range(3):
        c = float(X @ m_geo)
        A = np.array([[1, c], [c, 1]])
        a, b = np.linalg.solve(A, [s1, s2])
        base = a * X + b * m_geo
        n = unit(np.cross(X, m_geo))
        rest = math.sqrt(max(0.0, 1 - base @ base))
        cands = [unit(base + rest * n), unit(base - rest * n)]
        # pick the zenith whose observer is in the northern hemisphere-ish (spin axis side)
        z = max(cands, key=lambda v: v @ SPIN_AXIS)
        O = R_E * z
        m_geo = unit(mars_km(T_HOOK) - O)        # topocentric refinement
        best = z
    return best


ZENITH_HOOK = _solve_zenith()
OBS_HOOK = R_E * ZENITH_HOOK
LATITUDE = math.degrees(math.asin(ZENITH_HOOK @ SPIN_AXIS))


def local_frame(zenith, forward_hint):
    """(right, up, forward) for a camera looking near forward_hint with the horizon level."""
    f = unit(forward_hint)
    r = unit(np.cross(f, zenith))
    u = np.cross(r, f)
    return r, u, f


def _moon_position():
    m_dir = unit(mars_km(T_HOOK) - OBS_HOOK)
    r, u, f = local_frame(ZENITH_HOOK, m_dir)
    dx, dy = np.radians(MOON_OFFSET)
    l_dir = unit(f + math.tan(dx) * r + math.tan(dy) * u)
    # place on the ray so the Moon is 384,400 km from Earth's centre
    b = OBS_HOOK @ l_dir
    D = -b + math.sqrt(b * b - (OBS_HOOK @ OBS_HOOK - 384_400.0**2))
    return OBS_HOOK + D * l_dir


MOON_POS = _moon_position()
MOON_ECL_LAT = math.degrees(math.asin(unit(MOON_POS)[2]))


def zenith_at(t):
    """Observer zenith at time t (s from closest approach): Earth spins about SPIN_AXIS."""
    return rot_axis(SPIN_AXIS, SIDEREAL_RATE * (t - T_HOOK)) @ ZENITH_HOOK


def observer_at(t):
    return R_E * zenith_at(t)


def alt_of(direction, zenith):
    return math.degrees(math.asin(np.clip(unit(direction) @ zenith, -1, 1)))


class Camera:
    """Pinhole camera. Screen x right, y down; 1080x1920 frame."""

    def __init__(self, pos, right, up, fwd, fov_v_deg, w=1080, h=1920, cx=None, cy=None):
        self.pos = np.asarray(pos, float)
        self.R = np.stack([right, up, fwd])     # world -> camera rows
        self.w, self.h = w, h
        self.f = (h / 2) / math.tan(math.radians(fov_v_deg) / 2)
        self.cx = w / 2 if cx is None else cx
        self.cy = h / 2 if cy is None else cy

    @staticmethod
    def look(pos, target, up_hint, fov_v_deg, roll_deg=0.0, **kw):
        f = unit(np.asarray(target, float) - np.asarray(pos, float))
        r = unit(np.cross(f, up_hint))
        u = np.cross(r, f)
        if roll_deg:
            Rr = rot_axis(f, math.radians(roll_deg))
            r, u = Rr @ r, Rr @ u
        return Camera(pos, r, u, f, fov_v_deg, **kw)

    def to_cam(self, p):
        return self.R @ (np.asarray(p, float) - self.pos)

    def project(self, p):
        """World point -> (x, y, depth). depth<=0 means behind the camera."""
        c = self.to_cam(p)
        if c[2] <= 1e-9:
            return None
        return np.array([self.cx + self.f * c[0] / c[2], self.cy - self.f * c[1] / c[2], c[2]])

    def project_many(self, P):
        C = (np.asarray(P, float) - self.pos) @ self.R.T
        z = np.where(C[:, 2] > 1e-9, C[:, 2], np.nan)
        return np.stack([self.cx + self.f * C[:, 0] / z, self.cy - self.f * C[:, 1] / z, C[:, 2]], 1)

    def ray_dirs(self, x0, y0, x1, y1):
        """Unit world-space ray directions for pixel centres in [x0,x1) x [y0,y1)."""
        xs = np.arange(x0, x1) + 0.5
        ys = np.arange(y0, y1) + 0.5
        X, Y = np.meshgrid((xs - self.cx) / self.f, -(ys - self.cy) / self.f)
        d = np.stack([X, Y, np.ones_like(X)], -1)
        d /= np.linalg.norm(d, axis=-1, keepdims=True)
        return d @ self.R                     # camera -> world

    def px_per_deg(self):
        return self.f * math.radians(1.0)


def report():
    m = mars_km(T_HOOK)
    print("zenith", ZENITH_HOOK, "latitude %.1f" % LATITUDE)
    print("anti-sun alt %.2f, Mars alt %.2f" % (alt_of(np.array([1.0, 0, 0]), ZENITH_HOOK),
                                               alt_of(m - OBS_HOOK, ZENITH_HOOK)))
    print("Moon alt %.2f, ecliptic lat %.2f, Moon dist %.0f km" % (
        alt_of(MOON_POS - OBS_HOOK, ZENITH_HOOK), MOON_ECL_LAT, np.linalg.norm(MOON_POS)))
    sep = np.linalg.norm(MOON_POS - m)
    ang = math.degrees(math.acos(unit(MOON_POS - OBS_HOOK) @ unit(m - OBS_HOOK)))
    print("Mars-Moon separation: %.0f km (%.2f deg on sky)" % (sep, ang))
    print("Mars dist from observer %.0f km, from centre %.0f km" % (np.linalg.norm(m - OBS_HOOK), np.linalg.norm(m)))
    # closest Mars-Moon approach during the flyby (Moon held fixed; it moves only ~1 km/s)
    ts = np.linspace(-6 * 3600, 6 * 3600, 20001)
    d = np.linalg.norm(sc.mars_pos(ts) / KM - MOON_POS, axis=1)
    i = np.argmin(d)
    print("closest Mars-Moon distance %.0f km at t=%.2f h" % (d[i], ts[i] / 3600))
    dv = 2 * sc.G * sc.M_MARS / (d[i] * KM * sc.V_PERI)
    print("impulse on the Moon ~ %.0f m/s (Moon orbital speed ~1020 m/s)" % dv)
    print("Moon phase angle %.1f deg, Mars phase angle %.1f deg" % (
        sc.phase_angle_deg(MOON_POS * KM, OBS_HOOK * KM), sc.phase_angle_deg(m * KM, OBS_HOOK * KM)))
    return dict(moon_mars_sep_km=float(sep), moon_mars_sep_deg=ang, closest_moon_km=float(d[i]),
                moon_kick_ms=float(dv), latitude=LATITUDE, moon_ecl_lat=MOON_ECL_LAT)


if __name__ == "__main__":
    report()
