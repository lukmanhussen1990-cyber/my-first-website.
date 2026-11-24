"""Episode 17 "Here Lies Dale" (part 2) cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.30), ("sh03", 4.40), ("sh04", 7.10), ("sh05", 9.55), ("sh06", 10.85),
        ("sh07", 12.70), ("sh08", 14.40), ("sh09", 15.90), ("sh10", 17.75), ("sh11", 19.30), ("sh12", 21.00),
        ("sh13", 22.90), ("sh14", 23.95), ("sh15", 25.80), ("sh16", 27.30), ("sh17", 28.70), ("sh18", 30.60),
        ("sh19", 32.60), ("sh20", 34.65), ("sh21", 35.85), ("sh22", 36.60), ("sh23", 38.65), ("sh24", 39.95),
        ("sh25", 41.50), ("sh26", 42.60), ("sh27", 44.30), ("sh28", 46.30), ("sh29", 48.75), ("sh30", 49.70),
        ("end", 51.60)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
