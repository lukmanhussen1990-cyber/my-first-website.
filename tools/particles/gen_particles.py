#!/usr/bin/env python3
"""Generate and verify the custom particle effects (RP particles/pas_*.json).

All four effects use format_version 1.10.0 (the only version used by the
1.21.0.26 vanilla particles), the vanilla atlas ``textures/particle/particles``
(128x128) with sprite UVs taken from vanilla effects, and tint the white
sprites with ``minecraft:particle_appearance_tinting``. Every effect uses
``minecraft:emitter_lifetime_once`` with a short ``active_time`` and a finite
``max_lifetime`` per particle, so nothing loops or leaks after
``Dimension.spawnParticle``.

Sprites (vanilla UVs):
  generic puff flipbook  base_UV [56,0] step [-8,0] (basic_smoke, redstone_wire_dust,
                         explosion_death); [32,0]/[40,0] start at a smaller puff
  sparkle flipbook       base_UV [56,88] step [-8,0] (endrod)

Usage:
  python3 tools/particles/gen_particles.py           # write + check
  python3 tools/particles/gen_particles.py --check   # check only
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "addon" / "resource_pack" / "particles"
IDS_JS = ROOT / "addon" / "behavior_pack" / "scripts" / "lib" / "ids.js"
DEFAULT_REF = ("/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441"
               "/scratchpad/ref/bedrock-samples-1.21.0.26")
ATLAS = "textures/particle/particles"
ATLAS_SIZE = 128
FADE = "math.min(variable.particle_age * 10, 1) * math.clamp((1 - variable.particle_age / variable.particle_lifetime) * 2.5, 0, 1)"

# Budget per spawnParticle call (mobile friendly) and hard caps on time.
MAX_PARTICLES = {"pas:infection_spores": 10, "pas:conversion_burst": 40,
                 "pas:birth_splatter": 15, "pas:build_sparkle": 25}
MAX_PARTICLE_LIFETIME = 1.5   # seconds
MAX_EMITTER_ACTIVE = 0.6      # seconds


def flipbook(base_u: int, base_v: int, frames: int) -> dict:
    return {
        "texture_width": ATLAS_SIZE,
        "texture_height": ATLAS_SIZE,
        "flipbook": {
            "base_UV": [base_u, base_v],
            "size_UV": [8, 8],
            "step_UV": [-8, 0],
            "frames_per_second": 8,
            "max_frame": frames,
            "stretch_to_lifetime": True,
            "loop": False,
        },
    }


def effect(identifier: str, material: str, components: dict) -> dict:
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": identifier,
                "basic_render_parameters": {"material": material, "texture": ATLAS},
            },
            "components": components,
        },
    }


def infection_spores() -> dict:
    # 6-10 crimson motes drifting up and swirling around an entity-sized box.
    # Spawned once per second by the outbreak script; each emission dies in <= 1.3 s.
    return effect("pas:infection_spores", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": "math.random_integer(6, 10)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_box": {
            "offset": [0, 0.9, 0],
            "half_dimensions": [0.45, 0.75, 0.45],
            "direction": ["math.random(-0.3, 0.3)", "math.random(0.2, 1.0)", "math.random(-0.3, 0.3)"],
        },
        "minecraft:particle_initial_speed": "math.random(0.15, 0.4)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.3)"},
        "minecraft:particle_motion_dynamic": {
            "linear_acceleration": [
                "math.sin(variable.particle_age * 240 + variable.particle_random_1 * 360) * 0.35",
                0.15,
                "math.cos(variable.particle_age * 240 + variable.particle_random_2 * 360) * 0.35",
            ],
            "linear_drag_coefficient": 1.2,
        },
        "minecraft:particle_appearance_billboard": {
            "size": ["0.05 + variable.particle_random_3 * 0.04", "0.05 + variable.particle_random_3 * 0.04"],
            "facing_camera_mode": "lookat_xyz",
            "uv": flipbook(32, 0, 5),
        },
        "minecraft:particle_appearance_tinting": {
            "color": [
                "0.42 + variable.particle_random_4 * 0.33",
                "0.02 + variable.particle_random_4 * 0.06",
                "0.05 + variable.particle_random_1 * 0.08",
                FADE,
            ],
        },
    })


def conversion_burst() -> dict:
    # 40 particles: ~35 % grey-brown smoke puffs that rise and linger briefly,
    # the rest red/brown gore-spore chunks that fly out and fall with gravity.
    smoke = "variable.particle_random_3 < 0.35"
    return effect("pas:conversion_burst", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 40},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"offset": [0, 0.8, 0], "radius": 0.45, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(1.5, 4.5)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 1.0)"},
        "minecraft:particle_motion_dynamic": {
            "linear_acceleration": [0, f"{smoke} ? 1.2 : -9.0", 0],
            "linear_drag_coefficient": f"{smoke} ? 4.0 : 1.2",
        },
        "minecraft:particle_motion_collision": {
            "enabled": f"{smoke} ? 0 : 1",
            "collision_drag": 6.0,
            "coefficient_of_restitution": 0.1,
            "collision_radius": 0.05,
        },
        "minecraft:particle_appearance_billboard": {
            "size": [f"{smoke} ? 0.16 + variable.particle_random_1 * 0.12 : 0.05 + variable.particle_random_1 * 0.08",
                     f"{smoke} ? 0.16 + variable.particle_random_1 * 0.12 : 0.05 + variable.particle_random_1 * 0.08"],
            "facing_camera_mode": "lookat_xyz",
            "uv": flipbook(56, 0, 8),
        },
        "minecraft:particle_appearance_tinting": {
            "color": {
                "gradient": {
                    "0.0": [0.22, 0.19, 0.17, 1.0],
                    "0.34": [0.36, 0.30, 0.27, 1.0],
                    "0.36": [0.55, 0.04, 0.04, 1.0],
                    "0.6": [0.36, 0.06, 0.03, 1.0],
                    "0.8": [0.46, 0.20, 0.10, 1.0],
                    "1.0": [0.70, 0.10, 0.12, 1.0],
                },
                "interpolant": "variable.particle_random_3",
            },
        },
        "minecraft:particle_appearance_lighting": {},
    })


def birth_splatter() -> dict:
    # 15 small red droplets thrown up and out from the ground, falling back.
    return effect("pas:birth_splatter", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 15},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_point": {
            "offset": [0, 0.2, 0],
            "direction": ["math.random(-1, 1)", "math.random(0.6, 1.6)", "math.random(-1, 1)"],
        },
        "minecraft:particle_initial_speed": "math.random(1.5, 3.2)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.45, 0.8)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -12, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_motion_collision": {
            "collision_drag": 8.0,
            "coefficient_of_restitution": 0.0,
            "collision_radius": 0.03,
        },
        "minecraft:particle_appearance_billboard": {
            "size": ["0.04 + variable.particle_random_1 * 0.05", "0.04 + variable.particle_random_1 * 0.05"],
            "facing_camera_mode": "lookat_xyz",
            "uv": flipbook(40, 0, 6),
        },
        "minecraft:particle_appearance_tinting": {
            "color": [
                "0.5 + variable.particle_random_2 * 0.3",
                "0.02 + variable.particle_random_2 * 0.06",
                "0.03 + variable.particle_random_4 * 0.05",
                1.0,
            ],
        },
        "minecraft:particle_appearance_lighting": {},
    })


def build_sparkle() -> dict:
    # 25 white/gold sparkles rising from a 2x1x2 area over 0.5 s.
    return effect("pas:build_sparkle", "particles_blend", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 50, "max_particles": 25},
        "minecraft:emitter_lifetime_once": {"active_time": 0.5},
        "minecraft:emitter_shape_box": {
            "offset": [0, 0.5, 0],
            "half_dimensions": [1.0, 0.5, 1.0],
            "direction": [0, 1, 0],
        },
        "minecraft:particle_initial_speed": "math.random(0.4, 1.2)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.4)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.06 + variable.particle_random_2 * 0.05", "0.06 + variable.particle_random_2 * 0.05"],
            "facing_camera_mode": "lookat_xyz",
            "uv": flipbook(56, 88, 8),
        },
        "minecraft:particle_appearance_tinting": {
            "color": [
                1.0,
                "0.78 + variable.particle_random_1 * 0.22",
                "0.25 + variable.particle_random_1 * 0.75",
                FADE,
            ],
        },
    })


EFFECTS = {
    "pas_infection_spores.json": infection_spores,
    "pas_conversion_burst.json": conversion_burst,
    "pas_birth_splatter.json": birth_splatter,
    "pas_build_sparkle.json": build_sparkle,
}


# ----------------------------------------------------------------- checks
def vanilla_component_names(ref: Path) -> set[str]:
    names = set()
    for p in (ref / "resource_pack" / "particles").glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        names |= set(data.get("particle_effect", {}).get("components", {}))
    return names


def ids_js_particles() -> set[str]:
    src = IDS_JS.read_text(encoding="utf-8")
    m = re.search(r"export const PARTICLES\s*=\s*Object\.freeze\(\{(.*?)\}\)", src, re.S)
    return set(re.findall(r':\s*"([^"]+)"', m.group(1))) if m else set()


def _max_of(expr) -> float:
    """Upper bound of a number or a 'math.random[_integer](a, b)' expression."""
    if isinstance(expr, (int, float)):
        return float(expr)
    m = re.fullmatch(r"math\.random(?:_integer)?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)", str(expr).strip())
    if not m:
        raise ValueError(f"cannot bound expression {expr!r}")
    return max(float(m.group(1)), float(m.group(2)))


def check() -> list[str]:
    errs: list[str] = []
    ref = Path(os.environ.get("PAS_VANILLA_REF", DEFAULT_REF))
    vnames = vanilla_component_names(ref) if (ref / "resource_pack").is_dir() else set()
    if not vnames:
        print("WARN: vanilla reference not found; component-name check skipped")
    elif not any((ref / "resource_pack" / (ATLAS + ext)).is_file() for ext in (".png", ".tga")):
        errs.append(f"atlas {ATLAS} not found in vanilla RP")
    seen = set()
    for fname in EFFECTS:
        p = OUT / fname
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            errs.append(f"{fname}: {e}")
            continue
        pe = data.get("particle_effect", {})
        ident = pe.get("description", {}).get("identifier")
        seen.add(ident)
        if data.get("format_version") != "1.10.0":
            errs.append(f"{fname}: format_version must be 1.10.0")
        if "pas_" + ident.split(":")[1] + ".json" != fname:
            errs.append(f"{fname}: file name does not match identifier {ident}")
        brp = pe.get("description", {}).get("basic_render_parameters", {})
        if brp.get("material") not in {"particles_alpha", "particles_blend", "particles_opaque"}:
            errs.append(f"{fname}: material {brp.get('material')} not a vanilla particle material")
        comps = pe.get("components", {})
        if vnames:
            unknown = set(comps) - vnames
            if unknown:
                errs.append(f"{fname}: components not used by vanilla 1.21.0.26: {sorted(unknown)}")
        # termination guarantees
        life = comps.get("minecraft:emitter_lifetime_once")
        if life is None:
            errs.append(f"{fname}: must use minecraft:emitter_lifetime_once")
        elif _max_of(life.get("active_time", 10)) > MAX_EMITTER_ACTIVE:
            errs.append(f"{fname}: active_time too long")
        for bad in ("minecraft:emitter_lifetime_looping", "minecraft:emitter_lifetime_expression",
                    "minecraft:emitter_rate_manual"):
            if bad in comps:
                errs.append(f"{fname}: {bad} could keep the emitter alive")
        plife = comps.get("minecraft:particle_lifetime_expression", {}).get("max_lifetime")
        if plife is None or _max_of(plife) > MAX_PARTICLE_LIFETIME:
            errs.append(f"{fname}: particle max_lifetime missing or > {MAX_PARTICLE_LIFETIME}s")
        if "minecraft:emitter_rate_instant" in comps:
            count = _max_of(comps["minecraft:emitter_rate_instant"]["num_particles"])
        else:
            steady = comps.get("minecraft:emitter_rate_steady", {})
            count = _max_of(steady.get("max_particles", 1e9))
        if count > MAX_PARTICLES.get(ident, 0):
            errs.append(f"{fname}: {count} particles exceeds budget {MAX_PARTICLES.get(ident)}")
        uv = comps.get("minecraft:particle_appearance_billboard", {}).get("uv", {})
        fb = uv.get("flipbook")
        if uv.get("texture_width") != ATLAS_SIZE or uv.get("texture_height") != ATLAS_SIZE or not fb:
            errs.append(f"{fname}: expected a flipbook on the 128x128 atlas")
        else:
            u0, v0 = fb["base_UV"]
            su, sv = fb["size_UV"]
            du, dv = fb["step_UV"]
            last_u = u0 + du * (fb["max_frame"] - 1)
            last_v = v0 + dv * (fb["max_frame"] - 1)
            for u, v in ((u0, v0), (last_u, last_v)):
                if not (0 <= u and u + su <= ATLAS_SIZE and 0 <= v and v + sv <= ATLAS_SIZE):
                    errs.append(f"{fname}: flipbook frame outside atlas ({u},{v})")
        if "minecraft:particle_appearance_tinting" not in comps:
            errs.append(f"{fname}: missing tinting")
    want = ids_js_particles()
    if want and seen != want:
        errs.append(f"particle ids {sorted(seen)} != ids.js PARTICLES {sorted(want)}")
    stray = {p.name for p in OUT.glob("pas_*.json")} - set(EFFECTS)
    if stray:
        errs.append(f"unexpected particle files: {sorted(stray)}")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="only verify existing files")
    args = ap.parse_args()
    if not args.check:
        OUT.mkdir(parents=True, exist_ok=True)
        for fname, fn in EFFECTS.items():
            (OUT / fname).write_text(json.dumps(fn(), indent=2) + "\n", encoding="utf-8")
            print(f"wrote {(OUT / fname).relative_to(ROOT)}")
    errs = check()
    for e in errs:
        print("ERROR:", e)
    print(f"checked {len(EFFECTS)} particle effects: {'OK' if not errs else str(len(errs)) + ' error(s)'}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
