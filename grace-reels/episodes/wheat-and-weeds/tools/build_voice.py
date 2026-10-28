"""Build the narration for "Wheat and Weeds" from the user's own recording (audio/vo/user_full.mp3).

The recording is cut into one clip per sentence at its natural pauses (found from the loudness), and
the clips are joined again with the brief's pauses: 0.3 s between sentences, 0.6 s after "God didn't
plant the evil", 0.8 s before "But notice", 0.8 s after "who would be left?" and 0.6 s before the last
line. Inside a sentence the speaker's own timing is kept.

Word times come from faster-whisper (audio/vo/user_full_asr.json, small.en with word timestamps),
snapped to the real pauses where a word touches one. Display text and keywords come from the approved
script. The finished track is transcribed again as a check.

Outputs: audio/voice_track.wav (48 kHz), timeline.json and public/timeline.json.
Run: python tools/build_voice.py   (needs numpy, faster-whisper; ffmpeg on PATH)
"""
import json
import re
import subprocess
from pathlib import Path

import numpy as np

EP = Path(__file__).resolve().parent.parent
VO = EP / 'audio' / 'vo'
SR = 48000
FPS = 30
SOURCE = VO / 'user_full.mp3'

# Approved script split into sentences; *word* marks a caption keyword.
# (id, line, scene, text). Long lines are split into separate clips.
SENTENCES = [
    ('01a', 1, 'S1', 'If God is real… why doesn’t He just stop all *evil*?'),
    ('01b', 1, 'S1', 'Right now?'),
    ('02', 2, 'S2', 'Jesus told a story about a *field*.'),
    ('03', 3, 'S3', 'A farmer planted good *seed*.'),
    ('04', 4, 'S4', '“But while men slept, his *enemy* came and sowed tares among the wheat, and went his way.”'),
    ('05', 5, 'S5', 'When the weeds came up, the servants asked: “Sir, didst not thou sow good seed in thy field?”'),
    ('06', 6, 'S6', 'And he said: “An *enemy* hath done this.”'),
    ('07', 7, 'S6', 'God didn’t plant the evil.'),
    ('08', 8, 'S7', 'So the servants asked: should we pull up the weeds?'),
    ('09', 9, 'S7', 'But notice his answer: “*Nay*; lest while ye gather up the tares, ye root up also the *wheat* with them.”'),
    ('10', 10, 'S8', '“Let both grow together until the *harvest*.”'),
    ('11a', 11, 'S9', 'Here’s the hard truth:'),
    ('11b', 11, 'S9', 'if God pulled out all evil tonight… who would be left?'),
    ('12', 12, 'S9', '“For all have *sinned*, and come short of the glory of God.”'),
    ('13a', 13, 'S10', 'He’s not slow.'),
    ('13b', 13, 'S10', 'He’s *patient*: “not willing that any should perish, but that all should come to repentance.”'),
    ('14a', 14, 'S11', 'Saul once hunted Christians.'),
    ('14b', 14, 'S11', 'Then he met Jesus… and became *Paul*.'),
    ('15', 15, 'S11', 'If God had pulled him up early, we’d never have his letters.'),
    ('16a', 16, 'S12', 'One day, the *harvest* will come.'),
    ('16b', 16, 'S13', 'If God ended all evil tonight, would you be ready?'),
    ('16c', 16, 'S13', 'Yes, or not yet?'),
]
SCENE_NAMES = {
    'S1': 'Opening: the enemy sows at night', 'S2': 'The storyteller', 'S3': 'Good seed', 'S4': 'While men slept',
    'S5': 'They look the same', 'S6': 'An enemy hath done this', 'S7': 'Pull them up?', 'S8': 'Grow together',
    'S9': 'The hard truth', 'S10': 'Patient', 'S11': 'Saul', 'S12': 'Harvest', 'S13': 'Call to action',
    'S14': 'End card',
}

LEAD_IN = 0.10            # the first word starts on frame 3 (a breath of room before it)
GAP = 0.30                # silence between sentences (last word end -> next first word)
GAP_AFTER = {'07': 0.60,   # after "God didn't plant the evil"
             '08': 0.80,   # before "But notice"
             '11b': 0.80,  # after "who would be left?"
             '15': 0.60}   # before the last line
