"""Convert the raw NASA downloads in assets_raw/ into web-ready textures in public/tex/.

Sources (all NASA, public domain):
  earth_day_jul.jpg      Blue Marble Next Generation, July 2004 (5400x2700)
  earth_night_3km.jpg    Black Marble 2016 (13500x6750)
  clouds_8192.tif        Blue Marble cloud composite (8192x4096)
  moon_color_4k.tif      CGI Moon Kit, LRO colour mosaic (4096x2048)
  moon_ldem_16.tif       CGI Moon Kit, LOLA elevation, 16 px/deg, 0.5 m units
  earth_topology.png     Elevation (from the three-globe examples, derived from NASA data)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets_raw"
OUT = ROOT / "public" / "tex"
OUT.mkdir(parents=True, exist_ok=True)


def save_jpg(arr, name, q=92):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(OUT / name, quality=q, subsampling=0)
    print("wrote", name, arr.shape)


def normal_map(height_m, radius_m, strength):
    """Tangent-space normal map (x = east, y = north) for an equirectangular height field."""
    h, w = height_m.shape
    lat = (0.5 - (np.arange(h) + 0.5) / h) * np.pi
    dx = 2 * np.pi * radius_m / w * np.maximum(np.cos(lat), 0.05)[:, None]
    dy = np.pi * radius_m / h
    east = (np.roll(height_m, -1, axis=1) - np.roll(height_m, 1, axis=1)) / (2 * dx)
    north = -(np.vstack([height_m[1:], height_m[-1:]]) - np.vstack([height_m[:1], height_m[:-1]])) / (2 * dy)
    n = np.dstack([-east * strength, -north * strength, np.ones_like(height_m)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return (n * 0.5 + 0.5) * 255


def earth():
    day = np.array(Image.open(RAW / "earth_day_jul.jpg")).astype(np.float32)
    save_jpg(day, "earth_day.jpg", 94)

    # Ocean in the July mosaic is a flat dark navy; matching it gives a crisp water mask.
    r, g, b = day[..., 0], day[..., 1], day[..., 2]
    water = (np.abs(r - 3) < 9) & (np.abs(g - 7) < 9) & (np.abs(b - 19) < 11)
    m = Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
    m = m.filter(ImageFilter.GaussianBlur(1.2)).resize((4096, 2048), Image.LANCZOS)
    m.save(OUT / "earth_water.png")
    print("wrote earth_water.png")

    # City lights: Black Marble shows dim land around luminance ~59; keep only what is brighter.
    night = Image.open(RAW / "earth_night_3km.jpg").resize((5400, 2700), Image.BOX)
    lum = np.array(night).astype(np.float32).mean(axis=2)
    lights = np.clip((lum - 64) / (255 - 64), 0, 1) ** 1.25
    save_jpg(np.repeat((lights * 255)[..., None], 3, axis=2), "earth_lights.jpg", 92)

    clouds = Image.open(RAW / "clouds_8192.tif").convert("L").resize((4096, 2048), Image.LANCZOS)
    clouds.save(OUT / "earth_clouds.jpg", quality=92)
    print("wrote earth_clouds.jpg")

    topo = Image.open(RAW / "earth_topology.png").convert("L").filter(ImageFilter.GaussianBlur(0.8))
    height = np.array(topo).astype(np.float32) / 255.0 * 8800.0
    save_jpg(normal_map(height, 6.371e6, 22.0), "earth_normal.jpg", 92)


def moon():
    col = np.array(Image.open(RAW / "moon_color_4k.tif").convert("RGB")).astype(np.float32)
    save_jpg(col, "moon_color.jpg", 94)

    raw = np.array(Image.open(RAW / "moon_ldem_16.tif")).astype(np.float32) * 0.5
    height = np.array(Image.fromarray(raw).resize((4096, 2048), Image.LANCZOS))
    save_jpg(normal_map(height, 1.7374e6, 3.0), "moon_normal.jpg", 92)


if __name__ == "__main__":
    which = sys.argv[1:] or ["earth", "moon"]
    if "earth" in which:
        earth()
    if "moon" in which:
        moon()
