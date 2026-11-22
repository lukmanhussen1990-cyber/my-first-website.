"""Episode 4 "Fresh Batch" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.75), ("sh03", 3.00), ("sh04", 4.65), ("sh05", 5.95), ("sh06", 7.60),
        ("sh07", 9.45), ("sh08", 10.80), ("sh09", 12.10), ("sh10", 13.30), ("sh11", 15.45), ("sh12", 16.90),
        ("sh13", 18.45), ("sh14", 20.60), ("sh15", 21.55), ("sh16", 23.55), ("sh17", 26.10), ("sh18", 27.65),
        ("sh19", 28.65), ("sh20", 29.95), ("sh21", 31.00), ("sh22", 32.00), ("sh23", 33.85), ("sh24", 35.70),
        ("sh25", 36.80), ("sh26", 38.85), ("sh27", 41.20), ("sh28", 43.40), ("sh29", 45.00), ("sh30", 46.00),
        ("sh31", 47.70), ("sh32", 50.10), ("end", 52.60)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