CTA_HOLD = 2.60           # the comment box keeps typing after "Yes, or not yet?"
END_CARD = 3.00
QUIET_DB = -45.0          # a pause is at least 80 ms below this level
EDGE_IN, EDGE_OUT = 0.05, 0.14   # room kept before the first and after the last word of a clip


def plain(text):
    return text.replace('*', '')


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'")).strip("'")


def tokens(text):
    return [{'text': tok.replace('*', ''), 'keyword': '*' in tok} for tok in text.split()]


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'pcm_s24le', str(path)], input=y.astype(np.float32).tobytes(), check=True)


def load(path):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                                        check=True, capture_output=True).stdout, dtype=np.float32).copy()


def pauses(x):
    """Quiet runs of at least 80 ms, as (start, end) in seconds, from a 10 ms loudness envelope."""
    hop = SR // 100
    n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(axis=1)) + 1e-9)
    quiet = np.concatenate([[False], db < QUIET_DB, [False]])
    edges = np.flatnonzero(np.diff(quiet.astype(int)))
    return [(a / 100, b / 100) for a, b in zip(edges[::2], edges[1::2]) if b - a >= 8]


def heard_words():
    return [{'w': norm(w['w']), 's': w['s'], 'e': w['e']} for w in json.loads((VO / 'user_full_asr.json').read_text()) if norm(w['w'])]


def snap(toks, quiet):
    """Whisper lets words run on into pauses. Give each real pause to the word boundary it belongs to
    (a sentence break first, then a comma or other punctuation, then a plain gap between words when
    whisper's boundary is close) and move the two word edges onto the pause."""
    rank = {'sentence': 0, 'punct': 1, 'word': 2}
    bounds = [(k, 'sentence' if toks[k]['first'] else 'punct' if re.search(r'[,:;.…”?!]$', toks[k - 1]['text']) else 'word')
              for k in range(1, len(toks))]
    for a, b in quiet:
        if b - a < 0.12:
            continue
        c = (a + b) / 2
        near = [(k, kind, abs((toks[k - 1]['e'] + toks[k]['s']) / 2 - c)) for k, kind in bounds]
        near = [n for n in near if n[2] <= (b - a) / 2 + 0.5 and (n[1] != 'word' or n[2] < 0.2)]
        if not near:
            continue
        k, _, _ = min(near, key=lambda n: (rank[n[1]], n[2]))
        prev, nxt = toks[k - 1], toks[k]
        prev['e'] = max(a, prev['s'] + 0.05)
        nxt['s'] = min(b, nxt['e'] - 0.05) if nxt['e'] > b + 0.05 else b
        nxt['e'] = max(nxt['e'], nxt['s'] + 0.08)
    for p, n in zip(toks, toks[1:]):
        p['e'] = min(p['e'], n['s'])
    return toks


def whisper_check(track, words):
    from faster_whisper import WhisperModel
    model = WhisperModel('small.en', device='cpu', compute_type='int8')
    segs, _ = model.transcribe(track[::3].astype(np.float32), word_timestamps=True, beam_size=5, vad_filter=False)
    heard = [{'w': norm(w.word), 's': w.start} for sg in segs for w in sg.words if norm(w.word)]
    diffs, j = [], 0
    for w in words:
        n = norm(w['text'])
        for k in range(j, min(j + 4, len(heard))):
            if heard[k]['w'] == n:
                diffs.append(w['start'] - heard[k]['s'])
                j = k + 1
                break
    d = np.array(diffs)
    print(f'whisper check: {len(d)}/{len(words)} words matched, mean offset {d.mean():+.3f}s, '
          f'mean |offset| {np.abs(d).mean():.3f}s, max |offset| {np.abs(d).max():.3f}s')
    return float(np.abs(d).mean())


