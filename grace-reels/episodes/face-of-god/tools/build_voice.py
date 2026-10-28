"""Build the narration for "The Face of God" from the user's own recording (audio/vo/moses_full.mp3).

The recording is cut into one clip per sentence at its natural pauses (found from the loudness), and
the clips are joined again with the brief's pauses: 0.3 s between sentences, 0.7 s after "you will die",
0.8 s before "But notice", 0.6 s after "That was just from being near God" and 0.6 s before the last
line. Inside a sentence the speaker's own timing is kept.

Word times come from faster-whisper (audio/vo/moses_full_asr.json, small.en with word timestamps),
snapped to the real pauses where a word touches one. Display text and keywords come from the approved
script (KJV spellings "shew", "clift" and "wist", which the recogniser hears as "show", "cliff" and
"whisked").

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

# Approved script split into sentences; *word* marks a caption keyword. (id, line, scene, text)
SENTENCES = [
    ('01', 1, 'S1', 'Moses asked to see God’s *face*.'),
    ('02', 2, 'S2', 'And God said: if you do… you will *die*.'),
    ('03', 3, 'S3', 'Moses had already seen fire, plagues, and a sea split in two.'),
    ('04', 4, 'S4', 'But on the mountain, he asked for more: “I beseech thee, shew me thy *glory*.”'),
    ('05', 5, 'S5', 'God answered: “There shall no man see me, and *live*.”'),
    ('06', 6, 'S6', 'So God hid him “in a clift of the *rock*”… and covered him while His glory passed by.'),
    ('07', 7, 'S7', 'Moses only saw His *back*.'),
    ('08a', 8, 'S8', 'But notice what happened next.'),
    ('08b', 8, 'S8', 'When Moses came down, his face was *shining*.'),
    ('09a', 9, 'S8', 'And he didn’t even know it.'),
    ('09b', 9, 'S9', '“Moses wist not that the skin of his face *shone*.”'),
    ('10', 10, 'S9', 'The people were *afraid* to come near him.'),
    ('11', 11, 'S10', 'That was just from being *near* God.'),
    ('12a', 12, 'S11', 'Now here’s the best part.'),
    ('12b', 12, 'S11', 'Centuries later, Jesus said: “He that hath seen *me* hath seen the *Father*.”'),
    ('13', 13, 'S12', 'Moses had to hide in a rock to see God’s back.'),
    ('14', 14, 'S13', 'You can see God’s glory “in the face of Jesus *Christ*.”'),
    ('15a', 15, 'S14', 'If you could see God’s face, what would you say first?'),
    ('15b', 15, 'S14', 'One line.'),
]
SCENE_NAMES = {
    'S1': 'He asked to see', 'S2': 'You will die', 'S3': 'Fire, plagues, sea', 'S4': 'The ask', 'S5': 'The answer',
    'S6': 'The clift', 'S7': 'His back', 'S8': 'Coming down', 'S9': 'The camp', 'S10': 'The veil',
    'S11': 'Centuries later', 'S12': 'No more hiding', 'S13': 'The face', 'S14': 'Call to action', 'S15': 'End card',
}
HEARD_AS = {'shew': 'show', 'clift': 'cliff', 'wist': 'whisked'}

LEAD_IN = 0.0             # the voice starts at frame 1
GAP = 0.30                # silence between sentences (last word end -> next first word)
GAP_AFTER = {'02': 0.70,  # after "you will die"
             '07': 0.80,  # before "But notice"
             '11': 0.60,  # after "That was just from being near God"
             '14': 0.60}  # before the last line
CTA_HOLD = 3.80           # the comment box types its answer and the hearts rise after "One line."
END_CARD = 3.70
QUIET_DB = -45.0          # a pause is at least 80 ms below this level
EDGE_IN, EDGE_OUT = 0.05, 0.14   # room kept before the first and after the last word of a clip


def plain(text):
    return text.replace('*', '')


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'")).strip("'")


def tokens(text):
    return [{'text': tok.replace('*', ''), 'keyword': '*' in tok} for tok in text.split()]


def load(path):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                                        check=True, capture_output=True).stdout, dtype=np.float32).copy()


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'pcm_s24le', str(path)], input=y.astype(np.float32).tobytes(), check=True)


def pauses(x):
    """Quiet runs of at least 80 ms, as (start, end) in seconds, from a 10 ms loudness envelope."""
    hop = SR // 100
    n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(axis=1)) + 1e-9)
    quiet = np.concatenate([[False], db < QUIET_DB, [False]])
    edges = np.flatnonzero(np.diff(quiet.astype(int)))
    return [(a / 100, b / 100) for a, b in zip(edges[::2], edges[1::2]) if b - a >= 8]


def heard_words():
    segs = json.loads((VO / 'moses_full_asr.json').read_text())
    return [{'w': norm(w['w']), 's': w['s'], 'e': w['e']} for sg in segs for w in sg['words'] if norm(w['w'])]


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


def main():
    x = load(VO / 'moses_full.mp3')
    quiet = pauses(x)
    heard = heard_words()

    # Match the script's words to what was heard, in order.
    j, clips, every = 0, [], []
    for sid, line, scene, text in SENTENCES:
        toks = tokens(text)
        for i, t in enumerate(toks):
            n = norm(t['text'])
            assert heard[j]['w'] == HEARD_AS.get(n, n), f'{sid}: script {t["text"]!r} vs heard {heard[j]["w"]!r}'
            t['s'], t['e'], t['first'] = heard[j]['s'], heard[j]['e'], i == 0
            j += 1
        clips.append({'sid': sid, 'line': line, 'scene': scene, 'text': text, 'tokens': toks})
        every += toks
    assert j == len(heard), f'words left over: {[w["w"] for w in heard[j:]]}'
    snap(every, quiet)

    # Cut each sentence out of the recording, from just before its first word to just after its last,
    # never past the middle of the pause on either side.
    for k, c in enumerate(clips):
        s, e = c['tokens'][0]['s'], c['tokens'][-1]['e']
        lo = 0.0 if k == 0 else (clips[k - 1]['tokens'][-1]['e'] + s) / 2
        hi = len(x) / SR if k == len(clips) - 1 else (e + clips[k + 1]['tokens'][0]['s']) / 2
        a, b = int(max(lo, s - EDGE_IN) * SR), int(min(hi, e + EDGE_OUT) * SR)
        y = x[a:b].copy()
        fi, fo = int(0.006 * SR), int(0.04 * SR)
        if k:
            y[:fi] *= np.linspace(0, 1, fi)
        y[-fo:] *= np.linspace(1, 0, fo)
        c['audio'], c['offset'] = y, a / SR
        print(f"{c['sid']:>3}: {s:6.2f}–{e:6.2f}  {plain(c['text'])}")

    # Place the clips so the silence between one sentence's last word and the next one's first word
    # equals the planned pause.
    t = LEAD_IN
    for c in clips:
        c['place'] = t - (c['tokens'][0]['s'] - c['offset'])
        t = c['place'] + (c['tokens'][-1]['e'] - c['offset']) + GAP_AFTER.get(c['sid'], GAP)
    voice_end = clips[-1]['place'] + clips[-1]['tokens'][-1]['e'] - clips[-1]['offset']
    frames = int(round((voice_end + CTA_HOLD + END_CARD) * FPS))
    total = frames / FPS
    track = np.zeros(int(total * SR) + SR, np.float32)
    for c in clips:
        a = int(round(c['place'] * SR))
        track[a:a + len(c['audio'])] += c['audio']
    track = track[:int(total * SR)]
    (EP / 'audio').mkdir(exist_ok=True)
    write_wav(EP / 'audio' / 'voice_track.wav', track)

    words, sentences = [], []
    for k, c in enumerate(clips, start=1):
        ids = []
        shift = c['place'] - c['offset']
        for tk in c['tokens']:
            w = {'i': len(words), 'text': tk['text'], 'keyword': tk['keyword'],
                 'start': round(shift + tk['s'], 3), 'end': round(shift + tk['e'], 3),
                 'line': c['line'], 'sentence': k, 'sid': c['sid'], 'scene': c['scene']}
            words.append(w)
            ids.append(w['i'])
        sentences.append({'id': k, 'sid': c['sid'], 'line': c['line'], 'scene': c['scene'], 'text': plain(c['text']),
                          'words': ids, 'start': words[ids[0]]['start'], 'end': words[ids[-1]]['end']})

    # Scene cuts sit in the middle of the pause between two scenes' sentences.
    order = [f'S{i}' for i in range(1, 15)]
    first = {sc: next(s for s in sentences if s['scene'] == sc) for sc in order}
    lasts = {sc: [s for s in sentences if s['scene'] == sc][-1] for sc in order}
    cuts = [0.0] + [round((lasts[a]['end'] + first[b]['start']) / 2, 3) for a, b in zip(order, order[1:])]
    cuts.append(round(total - END_CARD, 3))
    scenes = [{'id': sc, 'name': SCENE_NAMES[sc], 'start': cuts[k], 'end': cuts[k + 1]} for k, sc in enumerate(order)]
    scenes.append({'id': 'S15', 'name': SCENE_NAMES['S15'], 'start': round(total - END_CARD, 3), 'end': round(total, 3)})

    def word(sid, text, nth=0):
        return [w for w in words if w['sid'] == sid and norm(w['text']) == text][nth]

    sent = {s['sid']: s for s in sentences}
    cues = {
        'face': word('01', 'face')['start'],
        'godSaid': word('02', 'and')['start'],
        'ifYouDo': word('02', 'if')['start'],
        'youWill': word('02', 'you', 1)['start'],
        'die': word('02', 'die')['start'],
        'dieEnd': sent['02']['end'],
        'alreadySeen': word('03', 'moses')['start'],
        'fire': word('03', 'fire')['start'],
        'plagues': word('03', 'plagues')['start'],
        'sea': word('03', 'sea')['start'],
        'split': word('03', 'split')['start'],
        'two': word('03', 'two')['start'],
        'onTheMountain': word('04', 'but')['start'],
        'askedMore': word('04', 'asked')['start'],
        'beseech': word('04', 'i')['start'],
        'shewMe': word('04', 'shew')['start'],
        'glory': word('04', 'glory')['start'],
        'godAnswered': word('05', 'god')['start'],
        'noMan': word('05', 'there')['start'],
        'live': word('05', 'live')['start'],
        'hid': word('06', 'so')['start'],
        'clift': word('06', 'clift')['start'],
        'rock': word('06', 'rock')['start'],
        'covered': word('06', 'covered')['start'],
        'gloryPassed': word('06', 'glory')['start'],
        'passedBy': word('06', 'passed')['start'],
        'onlySaw': word('07', 'moses')['start'],
        'back': word('07', 'back')['start'],
        'butNotice': word('08a', 'but')['start'],
        'cameDown': word('08b', 'when')['start'],
        'hisFace': word('08b', 'his')['start'],
        'shining': word('08b', 'shining')['start'],
        'didntKnow': word('09a', 'and')['start'],
        'knowIt': word('09a', 'know')['start'],
        'wist': word('09b', 'moses')['start'],
        'skin': word('09b', 'skin')['start'],
        'shone': word('09b', 'shone')['start'],
        'people': word('10', 'the')['start'],
        'afraid': word('10', 'afraid')['start'],
        'nearHim': word('10', 'near')['start'],
        'justFrom': word('11', 'that')['start'],
        'nearGod': word('11', 'near')['start'],
        'nearGodEnd': sent['11']['end'],
        'bestPart': word('12a', 'now')['start'],
        'centuries': word('12b', 'centuries')['start'],
        'jesusSaid': word('12b', 'jesus')['start'],
        'heThat': word('12b', 'he')['start'],
        'me': word('12b', 'me')['start'],
        'father': word('12b', 'father')['start'],
        'fatherEnd': sent['12b']['end'],
        'hide': word('13', 'moses')['start'],
        'hideRock': word('13', 'rock')['start'],
        'godsBack': word('13', 'back')['start'],
        'youCanSee': word('14', 'you')['start'],
        'glory2': word('14', 'glory')['start'],
        'faceOf': word('14', 'face')['start'],
        'christ': word('14', 'christ')['start'],
        'christEnd': sent['14']['end'],
        'cta': word('15a', 'if')['start'],
        'sayFirst': word('15a', 'say')['start'],
        'oneLine': word('15b', 'one')['start'],
        'voiceEnd': round(voice_end, 3),
        'endCard': round(total - END_CARD, 3),
    }
    timeline = {
        'fps': FPS, 'durationInSeconds': round(total, 3), 'durationInFrames': frames,
        'voice': {'engine': 'recording', 'source': 'audio/vo/moses_full.mp3', 'timing': 'faster-whisper small.en, snapped to pauses'},
        'leadIn': LEAD_IN, 'voiceEnd': round(voice_end, 3),
        'sentences': sentences, 'words': words, 'scenes': scenes, 'cues': cues,
        'pauses': {'default': GAP, 'after': GAP_AFTER, 'ctaHold': CTA_HOLD, 'endCard': END_CARD},
    }
    (EP / 'public').mkdir(exist_ok=True)
    for path in (EP / 'timeline.json', EP / 'public' / 'timeline.json'):
        path.write_text(json.dumps(timeline, indent=1, ensure_ascii=False) + '\n')
    print(f'voice track {total:.2f}s ({frames} frames), voice ends {voice_end:.2f}s, {len(words)} words, {len(sentences)} sentences')
    for sc in scenes:
        print(f"  {sc['id']:4} {sc['start']:6.2f}–{sc['end']:6.2f}  {sc['name']}")


if __name__ == '__main__':
    main()
