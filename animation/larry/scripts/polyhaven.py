"""Download-and-cache helper for Poly Haven (CC0) models, textures and HDRIs."""
import json, os, urllib.request

CACHE = "/opt/polyhaven"
API = "https://api.polyhaven.com"


def _get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) asset-fetch"})
            with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
                f.write(r.read())
            os.replace(tmp, dest)
            return dest
        except Exception as e:  # network hiccup: retry
            last = e
    raise RuntimeError(f"download failed {url}: {last}")


def _files(asset_id):
    p = os.path.join(CACHE, "_meta", asset_id + ".json")
    if not os.path.exists(p):
        _get(f"{API}/files/{asset_id}", p)
    return json.load(open(p))


def model(asset_id, res="1k"):
    """Returns local path of the asset's .blend (textures downloaded alongside)."""
    f = _files(asset_id)
    blend = f["blend"][res]["blend"]
    root = os.path.join(CACHE, "models", asset_id, res)
    path = _get(blend["url"], os.path.join(root, os.path.basename(blend["url"])))
    for rel, info in blend.get("include", {}).items():
        _get(info["url"], os.path.join(root, rel))
    return path


def texture(asset_id, res="1k"):
    """Returns dict map_name -> local file (diffuse, nor_gl, rough, arm, disp...)."""
    f = _files(asset_id)
    out = {}
    for mapname in ("Diffuse", "nor_gl", "Rough", "arm", "AO", "Displacement"):
        if mapname in f and res in f[mapname]:
            fmt = "jpg" if "jpg" in f[mapname][res] else ("png" if "png" in f[mapname][res] else list(f[mapname][res])[0])
            url = f[mapname][res][fmt]["url"]
            out[mapname.lower()] = _get(url, os.path.join(CACHE, "textures", asset_id, res, os.path.basename(url)))
    return out


def hdri(asset_id, res="1k"):
    f = _files(asset_id)
    url = f["hdri"][res]["hdr"]["url"]
    return _get(url, os.path.join(CACHE, "hdris", asset_id + "_" + res + ".hdr"))


if __name__ == "__main__":
    import sys
    kind, aid = sys.argv[1], sys.argv[2]
    print({"model": model, "texture": texture, "hdri": hdri}[kind](aid))
