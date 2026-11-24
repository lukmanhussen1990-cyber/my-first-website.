"""Episode 18 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 1.45, "You are DALE.", "R"),
    (1.45, 2.76, "And you love your baby", "W"), (2.76, 4.05, "SO much.", "Y"),
    (4.05, 4.94, "But your baby", "W"), (4.94, 6.15, "HATES you.", "R"),
    (6.15, 7.62, "So you write him a love letter.", "W"),
    (7.62, 8.80, "ROMANTIC!", "Y"),
    (8.80, 10.20, "But he BURNS it.", "R"),
    (10.20, 11.65, "So you write it on his car.", "W"),
    (11.65, 12.88, "In his cereal.", "W"),
    (12.88, 14.15, "In the SKY!", "Y"),
    (14.15, 15.95, "He finally writes back.", "W"),
    (15.95, 17.30, "\"LEAVE ME ALONE.\"", "R"),
    (17.30, 18.55, "He wrote BACK!", "Y"),
    (18.55, 20.45, "So you sing under his window.", "W"),
    (20.45, 21.65, "ADORABLE!", "Y"),
    (21.65, 23.42, "But he throws his SHOE at you.", "R"),
    (23.42, 24.40, "A GIFT!", "Y"),
    (24.40, 25.85, "Now you sleep with it.", "W"),
    (25.85, 27.15, "So you cook him dinner.", "W"),
    (27.15, 28.40, "SO SWEET!", "Y"),
    (28.40, 29.36, "But he climbs out", "W"), (29.36, 30.52, "the bathroom WINDOW.", "R"),
    (30.52, 32.62, "So you wait in the getaway car.", "W"),
    (32.62, 33.68, "With DESSERT.", "Y"),
    (33.68, 35.28, "He changes the LOCKS.", "R"),
    (35.28, 36.48, "So you move in.", "W"),
    (36.48, 37.75, "Under his BED.", "R"),
    (37.75, 39.60, "He moves to another country.", "W"),
    (39.60, 40.60, "HONEYMOON!", "Y"),
    (40.60, 42.55, "He buries you in his GARDEN.", "R"),
    (42.55, 44.05, "He wants you close.", "W"),
    (44.05, 45.08, "FOREVER.", "Y"),
    (45.08, 45.80, "One night,", "W"), (45.80, 47.68, "he finally hugs you back.", "W"),
    (47.68, 48.78, "He's ASLEEP.", "R"),
    (48.78, 50.50, "You never move again.", "W"),
    (50.50, 52.02, "Best night of your LIFE.", "Y"),
    (52.02, 54.15, "He wakes up screaming your name.", "W"),
    (54.15, 55.20, "\"DALE!\"", "L"),
    (55.20, 56.65, "He's just SHY.", "L"),
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
