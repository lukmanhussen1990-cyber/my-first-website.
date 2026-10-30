"""Re-time a narrated voiceover and build timeline.json.

Takes the voice MP3, its forced alignment (tools/align_vo.py) and a voice plan
(lines, pauses, caption phrases). Cuts the audio into speech runs at the
aligned silences, rejoins them with the planned pauses, optionally drops words
that sit between silences, applies a gentle tempo change to hit a target
length, and writes:
  <out_dir>/voice.wav       48 kHz mono
  <out_dir>/timeline.json   words, phrases, lines and scenes with times (s)

Usage: python build_voice.py voice.mp3 align.json plan.json out_dir [target_seconds]
"""
import json
import re
import subprocess
import sys

import numpy as np

SR = 48000


def words_of(text):
    return re.findall(r"[a-z']+", text.lower().replace('’', "'"))


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def sound_bounds(audio, a, b, floor_db=-46.0, pre=0.02, post=0.05):
    """First/last 10 ms frame louder than floor_db inside [a, b] (seconds), padded."""
    a, b = max(0.0, a), min(len(audio) / SR, b)
    x = audio[int(a * SR):int(b * SR)]
    hop = SR // 100
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    loud = np.where(20 * np.log10(rms) > floor_db)[0]
    if len(loud) == 0:
        return a, b
    return max(0.0, a + loud[0] * 0.01 - pre), min(len(audio) / SR, a + (loud[-1] + 1) * 0.01 + post)


def ends_sentence(token):
    return bool(re.search(r"[.?!][”\"]?$", token))


