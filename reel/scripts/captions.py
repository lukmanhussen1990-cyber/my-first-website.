"""Word-synced captions (2-3 words at a time) -> audio/captions.ass

Style copied from the reference: bold white sans, dark outline + soft shadow, middle of the screen.
Uses the word timestamps in audio/voiceover_words.json (made by scripts/transcribe.py).
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "Poppins ExtraBold"
SIZE = 96
Y = 1130  # a little below the exact centre, like the reference


def ts(t):
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def groups(words):
    """split into phrases at punctuation, then into balanced chunks of 2-3 words"""
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if w["word"].endswith((".", ",", "?", "!")):
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    out = []
    for ph in phrases:
        n = len(ph)
        k = max(1, -(-n // 3))  # number of chunks
        sizes = [n // k + (1 if i < n % k else 0) for i in range(k)]
        i = 0
        for sz in sizes:
            out.append(ph[i:i + sz])
            i += sz
    return out


def main(out_path):
    words = json.load(open(os.path.join(ROOT, "audio", "voiceover_words.json")))
    g = groups(words)
    lines = []
    for i, grp in enumerate(g):
        start = grp[0]["start"]
        end = grp[-1]["end"] + 0.25
        if i + 1 < len(g):
            end = min(max(end, grp[-1]["end"]), g[i + 1][0]["start"])
        text = " ".join(w["word"] for w in grp)
        # little pop-in like the reference captions
        lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Cap,,0,0,0,,"
                     f"{{\\pos(540,{Y})\\fscx88\\fscy88\\t(0,90,\\fscx100\\fscy100)}}{text}")
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{FONT},{SIZE},&H00FFFFFF,&H00FFFFFF,&H00141414,&H96000000,0,0,0,0,100,100,0,0,1,7,4,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(out_path, "w") as f:
        f.write(head + "\n".join(lines) + "\n")
    print("captions ->", out_path, len(lines), "lines")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "audio", "captions.ass"))
