"""Episode 15 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.68, "DALE", "R"), (0.68, 2.40, "has been missing for 2 DAYS.", "W"),
    (2.40, 3.30, "And honestly?", "W"), (3.30, 5.30, "Best two days of your LIFE.", "Y"),
    (5.30, 6.70, "No one in your window.", "W"),
    (6.70, 8.10, "No one in your shower.", "W"),
    (8.10, 9.95, "Just PEACE.", "Y"),
    (9.95, 10.86, "Then someone", "W"), (10.86, 12.25, "BANGS on your door.", "R"),
    (12.25, 13.30, "It's LARRY.", "R"), (13.30, 14.55, "Crying.", "W"),
    (14.55, 15.85, "Still in his wedding dress.", "W"),
    (15.85, 17.50, "\"My husband is MISSING!\"", "R"),
    (17.50, 18.26, "\"You have to", "W"), (18.26, 19.35, "help me find him!\"", "W"),
    (19.35, 20.70, "You close the door.", "W"),
    (20.70, 22.30, "He climbs in through the WINDOW.", "W"),
    (22.30, 23.70, "He gets on his knees.", "W"),
    (23.70, 24.95, "He hugs your leg.", "W"),
    (24.95, 26.35, "He offers you a RAISE.", "Y"),
    (26.35, 27.65, "He offers you his CAR.", "Y"),
    (27.65, 28.70, "He offers you...", "W"), (28.70, 30.30, "his MOUSTACHE.", "R"),
    (30.30, 31.75, "But here's the problem.", "W"),
    (31.75, 32.80, "If you help Larry,", "W"), (32.80, 35.20, "Dale comes back. FOREVER.", "R"),
    (35.20, 36.45, "In your window.", "W"),
    (36.45, 37.45, "In your shower.", "W"),
    (37.45, 38.70, "In your BED.", "R"),
    (38.70, 39.90, "But if you don't help,", "W"), (39.90, 41.10, "Larry moves in.", "W"),
    (41.10, 43.40, "And he NEVER stops crying.", "R"),
    (43.40, 44.70, "So what do you do?", "Y"),
    (44.70, 46.30, "Help Larry find Dale?", "W"),
    (46.30, 47.50, "Or enjoy the peace...", "W"), (47.50, 49.70, "with a crying Larry on your couch?", "W"),
    (49.70, 51.60, "Comment YES or NO.", "L"),
    (51.60, 53.40, "PART 2 is up to you.", "L"),
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
