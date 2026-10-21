"""Word-by-word subtitles (ASS) from out/voice_placement.json -> out/subtitles.ass

    python3 tools/make_subtitles.py

One word at a time, in sync with the voice. Big bold rounded white font with a thick black
outline and a soft shadow; each word pops in with a small bounce. John's line is yellow and
a bit bigger. Placed a little above the middle and left of centre, away from the bottom 20%
and the right edge where Instagram puts its buttons.
"""
import json
import os

from PIL import ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FONT_FILE = os.path.join(ROOT, 'assets', 'fonts', 'MPLUSRounded1c-Black.ttf')
FONT_NAME = 'Rounded Mplus 1c Black'
W, H = 1080, 1920
CX, CY = 500, 790            # word centre: x 46% (clear of the right edge), y 41% (a little above the middle)
MAX_W = 760                  # widest a word may get (x 8%..77% of the frame)
SIZE = 134
OUTLINE = 10


def ts(t):
    t = max(0.0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def fit_size(word, size):
    font = ImageFont.truetype(FONT_FILE, size)
    w = font.getlength(word) + 2 * OUTLINE
    return size if w <= MAX_W else int(size * MAX_W / w)


def main():
    placed = json.load(open(os.path.join(ROOT, 'out', 'voice_placement.json')))
    lines = sorted(placed.values(), key=lambda l: l['start'])
    events = []
    for li, line in enumerate(lines):
        john = line['speaker'] == 'john'
        next_line_start = lines[li + 1]['start'] if li + 1 < len(lines) else 1e9
        words = line['words']
        for i, w in enumerate(words):
            start = w['start']
            if i + 1 < len(words):
                nxt = words[i + 1]['start']
                end = nxt if nxt - w['end'] < 0.6 else w['end'] + 0.35
            else:
                end = min(w['end'] + 0.45, next_line_start - 0.05)
            end = max(end, start + 0.12)
            size = fit_size(w['text'], int(SIZE * (1.15 if john else 1.0)))
            colour = r'\1c&H4AD8FF&' if john else r'\1c&HFFFFFF&'
            pop = r'\fscx72\fscy72\t(0,90,\fscx114\fscy114)\t(90,180,\fscx100\fscy100)'
            text = w['text'].replace('{', '(').replace('}', ')')
            shadow = rf'{{\an5\pos({CX + 7},{CY + 11})\fs{size}\bord{OUTLINE + 2}\shad0\blur9\1c&H000000&\3c&H000000&\alpha&H78&{pop}}}{text}'
            main_ = rf'{{\an5\pos({CX},{CY})\fs{size}\bord{OUTLINE}\shad0\blur0.7{colour}\3c&H000000&{pop}}}{text}'
            events.append(f'Dialogue: 0,{ts(start)},{ts(end)},Word,,0,0,0,,{shadow}')
            events.append(f'Dialogue: 1,{ts(start)},{ts(end)},Word,,0,0,0,,{main_}')
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,{FONT_NAME},{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,{OUTLINE},0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    path = os.path.join(ROOT, 'out', 'subtitles.ass')
    with open(path, 'w') as f:
        f.write(head + '\n'.join(events) + '\n')
    print(f'[subs] {len(events) // 2} words -> {os.path.relpath(path, ROOT)}')


if __name__ == '__main__':
    main()
