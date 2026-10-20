#!/usr/bin/env python3
"""Place the voice lines on the video timeline and build the voice track.

Each line (voices/<id>.wav + <id>.words.json) is cut into pieces at sentence
ends and at '...', and each piece is placed so its first word starts at its
anchor from script/script.json (never earlier, and never overlapping the
previous piece). A piece that would run into the next anchor is sped up a
little (at most 15 %). Output:
  work/voice_track.wav   48 kHz mono, full video length
  work/voice_layout.json word timings in video time (for subtitles/ducking)

usage: layout_voice.py [--voices DIR] [--duration 55.5]
"""
import argparse, json, os, subprocess, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
PRE, POST, MIN_GAP, MAX_SPEED = 0.05, 0.14, 0.14, 1.15


def load_wav(path):
    """Any audio file -> float mono at 48 kHz (ffmpeg handles mp3/wav/etc)."""
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, 'a.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_s16le', out], check=True)
        sr, x = wavfile.read(out)
    return x.astype(np.float32) / 32768.0


def tempo(x, speed):
    if abs(speed - 1) < 1e-3:
        return x
    with tempfile.TemporaryDirectory() as td:
        a, b = os.path.join(td, 'a.wav'), os.path.join(td, 'b.wav')
        wavfile.write(a, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a, '-filter:a', f'atempo={speed:.4f}', b], check=True)
        return wavfile.read(b)[1].astype(np.float32) / 32768.0


def split_pieces(words):
    pieces, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        tok = w['word']
        if (tok.endswith(('.', '?', '!')) or tok.endswith('...')) and i < len(words) - 1:
            pieces.append(cur); cur = []
    if cur:
        pieces.append(cur)
    return pieces


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voices', default=os.path.join(ROOT, 'voices'))
    ap.add_argument('--script', default=os.path.join(ROOT, 'script', 'script.json'))
    ap.add_argument('--duration', type=float, default=55.5)
    ap.add_argument('--out', default=os.path.join(ROOT, 'work'))
    a = ap.parse_args()
    script = json.load(open(a.script))
    track = np.zeros(int(a.duration * SR) + SR, np.float32)
    layout = {'lines': []}
    prev_end = -1.0
    for line in script['lines']:
        lid = line['id']
        wpath = next(os.path.join(a.voices, f) for f in sorted(os.listdir(a.voices)) if f.startswith(lid) and f.endswith(('.wav', '.mp3')) and 'words' not in f)
        words = json.load(open(os.path.join(a.voices, f'{lid}.words.json')))['words']
        x = load_wav(wpath)
        pieces = split_pieces(words)
        anchors = line.get('anchors', [])
        if len(anchors) < len(pieces):  # missing anchors: keep the original spacing
            base = anchors[0] if anchors else max(prev_end + 0.4, 0.3)
            anchors = [base + words[p[0]]['start'] - words[pieces[0][0]]['start'] for p in pieces]
        out_words = []
        for k, idx in enumerate(pieces):
            w0, w1 = words[idx[0]], words[idx[-1]]
            # cut points half-way into the silences around the piece
            lo = 0.0 if k == 0 else 0.5 * (words[pieces[k - 1][-1]]['end'] + w0['start'])
            hi = len(x) / SR if k == len(pieces) - 1 else 0.5 * (w1['end'] + words[pieces[k + 1][0]]['start'])
            s0, s1 = max(lo, w0['start'] - PRE), min(hi, w1['end'] + POST)
            seg = x[int(s0 * SR):int(s1 * SR)].copy()
            fade = int(0.012 * SR)
            seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
            dst = max(anchors[k], prev_end + MIN_GAP)
            speech = w1['end'] - w0['start']
            nxt = anchors[k + 1] if k + 1 < len(anchors) else None
            if nxt is None and line is not script['lines'][-1]:
                nl = script['lines'][script['lines'].index(line) + 1]
                nxt = nl.get('anchors', [None])[0]
            speed = 1.0
            if nxt is not None and dst + speech > nxt - MIN_GAP:
                speed = min(MAX_SPEED, speech / max(0.2, nxt - MIN_GAP - dst))
                seg = tempo(seg, speed)
            start = dst - (w0['start'] - s0) / speed
            i0 = int(round(start * SR))
            track[i0:i0 + len(seg)] += seg[:max(0, len(track) - i0)]
            for i in idx:
                w = words[i]
                out_words.append({'word': w['word'], 'start': round(start + (w['start'] - s0) / speed, 3), 'end': round(start + (w['end'] - s0) / speed, 3)})
            prev_end = start + (w1['end'] - s0) / speed
        layout['lines'].append({'id': lid, 'speaker': line['speaker'], 'text': line['text'], 'words': out_words})
        print(f"{lid}: {out_words[0]['start']:.2f} - {out_words[-1]['end']:.2f}  ({len(pieces)} pieces)")
    track = track[:int(a.duration * SR)]
    peak = np.max(np.abs(track))
    if peak > 0.99:
        track *= 0.99 / peak
    os.makedirs(a.out, exist_ok=True)
    wavfile.write(os.path.join(a.out, 'voice_track.wav'), SR, (track * 32767).astype(np.int16))
    json.dump(layout, open(os.path.join(a.out, 'voice_layout.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
