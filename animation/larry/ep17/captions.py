"""Episode 17 caption track (.ass). Times are whisper word timings refined against the voiceover energy.
Usage: python3 captions.py <out.ass>"""
import sys

OUT = sys.argv[1]
# (start, end, text, style): W white, Y yellow interjection, R red reveal/emphasis, L huge final line
C = [
    (0.00, 1.30, "You killed DALE.", "R"),
    (1.30, 2.40, "He's DEAD.", "W"), (2.40, 3.40, "Buried.", "W"), (3.40, 4.40, "GONE.", "Y"),
    (4.40, 5.66, "So that night,", "W"), (5.66, 7.10, "there's a big family dinner.", "W"),
    (7.10, 8.20, "Everyone's here.", "W"), (8.20, 9.55, "The whole family.", "W"),
    (9.55, 10.85, "And your CRUSH.", "Y"),
    (10.85, 11.76, "She sits", "W"), (11.76, 12.70, "right next to you.", "W"),
    (12.70, 14.40, "Best night of your LIFE.", "Y"),
    (14.40, 15.90, "Then you look up...", "W"),
    (15.90, 17.75, "and DALE is sitting at the table,", "R"),
    (17.75, 19.30, "eating your food.", "W"),
    (19.30, 20.40, "You scream,", "W"), (20.40, 21.00, "\"DALE!\"", "L"),
    (21.00, 22.90, "But no one else can see him.", "W"),
    (22.90, 23.95, "Only YOU.", "R"),
    (23.95, 25.80, "Your crush thinks you're CRAZY.", "W"),
    (25.80, 27.30, "Dale smiles.", "W"),
    (27.30, 28.62, "Then he grabs your crush", "W"), (28.62, 30.60, "and THROWS her out the window.", "R"),
    (30.60, 32.60, "Then the ground starts SHAKING.", "W"),
    (32.60, 33.80, "Outside...", "W"), (33.80, 34.65, "it's LARRY.", "R"),
    (34.65, 35.85, "In a TANK.", "Y"),
    (35.85, 36.60, "BOOM!", "L"),
    (36.60, 38.65, "He blows up the ENTIRE house.", "R"),
    (38.65, 39.95, "And in the smoke,", "W"),
    (39.95, 41.50, "Larry and Dale GRAB you.", "R"),
    (41.50, 42.60, "They kidnap you.", "W"),
    (42.60, 44.30, "They lock you in their BASEMENT.", "W"),
    (44.30, 45.40, "And then", "W"), (45.40, 46.30, "they CUDDLE you.", "R"),
    (46.30, 47.60, "From both sides.", "W"), (47.60, 48.75, "All night.", "W"),
    (48.75, 49.70, "\"HELP!\"", "L"),
    (49.70, 51.60, "But no one can hear you.", "W"),
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
