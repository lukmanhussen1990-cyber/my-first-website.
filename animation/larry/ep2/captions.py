"""Episode 2 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 0.84, "You just", "W"), (0.84, 1.24, "want a", "W"), (1.24, 2.67, "normal life.", "W"),
    (2.67, 3.32, "But Larry", "W"), (3.32, 3.80, "from accounting", "W"), (3.80, 4.48, "is obsessed", "W"),
    (4.48, 5.39, "with you.", "W"),
    (5.39, 5.90, "And so is", "W"), (5.90, 7.43, "Dale from IT.", "W"),
    (7.43, 7.84, "So you take", "W"), (7.84, 8.30, "a different", "W"), (8.30, 9.30, "bus to work.", "W"),
    (9.30, 10.38, "GENIUS!", "Y"),
    (10.38, 10.84, "But the bus", "W"), (10.84, 11.16, "driver", "W"), (11.16, 11.66, "is…", "W"),
    (11.66, 12.77, "LARRY.", "R"),
    (12.77, 13.12, "And the guy", "W"), (13.12, 13.58, "sitting on", "W"), (13.58, 14.06, "your lap", "W"),
    (14.06, 14.39, "is…", "W"), (14.39, 15.53, "DALE.", "R"),
    (15.53, 15.98, "So you quit", "W"), (15.98, 16.81, "your job.", "W"), (16.81, 17.72, "CLEVER!", "Y"),
    (17.72, 17.92, "But your", "W"), (17.92, 18.44, "new boss", "W"), (18.44, 18.94, "is…", "W"),
    (18.94, 20.05, "LARRY.", "R"),
    (20.05, 20.42, "And the guy", "W"), (20.42, 20.92, "inside the", "W"), (20.92, 21.58, "vending machine", "W"),
    (21.58, 21.99, "is…", "W"), (21.99, 23.01, "DALE.", "R"),
    (23.01, 23.48, "So you move", "W"), (23.48, 23.82, "to another", "W"), (23.82, 24.71, "country.", "W"),
    (24.71, 25.68, "PERFECT!", "Y"),
    (25.68, 26.06, "But the guy", "W"), (26.06, 26.50, "stamping", "W"), (26.50, 27.06, "your passport", "W"),
    (27.06, 27.57, "is…", "W"), (27.57, 28.69, "LARRY.", "R"),
    (28.69, 29.12, "And the dog", "W"), (29.12, 29.54, "sniffing", "W"), (29.54, 30.04, "your bags", "W"),
    (30.04, 30.46, "is…", "W"), (30.46, 31.55, "DALE.", "R"),
    (31.55, 31.98, "So you make", "W"), (31.98, 32.44, "them fight", "W"), (32.44, 33.23, "over you.", "W"),
    (33.23, 34.34, "MUCH BETTER!", "Y"),
    (34.34, 34.56, "But they", "W"), (34.56, 35.00, "team up", "W"), (35.00, 35.95, "instead.", "W"),
    (35.95, 36.42, "Matching", "W"), (36.42, 36.85, "T-shirts.", "W"), (36.85, 37.24, "With", "W"),
    (37.24, 38.80, "YOUR FACE.", "R"),
    (39.00, 39.34, "Seventy", "W"), (39.34, 40.00, "years later,", "W"), (40.00, 40.76, "you finally", "W"),
    (40.76, 41.86, "die.", "W"), (41.86, 43.37, "Peace at last.", "W"),
    (43.37, 43.88, "But the angel", "W"), (43.88, 44.73, "at heaven's gate", "W"), (44.73, 45.07, "is…", "W"),
    (45.07, 46.17, "LARRY.", "R"),
    (46.17, 46.60, "And the other", "W"), (46.60, 47.35, "angel is…", "W"), (47.35, 48.48, "DALE.", "R"),
    (48.48, 48.96, "We've been waiting", "W"), (48.96, 51.00, "FOR YOU.", "L"),
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
