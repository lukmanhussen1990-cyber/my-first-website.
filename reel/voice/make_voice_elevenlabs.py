#!/usr/bin/env python3
"""Re-create the narration with ElevenLabs (with exact word timestamps).

Standard library only (urllib) + ffmpeg. Reads the API key from ELEVENLABS_API_KEY,
or from a .env file (reel/.env or the repository root .env) containing
    ELEVENLABS_API_KEY=sk_...

Writes the same files the local voice uses, so tools/export.py picks them up:
    voice/lines/line_XX.wav       (48 kHz mono)
    voice/timings/line_XX.json    (word start/end times from ElevenLabs' character alignment)
Nothing is overwritten unless ALL lines succeed; the previous voice is backed up to voice/backup_<time>/.

Usage:
    python3 voice/make_voice_elevenlabs.py [--voice-id ID] [--model eleven_multilingual_v2]
"""
import argparse, base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
API = 'https://api.elevenlabs.io/v1'
# "Don - Movie Trailers" (deep, epic trailer narrator) from the ElevenLabs voice library.
# If your account can't use it, add it to "My Voices" in ElevenLabs, or pass --voice-id with any voice you like.
DEFAULT_VOICE = 'JJCR1UICgHnHljtvu5uF'
FALLBACK_VOICE = 'pNInz6obpgDQGcFmaJgB'  # "Adam" (premade, deep American narrator)
STYLE = {
    'playful':    dict(stability=0.42, similarity_boost=0.8, style=0.35, use_speaker_boost=True, speed=1.0),
    'dramatic':   dict(stability=0.32, similarity_boost=0.8, style=0.6, use_speaker_boost=True, speed=0.95),
    'triumphant': dict(stability=0.38, similarity_boost=0.8, style=0.55, use_speaker_boost=True, speed=0.96),
}


def api_key():
    k = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    if k:
        return k
    for p in (os.path.join(ROOT, '.env'), os.path.join(os.path.dirname(ROOT), '.env')):
        if os.path.exists(p):
            for line in open(p):
                line = line.strip()
                if line.startswith('ELEVENLABS_API_KEY'):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    return ''


def tts(key, voice_id, model, text, settings, prev_text, next_text):
    body = {'text': text, 'model_id': model, 'voice_settings': settings}
    if prev_text: body['previous_text'] = prev_text
    if next_text: body['next_text'] = next_text
    req = urllib.request.Request(f'{API}/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128',
                                 data=json.dumps(body).encode(), method='POST',
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def word_timings(text, alignment):
    chars = alignment['characters']; st = alignment['character_start_times_seconds']; en = alignment['character_end_times_seconds']
    joined = ''.join(chars)
    # alignment characters follow the input text; locate each script word in it
    words, pos = [], 0
    for tok in text.split():
        i = joined.find(tok, pos)
        if i < 0:  # fall back to a looser match (ignore punctuation)
            core = tok.strip('.,!?;:')
            i = joined.find(core, pos)
            if i < 0:
                raise ValueError(f'could not align word {tok!r}')
            j = i + len(core)
        else:
            j = i + len(tok)
        letters = [k for k in range(i, j) if chars[k].strip() and chars[k] not in '.,!?;:'] or [i]
        words.append({'word': tok, 'start': round(st[letters[0]], 3), 'end': round(en[letters[-1]], 3)})
        pos = j
    return words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice-id', default=os.environ.get('ELEVENLABS_VOICE_ID', DEFAULT_VOICE))
    ap.add_argument('--model', default=os.environ.get('ELEVENLABS_MODEL', 'eleven_multilingual_v2'))
    args = ap.parse_args()
    key = api_key()
    if not key:
        print('ElevenLabs: no API key (set ELEVENLABS_API_KEY or put it in .env). Keeping the current voice.', file=sys.stderr)
        sys.exit(2)
    script = json.load(open(os.path.join(ROOT, 'script/voiceover.json')))
    lines = script['lines']
    voice_id = args.voice_id
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, 'lines')); os.makedirs(os.path.join(tmp, 'timings'))
        for idx, line in enumerate(lines):
            lid = line['id']
            prev_t = lines[idx - 1]['text'] if idx > 0 else ''
            next_t = lines[idx + 1]['text'] if idx + 1 < len(lines) else ''
            settings = STYLE.get(line.get('style', 'playful'), STYLE['playful'])
            for attempt in range(3):
                try:
                    res = tts(key, voice_id, args.model, line['text'], settings, prev_t, next_t)
                    break
                except urllib.error.HTTPError as e:
                    msg = e.read().decode(errors='replace')[:400]
                    if e.code in (400, 404) and 'voice' in msg.lower() and voice_id != FALLBACK_VOICE:
                        print(f'voice {voice_id} not usable ({e.code}); falling back to premade voice "Adam".', file=sys.stderr)
                        voice_id = FALLBACK_VOICE; continue
                    if e.code == 429 and attempt < 2:
                        time.sleep(4 * (attempt + 1)); continue
                    print(f'ElevenLabs error on line {lid}: HTTP {e.code}: {msg}\nKeeping the current voice.', file=sys.stderr)
                    sys.exit(3)
                except Exception as e:  # network etc.
                    if attempt < 2:
                        time.sleep(3); continue
                    print(f'ElevenLabs request failed on line {lid}: {e}\nKeeping the current voice.', file=sys.stderr)
                    sys.exit(3)
            mp3 = os.path.join(tmp, f'line_{lid:02d}.mp3')
            open(mp3, 'wb').write(base64.b64decode(res['audio_base64']))
            words = word_timings(line['text'], res.get('alignment') or res['normalized_alignment'])
            wav = os.path.join(tmp, 'lines', f'line_{lid:02d}.wav')
            # light polish only (no pitch change): gentle compression + loudness to -16 LUFS
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-af',
                            'acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120:makeup=2,aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=9',
                            '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s24le', wav], check=True)
            dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', wav], capture_output=True, text=True).stdout)
            json.dump({'id': lid, 'text': line['text'], 'source': f'elevenlabs:{voice_id}:{args.model}', 'duration': round(dur, 3), 'words': words},
                      open(os.path.join(tmp, 'timings', f'line_{lid:02d}.json'), 'w'), indent=1)
            print(f'line {lid}: {dur:.2f}s ({len(words)} words)')
        # all good: back up the old voice and install the new one
        stamp = time.strftime('%Y%m%d_%H%M%S')
        bk = os.path.join(HERE, f'backup_{stamp}')
        os.makedirs(bk)
        for d in ('lines', 'timings'):
            if os.path.isdir(os.path.join(HERE, d)):
                shutil.move(os.path.join(HERE, d), os.path.join(bk, d))
            shutil.copytree(os.path.join(tmp, d), os.path.join(HERE, d))
    print(f'ElevenLabs voice installed (previous voice saved in {os.path.relpath(bk, ROOT)}).')


if __name__ == '__main__':
    main()
