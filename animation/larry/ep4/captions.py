"""Episode 4 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.60, "Every night", "W"), (0.60, 1.86, "at 3 AM,", "W"), (1.86, 2.76, "two grown men", "W"),
    (2.76, 3.44, "fly through", "W"), (3.44, 4.80, "your bedroom window.", "W"),
    (4.80, 5.26, "Larry from", "W"), (5.26, 6.05, "accounting", "W"), (6.05, 6.46, "and Dale", "W"), (6.46, 7.79, "from IT.", "W"),
    (7.79, 8.34, "They're here", "W"), (8.34, 9.58, "for one thing…", "W"), (9.58, 9.72, "your", "W"), (9.72, 10.90, "UNDERWEAR.", "R"),
    (10.90, 11.36, "So you lock", "W"), (11.36, 12.20, "the window.", "W"), (12.20, 13.45, "GENIUS!", "Y"),
    (13.45, 14.20, "But they come down", "W"), (14.20, 15.65, "the chimney instead.", "W"),
    (15.65, 17.09, "Covered in soot.", "W"), (17.09, 17.50, "Holding", "W"), (17.50, 18.62, "YOUR BOXERS.", "R"),
    (18.62, 19.16, "So you hide", "W"), (19.16, 19.84, "your underwear", "W"), (19.84, 20.79, "in a safe.", "W"),
    (20.79, 21.68, "CLEVER!", "Y"),
    (21.68, 22.52, "But Larry already", "W"), (22.52, 23.70, "knows the code.", "W"),
    (23.70, 24.40, "And Dale is", "W"), (24.40, 25.34, "already inside", "W"), (25.34, 26.36, "THE SAFE.", "R"),
    (26.36, 26.78, "So you get", "W"), (26.78, 27.80, "a guard dog.", "W"), (27.80, 28.82, "PERFECT!", "Y"),
    (28.82, 29.64, "But the guard dog", "W"), (29.64, 30.10, "is…", "W"), (30.10, 31.20, "DALE.", "R"),
    (31.20, 32.17, "Again.", "W"), (32.17, 32.86, "And Larry is", "W"), (32.86, 34.04, "walking him.", "W"),
    (34.04, 34.72, "So you stop", "W"), (34.72, 35.88, "wearing underwear.", "W"), (35.88, 36.98, "MUCH BETTER!", "Y"),
    (36.98, 37.58, "But now they", "W"), (37.58, 37.84, "SNIFF", "R"), (37.84, 39.09, "YOUR JEANS.", "R"),
    (39.09, 39.92, "So you move into", "W"), (39.92, 40.32, "a house", "W"), (40.32, 41.29, "with no windows,", "W"),
    (41.29, 42.16, "no chimney,", "W"), (42.16, 43.61, "and no underwear.", "W"), (43.61, 45.18, "Peace at last.", "W"),
    (45.18, 46.10, "But that night,", "W"), (46.10, 46.66, "you open", "W"), (46.66, 47.83, "your laundry basket", "W"),
    (47.83, 48.76, "and two faces", "W"), (48.76, 50.29, "smile up at you…", "W"),
    (50.29, 52.60, "FRESH BATCH?", "L"),
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
