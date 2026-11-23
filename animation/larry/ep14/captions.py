"""Episode 14 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 1.04, "You are SO", "W"), (1.04, 2.30, "done with DALE.", "R"),
    (2.30, 3.12, "First he became", "W"), (3.12, 4.20, "your STEPDAD.", "W"),
    (4.20, 5.02, "Now he wants", "W"), (5.02, 6.30, "to be your HUSBAND?", "R"),
    (6.30, 7.60, "So he KIDNAPS you.", "W"),
    (7.60, 9.10, "In a garbage truck.", "W"),
    (9.10, 9.74, "Duct-tapes you", "W"), (9.74, 10.70, "to a chair.", "W"),
    (10.70, 11.80, "At the ALTAR.", "R"),
    (11.80, 12.65, "The priest?", "W"), (12.65, 13.60, "Also DALE.", "R"), (13.60, 15.10, "In a fake moustache.", "W"),
    (15.10, 16.25, "\"Do you take Dale?\"", "W"), (16.25, 16.70, "MMMPH!", "R"),
    (16.70, 18.00, "\"He said YES!\"", "Y"),
    (18.00, 18.92, "Then the doors", "W"), (18.92, 19.95, "BURST open.", "R"),
    (19.95, 20.85, "It's LARRY.", "R"),
    (20.85, 22.05, "In a wedding dress.", "W"),
    (22.05, 22.76, "\"Get away from", "W"), (22.76, 23.65, "my HUSBAND!\"", "R"),
    (23.65, 25.15, "Dale throws the CAKE.", "W"),
    (25.15, 25.78, "Larry throws", "W"), (25.78, 26.60, "the PRIEST.", "W"),
    (26.60, 27.70, "Who is ALSO Dale.", "R"),
    (27.70, 28.64, "They fight", "W"), (28.64, 29.35, "down the aisle.", "W"),
    (29.35, 30.30, "Over the benches.", "W"),
    (30.30, 31.10, "Out the WINDOW.", "W"),
    (31.10, 31.78, "And back in", "W"), (31.78, 32.80, "through the ROOF.", "W"),
    (32.80, 33.90, "Covered in cake.", "W"),
    (33.90, 34.90, "Both screaming,", "W"), (34.90, 35.95, "\"I DO!\"", "R"),
    (35.95, 37.08, "Then the real priest", "W"), (37.08, 38.20, "wakes up and says,", "W"),
    (38.20, 39.40, "\"I now pronounce you", "W"), (39.40, 41.30, "HUSBAND and HUSBAND.\"", "R"),
    (41.30, 41.98, "Larry and Dale", "W"), (41.98, 42.95, "look at each other.", "W"),
    (42.95, 43.92, "They just MARRIED", "R"), (43.92, 44.65, "each other.", "R"),
    (44.65, 45.70, "You're FREE!", "Y"),
    (45.70, 46.22, "Then they", "W"), (46.22, 47.10, "turn around.", "W"),
    (47.10, 48.10, "\"Honey...", "W"), (48.10, 49.30, "let's ADOPT.\"", "L"),
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
