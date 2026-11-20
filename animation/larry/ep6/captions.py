"""Episode 6 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.80, "LARRY AND DALE", "R"), (0.80, 1.34, "are following", "W"), (1.34, 2.45, "your family car,", "W"),
    (2.45, 3.90, "AGAIN.", "R"),
    (3.90, 4.44, "You just wanted", "W"), (4.44, 5.24, "a nice family", "W"), (5.24, 6.45, "trip to the beach,", "W"),
    (6.45, 7.04, "but in the", "W"), (7.04, 8.25, "rearview mirror,", "W"),
    (8.25, 9.14, "two grown men", "W"), (9.14, 9.84, "in a tiny", "W"), (9.84, 10.85, "RED CAR,", "R"),
    (10.85, 11.28, "matching", "W"), (11.28, 12.45, "SUNGLASSES.", "R"),
    (12.45, 13.04, "So you", "W"), (13.04, 13.55, "speed up,", "W"), (13.55, 14.60, "GENIUS!", "Y"),
    (14.60, 15.26, "But Larry", "W"), (15.26, 16.25, "FLOORS IT.", "R"),
    (16.25, 16.80, "Dale is", "W"), (16.80, 17.36, "hanging out", "W"), (17.36, 17.85, "the window,", "W"),
    (17.85, 18.30, "waving at", "W"), (18.30, 19.20, "YOUR KIDS.", "R"),
    (19.20, 20.15, "So you pull over,", "W"), (20.15, 20.80, "get out,", "W"), (20.80, 21.50, "and march", "W"),
    (21.50, 22.30, "right up to them.", "W"),
    (22.30, 23.55, "LEAVE ME ALONE!", "R"),
    (23.55, 24.14, "They don't", "W"), (24.14, 25.05, "say a word,", "W"),
    (25.05, 25.56, "they just", "W"), (25.56, 26.60, "lean in and", "W"), (26.60, 27.06, "SNIFF", "R"),
    (27.06, 28.05, "YOUR PANTS.", "R"),
    (28.05, 28.56, "So you", "W"), (28.56, 29.00, "SCREAM", "R"), (29.00, 29.70, "and run back", "W"),
    (29.70, 30.60, "to the car.", "W"),
    (30.60, 31.28, "So you take a", "W"), (31.28, 32.06, "secret shortcut", "W"), (32.06, 33.20, "through the forest.", "W"),
    (33.20, 33.90, "CLEVER!", "Y"),
    (33.90, 34.40, "but they're", "W"), (34.40, 35.45, "already there,", "W"), (35.45, 36.40, "parked,", "W"),
    (36.40, 37.65, "HAVING A PICNIC.", "R"),
    (37.65, 38.38, "So you swap", "W"), (38.38, 38.94, "cars at", "W"), (38.94, 39.95, "a gas station.", "W"),
    (39.95, 40.75, "PERFECT!", "Y"),
    (40.75, 41.44, "but the new car", "W"), (41.44, 42.00, "comes with", "W"), (42.00, 42.95, "a driver,", "W"),
    (42.95, 43.50, "and it's…", "W"), (43.50, 44.20, "DALE.", "R"),
    (44.20, 44.88, "So you ditch", "W"), (44.88, 45.50, "the car and", "W"), (45.50, 46.50, "take a plane.", "W"),
    (46.50, 47.45, "MUCH BETTER!", "Y"), (47.45, 49.05, "Peace at last.", "W"),
    (49.05, 49.64, "But then the", "W"), (49.64, 50.36, "seatbelt sign", "W"), (50.36, 51.05, "DINGS.", "R"),
    (51.05, 51.64, "The pilot", "W"), (51.64, 52.85, "clears his throat.", "W"),
    (52.85, 53.40, "Good afternoon,", "W"), (53.40, 53.76, "family.", "W"), (53.76, 54.62, "This is your", "W"),
    (54.62, 55.40, "captain…", "W"), (55.40, 56.10, "LARRY.", "R"),
    (56.10, 56.54, "And your", "W"), (56.54, 57.30, "co-pilot…", "W"), (57.30, 57.95, "DALE.", "R"),
    (57.95, 61.20, "ARE WE\\NTHERE YET?", "L"),
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