def main():
    x = load(SOURCE)
    quiet = pauses(x)
    heard = heard_words()

    # Match the script's words to what was heard, in order.
    j, order_clips, every = 0, [], []
    for sid, line, scene, text in SENTENCES:
        toks = [t for t in tokens(text) if norm(t['text'])]
        for i, t in enumerate(toks):
            n = norm(t['text'])
            assert heard[j]['w'] == n, f'{sid}: script {t["text"]!r} vs heard {heard[j]["w"]!r}'
            t['s'], t['e'], t['first'] = heard[j]['s'], heard[j]['e'], i == 0
            j += 1
        order_clips.append({'sid': sid, 'line': line, 'scene': scene, 'text': text, 'tokens': toks})
        every += toks
    assert j == len(heard), f'words left over: {[w["w"] for w in heard[j:]]}'
    snap(every, quiet)

    # Cut each sentence out of the recording, from just before its first word to just after its last,
    # never past the middle of the pause on either side.
    clips = {}
    for k, c in enumerate(order_clips):
        s, e = c['tokens'][0]['s'], c['tokens'][-1]['e']
        lo = 0.0 if k == 0 else (order_clips[k - 1]['tokens'][-1]['e'] + s) / 2
        hi = len(x) / SR if k == len(order_clips) - 1 else (e + order_clips[k + 1]['tokens'][0]['s']) / 2
        a0, b0 = int(max(lo, s - EDGE_IN) * SR), int(min(hi, e + EDGE_OUT) * SR)
        y = x[a0:b0].copy()
        fi, fo = int(0.006 * SR), int(0.04 * SR)
        y[:fi] *= np.linspace(0, 1, fi)
        y[-fo:] *= np.linspace(1, 0, fo)
        for t in c['tokens']:
            t['s'] -= a0 / SR
            t['e'] -= a0 / SR
        clips[c['sid']] = {**c, 'audio': y}
        print(f"{c['sid']:>3}: {s:6.2f}–{e:6.2f}  {plain(c['text'])}")

    # Place the clips so the silence between one sentence's last word and the next one's first word
    # equals the planned pause.
    t, place = LEAD_IN, {}
    for sid, *_ in SENTENCES:
        c = clips[sid]
        place[sid] = t - c['tokens'][0]['s']
        t = place[sid] + c['tokens'][-1]['e'] + GAP_AFTER.get(sid, GAP)
    last = SENTENCES[-1][0]
    voice_end = place[last] + clips[last]['tokens'][-1]['e']
    frames = int(round((voice_end + CTA_HOLD + END_CARD) * FPS))
    total = frames / FPS
    track = np.zeros(int(total * SR) + SR, np.float32)
    for sid, c in clips.items():
        a0 = max(0, int(round(place[sid] * SR)))
        track[a0:a0 + len(c['audio'])] += c['audio'][: len(track) - a0]
    track = track[:int(total * SR)]
    (EP / 'audio').mkdir(exist_ok=True)
    write_wav(EP / 'audio' / 'voice_track.wav', track)

    words, sentences = [], []
    for k, (sid, line, scene, text) in enumerate(SENTENCES, start=1):
        c = clips[sid]
        ids = []
        for t in c['tokens']:
            w = {'i': len(words), 'text': t['text'], 'keyword': t['keyword'],
                 'start': round(place[sid] + t['s'], 3), 'end': round(place[sid] + t['e'], 3),
                 'line': line, 'sentence': k, 'sid': sid, 'scene': scene}
            words.append(w)
            ids.append(w['i'])
        sentences.append({'id': k, 'sid': sid, 'line': line, 'scene': scene, 'text': plain(text), 'words': ids,
                          'start': words[ids[0]]['start'], 'end': words[ids[-1]]['end']})

    # Scene cuts sit in the middle of the pause between two scenes' sentences.
    order = [f'S{i}' for i in range(1, 14)]
    first = {sc: next(s for s in sentences if s['scene'] == sc) for sc in order}
    lasts = {sc: [s for s in sentences if s['scene'] == sc][-1] for sc in order}
    cuts = [0.0] + [round((lasts[a]['end'] + first[b]['start']) / 2, 3) for a, b in zip(order, order[1:])]
    cuts.append(round(total - END_CARD, 3))
    scenes = [{'id': sc, 'name': SCENE_NAMES[sc], 'start': cuts[k], 'end': cuts[k + 1]} for k, sc in enumerate(order)]
    scenes.append({'id': 'S14', 'name': SCENE_NAMES['S14'], 'start': round(total - END_CARD, 3), 'end': round(total, 3)})

    def word(sid, text, nth=0):
        hits = [w for w in words if w['sid'] == sid and norm(w['text']) == text]
        return hits[nth]

    sent = {s['sid']: s for s in sentences}
    W = lambda sid, text, nth=0: word(sid, text, nth)['start']
    cues = {
        'evil': W('01a', 'evil'),
        'rightNow': W('01b', 'right'),
        'jesusTold': W('02', 'jesus'),
        'field': W('02', 'field'),
        'farmer': W('03', 'farmer'),
        'planted': W('03', 'planted'),
        'seed': W('03', 'seed'),
        'butWhile': W('04', 'but'),
        'slept': W('04', 'slept'),
        'enemy1': W('04', 'enemy'),
        'sowed': W('04', 'sowed'),
        'tares1': W('04', 'tares'),
        'wentHisWay': W('04', 'went'),
        'weedsCameUp': W('05', 'weeds'),
        'servantsAsked': W('05', 'servants'),
        'sir': W('05', 'sir'),
        'goodSeed': W('05', 'good'),
        'andHeSaid': W('06', 'and'),
        'enemy2': W('06', 'enemy'),
        'godDidnt': W('07', 'god'),
        'plantEvil': W('07', 'evil'),
        'shouldWe': W('08', 'should'),
        'pullUp': W('08', 'pull'),
        'butNotice': W('09', 'but'),
        'nay': W('09', 'nay'),
        'gatherUp': W('09', 'gather'),
        'rootUp': W('09', 'root'),
        'wheat': W('09', 'wheat'),
        'letBoth': W('10', 'let'),
        'grow': W('10', 'grow'),
        'harvest1': W('10', 'harvest'),
        'hardTruth': W('11a', 'hard'),
        'pulledOut': W('11b', 'pulled'),
        'tonight1': W('11b', 'tonight'),
        'whoWouldBeLeft': W('11b', 'who'),
        'forAll': W('12', 'for'),
        'all': W('12', 'all'),
        'sinned': W('12', 'sinned'),
        'glory': W('12', 'glory'),
        'notSlow': W('13a', 'not'),
        'patient': W('13b', 'patient'),
        'perish': W('13b', 'perish'),
        'repentance': W('13b', 'repentance'),
        'saul': W('14a', 'saul'),
        'hunted': W('14a', 'hunted'),
        'metJesus': W('14b', 'met'),
        'became': W('14b', 'became'),
        'paul': W('14b', 'paul'),
        'pulledHimUp': W('15', 'pulled'),
        'letters': W('15', 'letters'),
        'oneDay': W('16a', 'one'),
        'harvest2': W('16a', 'harvest'),
        'cta': W('16b', 'if'),
        'ready': W('16b', 'ready'),
        'yes': W('16c', 'yes'),
        'notYet': W('16c', 'not'),
        'voiceEnd': round(voice_end, 3),
        'endCard': round(total - END_CARD, 3),
    }
    timeline = {
        'fps': FPS, 'durationInSeconds': round(total, 3), 'durationInFrames': frames,
        'voice': {'engine': 'recording', 'source': 'audio/vo/user_full.mp3', 'timing': 'faster-whisper small.en, snapped to pauses'},
        'leadIn': LEAD_IN, 'voiceEnd': round(voice_end, 3),
        'sentences': sentences, 'words': words, 'scenes': scenes, 'cues': cues,
        'pauses': {'default': GAP, 'after': GAP_AFTER, 'ctaHold': CTA_HOLD, 'endCard': END_CARD},
    }
    (EP / 'public').mkdir(exist_ok=True)
    for path in (EP / 'timeline.json', EP / 'public' / 'timeline.json'):
        path.write_text(json.dumps(timeline, indent=1, ensure_ascii=False) + '\n')
    print(f'voice track {total:.2f}s ({frames} frames), {len(words)} words, {len(sentences)} sentences')
    for sc in scenes:
        print(f"  {sc['id']:4} {sc['start']:6.2f}–{sc['end']:6.2f}  {sc['name']}")
    err = whisper_check(track, words)
    assert err < 0.15, 'word timing does not match what whisper hears'


if __name__ == '__main__':
    main()
