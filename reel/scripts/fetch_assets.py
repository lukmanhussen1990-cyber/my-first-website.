"""Download every ready-made asset the reel uses (all free).

Run:  python3 scripts/fetch_assets.py
Re-running skips files that already exist.

Sources
  - Poly Haven (CC0)  https://polyhaven.com  via https://api.polyhaven.com
  - Google Fonts (OFL) Poppins / Montserrat from https://github.com/google/fonts
  - MakeHuman asset packs (CC0 + CC-BY) https://static.makehumancommunity.org/assets/assetpacks/
"""
import json
import os
import sys
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PH = os.path.join(ROOT, "assets", "polyhaven")
MH = os.path.join(ROOT, "assets", "makehuman")
FONTS = os.path.join(ROOT, "assets", "fonts")

# ---- Poly Haven -----------------------------------------------------------
PH_MODELS = [
    "sofa_02", "ArmChair_01", "modern_coffee_table_01", "television_02",
    "modern_wooden_cabinet", "potted_plant_01", "potted_plant_02",
    "hanging_picture_frame_01", "hanging_picture_frame_02", "throw_pillows_01",
    "rubber_duck_toy", "side_table_01", "wall_clock", "wooden_bookshelf_worn",
]
PH_TEXTURES = ["wood_floor", "painted_plaster_wall", "rough_pine_door", "dirty_carpet"]
PH_HDRIS = ["kloofendal_48d_partly_cloudy_puresky"]

# ---- MakeHuman asset packs (unzipped into assets/makehuman/data) ----------
MH_PACKS = {
    "makehuman_system_assets": "https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip",
    "dress02": "https://files.makehumancommunity.org/asset_packs/dress02/dress02_cc-by.zip",          # elvs_ladies_apron
    "hats03": "https://files.makehumancommunity.org/asset_packs/hats03/hats03_cc-by.zip",            # mindfront_patrol_cap
    "shirts02": "https://files.makehumancommunity.org/asset_packs/shirts02/shirts02_ccby.zip",       # elvs_male_shirt_tie_tucked1
    "suits03": "https://files.makehumancommunity.org/asset_packs/suits03/suits03_cc-by.zip",
    "equipment03": "https://files.makehumancommunity.org/asset_packs/equipment03/equipment03_cc-by.zip",  # tactical vest
    "pants02": "https://files.makehumancommunity.org/asset_packs/pants02/pants02_ccby.zip",          # elvs_male_trouser
    "underwear02": "https://files.makehumancommunity.org/asset_packs/underwear02/underwear02_cc0.zip",  # (diaper base)
    "makehuman_system_poses": "https://files.makehumancommunity.org/asset_packs/makehuman_system_poses/makehuman_system_poses_cc0.zip",
    "poses01": "https://files.makehumancommunity.org/asset_packs/poses01/poses01_cc0.zip",
    "poses03": "https://files.makehumancommunity.org/asset_packs/poses03/poses03_cc0.zip",
    "poses04": "https://files.makehumancommunity.org/asset_packs/poses04/poses04_cc0.zip",
    "poses05": "https://files.makehumancommunity.org/asset_packs/poses05/poses05_cc0.zip",
    "hair02": "https://files.makehumancommunity.org/asset_packs/hair02/hair02_ccby.zip",          # elvs_island_princess_hair (Mom)
    "skins01": "https://files.makehumancommunity.org/asset_packs/skins01/skins01_cc0.zip",        # natural make-up skin (Mom)
    "faceunits01": "https://files.makehumancommunity.org/functional/faceunits01.zip",  # face expressions (smile, wink, gasp)
}

FONT_URLS = {
    "Poppins-ExtraBold.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-ExtraBold.ttf",
    "Poppins-Bold.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf",
    "Montserrat[wght].ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
}


def get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print("  download", url)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "reel-builder/1.0"})
        with urllib.request.urlopen(req, timeout=300) as r, open(dest + ".part", "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        os.replace(dest + ".part", dest)
    except Exception as e:  # tell the user exactly what to fetch by hand
        print(f"\n!! DOWNLOAD FAILED: {url}\n   -> download it manually and save it as: {dest}\n   ({e})\n")
        raise


def api(path):
    req = urllib.request.Request("https://api.polyhaven.com/" + path, headers={"User-Agent": "reel-builder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def polyhaven():
    for m in PH_MODELS:
        files = api(f"files/{m}")["blend"]["1k"]["blend"]
        d = os.path.join(PH, "models", m)
        get(files["url"], os.path.join(d, os.path.basename(files["url"])))
        for rel, inc in files.get("include", {}).items():
            get(inc["url"], os.path.join(d, rel))
    for t in PH_TEXTURES:
        files = api(f"files/{t}")
        d = os.path.join(PH, "textures", t)
        for key in ("Diffuse", "nor_gl", "Rough", "AO"):
            if key in files:
                u = files[key]["2k"]["jpg"]["url"]
                get(u, os.path.join(d, os.path.basename(u)))
    for h in PH_HDRIS:
        u = api(f"files/{h}")["hdri"]["2k"]["hdr"]["url"]
        get(u, os.path.join(PH, "hdri", os.path.basename(u)))


def makehuman():
    data = os.path.join(MH, "data")
    for name, url in MH_PACKS.items():
        z = os.path.join(MH, "packs", os.path.basename(url))
        get(url, z)
        marker = os.path.join(MH, "packs", name + ".unzipped")
        if not os.path.exists(marker):
            zipfile.ZipFile(z).extractall(data)
            open(marker, "w").close()


def fonts():
    for name, url in FONT_URLS.items():
        get(url, os.path.join(FONTS, name))


if __name__ == "__main__":
    what = sys.argv[1:] or ["polyhaven", "makehuman", "fonts"]
    for w in what:
        print("==", w)
        globals()[w]()
    print("assets OK")
