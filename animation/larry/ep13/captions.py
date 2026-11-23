"""Episode 13 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.58, "If you laugh", "W"), (0.58, 1.56, "WAY too hard", "R"), (1.56, 2.95, "at your boss's joke,", "W"),
    (2.95, 3.86, "most people stop", "W"), (3.86, 4.38, "and clear", "W"), (4.38, 5.30, "their throat.", "W"),
    (5.30, 6.55, "That's a MISTAKE.", "R"),
    (6.55, 7.26, "You see,", "W"), (7.26, 8.45, "he LOVED it.", "W"),
    (8.45, 8.90, "There are", "W"), (8.90, 9.92, "THREE steps.", "W"),
    (9.92, 10.70, "First,", "Y"), (10.70, 11.55, "COMMIT.", "R"),
    (11.55, 11.92, "Laugh at", "W"), (11.92, 13.22, "EVERYTHING he says.", "W"),
    (13.22, 13.62, "Even", "W"), (13.62, 14.90, "\"Good morning.\"", "R"),
    (14.90, 15.70, "Second,", "Y"), (15.70, 16.18, "follow him", "W"), (16.18, 17.10, "to the TOILET.", "W"),
    (17.10, 17.90, "Laugh outside", "W"), (17.90, 18.80, "the door.", "W"),
    (18.80, 19.62, "Third,", "Y"), (19.62, 20.26, "at your performance", "W"), (20.26, 21.00, "review,", "W"),
    (21.00, 21.88, "laugh so hard", "W"), (21.88, 22.36, "you fall", "R"), (22.36, 23.30, "off your CHAIR.", "R"),
    (23.30, 23.94, "He'll make you", "W"), (23.94, 24.76, "HEAD OF LAUGHING,", "L"), (24.76, 25.90, "because...", "W"),
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
