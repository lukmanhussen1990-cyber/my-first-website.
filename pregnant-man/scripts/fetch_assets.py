"""Download every third-party asset listed in assets_manifest.json and write credits.txt.

Sources (all free):
  * Poly Haven (CC0)             - api.polyhaven.com / dl.polyhaven.org
  * Objaverse mirror of Sketchfab models (each keeps its Sketchfab licence: CC0 or CC-BY)
                                 - huggingface.co/datasets/allenai/objaverse
  * MakeHuman system assets (CC0) - files.makehumancommunity.org
  * Poppins font (OFL)           - github.com/google/fonts

Usage: python scripts/fetch_assets.py <assets_dir> [--only id1,id2]
"""
import gzip, json, os, sys, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = json.load(open(os.path.join(HERE, "..", "assets_manifest.json")))
OUT = os.path.abspath(sys.argv[1])
ONLY = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
UA = {"User-Agent": "chair-sniff-pipeline/1.0"}
TITLE = os.path.basename(os.path.dirname(HERE)).replace("-", " ").title()


def get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(dest + ".part", "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(dest + ".part", dest)
    return dest


def polyhaven_model(slug, res):
    info = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/files/{slug}", headers=UA)))
    g = info["gltf"][res]["gltf"]
    d = os.path.join(OUT, "polyhaven", slug)
    get(g["url"], os.path.join(d, os.path.basename(g["url"])))
    for rel, inc in g.get("include", {}).items():
        get(inc["url"], os.path.join(d, rel))
    return os.path.join(d, os.path.basename(g["url"]))


def polyhaven_hdri(slug, res):
    info = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/files/{slug}", headers=UA)))
    h = info["hdri"][res]["hdr"]
    return get(h["url"], os.path.join(OUT, "polyhaven", "hdri", f"{slug}_{res}.hdr"))


def polyhaven_texture(slug, res):
    info = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/files/{slug}", headers=UA)))
    d = os.path.join(OUT, "polyhaven", "tex", slug)
    for m in ("Diffuse", "nor_gl", "Rough", "AO"):
        if m in info and res in info[m]:
            fmt = "jpg" if "jpg" in info[m][res] else "png"
            u = info[m][res][fmt]["url"]
            get(u, os.path.join(d, os.path.basename(u)))
    return d


_paths = None
def objaverse(uid):
    global _paths
    if _paths is None:
        p = get("https://huggingface.co/datasets/allenai/objaverse/resolve/main/object-paths.json.gz",
                os.path.join(OUT, "objaverse", "object-paths.json.gz"))
        _paths = json.load(gzip.open(p))
    rel = _paths[uid]
    return get(f"https://huggingface.co/datasets/allenai/objaverse/resolve/main/{rel}",
               os.path.join(OUT, "objaverse", uid + ".glb"))


def main():
    credits = [f"{TITLE} - third-party asset credits", "=" * 40,
               "CC-BY 4.0 models were published on Sketchfab by the authors below and downloaded through the",
               "Objaverse mirror (huggingface.co/datasets/allenai/objaverse). CC-BY: https://creativecommons.org/licenses/by/4.0/",
               "Characters: MakeHuman / MPFB2 (output is CC0). Rigs: MPFB2 built-in 'mixamo' skeleton.", ""]
    for a in MANIFEST["assets"]:
        if ONLY and a["id"] not in ONLY:
            continue
        src = a["source"]
        print("fetch", a["id"], src, flush=True)
        if src == "polyhaven_model":
            polyhaven_model(a["slug"], a.get("res", "1k"))
        elif src == "polyhaven_hdri":
            polyhaven_hdri(a["slug"], a.get("res", "2k"))
        elif src == "polyhaven_texture":
            polyhaven_texture(a["slug"], a.get("res", "1k"))
        elif src == "objaverse":
            objaverse(a["uid"])
        elif src == "url":
            base = os.path.join(HERE, "..") if a.get("project") else OUT
            dest = get(a["url"], os.path.join(base, a["dest"]))
            if dest.endswith(".zip") and not os.path.isdir(os.path.join(OUT, a.get("extract", ""), "clothes")):
                zipfile.ZipFile(dest).extractall(os.path.join(OUT, a.get("extract", "")))
        credits.append(f'- "{a["title"]}" by {a["author"]} - {a["license"]}\n  {a["page"]}\n  used for: {a["use"]}')
    if not ONLY:
        open(os.path.join(HERE, "..", "credits.txt"), "w").write("\n".join(credits) + "\n")


if __name__ == "__main__":
    main()
