#!/usr/bin/env python3
"""Build timeline/timeline.json — the single source of truth for timing.

Dialogue placement is computed from the real speech boundaries of each chosen take
(word timestamps in audio/dialogue/words.json, produced by faster-whisper), so every
subtitle, mouth movement and camera cut lines up with what is actually spoken.
"""
import json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIA = os.path.join(ROOT, 'audio', 'dialogue')
FPS = 30

# id, speaker, on-screen text (what is spoken, minus delivery tags), delivery tags sent to TTS
LINES = [
    ('L01', 'KNIGHT', 'When I find him... he will pay.', '[tense] [quietly]'),
    ('L02', 'JESUS', "You've been gripping that sword since sunrise, my friend.", '[warmly]'),
    ('L03', 'JESUS', 'Why do you carry so much anger?', '[gently]'),
    ('L04', 'KNIGHT', 'The man I trusted most betrayed me. He opened our gates to the enemy.', '[bitter] ... [pause] ...'),
    ('L05', 'KNIGHT', "Every day since... I've sharpened this blade for him.", '[quietly] [tense]'),
    ('L06', 'JESUS', 'Any man can defeat his enemy with a sword.', '[softly]'),
    ('L07', 'JESUS', 'True strength is ruling the anger inside you... and choosing what is right.', '[warmly]'),
    ('L08', 'KNIGHT', "So I'm supposed to pretend it never happened?", '[hesitant] [quietly]'),
    ('L09', 'JESUS', "No. Forgiveness doesn't pretend the wrong never happened.", '[gently]'),
    ('L10', 'JESUS', 'It means you refuse to let hatred rule the rest of your life.', '[warmly]'),
    ('L11', 'KNIGHT', "I've let him rule me long enough.", '[exhales] [softly]'),
    ('L12', 'JESUS', "Then today... you've won the greatest battle of all.", '[warmly] [softly]'),
]

VOICES = {
    'JESUS': {'elevenlabs_voice_id': '9Ni5tnvWT8WRgVNQLU3c', 'name': 'LAUKYS Voice', 'model': 'eleven_v4'},
    'KNIGHT': {'elevenlabs_voice_id': '2ajXGJNYBR0iNHpS4VZb', 'name': 'Rob - Tough, Calloused, British', 'model': 'eleven_v4'},
}


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout
    return float(out.strip())


def main():
    words = json.load(open(os.path.join(DIA, 'words.json')))
    info = {}
    for lid, spk, text, tags in LINES:
        f = f'{lid}.mp3'
        w = words[f]['words']
        info[lid] = dict(file=f'audio/dialogue/{f}', dur=duration(os.path.join(DIA, f)),
                         s0=w[0]['s'], s1=w[-1]['e'], words=w, speaker=spk, text=text, tags=tags)

    cues, beats = [], {}
    t = 0.0

    def place(lid, speech_start):
        i = info[lid]
        file_start = speech_start - i['s0']
        cue = dict(id=lid, speaker=i['speaker'], text=i['text'], ttsTags=i['tags'], file=i['file'],
                   fileStart=round(file_start, 3), fileDur=round(i['dur'], 3),
                   speechStart=round(speech_start, 3), speechEnd=round(file_start + i['s1'], 3),
                   words=[dict(w=x['w'], s=round(file_start + x['s'], 3), e=round(file_start + x['e'], 3)) for x in i['words']])
        cues.append(cue)
        return cue['speechEnd']

    # --- Act 1: hook + arrival --------------------------------------------------------
    beats['hookStart'] = 0.0
    end = place('L01', 0.45)
    beats['establishStart'] = round(end + 0.35, 3)          # wide establishing shot, title card
    beats['jesusWalkStart'] = 0.0                            # Jesus is already walking toward the knight off-screen
    l02 = beats['establishStart'] + 2.6
    beats['jesusArrive'] = round(l02 + 1.2, 3)               # he reaches his spot mid-line
    end = place('L02', l02)
    beats['jesusSitStart'] = round(end + 0.15, 3)
    beats['jesusSitEnd'] = round(beats['jesusSitStart'] + 1.15, 3)
    end = place('L03', beats['jesusSitEnd'] + 0.2)
    # --- Act 2: the wound ---------------------------------------------------------------
    end = place('L04', end + 0.55)
    end = place('L05', end + 0.45)
    end = place('L06', end + 0.75)
    end = place('L07', end + 0.35)
    # --- The sword moment (no dialogue) ---------------------------------------------------
    beats['swordLookStart'] = round(end + 0.35, 3)
    beats['swordLowerStart'] = round(beats['swordLookStart'] + 1.0, 3)
    beats['swordTipDown'] = round(beats['swordLowerStart'] + 2.3, 3)
    beats['swordSettleEnd'] = round(beats['swordTipDown'] + 0.8, 3)
    # --- Act 3: forgiveness -----------------------------------------------------------------
    end = place('L08', beats['swordSettleEnd'] + 0.2)
    end = place('L09', end + 0.5)
    end = place('L10', end + 0.4)
    end = place('L11', end + 0.7)
    beats['goldenStart'] = round(end + 0.45, 3)              # dissolve to the standing, golden-hour ending
    beats['goldenEnd'] = round(beats['goldenStart'] + 0.9, 3)
    beats['shoulderTouch'] = round(beats['goldenEnd'] + 0.3, 3)
    end = place('L12', beats['goldenEnd'] + 0.55)
    beats['endCardStart'] = round(end + 0.45, 3)
    beats['end'] = round(beats['endCardStart'] + 4.8, 3)
    total = beats['end']
    frames = int(round(total * FPS))

    tl = dict(title="The Warrior Who Couldn't Forgive", fps=FPS, width=1080, height=1920,
              duration=round(frames / FPS, 3), frames=frames, voices=VOICES, beats=beats, cues=cues,
              endCard=dict(verse='One who is slow to anger is better than the mighty;\none who rules his spirit, than he who takes a city.',
                           reference='PROVERBS 16:32 (WEB)', tagline='True strength forgives.'))
    with open(os.path.join(ROOT, 'timeline', 'timeline.json'), 'w') as f:
        json.dump(tl, f, indent=1)
    print(f'duration {total:.2f}s, {frames} frames')
    for c in cues:
        print(f"{c['id']} {c['speaker']:6s} {c['speechStart']:6.2f}-{c['speechEnd']:6.2f}  {c['text']}")
    print(json.dumps(beats, indent=1))


if __name__ == '__main__':
    main()
