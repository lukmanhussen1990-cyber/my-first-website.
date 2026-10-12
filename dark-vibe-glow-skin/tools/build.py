"""Build the Dark Vibe Glow skin, preview images and Minecraft packages.

    python3 dark-vibe-glow-skin/tools/build.py

Writes into dark-vibe-glow-skin/:
    dark_vibe_glow.png             the skin (can also be imported on its own)
    preview.png                    preview sheet
    DarkVibeGlow.mcaddon           skin pack + glow FX resource pack (one tap import)
    DarkVibeGlow_SkinPack.mcpack   skin pack only
    DarkVibeGlow_GlowFX.mcpack     glow resource pack only
"""
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from render_preview import pack_icon, preview_sheet  # noqa: E402
from skin_art import build_skin  # noqa: E402

SKIN_PACK = os.path.join(ROOT, "src", "skin_pack")
GLOW_FX = os.path.join(ROOT, "src", "glow_fx")
FIXED_TIME = (2024, 6, 13, 0, 0, 0)  # stable zips: same input, same bytes


def add_dir(zf, src_dir, prefix=""):
    for dirpath, dirnames, filenames in os.walk(src_dir):
        dirnames.sort()
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            arc = os.path.relpath(full, src_dir).replace(os.sep, "/")
            if prefix:
                arc = prefix + "/" + arc
            info = zipfile.ZipInfo(arc, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(full, "rb") as f:
                zf.writestr(info, f.read())


def write_zip(path, dirs):
    with zipfile.ZipFile(path, "w") as zf:
        for src_dir, prefix in dirs:
            add_dir(zf, src_dir, prefix)
    print("wrote", os.path.relpath(path, os.getcwd()))


def main():
    skin = build_skin()
    skin.save(os.path.join(ROOT, "dark_vibe_glow.png"))
    skin.save(os.path.join(SKIN_PACK, "dark_vibe_glow.png"))
    pack_icon(skin, os.path.join(GLOW_FX, "pack_icon.png"))
    preview_sheet(skin, os.path.join(ROOT, "preview.png"))

    write_zip(os.path.join(ROOT, "DarkVibeGlow_SkinPack.mcpack"), [(SKIN_PACK, "")])
    write_zip(os.path.join(ROOT, "DarkVibeGlow_GlowFX.mcpack"), [(GLOW_FX, "")])
    write_zip(os.path.join(ROOT, "DarkVibeGlow.mcaddon"), [
        (SKIN_PACK, "DarkVibeGlow_SkinPack"),
        (GLOW_FX, "DarkVibeGlow_GlowFX"),
    ])


if __name__ == "__main__":
    main()
