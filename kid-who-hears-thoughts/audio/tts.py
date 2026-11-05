"""Narration + word-level timestamps -> audio/voice.wav and story/words.json.

Priority:
  1. The user's own recorded voiceover (assets/voiceover.mp3) - used exactly as recorded
     (decoded to WAV, no speed/pitch/level changes). Word timestamps come from Whisper
     (faster-whisper, word_timestamps=True); set WHISPER_MODEL to a model name or local path.
  2. ElevenLabs text-to-speech "with-timestamps" endpoint if ELEVENLABS_API_KEY is set.
  3. Offline fallback: espeak-ng, with word times spread by word length.
Usage: python3 audio/tts.py [--force]
"""
import base64
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
script = json.load(open(os.path.join(ROOT, 'story', 'script.json')))
VOICE_IN = os.path.join(ROOT, script['voiceover'])
VOICE_WAV = os.path.join(HERE, 'voice.wav')
WORDS = os.path.join(ROOT, 'story', 'words.json')
force = '--force' in sys.argv


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', *args], check=True)


def duration(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout)


def whisper_words(path):
    import numpy as np
    from faster_whisper import WhisperModel

    pcm = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], check=True, capture_output=True).stdout
    samples = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    model = WhisperModel(os.environ.get('WHISPER_MODEL', 'small'), device='cpu', compute_type='int8')
    segs, info = model.transcribe(samples, language='en', word_timestamps=True, beam_size=5)
    words, segments = [], []
    for s in segs:
        segments.append({'start': round(s.start, 3), 'end': round(s.end, 3), 'text': s.text.strip()})
        words += [{'word': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3), 'probability': round(w.probability, 3)} for w in s.words]
    return {'duration': round(info.duration, 3), 'text': ' '.join(s['text'] for s in segments), 'segments': segments, 'words': words}


if os.path.exists(VOICE_IN):
    print('narration: user voiceover', script['voiceover'])
    ffmpeg('-i', VOICE_IN, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', VOICE_WAV)
    src = sha(VOICE_IN)
    have = json.load(open(WORDS)) if os.path.exists(WORDS) else {}
    if force or have.get('source_sha256') != src:
        data = whisper_words(VOICE_IN)
        data['source_sha256'] = src
        json.dump(data, open(WORDS, 'w'), indent=1)
    else:
        print('words.json is up to date for this voiceover')
elif os.environ.get('ELEVENLABS_API_KEY'):
    voice_id = os.environ.get('ELEVENLABS_VOICE_ID', 'JBFqnCBsd6RMkjVDRZzb')
    text = ' '.join(script['narration'])
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps',
        data=json.dumps({'text': text, 'model_id': 'eleven_multilingual_v2'}).encode(),
        headers={'xi-api-key': os.environ['ELEVENLABS_API_KEY'], 'Content-Type': 'application/json'},
    )
    res = json.load(urllib.request.urlopen(req))
    mp3 = os.path.join(HERE, 'voice_tts.mp3')
    open(mp3, 'wb').write(base64.b64decode(res['audio_base64']))
    ffmpeg('-i', mp3, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', VOICE_WAV)
    al = res['alignment']
    words, cur, t0 = [], '', None
    for ch, s, e in zip(al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']):
        if ch.isspace():
            if cur:
                words.append({'word': cur, 'start': t0, 'end': last})
            cur, t0 = '', None
            continue
        if t0 is None:
            t0 = s
        cur += ch
        last = e
    if cur:
        words.append({'word': cur, 'start': t0, 'end': last})
    json.dump({'duration': duration(VOICE_WAV), 'text': text, 'words': words, 'source': 'elevenlabs'}, open(WORDS, 'w'), indent=1)
else:
    exe = shutil.which('espeak-ng') or shutil.which('espeak')
    if not exe:
        sys.exit('No voiceover, no ELEVENLABS_API_KEY and no espeak-ng installed.')
    text = ' '.join(script['narration'])
    subprocess.run([exe, '-v', 'en-us', '-s', '150', '-w', VOICE_WAV, text], check=True)
    d = duration(VOICE_WAV)
    toks = text.split()
    weights = [len(w) + 2 for w in toks]
    total = sum(weights)
    t, words = 0.0, []
    for w, k in zip(toks, weights):
        dt = d * k / total
        words.append({'word': w, 'start': round(t, 3), 'end': round(t + dt * 0.9, 3)})
        t += dt
    json.dump({'duration': d, 'text': text, 'words': words, 'source': 'espeak-ng'}, open(WORDS, 'w'), indent=1)
print('voice.wav', round(duration(VOICE_WAV), 2), 's')
