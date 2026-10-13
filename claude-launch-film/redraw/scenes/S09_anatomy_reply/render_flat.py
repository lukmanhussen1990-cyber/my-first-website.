#!/usr/bin/env python3
"""Render the S09 flat window-UI layer (canonical window coords x3, transparent) for each frame.
usage: render_flat.py first last [--workers N] [--frames a,b]  -> rd/work/s09_flat/fNNNN.png"""
import sys, os, argparse, multiprocessing as mp
HERE = os.path.dirname(os.path.abspath(__file__)); RD = os.path.dirname(os.path.dirname(HERE))
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
ARGS = ['--allow-file-access-from-files', '--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars']
VW, VH = 3105, 2085
def work(frames, wid):
    from playwright.sync_api import sync_playwright
    out = f'{RD}/work/s09_flat'; os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=ARGS)
        pg = b.new_page(viewport={'width': VW, 'height': VH}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
        pg.goto(f'file://{HERE}/flat.html'); pg.wait_for_load_state('load')
        pg.evaluate('async () => { await window.sceneReady; await document.fonts.ready; }')
        for f in frames:
            pg.evaluate('async (f) => { await window.renderFlat(f); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }', f)
            pg.screenshot(path=f'{out}/f{f:04d}.png', omit_background=True)
        if wid == 0:
            import json
            json.dump({'SC_K': pg.evaluate('window.SC_K')}, open(f'{RD}/work/s09_flat/meta.json', 'w'))
        for l in logs[:10]: print(f'[w{wid}] {l}', file=sys.stderr)
        b.close()
if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('first', type=int); ap.add_argument('last', type=int)
    ap.add_argument('--workers', type=int, default=3); ap.add_argument('--frames', default='')
    a = ap.parse_args()
    fr = [int(x) for x in a.frames.split(',')] if a.frames else list(range(a.first, a.last + 1))
    n = max(1, min(a.workers, len(fr))); ch = [fr[i::n] for i in range(n)]
    ps = [mp.Process(target=work, args=(c, i)) for i, c in enumerate(ch)]; [p.start() for p in ps]; [p.join() for p in ps]
    print('flat frames', len(fr))
