"""Build the narration for "Friend": one edge-tts clip per sentence, joined with the brief's pauses.

Voice: no ELEVENLABS_API_KEY is set and no earlier voice is saved in the project, so this uses the
brief's free fallback, edge-tts en-US-AndrewMultilingualNeural (backup en-US-ChristopherNeural),
rate -5%, with WordBoundary events for word timing. Clips are cached in audio/vo/ (mp3 + boundary
json), so a rebuild only calls the service for changed sentences.

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
# (id, line, scene, text). Lines 11 and 12 are split where the brief puts its long pauses.
SENTENCES = [
    ('01a', 1, 'S1', 'Judas betrayed Jesus with a *kiss*.'),
    ('01b', 1, 'S1', 'Jesus answered with one *word*.'),
    ('02', 2, 'S2', 'But first, go back a few hours.'),
    ('03', 3, 'S3', 'That night, Jesus took a towel, knelt down, and washed His disciples’ *feet*.'),
    ('04a', 4, 'S4', 'All twelve.'),
    ('04b', 4, 'S4', 'Including *Judas*.'),
    ('05', 5, 'S5', 'And Jesus already knew: “For he knew who should *betray* him.”'),
    ('06', 6, 'S6', 'Judas had sold Him for “thirty pieces of *silver*.”'),
    ('07', 7, 'S7', 'But notice: in the Law, thirty shekels of silver was the price of a *slave*.'),
    ('08', 8, 'S8', 'That’s what Jesus was worth to him.'),
    ('09', 9, 'S9', 'Later that night, in a garden, Judas came with a crowd, torches and swords.'),
    ('10', 10, 'S10', 'He walked up… “Hail, master”… and *kissed* him.'),
    ('11a', 11, 'S11', 'And Jesus said:'),
    ('11b', 11, 'S11', '“*Friend*, wherefore art thou come?”'),
    ('12a', 12, 'S11', '*Friend*.'),
    ('12b', 12, 'S11', 'To the man betraying Him.'),
    ('13a', 13, 'S12', 'That’s who Jesus is.'),
    ('13b', 13, 'S12', 'He washes the feet of people who hurt Him.'),
    ('14', 14, 'S13', '“When we were *enemies*, we were reconciled to God by the death of his Son.”'),
    ('15a', 15, 'S14', 'They called Him “a friend of publicans and *sinners*.”'),
    ('15b', 15, 'S14', 'They were *right*.'),
    ('16a', 16, 'S15', 'Could you wash the feet of someone who betrayed you?'),
    ('16b', 16, 'S15', 'Yes or no?'),
]
SCENE_NAMES = {
    'S1': 'Hook: the kiss', 'S2': 'Rewind', 'S3': 'The towel', 'S4': 'Twelve', 'S5': 'Judas',
    'S6': 'The deal', 'S7': 'But notice', 'S8': 'Worth', 'S9': 'The garden', 'S10': 'The kiss',
    'S11': 'Friend', 'S12': 'The same night', 'S13': 'Enemies', 'S14': 'Friend of sinners',
    'S15': 'Call to action', 'S16': 'End card',
}

LEAD_IN = 0.25            # the reel opens mid-moment: the voice starts almost at once
GAP = 0.30                # silence between sentences (last word end -> next first word)
GAP_AFTER = {'04b': 0.60,  # after "Including Judas"
             '06': 0.80,   # before "But notice"
             '08': 1.00,   # S8 "near silence": the spinning coin falls flat before the garden
             '11a': 1.00,  # silence before "Friend, wherefore art thou come?"
             '12b': 0.70}  # after "To the man betraying Him"
CTA_HOLD = 2.20           # the comment box keeps typing after "Yes or no?"
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
    order = [f'S{i}' for i in range(1, 16)]
    first = {sc: next(s for s in sentences if s['scene'] == sc) for sc in order}
    lasts = {sc: [s for s in sentences if s['scene'] == sc][-1] for sc in order}
    cuts = [0.0] + [round((lasts[a]['end'] + first[b]['start']) / 2, 3) for a, b in zip(order, order[1:])]
    cuts.append(round(total - END_CARD, 3))
    scenes = [{'id': sc, 'name': SCENE_NAMES[sc], 'start': cuts[k], 'end': cuts[k + 1]} for k, sc in enumerate(order)]
    scenes.append({'id': 'S16', 'name': SCENE_NAMES['S16'], 'start': round(total - END_CARD, 3), 'end': round(total, 3)})

    def word(sid, text, nth=0):
        hits = [w for w in words if w['sid'] == sid and norm(w['text']) == text]
        return hits[nth]

    sent = {s['sid']: s for s in sentences}
    cues = {
        'kiss': word('01a', 'kiss')['start'],
        'answered': word('01b', 'answered')['start'],
        'oneWord': word('01b', 'word')['start'],
        'butFirst': word('02', 'but')['start'],
        'goBack': word('02', 'go')['start'],
        'fewHours': word('02', 'few')['start'],
        'thatNight': word('03', 'that')['start'],
        'towel': word('03', 'towel')['start'],
        'knelt': word('03', 'knelt')['start'],
        'washed': word('03', 'washed')['start'],
        'feet': word('03', 'feet')['start'],
        'allTwelve': word('04a', 'all')['start'],
        'including': word('04b', 'including')['start'],
        'judasFeet': word('04b', 'judas')['start'],
        'alreadyKnew': word('05', 'already')['start'],
        'forHeKnew': word('05', 'for')['start'],
        'betray': word('05', 'betray')['start'],
        'sold': word('06', 'sold')['start'],
        'thirty': word('06', 'thirty')['start'],
        'silver': word('06', 'silver')['start'],
        'butNotice': word('07', 'but')['start'],
        'theLaw': word('07', 'law')['start'],
        'shekels': word('07', 'shekels')['start'],
        'price': word('07', 'price')['start'],
        'slave': word('07', 'slave')['start'],
        'worth': word('08', 'worth')['start'],
        'worthEnd': sent['08']['end'],
        'laterThatNight': word('09', 'later')['start'],
        'garden': word('09', 'garden')['start'],
        'crowd': word('09', 'crowd')['start'],
        'torches': word('09', 'torches')['start'],
        'swords': word('09', 'swords')['start'],
        'walkedUp': word('10', 'walked')['start'],
        'hail': word('10', 'hail')['start'],
        'kissed': word('10', 'kissed')['start'],
        'jesusSaid': word('11a', 'and')['start'],
        'silence': sent['11a']['end'],
        'friend1': word('11b', 'friend')['start'],
        'wherefore': word('11b', 'wherefore')['start'],
        'friend2': word('12a', 'friend')['start'],
        'toTheMan': word('12b', 'to')['start'],
        'keyChange': word('13a', "that's")['start'],
        'washesFeet': word('13b', 'washes')['start'],
        'hurt': word('13b', 'hurt')['start'],
        'enemies': word('14', 'enemies')['start'],
        'reconciled': word('14', 'reconciled')['start'],
        'deathOfHisSon': word('14', 'death')['start'],
        'theyCalled': word('15a', 'they')['start'],
        'sinners': word('15a', 'sinners')['start'],
        'theyWereRight': word('15b', 'they')['start'],
        'right': word('15b', 'right')['start'],
        'cta': word('16a', 'could')['start'],
        'yesOrNo': word('16b', 'yes')['start'],
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
