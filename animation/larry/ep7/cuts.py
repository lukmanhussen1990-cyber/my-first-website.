"""Episode 7 "Group Hug" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.60), ("sh03", 5.70), ("sh04", 7.40), ("sh05", 9.30), ("sh06", 10.80),
        ("sh07", 11.85), ("sh08", 13.70), ("sh09", 15.45), ("sh10", 18.00), ("sh11", 20.60), ("sh12", 22.00),
        ("sh13", 24.50), ("sh14", 26.40), ("sh15", 27.35), ("sh16", 29.50), ("sh17", 31.90), ("sh18", 32.65),
        ("sh19", 35.40), ("sh20", 37.55), ("sh21", 39.20), ("sh22", 39.95), ("sh23", 43.05), ("sh24", 46.10),
        ("sh25", 47.00), ("sh26", 49.20), ("sh27", 50.65), ("sh28", 53.85), ("sh29", 55.20), ("sh30", 56.55),
        ("end", 60.30)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
