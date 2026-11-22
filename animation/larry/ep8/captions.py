"""Episode 8 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.78, "DALE", "R"), (0.78, 1.36, "begs you to", "W"), (1.36, 2.26, "oil up his massive", "W"),
    (2.26, 2.94, "DECK,", "R"), (2.94, 3.72, "so you slap it on", "W"), (3.72, 4.95, "with your bare hands.", "W"),
    (4.95, 6.14, "Except his deck", "W"), (6.14, 7.30, "is dry and rough,", "W"), (7.30, 8.18, "so you just get", "W"),
    (8.18, 9.50, "SPLINTERS.", "R"),
    (9.50, 10.52, "So you tie bristles", "W"), (10.52, 11.44, "to a wooden handle", "W"),
    (11.44, 11.98, "and STROKE IT", "R"), (11.98, 12.95, "instead.", "W"),
    (12.95, 13.80, "CLEVER!", "Y"),
    (13.80, 14.46, "But his deck", "W"), (14.46, 15.46, "is SO WIDE", "R"), (15.46, 16.18, "it takes forever", "W"),
    (16.18, 17.15, "to cover.", "W"),
    (17.15, 18.26, "So you swap to a", "W"), (18.26, 18.84, "FUZZY SLEEVE", "R"), (18.84, 19.68, "that spins on a", "W"),
    (19.68, 21.05, "bent wire frame.", "W"),
    (21.05, 22.10, "GENIUS!", "Y"),
    (22.10, 22.92, "Except it", "W"), (22.92, 23.76, "DRIPS EVERYWHERE", "R"), (23.76, 24.36, "when you dip it", "W"),
    (24.36, 25.40, "in the bucket.", "W"),
    (25.40, 26.04, "So you add a", "W"), (26.04, 26.60, "RIBBED", "R"), (26.60, 27.28, "METAL TRAY", "R"),
    (27.28, 27.88, "to roll off", "W"), (27.88, 28.45, "the EXTRA JUICE.", "R"),
    (28.45, 29.52, "But your back", "W"), (29.52, 30.20, "HURTS", "R"), (30.20, 31.02, "from kneeling down", "W"),
    (31.02, 31.85, "to work on his deck.", "W"),
    (31.85, 32.58, "So you screw a", "W"), (32.58, 33.40, "LONG POLE", "R"), (33.40, 34.08, "onto the handle", "W"),
    (34.08, 35.06, "to glide back", "W"), (35.06, 35.52, "and forth", "W"), (35.52, 36.45, "while standing.", "W"),
    (36.45, 37.44, "Now Dale loves", "W"), (37.44, 38.04, "how you treat", "W"), (38.04, 40.30, "HIS DECK.", "L"),
]

HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: W,Montserrat Black,86,&H00FFFFFF,&H00FFFFFF,&H00101010,&H8C000000,0,0,0,0,100,100,0,0,1,6,5,5,60,60,0,1
Style: Y,Montserrat Black,112,&H0021D6FF,&H0021D6FF,&H00000000,&H8C000000,0,0,0,0,100,100,0,0,1,8,6,5,60,60,0,1
Style: R,Montserrat Black,112,&H002D2DFF,&H002D2DFF,&H00FFFFFF,&H8C000000,0,0,0,0,100,100,0,0,1,7,6,5,60,60,0,1
Style: L,Montserrat Black,118,&H002D2DFF,&H002D2DFF,&H00FFFFFF,&HA0000000,0,0,0,0,100,100,0,0,1,9,8,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ts(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


if __name__ == "__main__":
    for (a, b, _, _), (c, _, _, _) in zip(C, C[1:]):
        assert a < b <= c + 1e-6, (a, b, c)
    lines = [HEAD]
    for (a, b, text, st) in C:
        if st == "W":
            anim = r"{\pos(540,1150)\fscx78\fscy78\t(0,80,\fscx104\fscy104)\t(80,140,\fscx100\fscy100)}"
        elif st == "L":
            anim = r"{\pos(540,1130)\fscx40\fscy40\t(0,120,\fscx115\fscy115)\t(120,220,\fscx100\fscy100)}"
        else:
            anim = r"{\pos(540,1140)\fscx55\fscy55\t(0,100,\fscx112\fscy112)\t(100,180,\fscx100\fscy100)}"
        lines.append(f"Dialogue: 0,{ts(a)},{ts(b)},{st},,0,0,0,,{anim}{text}\n")
    open(OUT, "w").write("".join(lines))
    print("captions:", len(C), "->", OUT)
