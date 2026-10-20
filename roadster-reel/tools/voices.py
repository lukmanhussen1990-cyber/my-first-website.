#!/usr/bin/env python3
"""Generate one audio file per script line + exact word timings.

  python tools/voices.py                 # auto: ElevenLabs if a key is available, otherwise Piper
  python tools/voices.py --engine elevenlabs   (fails over to Piper on any error unless --strict)
  python tools/voices.py --engine piper

Outputs (voices/):
  lineNN_<speaker>.wav   48 kHz mono, trimmed, loudness-matched (-20 LUFS)
  timings.json           word start/end times (seconds, relative to each file)
  john_mouth.json        mouth-open envelope for the 3D lip movement
  engine.txt             which engine produced the files
The ElevenLabs key is read from ELEVENLABS_API_KEY or from a .env file
(roadster-reel/.env or the repository root .env).
"""
import argparse, base64, json, os, re, subprocess, sys, tempfile, urllib.request, urllib.error
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'voices')
SR = 48000
PIPER_DIR = os.environ.get('PIPER_VOICES', '/home/user/piper-voices')


def load_key():
    k = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    if k:
        return k
    for p in [os.path.join(ROOT, '.env'), os.path.join(os.path.dirname(ROOT), '.env')]:
        if os.path.exists(p):
            for line in open(p):
                m = re.match(r'\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["\']?([^"\'\s#]+)', line)
                if m:
                    return m.group(1)
    return None


def words_of(text):
    """Script words exactly as written (punctuation kept) with char offsets."""
    return [(m.group(0), m.start(), m.end()) for m in re.finditer(r'\S+', text)]


