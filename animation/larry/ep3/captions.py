"""Episode 3 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.66, "You just want", "W"), (0.66, 1.48, "a normal", "W"), (1.48, 2.37, "lunch break,", "W"),
    (2.37, 2.98, "but Larry", "W"), (2.98, 3.42, "from accounting", "W"), (3.42, 4.22, "keeps begging", "W"),
    (4.22, 4.64, "you to", "W"), (4.64, 5.77, "BEAT HIS MEAT.", "R"),
    (5.77, 6.26, "So you", "W"), (6.26, 6.82, "report him", "W"), (6.82, 7.65, "to HR.", "W"), (7.65, 8.68, "GENIUS!", "Y"),
    (8.68, 9.40, "But HR says", "W"), (9.40, 10.08, "it's just", "W"), (10.08, 11.19, "a steak", "W"),
    (11.19, 11.66, "and hands you", "W"), (11.66, 12.72, "a hammer.", "W"),
    (12.72, 13.28, "So you", "W"), (13.28, 14.25, "go vegan.", "W"), (14.25, 15.16, "CLEVER!", "Y"),
    (15.16, 15.92, "But Larry follows", "W"), (15.92, 16.54, "you into", "W"), (16.54, 17.67, "the salad bar,", "W"),
    (17.67, 19.11, "HOLDING HIS MEAT.", "R"),
    (19.11, 19.78, "So you move", "W"), (19.78, 20.48, "to a monastery", "W"), (20.48, 21.61, "in the mountains.", "W"),
    (21.61, 22.52, "PERFECT!", "Y"),
    (22.52, 23.00, "But the monk", "W"), (23.00, 23.94, "ringing the bell", "W"), (23.94, 24.32, "is…", "W"),
    (24.32, 25.35, "LARRY,", "R"), (25.35, 26.13, "and he's ringing it", "W"), (26.13, 27.62, "WITH HIS MEAT.", "R"),
    (27.62, 28.10, "So you hire", "W"), (28.10, 28.92, "a professional", "W"), (28.92, 29.52, "butcher", "W"),
    (29.52, 30.67, "to beat it for him.", "W"), (30.67, 31.73, "MUCH BETTER!", "Y"),
    (31.73, 32.32, "But Larry says", "W"), (32.32, 32.94, "it only gets", "W"), (32.94, 33.34, "tender", "W"),
    (33.34, 34.69, "WHEN YOU DO IT.", "R"),
    (34.69, 35.24, "So you", "W"), (35.24, 36.66, "fake your own death.", "W"), (36.66, 38.29, "Peace at last.", "W"),
    (38.29, 39.43, "But at your funeral,", "W"), (39.43, 40.10, "Larry opens", "W"), (40.10, 40.95, "the coffin,", "W"),
    (40.95, 41.48, "puts a steak", "W"), (41.48, 42.31, "in your hands,", "W"), (42.31, 43.30, "and whispers…", "W"),
    (43.30, 46.50, "JUST ONE LAST TIME.", "L"),
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
Style: L,Montserrat Black,108,&H002D2DFF,&H002D2DFF,&H00FFFFFF,&HA0000000,0,0,0,0,100,100,0,0,1,9,8,5,60,60,0,1

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
