"""Episode 2 "Larry & Dale" cut list (seconds on the voiceover timeline), shared by shots.py, audio.py and assemble.sh.
The voiceover needs no edit (no stray words), so the timeline is the raw vo.mp3 plus a tail for the final sting."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.55), ("sh03", 3.80), ("sh04", 5.25), ("sh05", 7.25), ("sh06", 9.15),
        ("sh07", 10.25), ("sh08", 11.55), ("sh09", 12.62), ("sh10", 14.25), ("sh11", 15.35), ("sh12", 16.65),
        ("sh13", 17.55), ("sh14", 18.85), ("sh15", 19.90), ("sh16", 21.88), ("sh17", 22.85), ("sh18", 24.55),
        ("sh19", 25.50), ("sh20", 27.45), ("sh21", 28.52), ("sh22", 30.35), ("sh23", 31.38), ("sh24", 33.10),
        ("sh25", 34.18), ("sh26", 35.80), ("sh27", 37.10), ("sh28", 38.80), ("sh29", 40.00), ("sh30", 41.55),
        ("sh31", 43.15), ("sh32", 44.95), ("sh33", 46.00), ("sh34", 47.22), ("sh35", 48.25), ("end", 51.00)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    tot = 0
    for n in SHOT_NAMES:
        tot += frames_of(n)
        print(n, frames_of(n))
    print("total frames", tot, "=", tot / FPS, "s")
