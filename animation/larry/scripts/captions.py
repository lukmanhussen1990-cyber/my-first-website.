"""Write the caption track (.ass) on the edited timeline. Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style) — times in seconds on the edited voiceover timeline
C = [
    (0.00, 0.50, "You just", "W"), (0.50, 0.92, "start your", "W"), (0.92, 1.86, "new job,", "W"),
    (1.86, 2.26, "but Larry", "W"), (2.26, 2.96, "from accounting", "W"), (2.96, 3.72, "keeps touching", "W"),
    (3.72, 5.26, "you inappropriately.", "W"),
    (5.26, 5.78, "So you", "W"), (5.78, 6.90, "call the police.", "W"), (6.90, 7.94, "GENIUS!", "Y"),
    (7.94, 8.42, "But Larry", "W"), (8.42, 9.24, "pays his bail", "W"), (9.24, 9.90, "with", "W"),
    (9.90, 11.24, "your wallet.", "W"),
    (11.24, 11.90, "So you get", "W"), (11.90, 12.36, "a restraining", "W"), (12.36, 13.32, "order.", "W"),
    (13.32, 13.64, "Larry has", "W"), (13.64, 14.02, "to stay", "W"), (14.02, 14.92, "500 feet", "W"),
    (14.92, 15.65, "away.", "W"), (15.65, 16.66, "CLEVER!", "Y"),
    (16.66, 17.38, "Except Larry", "W"), (17.38, 17.78, "buys a", "W"), (17.78, 19.02, "501-foot", "W"),
    (19.02, 19.88, "stick.", "W"),
    (19.88, 20.64, "So you move", "W"), (20.64, 21.02, "to another", "W"), (21.02, 21.82, "country.", "W"),
    (21.82, 22.82, "PERFECT!", "Y"),
    (22.82, 23.30, "But Larry", "W"), (23.30, 24.14, "mails himself", "W"), (24.14, 24.48, "to your", "W"),
    (24.48, 25.52, "new house.", "W"),
    (25.52, 26.34, "So you hire", "W"), (26.34, 27.02, "the biggest", "W"), (27.02, 27.62, "bodyguard", "W"),
    (27.62, 28.74, "on earth.", "W"), (28.74, 30.03, "MUCH BETTER!", "Y"),
    (30.06, 30.68, "Except Larry", "W"), (30.68, 31.62, "somehow still", "W"), (31.62, 32.38, "manages to", "W"),
    (32.38, 32.78, "F***ING", "R"), (32.78, 33.96, "TOUCH YOU!", "R"),
    (33.96, 34.78, "So you hire", "W"), (34.78, 35.50, "the entire", "W"), (35.50, 36.56, "army.", "W"),
    (36.56, 37.27, "TANKS.", "W"), (37.27, 38.02, "JETS.", "W"),
    (38.02, 38.40, "A soldier", "W"), (38.40, 39.18, "at every", "W"), (39.18, 40.00, "window.", "W"),
    (40.00, 40.42, "Larry gets", "W"), (40.42, 40.78, "tackled", "W"), (40.78, 42.38, "in two seconds.", "W"),
    (42.38, 43.06, "Now you", "W"), (43.06, 43.98, "finally sleep", "W"), (43.98, 45.12, "in peace.", "W"),
    (45.48, 45.90, "The soldier", "W"), (45.90, 46.74, "tucking you in", "W"),
    (46.74, 47.32, "is", "W"), (47.32, 49.30, "LARRY.", "L"),
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
Style: L,Montserrat Black,150,&H002D2DFF,&H002D2DFF,&H00FFFFFF,&HA0000000,0,0,0,0,100,100,0,0,1,9,8,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ts(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


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
