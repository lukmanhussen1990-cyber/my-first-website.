#!/usr/bin/env python3
"""Download the Google Fonts + Font Awesome files used by website/index.html into
app/src/main/assets/offline/ so the app looks right even without internet.

Run it again after changing nameFont / textFont in the CONFIG:   python3 tools/update_offline_fonts.py
(Without it the app still works, it just needs internet for the new fonts.)
"""
import json, pathlib, re, shutil, urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]           # android/
HTML = (ROOT.parent / "website" / "index.html").read_text(encoding="utf-8")
OUT = ROOT / "app" / "src" / "main" / "assets" / "offline"
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def config(key):
    m = re.search(r"\b%s\s*:\s*[\"'`]([^\"'`]+)[\"'`]" % key, HTML)
    return m.group(1).strip() if m else None


def google_url(family, weights=None):  # same as load() in index.html
    fam = urllib.parse.quote(family, safe="-_.!~*'()").replace("%20", "+")
    return "https://fonts.googleapis.com/css2?family=" + fam + (":wght@" + weights if weights else "") + "&display=swap"


shutil.rmtree(OUT, ignore_errors=True)
OUT.mkdir(parents=True)
mapping, n = {}, 0


def save(url, data, ext):
    global n
    n += 1
    name = "f%02d%s" % (n, ext)
    (OUT / name).write_bytes(data)
    mapping[url] = "offline/" + name
    return name


def add_css(url, base=None):
    css = get(url).decode("utf-8")
    save(url, css.encode("utf-8"), ".css")
    for ref in sorted(set(re.findall(r"url\(([^)]+)\)", css))):
        ref = ref.strip("'\"")
        full = urllib.parse.urljoin(base or url, ref)
        if not full.endswith(".woff2") or full in mapping:
            continue  # Android's WebView only ever asks for the .woff2 files
        save(full, get(full), ".woff2")


for family, weights in ((config("nameFont"), None), (config("quoteFont"), None), (config("textFont"), "400;500;600;700;800")):
    if not family:
        continue
    try:
        add_css(google_url(family, weights))
    except urllib.error.HTTPError:          # font has no such weights -> index.html falls back to the plain url
        add_css(google_url(family))

fa = re.search(r'href="(https://cdnjs\.cloudflare\.com/ajax/libs/font-awesome/[^"]+\.css)"', HTML)
if fa:
    add_css(fa.group(1))

(OUT / "map.json").write_text(json.dumps(mapping, indent=1), encoding="utf-8")
print("saved %d files to %s" % (len(mapping), OUT))
