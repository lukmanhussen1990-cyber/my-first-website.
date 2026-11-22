"""Episode 11 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.80, "You are SO", "W"), (0.80, 1.45, "F***ING", "R"), (1.45, 2.92, "sick of DALE!", "R"),
    (2.92, 3.60, "Ever since he", "W"), (3.60, 4.40, "got out of prison,", "W"),
    (4.40, 5.20, "he follows you", "W"), (5.20, 6.40, "EVERYWHERE.", "R"),
    (6.40, 7.40, "So you buy a TANK", "W"), (7.40, 8.75, "and fire it at him.", "W"),
    (8.75, 9.78, "GENIUS!", "Y"),
    (9.78, 10.90, "But Dale catches", "W"), (10.90, 11.30, "the shell", "W"), (11.30, 12.45, "and throws it back.", "W"),
    (12.45, 13.30, "So you fly", "W"), (13.30, 14.18, "to the SUN.", "W"),
    (14.18, 15.05, "CLEVER!", "Y"),
    (15.05, 15.70, "But Dale is", "W"), (15.70, 16.60, "already there,", "W"), (16.60, 18.05, "working on his tan.", "W"),
    (18.05, 19.22, "So you RUN.", "W"),
    (19.22, 20.08, "The moon?", "W"), (20.08, 20.72, "DALE.", "R"),
    (20.72, 21.30, "The bottom", "W"), (21.30, 22.02, "of the ocean?", "W"), (22.02, 22.78, "DALE.", "R"),
    (22.78, 23.88, "The North Pole?", "W"), (23.88, 24.75, "DALE.", "R"),
    (24.75, 25.50, "So you die", "W"), (25.50, 26.68, "and go to HEAVEN.", "W"),
    (26.68, 27.55, "PERFECT!", "Y"),
    (27.55, 28.20, "But the angel", "W"), (28.20, 28.85, "at the gate", "W"), (28.85, 30.38, "is DALE.", "R"),
    (30.38, 31.62, "So you go to HELL.", "W"),
    (31.62, 32.75, "MUCH BETTER!", "Y"),
    (32.75, 33.60, "But the guy roasting", "W"), (33.60, 34.30, "marshmallows", "W"), (34.30, 35.82, "is DALE.", "R"),
    (35.82, 36.60, "So you hire", "W"), (36.60, 37.30, "a HITMAN,", "R"), (37.30, 37.95, "the best", "W"), (37.95, 38.85, "in the business.", "W"),
    (38.85, 39.35, "But Dale", "W"), (39.35, 39.95, "folds him like a", "W"), (39.95, 41.12, "LAWN CHAIR.", "R"),
    (41.12, 41.70, "So you run", "W"), (41.70, 42.72, "home to your MOM.", "W"),
    (42.72, 43.55, "The one place", "W"), (43.55, 45.12, "Dale would never go.", "W"),
    (45.12, 46.40, "She opens the door.", "W"),
    (46.40, 47.00, "Honey,", "W"), (47.00, 47.40, "meet your new", "W"), (47.40, 48.22, "STEPDAD.", "R"),
    (48.22, 50.20, "HI, SON.", "L"),
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
