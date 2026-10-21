"""Make one voice file per script line, plus word timings for the subtitles.

    python3 tools/make_voices.py [--engine auto|elevenlabs|local]

auto        ElevenLabs if a key is available and every line succeeds, else local for ALL lines.
elevenlabs  ElevenLabs only (fails loudly if it can't).
local       Kokoro TTS (falls back to Piper, then espeak-ng) + word timings from faster-whisper.

Writes voices/<id>.wav (48 kHz mono) and voices/timings.json.
Word times in timings.json are relative to the start of each line's file.
"""
import argparse
import base64
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VOICES_DIR = os.path.join(ROOT, 'voices')
SR = 48000
KOKORO_DIRS = [os.path.join(ROOT, 'models'), os.environ.get('KOKORO_DIR', '')]
KOKORO_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'


def log(msg):
    print(f'[voices] {msg}', flush=True)


def load_json(name):
    with open(os.path.join(ROOT, name)) as f:
        return json.load(f)


def script_words(text):
    return text.split()


# ----------------------------------------------------------------------------- audio utils
def to_sr(audio, sr):
    if sr == SR:
        return audio.astype(np.float32)
    g = np.gcd(SR, sr)
    return resample_poly(audio, SR // g, sr // g).astype(np.float32)


def trim_silence(audio, keep=0.04, thresh_db=-42.0):
    """Cut leading/trailing silence, keeping `keep` seconds. Returns (audio, offset_seconds)."""
    hop = int(0.01 * SR)
    frames = len(audio) // hop
    if frames == 0:
        return audio, 0.0
    rms = np.sqrt(np.mean(audio[:frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms / (rms.max() + 1e-12))
    loud = np.where(db > thresh_db)[0]
    if len(loud) == 0:
        return audio, 0.0
    a = max(0, loud[0] * hop - int(keep * SR))
    b = min(len(audio), (loud[-1] + 1) * hop + int(keep * SR))
    out = audio[a:b].copy()
    fade = int(0.006 * SR)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out, a / SR


def ffmpeg_decode(data, suffix='.mp3'):
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, 'in' + suffix)
        dst = os.path.join(d, 'out.wav')
        with open(src, 'wb') as f:
            f.write(data)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', str(SR), dst], check=True)
        audio, _ = sf.read(dst, dtype='float32')
    return audio


# ----------------------------------------------------------------------------- ElevenLabs
def find_api_key():
    key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    if key:
        return key
    for path in (os.path.join(ROOT, '.env'), os.path.join(ROOT, '..', '.env')):
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    m = re.match(r'\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["\']?([^"\'\s]+)', line)
                    if m:
                        return m.group(1)
    return ''


def elevenlabs_line(key, text, cfg):
    """Returns (audio@48k, words) using the with-timestamps endpoint. Tries the fallback voice on 4xx."""
    last_err = None
    for voice_id in (cfg['voice_id'], cfg.get('fallback_voice_id')):
        if not voice_id:
            continue
        body = json.dumps({'text': text, 'model_id': cfg['model_id'], 'voice_settings': cfg.get('voice_settings', {})}).encode()
        req = urllib.request.Request(
            f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128',
            data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                res = json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors='replace')[:300]
            last_err = f'HTTP {e.code} for voice {voice_id}: {detail}'
            log(last_err)
            if e.code in (401, 402, 429) or 'quota' in detail.lower() or 'credits' in detail.lower():
                break  # no point trying another voice
            continue
        audio = ffmpeg_decode(base64.b64decode(res['audio_base64']))
        align = res.get('alignment') or res.get('normalized_alignment')
        words = words_from_char_alignment(text, align)
        return audio, words, voice_id
    raise RuntimeError(last_err or 'ElevenLabs failed')


def words_from_char_alignment(text, align):
    chars = align['characters']
    starts = align['character_start_times_seconds']
    ends = align['character_end_times_seconds']
    aligned = ''.join(chars)
    # map each text char index -> alignment char index (they are normally identical)
    sm = difflib.SequenceMatcher(None, text, aligned, autojunk=False)
    m = {}
    for a, b, size in sm.get_matching_blocks():
        for k in range(size):
            m[a + k] = b + k
    words = []
    for match in re.finditer(r'\S+', text):
        idx = [m[i] for i in range(match.start(), match.end()) if i in m]
        if idx:
            words.append({'text': match.group(), 'start': float(starts[idx[0]]), 'end': float(ends[idx[-1]])})
        else:
            words.append({'text': match.group(), 'start': None, 'end': None})
    fill_missing(words)
    return words


# ----------------------------------------------------------------------------- local TTS
_kokoro = None


def kokoro():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        for d in KOKORO_DIRS:
            if d and os.path.exists(os.path.join(d, 'kokoro-v1.0.onnx')) and os.path.exists(os.path.join(d, 'voices-v1.0.bin')):
                _kokoro = Kokoro(os.path.join(d, 'kokoro-v1.0.onnx'), os.path.join(d, 'voices-v1.0.bin'))
                break
        else:
            d = os.path.join(ROOT, 'models')
            os.makedirs(d, exist_ok=True)
            for name in ('kokoro-v1.0.onnx', 'voices-v1.0.bin'):
                log(f'downloading {name} ...')
                subprocess.run(['curl', '-sSL', '-o', os.path.join(d, name), KOKORO_URL + name], check=True)
            _kokoro = Kokoro(os.path.join(d, 'kokoro-v1.0.onnx'), os.path.join(d, 'voices-v1.0.bin'))
    return _kokoro


def tts_kokoro(text, voice, speed):
    audio, sr = kokoro().create(text, voice=voice, speed=speed, lang='en-us')
    return to_sr(np.asarray(audio, dtype=np.float32), sr)


def tts_piper(text, model):
    d = os.path.join(ROOT, 'models')
    os.makedirs(d, exist_ok=True)
    onnx = os.path.join(d, model + '.onnx')
    if not os.path.exists(onnx):
        lang, name, q = model.split('-')[0], model.split('-')[1], model.split('-')[2]
        base = f'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/{lang}/{name}/{q}/{model}'
        for ext in ('.onnx', '.onnx.json'):
            subprocess.run(['curl', '-sSL', '-o', os.path.join(d, model + ext), base + ext], check=True)
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, 'p.wav')
        subprocess.run([sys.executable, '-m', 'piper', '-m', onnx, '-f', out], input=text.encode(), check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        audio, sr = sf.read(out, dtype='float32')
    return to_sr(audio, sr)


def tts_espeak(text, voice, speed):
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, 'e.wav')
        subprocess.run(['espeak-ng', '-v', voice, '-s', str(int(165 * speed)), '-w', out, text], check=True)
        audio, sr = sf.read(out, dtype='float32')
    return to_sr(audio, sr)


def tts_local(text, cfg, speed):
    for engine in ('kokoro', 'piper', 'espeak'):
        try:
            if engine == 'kokoro':
                return tts_kokoro(text, cfg['kokoro_voice'], speed), 'kokoro:' + cfg['kokoro_voice']
            if engine == 'piper':
                return tts_piper(text, cfg['piper_model']), 'piper:' + cfg['piper_model']
            return tts_espeak(text, cfg['espeak_voice'], speed), 'espeak-ng:' + cfg['espeak_voice']
        except Exception as e:  # noqa: BLE001 - try the next engine
            log(f'{engine} failed ({e}); trying next local engine')
    raise RuntimeError('no local TTS engine worked')


def sox(audio, *effects):
    with tempfile.TemporaryDirectory() as tmp:
        a, b = os.path.join(tmp, 'a.wav'), os.path.join(tmp, 'b.wav')
        sf.write(a, audio, SR)
        subprocess.run(['sox', a, b, *effects], check=True)
        out, _ = sf.read(b, dtype='float32')
    return out


def old_man_fx(audio, cfg):
    """Lower, slower, shaky: pitch down, tempo down, wobbling pitch (vibrato) and level (tremolo), softer top end."""
    cents = int(cfg.get('pitch_semitones', -2.0) * 100)
    out = sox(audio, 'pitch', str(cents), 'tempo', '-s', str(cfg.get('tempo', 0.85)),
              'lowpass', '5200', 'highpass', '110', 'bass', '+2', '220')
    n = len(out)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    # slow random wander on top of the regular shake makes it sound less mechanical
    wander = np.interp(t, np.linspace(0, t[-1], 12), rng.uniform(-1, 1, 12))
    vib = cfg.get('vibrato_depth', 0.18) * (np.sin(2 * np.pi * cfg.get('vibrato_hz', 5.5) * t) + 0.35 * wander)
    # vibrato = time-varying fractional delay (depth in ms)
    delay = (2.0 + vib * 2.5) * SR / 1000.0
    idx = np.clip(np.arange(n) - delay, 0, n - 1)
    out = np.interp(idx, np.arange(n), out).astype(np.float32)
    trem = 1 - cfg.get('tremolo_depth', 0.25) * 0.5 * (1 + np.sin(2 * np.pi * cfg.get('tremolo_hz', 6.0) * t + 0.7 * wander))
    out = out * trem
    # a little breathy air
    air = rng.standard_normal(n).astype(np.float32)
    air = sox(air * 0.02, 'highpass', '2500', 'lowpass', '7000')[:n]
    env = np.abs(out)
    env = np.convolve(env, np.ones(480) / 480, mode='same')
    out = out + air * env * 6
    return (out / (np.abs(out).max() + 1e-9) * 0.89).astype(np.float32)


def synth_john_local(text, cfg, speed):
    """Synthesise around the '...' separately so the old man really pauses there.
    Returns (audio, engine, parts) where parts = [(text, start_s, end_s)] in the returned audio."""
    texts = [p.strip() for p in re.split(r'(?<=\.\.\.)\s*', text) if p.strip()]
    chunks, bounds, pos = [], [], 0
    engine = ''
    for i, p in enumerate(texts):
        a, engine = tts_local(p, cfg, speed)
        a, _ = trim_silence(a, keep=0.02)
        chunks.append(a)
        bounds.append((pos, pos + len(a)))
        pos += len(a)
        if i < len(texts) - 1:
            gap = np.zeros(int(cfg.get('pause_after_ellipsis', 0.5) * SR * cfg.get('tempo', 0.85)), np.float32)
            chunks.append(gap)
            pos += len(gap)
    audio = np.concatenate(chunks)
    n_in = len(audio)
    if cfg.get('old_man_fx'):
        audio = old_man_fx(audio, cfg)
    k = len(audio) / n_in / SR
    parts = [(t, b0 * k, b1 * k) for t, (b0, b1) in zip(texts, bounds)]
    return audio, engine, parts


# ----------------------------------------------------------------------------- word timings from audio
_whisper = None


def whisper_words(audio):
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(os.environ.get('WHISPER_MODEL', 'small.en'), device='cpu', compute_type='int8')
    a16 = resample_poly(audio, 1, 3).astype(np.float32)  # 48k -> 16k
    segs, _ = _whisper.transcribe(a16, language='en', word_timestamps=True, condition_on_previous_text=False,
                                  beam_size=5)
    dur = len(audio) / SR
    words = []
    for s in segs:
        for w in s.words or []:
            if w.start < dur - 0.05:
                words.append({'text': w.word.strip(), 'start': float(w.start), 'end': float(min(w.end, dur))})
    return words


def norm(w):
    w = w.lower().replace('’', "'")
    w = re.sub(r"[^a-z0-9']+", '', w)
    return w


def align_words(script, recognised, lo=0.0, hi=None):
    """Monotonic DP alignment of script words to recognised words.
    Handles one script word heard as two ("tunnel-boring" -> "tunnel" "boring").
    Unmatched script words share the time of unmatched recognised words ("21,000" -> "twenty-one thousand")."""
    S = [norm(w) for w in script]
    R = [norm(w['text']) for w in recognised]
    n, m = len(S), len(R)

    def sim(a, b):
        if not a or not b:
            return 0.0
        return difflib.SequenceMatcher(None, a, b).ratio()

    def gain(s):
        return s * 2 - 1 if s > 0.5 else -1.0

    gap = -0.4
    score = np.full((n + 1, m + 1), -1e9)
    back = np.zeros((n + 1, m + 1), dtype=int)
    score[0, 0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if i == 0 and j == 0:
                continue
            opts = []
            if i and j:
                opts.append((score[i - 1, j - 1] + gain(sim(S[i - 1], R[j - 1])), 0))
            if i:
                opts.append((score[i - 1, j] + gap, 1))
            if j:
                opts.append((score[i, j - 1] + gap, 2))
            if i and j >= 2:
                opts.append((score[i - 1, j - 2] + gain(sim(S[i - 1], R[j - 2] + R[j - 1])) + 0.05, 3))
            score[i, j], back[i, j] = max(opts)
    pairs = {}  # script index -> (first rec, last rec)
    i, j = n, m
    while i > 0 or j > 0:
        k = back[i, j]
        if k == 0:
            if sim(S[i - 1], R[j - 1]) > 0.5:
                pairs[i - 1] = (j - 1, j - 1)
            i, j = i - 1, j - 1
        elif k == 1:
            i -= 1
        elif k == 2:
            j -= 1
        else:
            if sim(S[i - 1], R[j - 2] + R[j - 1]) > 0.5:
                pairs[i - 1] = (j - 2, j - 1)
            i, j = i - 1, j - 2
    out = []
    for i, w in enumerate(script):
        if i in pairs:
            a, b = pairs[i]
            out.append({'text': w, 'start': recognised[a]['start'], 'end': recognised[b]['end']})
        else:
            out.append({'text': w, 'start': None, 'end': None})
    used = {k for a, b in pairs.values() for k in range(a, b + 1)}
    hi = hi if hi is not None else (recognised[-1]['end'] if recognised else lo + 0.3 * n)
    i = 0
    while i < len(out):
        if out[i]['start'] is not None:
            i += 1
            continue
        j = i
        while j < len(out) and out[j]['start'] is None:
            j += 1
        lo_r = pairs[i - 1][1] + 1 if i > 0 else 0
        hi_r = pairs[j][0] if j < len(out) else len(recognised)
        spare = [recognised[k] for k in range(lo_r, hi_r) if k not in used]
        if len(spare) == j - i:
            for k, r in zip(range(i, j), spare):
                out[k]['start'], out[k]['end'] = r['start'], r['end']
            i = j
            continue
        if spare:
            t0, t1 = spare[0]['start'], spare[-1]['end']
        else:
            t0 = out[i - 1]['end'] if i > 0 else lo
            t1 = out[j]['start'] if j < len(out) else hi
        lens = np.array([max(1, len(norm(out[k]['text']))) for k in range(i, j)], dtype=float)
        edges = t0 + (t1 - t0) * np.concatenate([[0], np.cumsum(lens) / lens.sum()])
        for n_, k in enumerate(range(i, j)):
            out[k]['start'], out[k]['end'] = float(edges[n_]), float(edges[n_ + 1])
        i = j
    return out


def snap_to_onsets(words, audio, thresh_db=-38.0):
    """If whisper put a word start inside a silent gap, move it to where the sound actually begins."""
    hop = int(0.005 * SR)
    frames = len(audio) // hop
    rms = np.sqrt(np.mean(audio[:frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms / (rms.max() + 1e-12))
    for w in words:
        f0 = int(w['start'] * SR / hop)
        f1 = int(w['end'] * SR / hop)
        if f0 >= frames:
            continue
        if db[f0:min(f0 + 6, frames)].max() < thresh_db:
            loud = np.where(db[f0:min(f1, frames)] > thresh_db)[0]
            if len(loud):
                w['start'] = (f0 + loud[0]) * hop / SR - 0.01
    return words


def fill_missing(words):
    known = [i for i, w in enumerate(words) if w['start'] is not None]
    for i, w in enumerate(words):
        if w['start'] is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            t0 = words[prev]['end'] if prev is not None else 0.0
            t1 = words[nxt]['start'] if nxt is not None else t0 + 0.3
            w['start'], w['end'] = t0, max(t0 + 0.05, t1)


def tidy(words, duration):
    """Monotonic, non-overlapping, inside the file."""
    last = 0.0
    for w in words:
        w['start'] = round(float(np.clip(max(w['start'], last), 0, duration)), 3)
        w['end'] = round(float(np.clip(max(w['end'], w['start'] + 0.04), 0, duration)), 3)
        last = w['start'] + 0.02
    return words


# ----------------------------------------------------------------------------- main
def make_local(line, vcfg, window):
    cfg = dict(vcfg['local'])
    speed = cfg.get('speed', 1.0)
    for attempt in range(8):
        if line['speaker'] == 'john':
            audio, engine, parts = synth_john_local(line['text'], cfg, speed)
        else:
            audio, engine = tts_local(line['text'], cfg, speed)
            parts = [(line['text'], 0.0, len(audio) / SR)]
        audio, off = trim_silence(audio)
        dur = len(audio) / SR
        parts = [(t, max(0.0, a - off), min(dur, b - off)) for t, a, b in parts]
        if dur <= window - 0.05 or attempt == 7:
            break
        if line['speaker'] == 'john' and cfg.get('pause_after_ellipsis', 0) > 0.36:
            # keep the old man slow: shorten his dramatic pause before speeding him up
            cfg['pause_after_ellipsis'] = max(0.35, cfg['pause_after_ellipsis'] - (dur - window + 0.1))
            log(f'{line["id"]}: {dur:.2f}s is longer than its {window:.2f}s window, pause -> {cfg["pause_after_ellipsis"]:.2f}s')
            continue
        speed = min(1.45, speed * min(1.12, (dur / (window - 0.1)) * 1.01))
        log(f'{line["id"]}: {dur:.2f}s is longer than its {window:.2f}s window, re-synthesising at speed {speed:.2f}')
    words = []
    for i, (text, a, b) in enumerate(parts):
        # pad each phrase a little so whisper hears the word edges
        a0 = max(0.0, a - 0.05) if i else 0.0
        b0 = min(dur, b + 0.1) if i < len(parts) - 1 else dur
        seg = audio[int(a0 * SR):int(b0 * SR)]
        rec = [dict(w, start=w['start'] + a0, end=w['end'] + a0) for w in whisper_words(seg)]
        words += align_words(script_words(text), rec, lo=a0, hi=b0)
    words = snap_to_onsets(words, audio)
    return audio, tidy(words, dur), engine, speed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', choices=['auto', 'elevenlabs', 'local'], default='auto')
    args = ap.parse_args()
    script = load_json('script.json')
    timeline = load_json('timeline.json')
    os.makedirs(VOICES_DIR, exist_ok=True)

    results = {}
    engine_used = 'local'
    if args.engine in ('auto', 'elevenlabs'):
        key = find_api_key()
        if not key:
            msg = 'No ELEVENLABS_API_KEY found (env or .env).'
            if args.engine == 'elevenlabs':
                sys.exit(f'[voices] ERROR: {msg}')
            log('!' * 70)
            log(f'{msg} Using the LOCAL voices for every line.')
            log('!' * 70)
        else:
            try:
                for line in script['lines']:
                    vcfg = script['voices'][line['speaker']]['elevenlabs']
                    log(f'ElevenLabs: {line["id"]} ...')
                    audio, words, voice_id = elevenlabs_line(key, line['text'], vcfg)
                    audio, off = trim_silence(audio)
                    dur = len(audio) / SR
                    for w in words:
                        w['start'] -= off
                        w['end'] -= off
                    results[line['id']] = (audio, tidy(words, dur), f'elevenlabs:{vcfg["model_id"]}:{voice_id}', 1.0)
                engine_used = 'elevenlabs'
            except Exception as e:  # noqa: BLE001
                if args.engine == 'elevenlabs':
                    sys.exit(f'[voices] ERROR: ElevenLabs failed: {e}')
                log('!' * 70)
                log(f'ElevenLabs failed ({e}). Using the LOCAL voices for every line.')
                log('!' * 70)
                results = {}

    if not results:
        for line in script['lines']:
            w = timeline['voice_windows'][line['id']]
            window = w['latest_end'] - w['cue']
            vcfg = script['voices'][line['speaker']]
            log(f'local: {line["id"]} ...')
            results[line['id']] = make_local(line, vcfg, window)

    timings = {'engine': engine_used, 'sample_rate': SR, 'lines': {}}
    for line in script['lines']:
        audio, words, engine, speed = results[line['id']]
        peak = np.abs(audio).max()
        if peak > 0:
            audio = audio / peak * 0.89
        path = os.path.join(VOICES_DIR, f'{line["id"]}.wav')
        sf.write(path, audio, SR, subtype='PCM_16')
        dur = len(audio) / SR
        timings['lines'][line['id']] = {'speaker': line['speaker'], 'text': line['text'], 'file': f'voices/{line["id"]}.wav',
                                        'duration': round(dur, 3), 'engine': engine, 'speed': round(speed, 3), 'words': words}
        log(f'{line["id"]}: {dur:.2f}s  [{engine}]')
    with open(os.path.join(VOICES_DIR, 'timings.json'), 'w') as f:
        json.dump(timings, f, indent=2)
    log(f'wrote {len(script["lines"])} voice files + voices/timings.json (engine: {engine_used})')


if __name__ == '__main__':
    main()
