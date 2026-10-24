"""One-word-at-a-time burned-in captions as an ASS file (1080x1920), styled
like the reference reel: heavy white Montserrat, black outline + soft shadow,
just above centre, no punctuation, timed to the aligned narration."""
import sys, json, re
S = sys.argv[1]
caps = json.load(open(f'{S}/audio/captions.json'))


def ts(t):
    t = max(0, t)
    h, m = int(t // 3600), int(t % 3600 // 60)
    return f'{h}:{m:02d}:{t % 60:05.2f}'


head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Montserrat ExtraBold,122,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,0,0,0,0,100,100,0,0,1,7.5,4,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
# give every word at least MIN_ON seconds on screen; a very short word borrows
# time from the start of the next one (never more than 0.12 s late)
MIN_ON = 0.16
for i in range(len(caps) - 1):
    a, b = caps[i], caps[i + 1]
    if b['line'] == a['line'] and b['t0'] - a['t0'] < MIN_ON:
        b['t0'] = min(a['t0'] + MIN_ON, b['t0'] + 0.12, b['t1'] - 0.08)
lines = []
for i, c in enumerate(caps):
    word = re.sub(r"[^\w']+", '', c['w'])
    t0 = c['t0'] - 0.03
    nxt = caps[i + 1]['t0'] - 0.03 if i + 1 < len(caps) else 1e9
    t1 = nxt if nxt - c['t1'] < 0.45 else c['t1'] + 0.3
    pop = r'{\pos(540,862)\blur0.6}'
    lines.append(f'Dialogue: 0,{ts(t0)},{ts(t1)},Word,,0,0,0,,{pop}{word}')
open(f'{S}/audio/captions.ass', 'w').write(head + '\n'.join(lines) + '\n')
print(len(lines), 'caption events')
