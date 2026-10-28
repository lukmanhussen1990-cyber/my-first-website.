"""Build the narration for "Wheat and Weeds": one edge-tts clip per sentence, joined with the brief's pauses.

Voice: no ElevenLabs voice_id was given, so this uses the same voice as the earlier code-voiced reels
("Friend"): edge-tts en-US-AndrewMultilingualNeural (backup en-US-ChristopherNeural), rate -5%, with
WordBoundary events for word timing. Clips are cached in audio/vo/ (mp3 + boundary json), so a rebuild
only calls the service for changed sentences.

Every word is timed by the TTS engine itself and checked against faster-whisper (the two must agree
within 0.15 s on average). Display text and keywords come from the approved script.

Outputs: audio/vo/*.mp3|json, audio/voice_track.wav (48 kHz), timeline.json and public/timeline.json.
Run: python tools/build_voice.py   (needs edge-tts, numpy, faster-whisper; ffmpeg on PATH)
"""
import asyncio
import json
import os
import re
import ssl
import subprocess
from pathlib import Path

import numpy as np

EP = Path(__file__).resolve().parent.parent
VO = EP / 'audio' / 'vo'
SR = 48000
FPS = 30
VOICE = 'en-US-AndrewMultilingualNeural'
BACKUP_VOICE = 'en-US-ChristopherNeural'
RATE = '-5%'

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

LEAD_IN = 0.04            # the voice starts on frame 1
GAP = 0.30                # silence between sentences (last word end -> next first word)
GAP_AFTER = {'07': 0.60,   # after "God didn't plant the evil"
             '08': 0.80,   # before "But notice"
             '11b': 0.80,  # after "who would be left?"
             '15': 0.60}   # before the last line
CTA_HOLD = 2.60           # the comment box keeps typing after "Yes, or not yet?"
END_CARD = 3.00


def plain(text):
    return text.replace('*', '')


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'")).strip("'")


def tokens(text):
    return [{'text': tok.replace('*', ''), 'keyword': '*' in tok} for tok in text.split()]


async def synth(text, voice, mp3, js):
    import edge_tts
    import edge_tts.communicate as ec
    # The session proxy re-terminates TLS, so trust its CA bundle (falls back to the default store).
    ca = '/root/.ccr/ca-bundle.crt'
    if os.path.exists(ca):
        ec._SSL_CTX = ssl.create_default_context(cafile=ca)
    c = edge_tts.Communicate(text, voice, rate=RATE, boundary='WordBoundary', proxy=os.environ.get('HTTPS_PROXY'))
    audio, words = bytearray(), []
    async for ch in c.stream():
        if ch['type'] == 'audio':
            audio += ch['data']
        elif ch['type'] == 'WordBoundary':
            words.append({'text': ch['text'], 'start': ch['offset'] / 1e7, 'dur': ch['duration'] / 1e7})
    mp3.write_bytes(bytes(audio))
    js.write_text(json.dumps({'text': text, 'voice': voice, 'rate': RATE, 'words': words}, indent=1, ensure_ascii=False) + '\n')


def get_clip(sid, text):
    mp3, js = VO / f's{sid}.mp3', VO / f's{sid}.json'
    if not (mp3.exists() and js.exists() and json.loads(js.read_text())['text'] == text):
        for attempt in range(4):
            try:
                asyncio.run(synth(text, VOICE if attempt < 3 else BACKUP_VOICE, mp3, js))
                break
            except Exception as e:  # network hiccup: retry, then the backup voice
                print(f'  {sid}: attempt {attempt + 1} failed: {e}')
        else:
            raise SystemExit(f'could not synthesize sentence {sid}')
    meta = json.loads(js.read_text())
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                                     check=True, capture_output=True).stdout, dtype=np.float32).copy()
    return x, meta


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'pcm_s24le', str(path)], input=y.astype(np.float32).tobytes(), check=True)


def align(toks, bounds, sid):
    """Give each script token the time of its WordBoundary word (punctuation-only tokens are merged)."""
    bw = [b for b in bounds if norm(b['text'])]
    out, j = [], 0
    for t in toks:
        n = norm(t['text'])
        if not n:
            continue
        # a boundary word can cover several tokens ("twelve." is one) or one token can span two
        # boundary words (rare); match greedily on the normalized letters
        acc, k = '', j
        while k < len(bw) and len(acc) < len(n):
            acc += norm(bw[k]['text'])
            k += 1
        assert acc == n, f'{sid}: script word {t["text"]!r} vs TTS {[b["text"] for b in bw[j:k]]}'
        out.append({**t, 's': bw[j]['start'], 'e': bw[k - 1]['start'] + bw[k - 1]['dur']})
        j = k
    assert j == len(bw), f'{sid}: TTS words left over: {[b["text"] for b in bw[j:]]}'
    return out


def speech_bounds(x, thresh_db=-50.0):
    hop = SR // 200
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    on = np.nonzero(20 * np.log10(rms) > thresh_db)[0]
    return on[0] * hop / SR, (on[-1] + 1) * hop / SR


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
    VO.mkdir(parents=True, exist_ok=True)
    clips = {}
    for sid, line, scene, text in SENTENCES:
        x, meta = get_clip(sid, plain(text))
        toks = align(tokens(text), meta['words'], sid)
        # Trim the clip to its speech, keeping a short breath of room on each side.
        s, e = speech_bounds(x)
        s = min(s, toks[0]['s'])
        e = max(e, toks[-1]['e'])
        a, b = max(0, int((s - 0.03) * SR)), min(len(x), int((e + 0.10) * SR))
        x = x[a:b].copy()
        fi, fo = int(0.006 * SR), int(0.03 * SR)
        x[:fi] *= np.linspace(0, 1, fi)
        x[-fo:] *= np.linspace(1, 0, fo)
        for t in toks:
            t['s'] -= a / SR
            t['e'] -= a / SR
        speech = (max(0.0, s - a / SR), e - a / SR)
        clips[sid] = {'audio': x, 'tokens': toks, 'speech': speech, 'line': line, 'scene': scene, 'text': text,
                      'voice': meta['voice']}
        print(f'{sid:>3}: {len(x) / SR:5.2f}s  {plain(text)}')

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
        a = int(round(place[sid] * SR))
        track[a:a + len(c['audio'])] += c['audio']
    track = track[:int(total * SR)]
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
        'voice': {'engine': 'edge-tts', 'voice': sorted({c['voice'] for c in clips.values()}), 'rate': RATE},
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
