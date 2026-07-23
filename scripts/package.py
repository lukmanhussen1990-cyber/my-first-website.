#!/usr/bin/env python3
"""Package the add-on into importable files for Minecraft Bedrock (mobile/PE).

Produces (in ./dist):
  HauntedHouse.mcaddon         -> one-tap install of BOTH packs
  HauntedHouse_BP.mcpack       -> behavior pack only
  HauntedHouse_RP.mcpack       -> resource pack only
"""
import os
import zipfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(BASE, "dist")
os.makedirs(DIST, exist_ok=True)


def add_folder(zf, folder, arc_prefix):
    root = os.path.join(BASE, folder)
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            zf.write(full, os.path.join(arc_prefix, rel))


# .mcpack for each pack (pack files live at the archive root)
def make_mcpack(folder, out_name):
    out = os.path.join(DIST, out_name)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        add_folder(zf, folder, "")
    print("wrote", os.path.relpath(out, BASE))


# .mcaddon bundles both packs, each in its own subfolder
def make_mcaddon(out_name):
    out = os.path.join(DIST, out_name)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        add_folder(zf, "behavior_pack", "HauntedHouse_BP")
        add_folder(zf, "resource_pack", "HauntedHouse_RP")
    print("wrote", os.path.relpath(out, BASE))


def make_mcaddon_from(bp_folder, rp_folder, bp_arc, rp_arc, out_name):
    out = os.path.join(DIST, out_name)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        add_folder(zf, bp_folder, bp_arc)
        add_folder(zf, rp_folder, rp_arc)
    print("wrote", os.path.relpath(out, BASE))


# --- Full add-on: haunted house + weapons ---
make_mcpack("behavior_pack", "HauntedHouse_BP.mcpack")
make_mcpack("resource_pack", "HauntedHouse_RP.mcpack")
make_mcaddon("HauntedHouse.mcaddon")

# --- Standalone weapons mod ---
if os.path.isdir(os.path.join(BASE, "weapons_mod")):
    make_mcaddon_from(
        "weapons_mod/behavior_pack", "weapons_mod/resource_pack",
        "ArcaneWeapons_BP", "ArcaneWeapons_RP", "ArcaneWeapons.mcaddon",
    )
print("done")
