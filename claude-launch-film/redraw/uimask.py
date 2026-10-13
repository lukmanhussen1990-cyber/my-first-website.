"""Render a scene's redrawn foreground alone (transparent page, index.html?mask) for frames a..b.
The alpha marks where the original graphics sat, so plates only fill those pixels.
usage: uimask.py SCENE a b  -> rd/work/<SCENE>_alpha/fNNNN.png"""
import sys, os
from playwright.sync_api import sync_playwright
S = '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad'
scene, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
od = f'{S}/rd/work/{scene}_alpha'; os.makedirs(od, exist_ok=True)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--allow-file-access-from-files', '--force-color-profile=srgb'])
    pg = br.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto(f'file://{S}/rd/scenes/{scene}/index.html?mask=1'); pg.wait_for_load_state('load')
    pg.evaluate('async () => { if (window.sceneReady) await window.sceneReady; await document.fonts.ready; }')
    for f in range(a, b + 1):
        pg.evaluate('async (f) => { await window.renderFrame(f); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }', f)
        pg.screenshot(path=f'{od}/f{f:04d}.png', omit_background=True)
    br.close()
print('alpha', scene, a, b)