def main(mp3, align_path, plan_path, out_dir, target=None):
    audio = decode(mp3)
    align = json.load(open(align_path))
    plan = json.load(open(plan_path))
    toks = [dict(w=re.sub(r'\(\d+\)$', '', a['w']), s=a['s'], e=a['e']) for a in align]

    # walk the alignment line by line, splitting each line into speech runs at <sil>
    i = 0
    runs = []  # dict(line, words=[(word, s, e, script_token)], drop)
    for line in plan['lines']:
        drop = line.get('drop', [])
        script_tokens = [t for t in re.split(r'\s+', line['text'].replace('…', '… ').strip()) if words_of(t)]
        spoken = drop + [w for t in script_tokens for w in words_of(t)]
        tok_for_word = [None] * len(drop) + [t for t in script_tokens for _ in words_of(t)]
        k = 0
        cur = []
        while k < len(spoken):
            a = toks[i]
            i += 1
            if a['w'] in ('<sil>', '<s>', '</s>', '[NOISE]'):
                if cur:
                    runs.append(dict(line=line['id'], words=cur))
                    cur = []
                continue
            if a['w'] != spoken[k]:
                raise SystemExit(f"alignment mismatch in line {line['id']}: {a['w']} != {spoken[k]}")
            cur.append((a['w'], a['s'], a['e'], tok_for_word[k], k < len(drop)))
            k += 1
        if cur:
            runs.append(dict(line=line['id'], words=cur))
    lines = {l['id']: l for l in plan['lines']}

    # build output pieces
    out = []
    t = 0.0
    timed_words = []
    prev_line = None
    for n, run in enumerate(runs):
        if all(w[4] for w in run['words']):
            continue  # dropped run
        nxt = runs[n + 1]['words'][0][1] if n + 1 < len(runs) else len(audio) / SR
        s_peek, _ = sound_bounds(audio, run['words'][0][1] - 0.12, min(run['words'][-1][2] + 0.25, nxt))
        if prev_line is not None:
            if run['line'] != prev_line:
                gap = lines[prev_line].get('pauseAfter', plan['defaultPause'])
            else:
                last_tok = out[-1]['last_token']
                orig_gap = s_peek - out[-1]['src_e']
                gap = plan['innerSentencePause'] if ends_sentence(last_tok) else float(np.clip(orig_gap, 0.18, 0.42))
            t += gap
        nxt = runs[n + 1]['words'][0][1] if n + 1 < len(runs) else len(audio) / SR
        s, e = sound_bounds(audio, run['words'][0][1] - 0.12, min(run['words'][-1][2] + 0.25, nxt))
        seg = audio[int(s * SR):int(e * SR)].copy()
        fi, fo = int(0.01 * SR), int(0.025 * SR)
        seg[:fi] *= np.linspace(0, 1, fi)
        seg[-fo:] *= np.linspace(1, 0, fo)
        for w, ws, we, tok, dropped in run['words']:
            timed_words.append(dict(w=w, token=tok, line=run['line'], start=t + max(0.0, ws - s), end=t + min(we, e) - s))
        out.append(dict(at=t, seg=seg, src_e=e, last_token=run['words'][-1][3]))
        t += len(seg) / SR
        prev_line = run['line']
    total = t
    buf = np.zeros(int(total * SR) + SR // 10, np.float32)
    for p in out:
        a = int(p['at'] * SR)
        buf[a:a + len(p['seg'])] += p['seg']

    rate = 1.0
    if target and total > target:
        rate = min(1.08, total / target)
    wav_tmp = f'{out_dir}/voice_untimed.wav'
    write_wav(wav_tmp, buf)
    flt = f'atempo={rate:.4f}' if rate != 1.0 else 'anull'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav_tmp, '-af', flt, '-ar', str(SR), '-ac', '1',
                    '-c:a', 'pcm_f32le', f'{out_dir}/voice.wav'], check=True)
    for w in timed_words:
        w['start'] = round(w['start'] / rate, 3)
        w['end'] = round(w['end'] / rate, 3)
    total /= rate

    # phrases: consecutive groups of the line's (kept) words
    phrases, line_rows = [], []
    by_line = {}
    for w in timed_words:
        by_line.setdefault(w['line'], []).append(w)
    pid = 0
    for line in plan['lines']:
        ws = by_line[line['id']]
        k = 0
        first = len(phrases)
        for ptxt in line['phrases']:
            n = len(words_of(ptxt))
            chunk = ws[k:k + n]
            if [c['w'] for c in chunk] != words_of(ptxt):
                raise SystemExit(f"phrase mismatch line {line['id']}: {ptxt}")
            pid += 1
            phrases.append(dict(id=pid, text=ptxt, line=line['id'], scene=line['scene'],
                                start=chunk[0]['start'], end=chunk[-1]['end']))
            for c in chunk:
                c['phrase'] = pid
            k += n
        line_rows.append(dict(id=line['id'], scene=line['scene'], text=line['text'],
                              start=ws[0]['start'], end=ws[-1]['end'], phrases=list(range(phrases[first]['id'], pid + 1))))
    # captions stay up until the next phrase starts (but not across long pauses)
    for a, b in zip(phrases, phrases[1:]):
        a['hold'] = round(min(b['start'], a['end'] + 0.9), 3)
    phrases[-1]['hold'] = round(phrases[-1]['end'] + 0.8, 3)
    scenes = []
    for r in line_rows:
        if not scenes or scenes[-1]['id'] != r['scene']:
            scenes.append(dict(id=r['scene'], start=r['start']))
    for a, b in zip(scenes, scenes[1:]):
        a['end'] = b['start']
    scenes[-1]['end'] = round(total, 3)
    for w in timed_words:
        w['scene'] = lines[w['line']]['scene']
        w.pop('token', None)
    json.dump(dict(fps=30, voiceDuration=round(total, 3), tempo=round(rate, 4),
                   lines=line_rows, phrases=phrases, words=timed_words, scenes=scenes),
              open(f'{out_dir}/timeline.json', 'w'), indent=1)
    print(f'voice {total:.2f}s (tempo {rate:.3f}), {len(timed_words)} words, {len(phrases)} phrases')


def write_wav(path, x):
    import wave
    x16 = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(x16.tobytes())


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]) if len(sys.argv) > 5 else None)
