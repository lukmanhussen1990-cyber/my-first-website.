"""Episode 12 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.50, "If the guy", "W"), (0.50, 1.22, "in the next car", "W"), (1.22, 1.68, "sees you", "W"),
    (1.68, 2.80, "picking your NOSE,", "R"),
    (2.80, 3.78, "most people", "W"), (3.78, 4.85, "pretend to scratch.", "W"),
    (4.85, 6.05, "That's a MISTAKE.", "R"),
    (6.05, 6.80, "You see,", "W"), (6.80, 8.30, "he's STILL watching.", "W"),
    (8.30, 8.74, "There are", "W"), (8.74, 9.85, "THREE steps.", "W"),
    (9.85, 10.60, "First,", "Y"), (10.60, 11.45, "COMMIT.", "R"),
    (11.45, 12.90, "Hold eye contact.", "W"),
    (12.90, 13.92, "GO DEEPER.", "R"),
    (13.92, 14.95, "Second,", "Y"), (14.95, 16.30, "follow him to work.", "W"),
    (16.30, 17.70, "Sit in his meeting.", "W"),
    (17.70, 18.90, "Do it SLOWER.", "R"),
    (18.90, 19.95, "Third,", "Y"), (19.95, 20.42, "leave one", "W"), (20.42, 21.14, "on his windscreen", "W"),
    (21.14, 21.90, "with a note:", "W"),
    (21.90, 23.15, "\"YOU DROPPED THIS.\"", "L"),
    (23.15, 23.88, "Now he takes", "W"), (23.88, 24.36, "the BUS,", "W"), (24.36, 25.50, "because...", "W"),
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
