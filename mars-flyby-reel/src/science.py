"""Physics for 'What If Mars Appeared in Earth's Sky?'.

Every number shown on screen or spoken in the reel is computed here, and the
same geometry drives the renderer (one Sun direction for every scene).
Units: SI unless a name says otherwise (_km, _deg, _h).
"""
import json
import math

import numpy as np

G = 6.67430e-11
AU = 1.495978707e11

# Bodies (Mars values are the brief's starting conditions)
M_EARTH = 5.9722e24
R_EARTH = 6371.0e3
RHO_EARTH = 5514.0
M_MARS = 6.42e23
R_MARS = 3389.5e3
RHO_MARS = 3933.0
M_MOON = 7.342e22
R_MOON = 1737.4e3
RHO_MOON = 3344.0
D_MOON = 384_400e3          # Moon's mean distance (centre to centre)

# Scenario assumptions (ASSUMPTION labels)
R_PERI = 384_400e3          # Mars closest approach, centre to centre
V_INF = 10.0e3              # Mars speed far from Earth, relative to Earth

# Photometry
P_MARS_V = 0.170            # geometric albedo (NASA fact sheet)
P_MOON_V = 0.12
H_MARS_V = -1.52            # absolute magnitude (Mallama 2017)
FULL_MOON_V = -12.74

V_EARTH_ORBIT = 29.78e3
YEAR_DAYS = 365.256


def ang_diam_deg(radius, dist):
    return math.degrees(2.0 * math.atan(radius / dist))


def deg_to_arcsec(d):
    return d * 3600.0


# --- hyperbolic two-body flyby ---------------------------------------------
MU = G * (M_EARTH + M_MARS)
A_HYP = MU / V_INF**2                       # |semi-major axis|
ECC = 1.0 + R_PERI * V_INF**2 / MU
DEFLECT = 2.0 * math.asin(1.0 / ECC)        # turn angle of relative velocity
V_PERI = math.sqrt(V_INF**2 + 2.0 * MU / R_PERI)
B_IMPACT = R_PERI * math.sqrt(1.0 + 2.0 * MU / (R_PERI * V_INF**2))
N_HYP = math.sqrt(MU / A_HYP**3)


def hyp_r_of_t(t):
    """Distance (m) and true anomaly (rad) at time t (s) from periapsis."""
    t = np.asarray(t, dtype=float)
    M = N_HYP * t
    F = np.arcsinh(M / ECC)
    for _ in range(60):  # Newton on e sinh F - F = M
        f = ECC * np.sinh(F) - F - M
        F = F - f / (ECC * np.cosh(F) - 1.0)
    r = A_HYP * (ECC * np.cosh(F) - 1.0)
    nu = 2.0 * np.arctan(np.sqrt((ECC + 1.0) / (ECC - 1.0)) * np.tanh(F / 2.0))
    return r, nu


def hyp_t_of_r(r):
    """Time (s) after periapsis when the outbound leg reaches distance r."""
    F = math.acosh((r / A_HYP + 1.0) / ECC)
    return (ECC * math.sinh(F) - F) / N_HYP


# --- global geometry (one Sun for every scene) -----------------------------
# Inertial frame: +X = anti-Sun direction, +Z = ecliptic north.
SUN_DIR = np.array([-1.0, 0.0, 0.0])        # direction TO the Sun

_t4 = math.radians(4.0)
TRACK_A1 = np.array([math.cos(_t4), 0.0, math.sin(_t4)])  # track point 4 deg N of anti-Sun
TRACK_A2 = np.array([0.0, 1.0, 0.0])
PHI_PERI = math.radians(11.0)               # periapsis 11 deg along the track
P_HAT = math.cos(PHI_PERI) * TRACK_A1 + math.sin(PHI_PERI) * TRACK_A2
Q_HAT = -math.sin(PHI_PERI) * TRACK_A1 + math.cos(PHI_PERI) * TRACK_A2  # motion at periapsis


