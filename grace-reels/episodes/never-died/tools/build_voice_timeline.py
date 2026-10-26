"""Build the narration track and timeline.json from the user's 15 recorded parts.

Edits (see audio/vo/VO_CHECK.md): cut the stray sound at the start of vo_12, slow vo_11 and vo_13 by
10% (rubberband), even out levels halfway, then place the parts with the planned pauses and time every
word with faster-whisper. Display text and keywords come from the approved script, not from speech-to-text.

Outputs: audio/voice_track.wav (48 kHz), timeline.json and public/timeline.json.
Run: python tools/build_voice_timeline.py   (needs numpy, pyloudnorm, faster-whisper; ffmpeg on PATH)
"""
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
from faster_whisper import WhisperModel

EP = Path(__file__).resolve().parent.parent
VO = EP / 'audio' / 'vo'
WORK = EP / 'audio' / 'work'
SR = 48000
FPS = 30

# Approved script; *word* marks a caption keyword. Scene ids follow SCRIPT_AND_SHOTS.md.
SCRIPT = {
    1: ('S1', 'Two men in the Bible never *died*. Not even once.'),
    2: ('S2', 'The first was *Enoch*. “Enoch walked with God: and he was not; for God *took* him.”'),
    3: ('S2', '“By faith Enoch was *translated* that he should not see death…” because he pleased God.'),
    4: ('S3', 'The second was *Elijah*. And most people get his story *wrong*.'),
    5: ('S3', 'Elijah and Elisha were walking and talking…'),
    6: ('S4', 'When suddenly, “there appeared a chariot of *fire*, and horses of fire.”'),
    7: ('S5', 'Most people think Elijah rode that chariot to heaven. But read it again.'),
    8: ('S6', 'The chariot “parted them both *asunder*.” It came *between* them.'),
    9: ('S6', 'And “Elijah went up by a *whirlwind* into heaven.”'),
    10: ('S7', 'Elisha cried, “My father, my father”… and he saw him no more.'),
    11: ('S7', 'Only his cloak came floating down.'),
    12: ('S8', 'But that’s not the end. Centuries later, on a mountain, Elijah appeared again… talking with *Jesus*.'),
    13: ('S9', 'And Jesus made a promise for *you*:'),
    14: ('S9', '“Whosoever liveth and believeth in me shall *never* die.”'),
    15: ('S10', 'If you could ask Elijah one *question*, what would it be? Comment below.'),
}
SCENE_NAMES = {'S1': 'Hook', 'S2': 'Enoch', 'S3': 'Elijah and Elisha', 'S4': 'Chariot of fire',
               'S5': 'Most people get it wrong', 'S6': 'The whirlwind', 'S7': 'My father, my father',
               'S8': 'The mountain', 'S9': 'The promise', 'S10': 'Call to action', 'S11': 'End card'}

LEAD_IN = 0.30            # voice starts here; the hook title owns 0–1.8 s
GAP = 0.30                # pause between parts (last word end → next first word)
GAP_AFTER = {6: 1.20,     # let the chariot burst breathe
             9: 1.40,     # whirlwind climax
             11: 0.70,    # the pause before "But that's not the end"
             12: 1.00,    # mountain reveal holds, key change lands on part 13
             14: 1.20}    # promise card breathes
PAUSE_BEFORE_READ_AGAIN = 0.80
CTA_HOLD = 1.60           # comment box keeps typing after the last word
END_CARD = 3.00
CUT_START = {12: 1.15}    # stray sound before "But that's not the end"
TEMPO = {11: 0.90, 13: 0.90}
LEVEL_STRENGTH = 0.5      # move each part halfway toward the average loudness


def load(part):
    af = []
    if part in TEMPO:
        af.append(f'rubberband=tempo={TEMPO[part]}:transients=mixed:pitchq=quality')
    cmd = ['ffmpeg', '-v', 'error', '-i', str(VO / f'vo_{part:02d}.mp3')]
    if part in CUT_START:
        cmd[3:3] = ['-ss', str(CUT_START[part])]
    cmd += (['-af', ','.join(af)] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, check=True, capture_output=True).stdout, dtype=np.float32).copy()


def speech_bounds(x, thresh_db=-45.0):
    hop = SR // 100
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    on = np.nonzero(20 * np.log10(rms) > thresh_db)[0]
    return on[0] * hop / SR, (on[-1] + 1) * hop / SR


def tokens(text):
    out = []
    for tok in text.split():
        kw = '*' in tok
        out.append({'text': tok.replace('*', ''), 'keyword': kw})
    return out


