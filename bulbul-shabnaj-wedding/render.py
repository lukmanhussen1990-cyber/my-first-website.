#!/usr/bin/env python3
"""Render frames of a scene with headless Chromium.
usage: render.py SCENE FIRST LAST [--workers N] [--step K] [--frames a,b,c]
Loads scenes/SCENE/index.html, awaits window.sceneReady (optional), then for each frame
awaits window.renderFrame(f) and saves out/SCENE/fNNNN.png (1920x1080)."""
import sys, os, argparse, multiprocessing as mp
RD = os.path.dirname(os.path.abspath(__file__))
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
ARGS = ['--allow-file-access-from-files', '--font-render-hinting=none', '--force-color-profile=srgb',
        '--disable-lcd-text', '--hide-scrollbars']

def work(scene, frames, wid):
    from playwright.sync_api import sync_playwright
    out = f'{RD}/out/{scene}'; os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=ARGS)
        pg = b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
        pg.goto(f'file://{RD}/scenes/{scene}/index.html')
        pg.wait_for_load_state('load')
        pg.evaluate('async () => { if (window.sceneReady) await window.sceneReady; await document.fonts.ready; }')
        for f in frames:
            pg.evaluate('async (f) => { await window.renderFrame(f); await document.fonts.ready; '
                        'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }', f)
            pg.screenshot(path=f'{out}/f{f:04d}.png')
        for l in logs[:20]:
            print(f'[worker {wid}] {l}', file=sys.stderr)
        b.close()

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('scene'); ap.add_argument('first', type=int); ap.add_argument('last', type=int)
    ap.add_argument('--workers', type=int, default=2); ap.add_argument('--step', type=int, default=1)
    ap.add_argument('--frames', default='')
    a = ap.parse_args()
    frames = [int(x) for x in a.frames.split(',')] if a.frames else list(range(a.first, a.last + 1, a.step))
    n = max(1, min(a.workers, len(frames)))
    chunks = [frames[i::n] for i in range(n)]
    ps = [mp.Process(target=work, args=(a.scene, c, i)) for i, c in enumerate(chunks)]
    [p.start() for p in ps]; [p.join() for p in ps]
    print(f'rendered {len(frames)} frames of {a.scene} -> {RD}/out/{a.scene}')
