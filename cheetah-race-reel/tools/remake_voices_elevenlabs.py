#!/usr/bin/env python3
"""Re-make every voice line with ElevenLabs and re-export the reel.

No 3D re-render: the silent master (work/master/master.mp4) and the music and
effects stems are reused; only the voice track, the subtitle timing and the
final mix change.

  1. reads script/script.json (text, delivery tags, voice ids, anchors)
  2. calls /v1/text-to-speech/{voice}/with-timestamps for each line and saves
     voices_elevenlabs/<id>.mp3 + <id>.words.json (word timings taken from the
     character timestamps, spelled exactly as in the script)
  3. lays the lines out on the timeline (tools/layout_voice.py)
  4. rebuilds the word-by-word subtitles (tools/make_subs.py)
  5. mixes and exports out/cheetah_race_reel_elevenlabs.mp4 (tools/finalize.py)

API key: ELEVENLABS_API_KEY in the environment, or in a .env file next to this
project (or the repository root).
usage: remake_voices_elevenlabs.py [--model eleven_v4] [--only 08_john] [--skip-tts]
"""
import argparse, base64, json, os, re, subprocess, sys, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, 'tools')
VOICE_DIR = os.path.join(ROOT, 'voices_elevenlabs')
WORK = os.path.join(ROOT, 'work', 'elevenlabs')
API = 'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128'
FALLBACK_MODELS = ['eleven_v3', 'eleven_multilingual_v2']
TAG = re.compile(r'\[[^\]]*\]\s*')


def api_key():
    if os.environ.get('ELEVENLABS_API_KEY'):
        return os.environ['ELEVENLABS_API_KEY'].strip()
    for d in (ROOT, os.path.dirname(ROOT)):
        p = os.path.join(d, '.env')
        if os.path.exists(p):
            for line in open(p):
                m = re.match(r'\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["\']?([^"\'\s]+)', line)
                if m:
                    return m.group(1)
    sys.exit('ELEVENLABS_API_KEY not found (set it in the environment or in .env)')


def tts(key, voice, model, text):
    body = json.dumps({'text': text, 'model_id': model,
                       'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.35, 'use_speaker_boost': True}}).encode()
    req = urllib.request.Request(API.format(voice=voice), data=body, method='POST',
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:400]
            if e.code == 429 and attempt < 3:      # rate limited: nothing was generated, wait and retry
                time.sleep(4 * (attempt + 1)); continue
            raise RuntimeError(f'HTTP {e.code}: {msg}')


def words_from_alignment(al, script_text):
    """Character timestamps -> word timings for the script's exact words."""
    chars, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
    words, cur, in_tag = [], None, False
    for c, s, e in zip(chars, st, en):
        if c == '[':
            in_tag = True; continue
        if in_tag:
            in_tag = c != ']'; continue
        if c.isspace():
            if cur: words.append(cur); cur = None
            continue
        if cur is None:
            cur = {'text': c, 'start': s, 'end': e}
        else:
            cur['text'] += c; cur['end'] = e
    if cur:
        words.append(cur)
    norm = lambda w: re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'"))
    spoken = [w for w in words if norm(w['text'])]
    target = script_text.split()
    if [norm(w['text']) for w in spoken] != [norm(w) for w in target]:
        return None
    return [{'word': t, 'start': round(w['start'], 3), 'end': round(w['end'], 3)} for t, w in zip(target, spoken)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', help='override the model id from script.json')
    ap.add_argument('--only', nargs='*', help='line ids to re-make (default: all)')
    ap.add_argument('--skip-tts', action='store_true', help='reuse voices_elevenlabs/ and only re-export')
    ap.add_argument('--out', default=os.path.join(ROOT, 'out', 'cheetah_race_reel_elevenlabs.mp4'))
    ap.add_argument('--master', default=os.path.join(ROOT, 'work', 'master', 'master.mp4'))
    a = ap.parse_args()
    script = json.load(open(os.path.join(ROOT, 'script', 'script.json')))
    os.makedirs(VOICE_DIR, exist_ok=True); os.makedirs(WORK, exist_ok=True)
    if not a.skip_tts:
        key = api_key()
        for line in script['lines']:
            lid = line['id']
            if a.only and lid not in a.only:
                if os.path.exists(os.path.join(VOICE_DIR, f'{lid}.mp3')):
                    continue
                print(f'{lid}: no ElevenLabs take yet, making it too')
            v = script['voices'][line['speaker']]
            models = [a.model or v.get('model_id', 'eleven_v3')] + [m for m in FALLBACK_MODELS if m != (a.model or v.get('model_id'))]
            res, used = None, None
            for m in models:
                text = line.get('tts_prompt', line['text']) if m in ('eleven_v3', 'eleven_v4') or m.startswith('eleven_v4') else line['text']
                try:
                    res = tts(key, v['elevenlabs_voice_id'], m, text); used = m; break
                except RuntimeError as e:
                    print(f'{lid}: {m} failed ({e})')
                    if 'quota' in str(e).lower() or '401' in str(e):
                        sys.exit('ElevenLabs refused the request (credits or key); nothing was changed.')
            if res is None:
                sys.exit(f'{lid}: no model worked')
            mp3 = os.path.join(VOICE_DIR, f'{lid}.mp3')
            open(mp3, 'wb').write(base64.b64decode(res['audio_base64']))
            al = res.get('alignment') or res.get('normalized_alignment')
            words = words_from_alignment(al, line['text']) if al else None
            if words is None:  # timestamps did not line up with the script: align from the audio instead
                sys.path.insert(0, TOOLS)
                from align_words import align
                words = align(mp3, line['text'])['words']
            dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3],
                                       capture_output=True, text=True).stdout.strip())
            json.dump({'audio': os.path.basename(mp3), 'duration': dur, 'text': line['text'], 'model': used, 'words': words},
                      open(os.path.join(VOICE_DIR, f'{lid}.words.json'), 'w'), indent=1)
            print(f'{lid}: {used}, {dur:.2f}s, {len(words)} words')
    # re-time, re-subtitle, re-mix, re-export (the 3D master is reused as is)
    py = sys.executable
    subprocess.run([py, os.path.join(TOOLS, 'layout_voice.py'), '--voices', VOICE_DIR, '--out', WORK], check=True)
    subprocess.run([py, os.path.join(TOOLS, 'make_subs.py'), os.path.join(WORK, 'voice_layout.json'), os.path.join(WORK, 'subs.ass')], check=True)
    subprocess.run([py, os.path.join(TOOLS, 'finalize.py'), '--voice', os.path.join(WORK, 'voice_track.wav'),
                    '--layout', os.path.join(WORK, 'voice_layout.json'), '--subs', os.path.join(WORK, 'subs.ass'),
                    '--master', a.master, '--out', a.out], check=True)


if __name__ == '__main__':
    main()