def mars_pos(t):
    """Mars position (m) relative to Earth's centre at time t (s) from closest approach."""
    r, nu = hyp_r_of_t(t)
    r = np.atleast_1d(r)
    nu = np.atleast_1d(nu)
    pos = (r * np.cos(nu))[:, None] * P_HAT + (r * np.sin(nu))[:, None] * Q_HAT
    return pos if pos.shape[0] > 1 else pos[0]


def phase_angle_deg(body_pos, observer=np.zeros(3)):
    to_obs = observer - body_pos
    to_obs = to_obs / np.linalg.norm(to_obs)
    return math.degrees(math.acos(np.clip(np.dot(to_obs, SUN_DIR), -1, 1)))


def lit_fraction(phase_deg):
    return 0.5 * (1.0 + math.cos(math.radians(phase_deg)))


def compute():
    out = {}
    # Apparent sizes
    out["moon_deg"] = ang_diam_deg(R_MOON, D_MOON)
    for d_km in (55e6, 10e6, 1e6, 384_400):
        k = f"mars_deg_{int(d_km)}km"
        out[k] = ang_diam_deg(R_MARS, d_km * 1e3)
    out["mars_arcsec_55Mkm"] = deg_to_arcsec(out["mars_deg_55000000km"])
    out["mars_arcsec_10Mkm"] = deg_to_arcsec(out["mars_deg_10000000km"])
    out["mars_over_moon_at_384400"] = out["mars_deg_384400km"] / out["moon_deg"]
    out["mars_1Mkm_over_moon"] = out["mars_deg_1000000km"] / out["moon_deg"]

    # Tides (scale as M/d^3); equilibrium tide from P2 term
    out["tide_ratio_mars_moon"] = M_MARS / M_MOON
    eq_moon_hi = (M_MOON / M_EARTH) * R_EARTH**4 / D_MOON**3
    out["eq_tide_moon_range_m"] = 1.5 * eq_moon_hi
    out["eq_tide_mars_range_m"] = 1.5 * (M_MARS / M_EARTH) * R_EARTH**4 / R_PERI**3
    out["eq_tide_mars_high_m"] = (M_MARS / M_EARTH) * R_EARTH**4 / R_PERI**3
    gamma2 = 1.0 + 0.302 - 0.609             # 1 + k2 - h2 (ocean tide vs. moving seafloor)
    out["love_factor_gamma2"] = gamma2
    out["eq_tide_mars_range_vs_seafloor_m"] = gamma2 * out["eq_tide_mars_range_m"]
    out["tide_sun_over_moon"] = (1.989e30 / AU**3) / (M_MOON / D_MOON**3)

    # Brightness at full phase (both ~1 AU from the Sun)
    out["brightness_ratio_full"] = (P_MARS_V / P_MOON_V) * (R_MARS / R_MOON) ** 2
    delta_au = R_PERI / AU
    out["mars_mag_full_at_peri"] = H_MARS_V + 5 * math.log10(1.0 * delta_au)
    out["brightness_ratio_from_mags"] = 10 ** (-0.4 * (out["mars_mag_full_at_peri"] - FULL_MOON_V))

    # Flyby
    out["mu"] = MU
    out["ecc"] = ECC
    out["a_hyp_km"] = A_HYP / 1e3
    out["deflection_deg"] = math.degrees(DEFLECT)
    out["v_peri_kms"] = V_PERI / 1e3
    out["impact_param_km"] = B_IMPACT / 1e3
    dv_rel = 2.0 * V_INF * math.sin(DEFLECT / 2.0)
    out["dv_rel_ms"] = dv_rel
    out["dv_earth_ms"] = dv_rel * M_MARS / (M_EARTH + M_MARS)
    out["dv_mars_ms"] = dv_rel * M_EARTH / (M_EARTH + M_MARS)
    out["dv_earth_impulse_ms"] = 2 * G * M_MARS / (B_IMPACT * V_INF)
    dT_over_T = 3.0 * out["dv_earth_ms"] / V_EARTH_ORBIT
    out["year_change_max_frac"] = dT_over_T
    out["year_change_max_days"] = dT_over_T * YEAR_DAYS
    out["year_change_max_hours"] = dT_over_T * YEAR_DAYS * 24
    # Our geometry: Earth's kick points along +P_HAT; Earth's orbital velocity is along +/-Y
    tang = abs(P_HAT[1]) * out["dv_earth_ms"]
    out["dv_earth_tangential_ms_this_geometry"] = tang
    out["year_change_this_geometry_hours"] = 3.0 * tang / V_EARTH_ORBIT * YEAR_DAYS * 24
    out["ecc_change_max"] = 2.0 * out["dv_earth_ms"] / V_EARTH_ORBIT
    out["barycentre_km"] = R_PERI * M_MARS / (M_EARTH + M_MARS) / 1e3

    # Roche limits
    out["roche_rigid_mars_by_earth_km"] = R_MARS * (2 * M_EARTH / M_MARS) ** (1 / 3) / 1e3
    out["roche_fluid_mars_by_earth_km"] = 2.44 * R_EARTH * (RHO_EARTH / RHO_MARS) ** (1 / 3) / 1e3
    out["roche_rigid_earth_by_mars_km"] = 1.26 * R_MARS * (RHO_MARS / RHO_EARTH) ** (1 / 3) / 1e3
    out["contact_distance_km"] = (R_EARTH + R_MARS) / 1e3
    out["roche_rigid_moon_by_mars_km"] = R_MOON * (2 * M_MARS / M_MOON) ** (1 / 3) / 1e3
    out["roche_fluid_moon_by_mars_km"] = 2.44 * R_MARS * (RHO_MARS / RHO_MOON) ** (1 / 3) / 1e3
    out["hill_mars_wrt_earth_km"] = R_PERI * (M_MARS / (3 * M_EARTH)) ** (1 / 3) / 1e3

    # Timing
    t_1M = hyp_t_of_r(1e9)
    out["hours_closer_than_1Mkm_total"] = 2 * t_1M / 3600
    d_moon_size = R_MARS / math.tan(math.radians(out["moon_deg"]) / 2)
    out["dist_where_mars_equals_moon_km"] = d_moon_size / 1e3
    out["hours_bigger_than_moon_total"] = 2 * hyp_t_of_r(d_moon_size) / 3600
    out["days_from_10Mkm_to_peri"] = hyp_t_of_r(1e10) / 86400
    out["hours_from_1Mkm_to_peri"] = t_1M / 3600
    ts = np.linspace(-40 * 3600, 40 * 3600, 160001)
    r, _ = hyp_r_of_t(ts)
    forcing = (R_PERI / r) ** 3
    out["tide_hours_above_half_peak"] = float(np.ptp(ts[forcing >= 0.5]) / 3600)
    out["tide_hours_above_90pct_peak"] = float(np.ptp(ts[forcing >= 0.9]) / 3600)
    out["sky_rate_deg_per_h_at_peri"] = math.degrees(V_PERI / R_PERI) * 3600

    # Phases along the path (seen from Earth's centre)
    for label, dist in (("peri", R_PERI), ("1Mkm_in", 1e9), ("10Mkm_in", 1e10)):
        t = 0.0 if label == "peri" else -hyp_t_of_r(dist)
        pa = phase_angle_deg(mars_pos(t))
        out[f"phase_deg_{label}"] = pa
        out[f"lit_frac_{label}"] = lit_fraction(pa)
    return out


if __name__ == "__main__":
    res = compute()
    w = max(len(k) for k in res)
    for k, v in res.items():
        print(f"{k:<{w}}  {v:.6g}" if isinstance(v, float) else f"{k:<{w}}  {v}")
    with open(__file__.replace("science.py", "../assets/science.json"), "w") as f:
        json.dump(res, f, indent=1)