def resample(x, sr_in, sr_out=SR):
    if sr_in == sr_out:
        return x.astype(np.float32)
    from scipy.signal import resample_poly
    from math import gcd
    g = gcd(sr_in, sr_out)
    return resample_poly(x, sr_out // g, sr_in // g).astype(np.float32)


def trim(x, sr, words, pad=0.04, thr_db=-45):
    env = np.abs(x)
    thr = 10 ** (thr_db / 20) * max(1e-6, env.max())
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x, words
    a = max(0, idx[0] - int(pad * sr)); b = min(len(x), idx[-1] + int(pad * sr))
    off = a / sr
    return x[a:b], [dict(w, start=max(0.0, w['start'] - off), end=max(0.0, w['end'] - off)) for w in words]


def loudness_match(x, sr, target=-20.0):
    try:
        import pyloudnorm as pyln
        meter = pyln.Meter(sr)
        l = meter.integrated_loudness(x)
        if np.isfinite(l):
            x = x * (10 ** ((target - l) / 20))
    except Exception:
        x = x / max(1e-6, np.abs(x).max()) * 0.5
    peak = np.abs(x).max()
    if peak > 0.97:
        x = x * (0.97 / peak)
    return x.astype(np.float32)


# ---------------------------------------------------------------- ElevenLabs
class ElevenLabsError(Exception):
    pass


def el_request(key, method, path, body=None):
    url = 'https://api.elevenlabs.io' + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise ElevenLabsError(f'{e.code} {e.read().decode(errors="replace")[:300]}')
    except Exception as e:
        raise ElevenLabsError(str(e))


def el_pick_voice(key, cfg):
    vid = cfg['voice_id']
    try:
        el_request(key, 'GET', f'/v1/voices/{vid}')
        return vid
    except ElevenLabsError:
        try:
            voices = el_request(key, 'GET', '/v1/voices').get('voices', [])
        except ElevenLabsError:
            return vid   # key without voices_read permission: use the configured id as is
        for v in voices:
            if v.get('name', '').lower().startswith(cfg.get('voice_name', '').lower()):
                return v['voice_id']
        if voices:
            return voices[0]['voice_id']
        raise ElevenLabsError('no voices available on this account')


def el_synth(key, text, cfg, voice_id):
    body = {'text': text, 'model_id': cfg.get('model_id', 'eleven_multilingual_v2'), 'voice_settings': cfg.get('voice_settings', {})}
    res = el_request(key, 'POST', f'/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128', body)
    audio = base64.b64decode(res['audio_base64'])
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as f:
        f.write(audio); mp3 = f.name
    wav = mp3 + '.wav'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', str(SR), wav], check=True)
    x, sr = sf.read(wav, dtype='float32'); os.remove(mp3); os.remove(wav)
    al = res.get('alignment') or res.get('normalized_alignment')
    chars, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
    # map characters back onto the script text
    words = []
    if ''.join(chars) == text:
        for w, a, b in words_of(text):
            words.append({'word': w, 'start': float(st[a]), 'end': float(en[b - 1])})
    else:
        # fallback: align character sequence greedily
        pos = 0; joined = ''.join(chars)
        for w, a, b in words_of(text):
            core = re.sub(r'[^\w\']', '', w)
            j = joined.find(core[:1], pos) if core else pos
            j = max(j, pos); k = min(len(chars) - 1, j + max(1, len(core)) - 1)
            words.append({'word': w, 'start': float(st[j]), 'end': float(en[k])}); pos = k + 1
    return x, sr, words


# ---------------------------------------------------------------- Piper
_piper_cache = {}


def piper_voice(model):
    from piper import PiperVoice
    if model not in _piper_cache:
        path = os.path.join(PIPER_DIR, model + '.onnx')
        if not os.path.exists(path):
            raise FileNotFoundError(f'Piper model not found: {path}')
        _piper_cache[model] = PiperVoice.load(path, include_alignments=True)
    return _piper_cache[model]


def groups_of(phonemes):
    """split a phoneme list into word groups (space separated), skipping punctuation-only groups"""
    groups, cur = [], []
    for p in phonemes:
        if p == ' ':
            if cur: groups.append(cur); cur = []
        else:
            cur.append(p)
    if cur: groups.append(cur)
    return [g for g in groups if any(re.match(r'\w', c) or c in 'ɪʊəɚɛɔæʌɑɐᵻ' for c in g)]


PH_SKIP = set(' ^$,.!?;:-\u2014')


def piper_synth(text, cfg):
    """Synthesize with Piper and derive exact word times from phoneme alignments.
    Each script word is phonemized on its own; that phoneme sequence is aligned
    (difflib) against the phoneme stream Piper actually spoke, so merges such as
    "on a" -> one espeak word, or "SpaceX" -> two, are handled."""
    import difflib
    from piper import SynthesisConfig
    v = piper_voice(cfg['model'])
    syn = SynthesisConfig(length_scale=cfg.get('length_scale'), noise_scale=cfg.get('noise_scale'), noise_w_scale=cfg.get('noise_w_scale'))
    sr = v.config.sample_rate
    segments = [s.strip() for s in re.split(r'(?<=\.\.\.)\s*', text) if s.strip()]   # split at ellipses -> real pause
    audio = []; words = []; t = 0.0
    for si, seg in enumerate(segments):
        seg_words = words_of(seg)
        stream = []   # (phoneme, t0, t1) actually spoken
        chunks = list(v.synthesize(seg, syn_config=syn, include_alignments=True))
        for ci, ch in enumerate(chunks):
            x = ch.audio_float_array.astype(np.float32)
            pos = 0
            for a_ in (ch.phoneme_alignments or []):
                n = int(a_.num_samples)
                if a_.phoneme not in PH_SKIP:
                    stream.append((a_.phoneme, t + pos / sr, t + (pos + n) / sr))
                pos += n
            audio.append(x); t += len(x) / sr
            if ci < len(chunks) - 1:
                gap = np.zeros(int(0.14 * sr), np.float32); audio.append(gap); t += len(gap) / sr
        # expected phonemes per word
        exp = []; owner = []
        for wi, (w, a, b) in enumerate(seg_words):
            ph = [p for sent in v.phonemize(w) for p in sent if p not in PH_SKIP]
            if not ph:
                ph = ['?']
            exp += ph; owner += [wi] * len(ph)
        got = [p for p, _, _ in stream]
        sm = difflib.SequenceMatcher(None, exp, got, autojunk=False)
        mp = [None] * len(exp)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag in ('equal', 'replace'):
                for k in range(i2 - i1):
                    mp[i1 + k] = min(j2 - 1, j1 + int(k * (j2 - j1) / max(1, i2 - i1)))
            elif tag == 'delete':
                for k in range(i1, i2):
                    mp[k] = min(len(got) - 1, j1)
        # fill gaps forward/backward
        last = 0
        for k in range(len(mp)):
            if mp[k] is None: mp[k] = last
            last = mp[k]
        for wi, (w, a, b) in enumerate(seg_words):
            idx = [mp[k] for k in range(len(exp)) if owner[k] == wi]
            j0, j1 = min(idx), max(idx)
            words.append({'word': w, 'start': stream[j0][1], 'end': stream[j1][2]})
        # make times monotonic
        for k in range(1, len(words)):
            if words[k]['start'] < words[k - 1]['start']:
                words[k]['start'] = words[k - 1]['start'] + 0.01
            words[k - 1]['end'] = max(words[k - 1]['end'], words[k - 1]['start'] + 0.04)
        if si < len(segments) - 1:
            gap = np.zeros(int(0.42 * sr), np.float32); audio.append(gap); t += len(gap) / sr
    return np.concatenate(audio), sr, words


def mouth_envelope(x, sr, rate=60):
    hop = sr // rate
    n = len(x) // hop
    env = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    env = env / max(1e-6, np.percentile(env, 95))
    env = np.clip((env - 0.08) / 0.9, 0, 1)
    k = np.array([0.25, 0.5, 0.25]); env = np.convolve(env, k, mode='same')
    return [round(float(v), 3) for v in env]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', default='auto', choices=['auto', 'elevenlabs', 'piper'])
    ap.add_argument('--strict', action='store_true', help='do not fall back to Piper')
    args = ap.parse_args()
    script = json.load(open(os.path.join(ROOT, 'script.json')))
    tl = json.load(open(os.path.join(ROOT, 'timeline.json')))
    os.makedirs(OUT, exist_ok=True)
    key = load_key()
    engine = args.engine
    if engine == 'auto':
        engine = 'elevenlabs' if key else 'piper'
        if not key:
            print('[voices] no ElevenLabs key found (ELEVENLABS_API_KEY / .env) -> using local Piper TTS')
    results = []
    if engine == 'elevenlabs':
        try:
            if not key:
                raise ElevenLabsError('ELEVENLABS_API_KEY not set')
            need = sum(len(l['text']) for l in script['lines'])
            try:
                sub = el_request(key, 'GET', '/v1/user/subscription')
                left = sub.get('character_limit', 0) - sub.get('character_count', 0)
            except ElevenLabsError as e:   # keys without user_read permission can still synthesize
                left = None
                print(f'[voices] ElevenLabs: could not read the credit balance ({e}); trying anyway')
            if left is not None:
                print(f'[voices] ElevenLabs: {left} characters left, need {need}')
                if left < need:
                    raise ElevenLabsError('not enough ElevenLabs credits')
            vids = {sp: el_pick_voice(key, cfg['elevenlabs']) for sp, cfg in script['voices'].items()}
            for line in script['lines']:
                cfg = script['voices'][line['speaker']]['elevenlabs']
                x, sr, words = el_synth(key, line['text'], cfg, vids[line['speaker']])
                results.append((line, x, sr, words))
                print(f"[voices] ElevenLabs line {line['id']} ok ({len(x) / sr:.2f}s)")
        except (ElevenLabsError, KeyError) as e:
            if args.strict:
                sys.exit(f'[voices] ElevenLabs failed: {e}')
            print(f'[voices] ElevenLabs failed ({e}) -> falling back to local Piper TTS')
            engine = 'piper'; results = []
    if engine == 'piper':
        for line in script['lines']:
            cfg = script['voices'][line['speaker']]['piper']
            x, sr, words = piper_synth(line['text'], cfg)
            results.append((line, x, sr, words))
            print(f"[voices] Piper line {line['id']} ({cfg['model']}) {len(x) / sr:.2f}s")
    timings = {'engine': engine, 'sample_rate': SR, 'lines': []}
    for line, x, sr, words in results:
        x = resample(x, sr); words = [dict(w) for w in words]
        x, words = trim(x, SR, words)
        x = loudness_match(x, SR)
        name = f"line{line['id']:02d}_{line['speaker']}.wav"
        sf.write(os.path.join(OUT, name), x, SR, subtype='PCM_16')
        timings['lines'].append({'id': line['id'], 'speaker': line['speaker'], 'text': line['text'], 'file': name, 'duration': round(len(x) / SR, 4),
                                 'words': [{'word': w['word'], 'start': round(w['start'], 4), 'end': round(w['end'], 4)} for w in words]})
        if line['speaker'] == 'john':
            slot = next(s for s in tl['voice_slots'] if s['line'] == line['id'])
            json.dump({'start': slot['start'], 'rate': 60, 'data': mouth_envelope(x, SR)}, open(os.path.join(OUT, 'john_mouth.json'), 'w'))
    json.dump(timings, open(os.path.join(OUT, 'timings.json'), 'w'), indent=1)
    open(os.path.join(OUT, 'engine.txt'), 'w').write(engine + '\n')
    print(f'[voices] wrote {len(results)} lines with engine={engine} -> {os.path.relpath(OUT, ROOT)}/')


if __name__ == '__main__':
    main()
