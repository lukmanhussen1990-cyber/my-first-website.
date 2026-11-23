"""Episode 15 "Missing" (part 1) cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.40), ("sh03", 5.30), ("sh04", 6.70), ("sh05", 8.10), ("sh06", 9.95),
        ("sh07", 12.25), ("sh08", 14.55), ("sh09", 15.85), ("sh10", 17.50), ("sh11", 19.35), ("sh12", 20.70),
        ("sh13", 22.30), ("sh14", 23.70), ("sh15", 24.95), ("sh16", 26.35), ("sh17", 27.65), ("sh18", 30.30),
        ("sh19", 31.75), ("sh20", 35.20), ("sh21", 36.45), ("sh22", 37.45), ("sh23", 38.70), ("sh24", 41.10),
        ("sh25", 43.40), ("sh26", 44.70), ("sh27", 47.30), ("sh28", 49.70), ("sh29", 51.60), ("end", 53.40)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
