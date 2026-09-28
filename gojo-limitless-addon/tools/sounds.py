"""Generate RP/sounds/sound_definitions.json.

Every Gojo sound event layers custom pitch / volume / range over vanilla sound
files that exist in Minecraft 1.21.0.26 (paths verified against Mojang's
bedrock-samples v1.21.0.26-preview sound_definitions.json by tools/validate.py).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "packs", "Gojo_Limitless_RP", "sounds", "sound_definitions.json")


def files(paths, pitch=1.0, volume=1.0):
    return [{"name": p, "pitch": pitch, "volume": volume} for p in paths]


def triple(base):
    return [f"{base}1", f"{base}2", f"{base}3"]


SOUNDS = {
    "gojo.infinity.on": ("player", 24, files(["sounds/block/beacon/activate"], 1.5, 0.8)),
    "gojo.infinity.off": ("player", 24, files(["sounds/block/beacon/deactivate"], 1.4, 0.7)),
    "gojo.infinity.block": ("player", 16, files(triple("sounds/block/amethyst/resonate"), 1.8, 1.0)),
    "gojo.blue.cast": ("player", 48, files(triple("sounds/mob/warden/sonic_charge"), 1.4, 1.0)),
    "gojo.blue.hum": ("player", 24, files(triple("sounds/block/beacon/power"), 0.6, 0.9)),
    "gojo.blue.collapse": ("player", 40, files(triple("sounds/random/explode"), 1.6, 0.8)),
    "gojo.red.charge": ("player", 32, files(triple("sounds/mob/breeze/charge"), 0.8, 1.0)),
    "gojo.red.fire": ("player", 48, files(triple("sounds/mob/warden/sonic_boom"), 1.5, 0.9)),
    "gojo.red.impact": ("player", 64, files(triple("sounds/random/explode"), 0.9, 1.2)),
    "gojo.purple.charge": ("player", 48, files(triple("sounds/mob/warden/sonic_charge"), 0.75, 1.2)),
    "gojo.purple.merge": ("player", 48, files(["sounds/block/end_portal/endportal"], 1.6, 1.0)),
    "gojo.purple.fire": ("player", 96, files(triple("sounds/mob/warden/sonic_boom"), 0.7, 1.5)),
    "gojo.purple.travel": ("player", 48, files(["sounds/mob/wither/shoot"], 0.6, 0.8)),
    "gojo.purple.end": ("player", 64, files(triple("sounds/random/explode"), 0.6, 1.5)),
    "gojo.domain.open": ("player", 64, files(["sounds/block/end_portal/endportal"], 0.6, 1.2)),
    "gojo.domain.ambient": ("player", 32, files(["sounds/mob/warden/heartbeat_1", "sounds/mob/warden/heartbeat_2", "sounds/mob/warden/heartbeat_3"], 0.6, 1.0)),
    "gojo.domain.close": ("player", 48, files(["sounds/block/conduit/deactivate"], 0.8, 1.2)),
    "gojo.six_eyes.on": ("player", 20, files(["sounds/block/amethyst/shimmer"], 1.4, 1.0)),
    "gojo.six_eyes.off": ("player", 20, files(["sounds/block/beacon/deactivate"], 1.8, 0.5)),
    "gojo.teleport": ("player", 24, files(["sounds/mob/endermen/portal", "sounds/mob/endermen/portal2"], 1.5, 0.9)),
    "gojo.rct.start": ("player", 24, files(["sounds/random/use_totem"], 1.4, 0.5)),
    "gojo.rct.pulse": ("player", 16, files(triple("sounds/block/respawn_anchor/charge"), 1.6, 0.5)),
    "gojo.rct.end": ("player", 20, files(["sounds/random/levelup"], 1.5, 0.4)),
    "gojo.black_flash": ("player", 48, files(["sounds/item/mace/smash_ground_heavy"], 0.9, 1.0)),
    "gojo.black_flash.whiff": ("player", 16, files(triple("sounds/mob/breeze/wind_burst"), 1.3, 0.8)),
    "gojo.transform": ("player", 48, files(["sounds/random/use_totem"], 0.8, 0.8)),
    "gojo.revert": ("player", 24, files(["sounds/block/beacon/deactivate"], 0.8, 0.7)),
    "gojo.ui.denied": ("ui", 8, files(["sounds/note/bass"], 0.7, 0.6)),
}


def main():
    defs = {}
    for name, (category, max_distance, sounds) in SOUNDS.items():
        defs[name] = {"category": category, "min_distance": 2.0, "max_distance": float(max_distance), "sounds": sounds}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"format_version": "1.20.20", "sound_definitions": defs}, fh, indent=2)
        fh.write("\n")
    print("sounds generated:", len(defs))


if __name__ == "__main__":
    main()
