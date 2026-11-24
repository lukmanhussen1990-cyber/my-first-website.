"""Episode 16 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.94, "You are going to", "W"), (0.94, 1.66, "KILL DALE", "R"), (1.66, 3.15, "TONIGHT!", "R"),
    (3.15, 4.16, "Because Dale was", "W"), (4.16, 5.25, "NEVER missing.", "R"),
    (5.25, 7.10, "It was all a PLAN.", "Y"),
    (7.10, 8.95, "Dale disappears.", "W"),
    (8.95, 10.00, "Larry cries.", "W"),
    (10.00, 11.15, "You feel bad.", "W"),
    (11.15, 12.45, "You let Larry in.", "W"),
    (12.45, 13.42, "And then they", "W"), (13.42, 14.25, "CUDDLE you.", "R"),
    (14.25, 15.55, "From both sides.", "W"),
    (15.55, 16.65, "All night.", "W"),
    (16.65, 17.80, "So you're DONE.", "R"),
    (17.80, 18.42, "You grab", "W"), (18.42, 19.45, "an AK-47.", "R"),
    (19.45, 20.54, "You find Dale", "W"), (20.54, 21.35, "on your couch.", "W"),
    (21.35, 22.55, "Eating your cereal.", "W"),
    (22.55, 23.60, "\"Morning, honey!\"", "Y"),
    (23.60, 24.50, "BANG!", "L"),
    (24.50, 26.00, "Then you dig.", "W"),
    (26.00, 27.00, "All night.", "W"), (27.00, 28.25, "In the garden.", "W"),
    (28.25, 29.20, "Deep.", "W"), (29.20, 30.00, "DEEPER.", "Y"), (30.00, 31.20, "DEEPER.", "R"),
    (31.20, 32.40, "You drop him in.", "W"),
    (32.40, 33.65, "You fill the hole.", "W"),
    (33.65, 34.48, "You even put", "W"), (34.48, 35.65, "a little stone on top:", "W"),
    (35.65, 37.05, "\"Here lies Dale.", "W"), (37.05, 38.05, "FINALLY.\"", "Y"),
    (38.05, 39.62, "And for the first time in months...", "W"), (39.62, 41.25, "you SLEEP.", "Y"),
    (41.25, 42.65, "No one in your window.", "W"),
    (42.65, 44.05, "No one in your shower.", "W"),
    (44.05, 45.50, "No one in your bed.", "W"), (45.50, 46.75, "PEACE.", "Y"),
    (46.75, 48.35, "Until 3 DAYS LATER...", "W"),
    (48.35, 49.00, "when the dirt", "W"), (49.00, 50.80, "starts to MOVE.", "R"),
    (50.80, 52.55, "Is Dale really DEAD?", "R"),
    (52.55, 54.15, "Comment YES or NO.", "L"),
    (54.15, 55.70, "PART 2 reveals.", "L"),
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
