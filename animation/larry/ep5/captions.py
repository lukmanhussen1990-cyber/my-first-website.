"""Episode 5 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.58, "Larry from", "W"), (0.58, 1.20, "accounting", "W"), (1.20, 1.54, "has spent", "W"),
    (1.54, 2.42, "SIX MONTHS", "R"), (2.42, 2.96, "working on", "W"), (2.96, 3.95, "something special,", "W"),
    (3.95, 4.88, "and every day", "W"), (4.88, 5.70, "he asks you", "W"), (5.70, 7.20, "the same thing:", "W"),
    (7.20, 7.70, "Will you sit", "W"), (7.70, 8.55, "on my WOOD?", "R"),
    (8.55, 9.24, "So you", "W"), (9.24, 10.40, "stop sitting down.", "W"), (10.40, 11.50, "GENIUS!", "Y"),
    (11.50, 12.50, "But Larry carves you", "W"), (12.50, 13.04, "a wooden", "W"), (13.04, 14.00, "standing desk…", "W"),
    (14.00, 15.20, "WITH A SEAT.", "R"),
    (15.20, 15.94, "So you buy", "W"), (15.94, 17.10, "a bean bag.", "W"), (17.10, 17.85, "CLEVER!", "Y"),
    (17.85, 18.78, "But the beans are", "W"), (18.78, 19.95, "WOOD CHIPS.", "R"),
    (19.95, 20.54, "LARRY'S", "R"), (20.54, 21.30, "WOOD CHIPS.", "R"),
    (21.30, 22.14, "So you take", "W"), (22.14, 23.05, "the bus home.", "W"), (23.05, 23.90, "PERFECT!", "Y"),
    (23.90, 24.72, "But every seat", "W"), (24.72, 25.46, "on the bus", "W"), (25.46, 26.40, "is made of oak,", "W"),
    (26.40, 27.18, "and the driver", "W"), (27.18, 27.78, "is…", "W"), (27.78, 28.70, "DALE.", "R"),
    (28.70, 29.34, "So you become", "W"), (29.34, 30.50, "an astronaut.", "W"),
    (30.50, 31.45, "Zero gravity.", "W"), (31.45, 32.14, "Nobody sits", "W"), (32.14, 33.05, "in space.", "W"),
    (33.05, 34.00, "MUCH BETTER!", "Y"), (34.00, 35.55, "Peace at last.", "W"),
    (35.55, 36.66, "But then there's", "W"), (36.66, 37.22, "a knock", "W"), (37.22, 38.30, "on the airlock.", "W"),
    (38.30, 39.04, "Larry and Dale", "W"), (39.04, 39.90, "float in,", "W"), (39.90, 40.48, "carrying a", "W"),
    (40.48, 41.20, "wooden", "W"), (41.20, 42.10, "rocking chair.", "W"),
    (42.10, 42.90, "Houston…", "W"), (42.90, 43.66, "he's gonna sit", "W"), (43.66, 46.00, "ON MY WOOD.", "L"),
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