def norm(w):
    return re.sub(r"[^a-z']", '', w.lower().replace('’', "'"))


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'pcm_s24le', str(path)], input=y.astype(np.float32).tobytes(), check=True)


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    meter = pyln.Meter(SR)
    clips = {p: load(p) for p in SCRIPT}
    loud = {p: meter.integrated_loudness(c.astype(np.float64)) for p, c in clips.items()}
    target = float(np.mean(list(loud.values())))
    model = WhisperModel('small.en', device='cpu', compute_type='int8')

    parts = {}
    for p, x in clips.items():
        x = x * 10 ** ((target - loud[p]) * LEVEL_STRENGTH / 20)
        s, e = speech_bounds(x)
        a, b = max(0, int((s - 0.025) * SR)), min(len(x), int((e + 0.12) * SR))
        x = x[a:b].copy()
        fi, fo = int(0.008 * SR), int(0.03 * SR)
        x[:fi] *= np.linspace(0, 1, fi)
        x[-fo:] *= np.linspace(1, 0, fo)
        x16 = x[::3].astype(np.float32)  # 48k -> 16k for whisper (speech band is far below 8 kHz)
        segs, _ = model.transcribe(x16, word_timestamps=True, beam_size=5, vad_filter=False)
        heard = [{'w': w.word.strip(), 's': w.start, 'e': w.end} for sg in segs for w in sg.words]
        toks = tokens(SCRIPT[p][1])
        assert [norm(t['text']) for t in toks] == [norm(h['w']) for h in heard], \
            f'part {p}: script {[t["text"] for t in toks]} vs heard {[h["w"] for h in heard]}'
        for t, h in zip(toks, heard):
            t['s'], t['e'] = h['s'], h['e']
        if p == 7:  # stretch the pause before "But read it again"
            i = next(k for k, t in enumerate(toks) if norm(t['text']) == 'but')
            g0, g1 = toks[i - 1]['e'], toks[i]['s']
            seg = x[int(g0 * SR):int(g1 * SR)]
            hop = SR // 200
            quiet = min(range(0, max(1, len(seg) - hop), hop), key=lambda k: np.sum(seg[k:k + hop] ** 2))
            cut = int(g0 * SR) + quiet + hop // 2
            extra = max(0.0, PAUSE_BEFORE_READ_AGAIN - (g1 - g0))
            x = np.concatenate([x[:cut], np.zeros(int(extra * SR), np.float32), x[cut:]])
            for t in toks[i:]:
                t['s'] += extra
                t['e'] += extra
        parts[p] = {'audio': x, 'tokens': toks, 'speech': (toks[0]['s'], toks[-1]['e'])}
        write_wav(WORK / f'part_{p:02d}.wav', x)
        print(f'part {p:2d}: {len(x) / SR:5.2f}s, words {len(toks)}, level {loud[p]:.1f} -> '
              f'{loud[p] + (target - loud[p]) * LEVEL_STRENGTH:.1f} LUFS')

    # Place parts so that the silence between last word and next first word equals the planned gap.
    t, place = LEAD_IN, {}
    for p in sorted(parts):
        s0, e0 = parts[p]['speech']
        place[p] = t - s0
        t = place[p] + e0 + GAP_AFTER.get(p, GAP)
    last = max(parts)
    voice_end = place[last] + parts[last]['speech'][1]
    total = voice_end + CTA_HOLD + END_CARD
    frames = int(round(total * FPS))
    total = frames / FPS
    track = np.zeros(int(total * SR) + SR, np.float32)
    for p, d in parts.items():
        a = int(round(place[p] * SR))
        track[a:a + len(d['audio'])] += d['audio']
    track = track[:int(total * SR)]
    write_wav(EP / 'audio' / 'voice_track.wav', track)

    words, sentences, partlist = [], [], []
    sid = 0
    for p in sorted(parts):
        scene = SCRIPT[p][0]
        start_sentence = True
        for t in parts[p]['tokens']:
            if start_sentence:
                sid += 1
                sentences.append({'id': sid, 'part': p, 'scene': scene, 'words': []})
                start_sentence = False
            w = {'i': len(words), 'text': t['text'], 'keyword': t['keyword'],
                 'start': round(place[p] + t['s'], 3), 'end': round(place[p] + t['e'], 3),
                 'part': p, 'sentence': sid, 'scene': scene}
            words.append(w)
            sentences[-1]['words'].append(w['i'])
            if re.search(r'[.?!:][”"]?$', t['text']):
                start_sentence = True
        partlist.append({'id': p, 'scene': scene, 'text': SCRIPT[p][1].replace('*', ''),
                         'start': round(place[p] + parts[p]['speech'][0], 3),
                         'end': round(place[p] + parts[p]['speech'][1], 3)})
    for s in sentences:
        s['text'] = ' '.join(words[i]['text'] for i in s['words'])
        s['start'], s['end'] = words[s['words'][0]]['start'], words[s['words'][-1]]['end']

    # Scene cuts sit in the middle of the pause between the last part of one scene and the next.
    pmap = {p['id']: p for p in partlist}
    order = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']
    first = {sc: min(p['id'] for p in partlist if p['scene'] == sc) for sc in order}
    lastp = {sc: max(p['id'] for p in partlist if p['scene'] == sc) for sc in order}
    cuts = [0.0]
    for a, b in zip(order, order[1:]):
        cuts.append(round((pmap[lastp[a]]['end'] + pmap[first[b]]['start']) / 2, 3))
    cuts.append(round(total - END_CARD, 3))
    # Elisha keeps the cloak through "But that's not the end."; the mountain arrives on "Centuries later".
    end_word = next(w for w in words if w['part'] == 12 and norm(w['text']) == 'end')
    centuries = next(w for w in words if w['part'] == 12 and norm(w['text']) == 'centuries')
    cuts[order.index('S8')] = round((end_word['end'] + centuries['start']) / 2, 3)
    scenes = [{'id': sc, 'name': SCENE_NAMES[sc], 'start': cuts[k], 'end': cuts[k + 1]} for k, sc in enumerate(order)]
    scenes.append({'id': 'S11', 'name': SCENE_NAMES['S11'], 'start': round(total - END_CARD, 3), 'end': round(total, 3)})

    def word(part, text, nth=0):
        hits = [w for w in words if w['part'] == part and norm(w['text']) == text]
        return hits[nth]

    cues = {
        'enochLabel': word(2, 'enoch')['start'],
        'enochWalksIn': word(2, 'and')['start'],
        'enochTaken': word(2, 'took')['start'],
        'translated': word(3, 'translated')['start'],
        'elijahLabel': word(4, 'elijah')['start'],
        'wrong': word(4, 'wrong')['start'],
        'elishaLabel': word(5, 'elisha')['start'],
        'suddenly': word(6, 'suddenly')['start'],
        'chariotBurst': word(6, 'chariot')['start'],
        'freeze': word(7, 'most')['start'],
        'redX': word(7, 'but')['start'],
        'rewind': word(7, 'again')['end'],
        'asunder': word(8, 'asunder')['start'],
        'between': word(8, 'between')['start'],
        'wentUp': word(9, 'went')['start'],
        'whirlwind': word(9, 'whirlwind')['start'],
        'heaven': word(9, 'heaven')['start'],
        'myFather': word(10, 'my')['start'],
        'sawNoMore': word(10, 'saw')['start'],
        'cloakFloat': word(11, 'only')['start'],
        'cloakLand': round(pmap[11]['end'] + 0.35, 3),
        'notTheEnd': word(12, 'but')['start'],
        'centuries': word(12, 'centuries')['start'],
        'elijahAppeared': word(12, 'appeared')['start'],
        'jesus': word(12, 'jesus')['start'],
        'keyChange': word(13, 'and')['start'],
        'promiseYou': word(13, 'you')['start'],
        'neverDie': word(14, 'never')['start'],
        'cta': word(15, 'if')['start'],
        'question': word(15, 'question')['start'],
        'commentBelow': word(15, 'comment')['start'],
        'endCard': round(total - END_CARD, 3),
    }
    timeline = {
        'fps': FPS, 'durationInSeconds': round(total, 3), 'durationInFrames': frames,
        'leadIn': LEAD_IN, 'voiceEnd': round(voice_end, 3),
        'parts': partlist, 'sentences': sentences, 'words': words, 'scenes': scenes, 'cues': cues,
        'edits': {'cutStart': CUT_START, 'tempo': TEMPO, 'gapDefault': GAP, 'gapAfter': GAP_AFTER,
                  'pauseBeforeReadAgain': PAUSE_BEFORE_READ_AGAIN},
    }
    for path in (EP / 'timeline.json', EP / 'public' / 'timeline.json'):
        path.write_text(json.dumps(timeline, indent=1, ensure_ascii=False) + '\n')
    print(f'voice track {total:.2f}s ({frames} frames), {len(words)} words, {len(sentences)} sentences')
    for sc in scenes:
        print(f"  {sc['id']:4} {sc['start']:6.2f}–{sc['end']:6.2f}  {sc['name']}")


if __name__ == '__main__':
    main()
