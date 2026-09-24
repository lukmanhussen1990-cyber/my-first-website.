"""Bundle the site into one self-contained HTML file: dist/imran.html

Run:  python3 build.py

Everything (styles, script, fonts, images, video and music) is embedded,
so the output file works on its own, even offline.
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
MIME = {
    ".woff2": "font/woff2",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
}


def b64(path):
    return base64.b64encode((ROOT / path).read_bytes()).decode("ascii")


def data_uri(path):
    return f"data:{MIME[pathlib.Path(path).suffix]};base64,{b64(path)}"


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise SystemExit(f"build.py: expected exactly one {old!r} in the source")
    return text.replace(old, new)


html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "style.css").read_text(encoding="utf-8")
js = (ROOT / "script.js").read_text(encoding="utf-8")

# Fonts and images referenced from the stylesheet
css = re.sub(r'url\("(assets/[^"]+)"\)', lambda m: f'url("{data_uri(m.group(1))}")', css)

html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
html = replace_once(html, '<link rel="stylesheet" href="style.css" />', f"<style>\n{css}</style>")
html = replace_once(html, 'href="assets/favicon.png"', f'href="{data_uri("assets/favicon.png")}"')
html = replace_once(html, 'src="assets/bg.mp4" ', "")
html = replace_once(html, 'poster="assets/poster.jpg"', f'poster="{data_uri("assets/poster.jpg")}"')
html = replace_once(html, 'src="assets/forever-young.mp3" ', "")

# The big media goes last, so the page can paint before it has all loaded.
# script.js picks these up and turns them into playable blob URLs.
payload = (
    f'<script type="text/plain" id="m-video">{b64("assets/bg.mp4")}</script>\n'
    f'  <script type="text/plain" id="m-audio">{b64("assets/forever-young.mp3")}</script>'
)
html = replace_once(html, '<script src="script.js"></script>', f"<script>\n{js}</script>\n  {payload}")

leftover = re.findall(r'(?:src|href|poster)="assets/[^"]+"', html)
if leftover:
    raise SystemExit(f"build.py: files not embedded: {leftover}")

out = ROOT / "dist" / "imran.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1e6:.1f} MB)")
