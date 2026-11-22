"""Episode 10 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.64, "If DALE", "R"), (0.64, 1.15, "is watching you", "W"), (1.15, 2.02, "TAKE A SHIT,", "R"),
    (2.02, 2.62, "most people", "W"), (2.62, 3.20, "yell at him", "W"), (3.20, 4.20, "to get out.", "W"),
    (4.20, 4.60, "That's a", "W"), (4.60, 5.35, "MISTAKE.", "R"),
    (5.35, 6.15, "You see,", "W"), (6.15, 6.90, "he thinks it's", "W"), (6.90, 7.85, "A SHOW.", "R"),
    (7.85, 8.45, "There are", "W"), (8.45, 9.30, "THREE STEPS.", "R"),
    (9.30, 10.15, "FIRST,", "Y"), (10.15, 10.78, "give the people", "W"), (10.78, 11.80, "what they want.", "W"),
    (11.80, 12.85, "SELL TICKETS.", "R"),
    (12.85, 13.65, "Front row,", "W"), (13.65, 14.65, "$10.", "R"),
    (14.65, 15.62, "SECOND,", "Y"), (15.62, 16.10, "upgrade", "W"), (16.10, 16.85, "the bathroom.", "W"),
    (16.85, 17.85, "SPOTLIGHTS,", "R"), (17.85, 18.70, "a red curtain,", "W"),
    (18.70, 19.30, "popcorn", "W"), (19.30, 20.05, "for LARRY.", "R"),
    (20.05, 20.90, "THIRD,", "Y"), (20.90, 21.72, "when you flush,", "W"),
    (21.72, 22.50, "stand up and", "W"), (22.50, 23.50, "TAKE A BOW.", "R"),
    (23.50, 24.10, "Dale will", "W"), (24.10, 24.85, "BEG", "R"), (24.85, 25.65, "for an encore,", "W"),
    (25.65, 26.45, "because...", "W"),
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
