#!/usr/bin/env python3
"""Check the final MP4 against the delivery spec and make a QA contact sheet from it."""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MP4 = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'john_roadster_reel.mp4')


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', path], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main():
    p = probe(MP4)
    v = next(s for s in p['streams'] if s['codec_type'] == 'video')
    a = next(s for s in p['streams'] if s['codec_type'] == 'audio')
    checks = [
        ('video codec H.264', v['codec_name'] == 'h264', v['codec_name'] + ' / ' + v.get('profile', '')),
        ('1080x1920', (v['width'], v['height']) == (1080, 1920), f"{v['width']}x{v['height']}"),
        ('30 fps', v['r_frame_rate'] == '30/1', v['r_frame_rate']),
        ('yuv420p', v['pix_fmt'] == 'yuv420p', v['pix_fmt']),
        ('audio AAC', a['codec_name'] == 'aac', f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch"),
        ('~55 s', abs(float(p['format']['duration']) - 55.5) < 0.6, p['format']['duration']),
        ('frame count', int(v.get('nb_read_frames', 0)) == 1665, v.get('nb_read_frames')),
    ]
    # loudness of the delivered audio
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', MP4, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind('Summary:'):]
    lufs = next((l.split()[1] for l in tail.splitlines() if l.strip().startswith('I:')), '?')
    peak = next((l.split()[1] for l in tail.splitlines() if l.strip().startswith('Peak:')), '?')
    checks.append(('loudness ~ -14 LUFS', lufs != '?' and abs(float(lufs) + 14) < 1.0, f'{lufs} LUFS, true peak {peak} dBFS'))
    size = os.path.getsize(MP4) / 1e6
    ok = True
    for name, good, val in checks:
        ok &= bool(good)
        print(f"  [{'OK ' if good else 'BAD'}] {name:22s} {val}")
    print(f'  size {size:.1f} MB, bitrate {int(p["format"]["bit_rate"]) / 1e6:.1f} Mbps')
    # QA contact sheet straight from the final file
    qa = os.path.join(ROOT, 'build', 'qa'); os.makedirs(qa, exist_ok=True)
    times = [0.8, 2.6, 4.9, 6.3, 7.1, 10.3, 12.2, 14.2, 17.4, 19.0, 20.6, 22.6, 24.2, 25.7, 27.6, 30.2, 32.6, 35.5, 38.4, 41.0, 42.8, 45.2, 47.6, 49.4, 50.9, 52.7, 53.6, 55.2]
    files = []
    for t in times:
        f = os.path.join(qa, f'final_{t:05.2f}.png')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(t), '-i', MP4, '-frames:v', '1', f], check=True)
        files.append(f)
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'contact_sheet.py'), os.path.join(qa, 'sheet_a.png')] + files[:14], check=True)
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'contact_sheet.py'), os.path.join(qa, 'sheet_b.png')] + files[14:], check=True)
    print('ALL CHECKS PASSED' if ok else 'SOME CHECKS FAILED')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
