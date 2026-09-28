"""Build dist/Gojo_Limitless.mcaddon (a zip holding the BP and RP folders).

Opening the .mcaddon on Android/iOS/Windows imports both packs into Minecraft.
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = os.path.join(ROOT, "packs")
OUT = os.path.join(ROOT, "dist", "Gojo_Limitless.mcaddon")
FOLDERS = ["Gojo_Limitless_BP", "Gojo_Limitless_RP"]
FIXED_TIME = (2024, 6, 1, 0, 0, 0)  # deterministic archive


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)
    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for folder in FOLDERS:
            base = os.path.join(PACKS, folder)
            for dirpath, dirnames, filenames in os.walk(base):
                dirnames.sort()
                for name in sorted(filenames):
                    if name.startswith(".") or name.endswith((".pyc", ".bak")):
                        continue
                    full = os.path.join(dirpath, name)
                    arc = os.path.relpath(full, PACKS).replace(os.sep, "/")
                    info = zipfile.ZipInfo(arc, FIXED_TIME)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    with open(full, "rb") as fh:
                        z.writestr(info, fh.read())
                    count += 1
    print(f"wrote {OUT} ({count} files, {os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
