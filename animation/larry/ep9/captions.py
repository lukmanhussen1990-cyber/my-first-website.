"""Episode 9 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.62, "DALE", "R"), (0.62, 1.25, "AHHH!", "Y"),
    (1.25, 2.10, "MIDNIGHT.", "W"),
    (2.10, 2.82, "DALE", "R"), (2.82, 3.40, "is chasing you", "W"), (3.40, 3.95, "down the street", "W"),
    (3.95, 4.56, "and you're", "W"), (4.56, 5.06, "SCREAMING", "R"), (5.06, 5.70, "for your life.", "W"),
    (5.70, 6.60, "And right behind", "W"), (6.60, 7.40, "Dale... is", "W"), (7.40, 8.50, "LARRY.", "R"),
    (8.50, 9.40, "You're running to", "W"), (9.40, 10.60, "the police station.", "W"),
    (10.60, 11.90, "Let me explain.", "W"),
    (11.90, 12.66, "Last week,", "W"), (12.66, 13.20, "you took Dale", "W"), (13.20, 14.15, "TO COURT.", "R"),
    (14.15, 14.94, "FIVE YEARS", "R"), (14.94, 15.90, "in prison.", "W"),
    (15.90, 16.95, "GENIUS!", "Y"),
    (16.95, 17.47, "But Dale", "W"), (17.47, 18.42, "ESCAPED.", "R"),
    (18.42, 18.80, "In a", "W"), (18.80, 19.90, "GARBAGE TRUCK.", "R"),
    (19.90, 20.76, "Then he walked", "W"), (20.76, 21.46, "SIX DAYS", "R"), (21.46, 22.20, "straight", "W"),
    (22.20, 23.38, "to your window.", "W"),
    (23.38, 24.10, "So you hide at", "W"), (24.10, 25.00, "your mom's house.", "W"),
    (25.00, 25.78, "CLEVER!", "Y"),
    (25.78, 26.50, "But the guy in the", "W"), (26.50, 27.30, "WASHING MACHINE", "R"), (27.30, 28.55, "is LARRY.", "R"),
    (28.55, 29.30, "So you check", "W"), (29.30, 30.15, "into a hotel.", "W"),
    (30.15, 31.12, "PERFECT!", "Y"),
    (31.12, 32.35, "But room service is", "W"), (32.35, 33.45, "DALE.", "R"),
    (33.45, 34.20, "So you sleep", "W"), (34.20, 35.00, "in your car.", "W"),
    (35.00, 36.08, "MUCH BETTER!", "Y"),
    (36.08, 36.90, "But Dale is", "W"), (36.90, 37.75, "IN THE TRUNK.", "R"),
    (37.75, 38.60, "And Larry is", "W"), (38.60, 39.75, "IN THE GLOVEBOX.", "R"),
    (39.75, 40.30, "That's why", "W"), (40.30, 41.25, "YOU'RE RUNNING.", "R"),
    (41.25, 41.80, "At the police", "W"), (41.80, 42.33, "station,", "W"),
    (42.33, 43.00, "the officer", "W"), (43.00, 43.85, "HAS A PLAN.", "R"),
    (43.85, 44.60, "The safest place", "W"), (44.60, 45.55, "on earth?", "W"),
    (45.55, 46.30, "MAXIMUM", "R"), (46.30, 47.50, "SECURITY PRISON.", "R"),
    (47.50, 48.25, "So you get", "W"), (48.25, 49.10, "your own cell.", "W"),
    (49.10, 50.70, "Peace at last.", "W"),
    (50.70, 51.40, "That night,", "W"), (51.40, 52.25, "a garbage truck", "W"), (52.25, 52.80, "pulls into", "W"),
    (52.80, 53.45, "the prison.", "W"),
    (53.45, 54.20, "Your cell door", "W"), (54.20, 55.42, "CREAKS OPEN.", "R"),
    (55.42, 57.60, "WE BROKE BACK IN.", "L"),
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
