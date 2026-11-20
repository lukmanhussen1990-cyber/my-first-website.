"""Episode 7 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.68, "DALE", "R"), (0.68, 1.26, "is in prison", "W"), (1.26, 2.60, "FOR FIVE YEARS,", "R"),
    (2.60, 3.26, "and LARRY", "R"), (3.26, 3.90, "from accounting", "W"), (3.90, 4.64, "is not", "W"),
    (4.64, 5.70, "handling it well.", "W"),
    (5.70, 6.44, "He tries to", "W"), (6.44, 7.40, "break him out.", "W"),
    (7.40, 7.98, "A file", "W"), (7.98, 9.30, "baked in a cake?", "W"),
    (9.30, 10.02, "Dale eats", "W"), (10.02, 10.80, "THE FILE.", "R"),
    (10.80, 11.36, "A secret", "W"), (11.36, 11.85, "tunnel?", "W"),
    (11.85, 12.58, "It comes up in", "W"), (12.58, 13.00, "THE WARDEN'S", "R"), (13.00, 13.70, "OFFICE.", "R"),
    (13.70, 14.32, "A fake", "W"), (14.32, 15.45, "guard uniform?", "W"),
    (15.45, 16.48, "Larry gets locked up", "W"), (16.48, 18.00, "FOR THREE HOURS.", "R"),
    (18.00, 18.80, "So that night,", "W"), (18.80, 19.96, "Larry climbs into", "W"), (19.96, 20.60, "your bed", "W"),
    (20.60, 21.08, "and", "W"), (21.08, 22.00, "SPOONS YOU.", "R"),
    (22.00, 23.02, "Because without Dale,", "W"), (23.02, 23.80, "he has no one", "W"), (23.80, 24.50, "to cuddle.", "W"),
    (24.50, 25.32, "So you lock", "W"), (25.32, 26.40, "your bedroom door.", "W"), (26.40, 27.35, "GENIUS!", "Y"),
    (27.35, 28.38, "But Larry comes in", "W"), (28.38, 29.50, "through THE CAT FLAP.", "R"),
    (29.50, 30.28, "So you put a", "W"), (30.28, 31.12, "giant teddy bear", "W"), (31.12, 31.90, "in your bed.", "W"),
    (31.90, 32.65, "CLEVER!", "Y"),
    (32.65, 33.46, "But when you hug", "W"), (33.46, 34.22, "the bear,", "W"), (34.22, 35.40, "IT HUGS YOU BACK.", "R"),
    (35.40, 36.10, "It's Larry.", "W"), (36.10, 37.55, "IN A BEAR SUIT.", "R"),
    (37.55, 38.38, "So you sleep", "W"), (38.38, 39.20, "in a hammock.", "W"), (39.20, 39.95, "PERFECT!", "Y"),
    (39.95, 40.70, "But Larry is", "W"), (40.70, 41.74, "already in it,", "W"), (41.74, 43.05, "holding a nightlight.", "W"),
    (43.05, 43.96, "So you go to", "W"), (43.96, 44.82, "the prison and", "W"), (44.82, 45.30, "BEG THEM", "R"), (45.30, 46.10, "TO LET DALE OUT.", "R"),
    (46.10, 47.00, "MUCH BETTER!", "Y"),
    (47.00, 47.92, "Now Larry has", "W"), (47.92, 49.20, "his best friend back.", "W"), (49.20, 50.65, "Peace at last.", "W"),
    (50.65, 51.50, "But that night,", "W"), (51.50, 52.50, "you wake up", "W"), (52.50, 53.10, "SQUEEZED", "R"), (53.10, 53.85, "IN THE MIDDLE.", "R"),
    (53.85, 54.40, "LARRY", "R"), (54.40, 55.20, "on your left.", "W"),
    (55.20, 55.60, "DALE", "R"), (55.60, 56.55, "on your right.", "W"),
    (56.55, 57.08, "Thanks for", "W"), (57.08, 57.60, "getting me out,", "W"), (57.60, 58.20, "buddy.", "W"),
    (58.20, 60.30, "GROUP HUG?", "L"),
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
