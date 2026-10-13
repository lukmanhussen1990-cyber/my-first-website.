"""Render text runs with Chromium canvas (same Skia rasteriser as the scenes).
render(items, K) -> list of (alpha float32 [H*K, W*K] in 0..1, advance width in px).
item = dict(text, font='Inter', weight=400, size=16, ls=0, W=400, H=40, x=4, base=30)  (canonical px)."""
import base64, json, io
import numpy as np
from PIL import Image
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
ARGS = ['--allow-file-access-from-files', '--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text']
JS = r'''async ([items, K]) => {
  await document.fonts.load('400 16px Inter'); await document.fonts.load('600 16px Inter'); await document.fonts.load('700 16px Inter');
  const out = [];
  for (const it of items) {
    const c = document.createElement('canvas'); c.width = Math.round(it.W * K); c.height = Math.round(it.H * K);
    const g = c.getContext('2d'); g.scale(K, K);
    g.font = `${it.weight || 400} ${it.size}px ${it.font || 'Inter'}`;
    g.letterSpacing = (it.ls || 0) + 'px'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
    g.fillText(it.text, it.x || 0, it.base);
    out.push([c.toDataURL('image/png'), g.measureText(it.text).width]);
  }
  return out; }'''
def render(items, K=2):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=ARGS)
        pg = b.new_page()
        pg.set_content('<html><body style="font-family:Inter">x</body></html>')
        res = pg.evaluate(JS, [items, K])
        b.close()
    out = []
    for url, adv in res:
        im = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGBA')
        out.append((np.asarray(im)[:, :, 3].astype(np.float32) / 255, adv))
    return out
