#!/usr/bin/env python3
"""Word-by-word subtitles (ASS, rendered by libass in ffmpeg).

One word on screen at a time, exactly as spelled in the script, centred a
little above the middle (40 % of the height), clear of the bottom 20 % and of
the right edge. Big, bold, rounded white type with a thick black outline and a
soft shadow; each word pops in with a small bounce. John's line is yellow and
a little bigger.
usage: make_subs.py [layout.json] [out.ass]
"""
import json, os, sys
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'fonts', 'FredokaReel-Bold700.ttf')
W, H = 1080, 1920
CX, CY = 528, int(0.40 * H)      # a touch left of centre: keeps clear of the right-hand UI
MAX_W = 0.70 * W                 # long words shrink to fit
STYLE = {'narrator': {'size': 112, 'color': '&H00FFFFFF'}, 'john': {'size': 134, 'color': '&H0000DCFF'}}

_font = TTFont(FONT)
_cmap, _hmtx, _upm = _font.getBestCmap(), _font['hmtx'], _font['head'].unitsPerEm


def text_width(s, size):
    adv = sum(_hmtx[_cmap.get(ord(ch), _cmap.get(ord('?')))][0] for ch in s)
    return adv * size / _upm


def ts(t):
    t = max(0.0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f'{int(h)}:{int(m):02d}:{s:05.2f}'


def esc(s):
    return s.replace('\\', '\\\\').replace('{', '(').replace('}', ')')


def main():
    layout = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'work', 'voice_layout.json')))
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'work', 'subs.ass')
    words = []
    for line in layout['lines']:
        for w in line['words']:
            words.append({**w, 'speaker': line['speaker']})
    ev = []
    for i, w in enumerate(words):
        nxt = words[i + 1]['start'] if i + 1 < len(words) else None
        end = w['end'] + 0.45
        if nxt is not None:
            # stay until the next word unless there is a real pause
            end = nxt - 0.02 if nxt - w['end'] < 0.7 else min(w['end'] + 0.45, nxt - 0.02)
        st = STYLE[w['speaker']]
        size = st['size']
        wdt = text_width(w['word'], size)
        scale = min(1.0, MAX_W / max(wdt, 1))
        s100 = int(round(100 * scale))
        # pop: start small, overshoot, settle (tiny bounce)
        pop = (f'\\fscx{int(s100*0.55)}\\fscy{int(s100*0.55)}\\t(0,80,\\fscx{int(s100*1.12)}\\fscy{int(s100*1.12)})'
               f'\\t(80,150,\\fscx{int(s100*0.95)}\\fscy{int(s100*0.95)})\\t(150,210,\\fscx{s100}\\fscy{s100})')
        txt = esc(w['word'])
        a, b = ts(w['start'] - 0.03), ts(end)
        # soft shadow: blurred dark copy, offset down-right
        ev.append(f'Dialogue: 0,{a},{b},Word,,0,0,0,,{{\\an5\\pos({CX + 5},{CY + 11})\\fs{size}\\bord13\\blur11\\1c&H000000&\\3c&H000000&\\1a&H78&\\3a&H78&{pop}}}{txt}')
        ev.append(f'Dialogue: 1,{a},{b},Word,,0,0,0,,{{\\an5\\pos({CX},{CY})\\fs{size}\\bord9\\blur0.8\\1c{st["color"]}\\3c&H000000&{pop}}}{txt}')
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka Reel,112,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,9,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    open(out, 'w').write(head + '\n'.join(ev) + '\n')
    print(f'{len(words)} words -> {out}')


if __name__ == '__main__':
    main()
