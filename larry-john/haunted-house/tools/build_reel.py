#!/usr/bin/env python3
"""Build the reel end to end from the current voice timing (build/timing.json):

  cues -> audio (effects, music, mix) -> 3D plates (every frame) -> text overlay -> final MP4

  python3 tools/build_reel.py --size preview        # 540x960 check copy -> build/preview/reel_preview.mp4
  python3 tools/build_reel.py --size final          # 1080x1920 -> out/reel_haunted-house.mp4
Options: --jobs N (parallel plate renderers), --skip audio,plates,overlay (reuse what is already built).
"""
import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import REEL, LJ, BUILD, OUT  # noqa: E402

PAGE = 'haunted-house/scene/index.html'
OVERLAY = 'haunted-house/overlay/index.html'
SIZES = {'preview': (540, 960), 'final': (1080, 1920)}


def run(cmd, **kw):
    print('$', ' '.join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def rel(p):
    return os.path.relpath(p, LJ)


def adopt(specs, ranges, shots_dir, manifest, w, h, fps):
    """Cut plate files rendered as long ranges ('START:path.mkv') into per-shot files (lossless re-encode)."""
    for spec in specs:
        start, path = spec.split(':', 1)
        start = int(start)
        n = int(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames',
                                '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout.strip())
        inside = [(sid, f0, f1) for sid, f0, f1 in ranges if f0 >= start and f1 <= start + n]
        if not inside:
            continue
        tmp = os.path.join(shots_dir, 'adopt_%03d.mkv')
        first = inside[0][1] - start
        last = inside[-1][2] - start
        cut_frames = [f0 - inside[0][1] for _, f0, _ in inside[1:]]
        keys = ','.join(f'{c / fps:.6f}' for c in cut_frames) or '0'
        run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', f'trim=start_frame={first}:end_frame={last},setpts=PTS-STARTPTS',
             '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', '-pix_fmt', 'rgb24', '-force_key_frames', keys,
             '-f', 'segment', '-segment_frames', ','.join(map(str, cut_frames)) or '100000', '-reset_timestamps', '1', tmp])
        for k, (sid, f0, f1) in enumerate(inside):
            os.replace(os.path.join(shots_dir, f'adopt_{k:03d}.mkv'), os.path.join(shots_dir, f'shot_{sid}.mkv'))
            manifest[sid] = f'{f0}-{f1}-{w}x{h}'
        print(f'adopted {len(inside)} shots from {path}', flush=True)
    json.dump(manifest, open(os.path.join(shots_dir, 'manifest.json'), 'w'), indent=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', choices=SIZES, default='preview')
    ap.add_argument('--jobs', type=int, default=2)
    ap.add_argument('--skip', default='')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--shots', default='', help='comma-separated shot ids to render again even if their frames did not move')
    ap.add_argument('--force', action='store_true', help='render every shot again')
    ap.add_argument('--adopt', default='', help='split already-rendered whole-range plate files (from:file,...) into shot files')
    a = ap.parse_args()
    skip = set(filter(None, a.skip.split(',')))
    w, h = SIZES[a.size]
    work = os.path.join(BUILD, a.size)
    os.makedirs(work, exist_ok=True)
    t0 = time.time()

    # 1) cues: shot list, effect cues, labels, music stop/sting (all derived from the voice timing)
    run(['node', 'engine/render.cjs', '--page', PAGE, '--mode', 'cues', '--w', '540', '--h', '960', '--out', rel(os.path.join(BUILD, 'cues.json'))], cwd=LJ)
    cues = json.load(open(os.path.join(BUILD, 'cues.json')))
    frames = round(cues['duration'] * a.fps)
    # where the faces are in every shot, so the subtitles can step around them
    run(['node', 'engine/render.cjs', '--page', PAGE, '--mode', 'faces', '--w', '540', '--h', '960', '--out', rel(os.path.join(BUILD, 'faces.json'))], cwd=LJ)

    # 2) audio
    if 'audio' not in skip:
        run([sys.executable, os.path.join(HERE, 'make_audio.py')], cwd=REEL)

    # 3) plates, one lossless file per shot; only shots whose frames changed (new timing, new size, or
    #    named with --shots) are rendered again, spread over --jobs browser sessions, then joined
    plates = os.path.join(work, 'plates.mkv')
    shots_dir = os.path.join(work, 'shots')
    os.makedirs(shots_dir, exist_ok=True)
    man_path = os.path.join(shots_dir, 'manifest.json')
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    sh = cues['shots']
    ranges = []
    for i, s in enumerate(sh):
        f0 = round(s['at'] * a.fps)
        f1 = round(sh[i + 1]['at'] * a.fps) if i + 1 < len(sh) else frames
        if f1 > f0:
            ranges.append((s['id'], f0, min(f1, frames)))
    if a.adopt:
        adopt(a.adopt.split(','), ranges, shots_dir, manifest, w, h, a.fps)
    if 'plates' not in skip:
        force = set(filter(None, a.shots.split(',')))
        todo = []
        for sid, f0, f1 in ranges:
            out = os.path.join(shots_dir, f'shot_{sid}.mkv')
            key = f'{f0}-{f1}-{w}x{h}'
            if a.force or sid in force or manifest.get(sid) != key or not os.path.exists(out):
                todo.append({'id': sid, 'from': f0, 'to': f1, 'out': rel(out), 'key': key})
        print(f'plates: {len(todo)} of {len(ranges)} shots to render ({sum(j["to"] - j["from"] for j in todo)} frames)', flush=True)
        n = max(1, min(a.jobs, len(todo)))
        buckets = [[] for _ in range(n)]
        for j in sorted(todo, key=lambda j: j['from'] - j['to']):          # longest first, into the lightest bucket
            min(buckets, key=lambda b: sum(x['to'] - x['from'] for x in b)).append(j)
        procs = []
        for i, b in enumerate(buckets):
            if not b:
                continue
            jf = os.path.join(work, f'jobs_{i}.json')
            json.dump(sorted(b, key=lambda j: j['from']), open(jf, 'w'))
            log = open(os.path.join(work, f'plates_{i}.log'), 'w')
            cmd = ['node', 'engine/render.cjs', '--page', PAGE, '--mode', 'plates', '--w', str(w), '--h', str(h), '--fps', str(a.fps), '--jobfile', rel(jf)]
            print('$', ' '.join(cmd), flush=True)
            procs.append((subprocess.Popen(cmd, cwd=LJ, stdout=log, stderr=subprocess.STDOUT), b))
        for p_, b in procs:
            if p_.wait() != 0:
                sys.exit('plate render failed (see plates_*.log)')
            for j in b:
                manifest[j['id']] = j['key']
        json.dump(manifest, open(man_path, 'w'), indent=0)
    lst = os.path.join(shots_dir, 'list.txt')
    with open(lst, 'w') as f:
        for sid, _, _ in ranges:
            f.write(f"file 'shot_{sid}.mkv'\n")
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', plates])

    # 4) text overlay (subtitles + labels) with alpha
    overlay = os.path.join(work, 'overlay.mov')
    if 'overlay' not in skip:
        run(['node', 'engine/render.cjs', '--page', OVERLAY, '--mode', 'overlay', '--w', str(w), '--h', str(h), '--fps', str(a.fps),
             '--out', rel(overlay)], cwd=LJ)

    # 5) compose: plates + overlay + mix -> H.264 (CRF 18, yuv420p) + AAC 48 kHz
    mix = os.path.join(BUILD, 'audio', 'mix.wav')
    out = os.path.join(OUT, 'reel_haunted-house.mp4') if a.size == 'final' else os.path.join(BUILD, 'preview', 'reel_preview.mp4')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    run(['ffmpeg', '-v', 'error', '-y', '-i', plates, '-i', overlay, '-i', mix,
         '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
         '-map', '[v]', '-map', '2:a', '-r', str(a.fps), '-frames:v', str(frames),
         '-c:v', 'libx264', '-crf', '18', '-preset', 'slow' if a.size == 'final' else 'medium', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out])
    print(f'done: {out}  ({(time.time() - t0) / 60:.1f} min)')


if __name__ == '__main__':
    main()
