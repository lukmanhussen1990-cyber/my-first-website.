"""Episode 14 "Husband and Husband" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.30), ("sh03", 4.20), ("sh04", 6.30), ("sh05", 7.60), ("sh06", 9.10),
        ("sh07", 10.70), ("sh08", 11.80), ("sh09", 12.65), ("sh10", 15.10), ("sh11", 16.40), ("sh12", 18.00),
        ("sh13", 19.95), ("sh14", 20.85), ("sh15", 22.05), ("sh16", 23.65), ("sh17", 25.15), ("sh18", 26.60),
        ("sh19", 27.70), ("sh20", 29.35), ("sh21", 30.30), ("sh22", 31.10), ("sh23", 32.80), ("sh24", 33.90),
        ("sh25", 35.95), ("sh26", 38.20), ("sh27", 41.30), ("sh28", 42.95), ("sh29", 44.65), ("sh30", 45.70),
        ("sh31", 47.10), ("end", 49.30)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
