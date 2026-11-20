"""Episode 6 "Road Trip" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.90), ("sh03", 3.90), ("sh04", 6.45), ("sh05", 8.25), ("sh06", 10.80),
        ("sh07", 12.45), ("sh08", 13.45), ("sh09", 14.60), ("sh10", 16.25), ("sh11", 17.80), ("sh12", 19.20),
        ("sh13", 20.15), ("sh14", 22.30), ("sh15", 23.55), ("sh16", 25.05), ("sh17", 28.05), ("sh18", 29.05),
        ("sh19", 30.60), ("sh20", 33.20), ("sh21", 33.85), ("sh22", 35.45), ("sh23", 37.65), ("sh24", 39.95),
        ("sh25", 40.75), ("sh26", 42.95), ("sh27", 44.20), ("sh28", 46.50), ("sh29", 47.45), ("sh30", 49.05),
        ("sh31", 51.05), ("sh32", 52.85), ("sh33", 56.00), ("sh34", 57.95), ("sh35", 59.70), ("end", 61.20)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
