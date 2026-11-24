"""Episode 16 "Here Lies Dale" (part 1) cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 3.15), ("sh03", 5.25), ("sh04", 7.10), ("sh05", 8.95), ("sh06", 10.00),
        ("sh07", 11.15), ("sh08", 12.45), ("sh09", 14.25), ("sh10", 16.65), ("sh11", 17.80), ("sh12", 19.45),
        ("sh13", 21.35), ("sh14", 22.55), ("sh15", 23.60), ("sh16", 24.50), ("sh17", 26.00), ("sh18", 28.25),
        ("sh19", 29.20), ("sh20", 30.00), ("sh21", 31.20), ("sh22", 32.40), ("sh23", 33.65), ("sh24", 35.65),
        ("sh25", 38.05), ("sh26", 41.25), ("sh27", 42.65), ("sh28", 44.05), ("sh29", 46.75), ("sh30", 48.35),
        ("sh31", 50.80), ("sh32", 52.55), ("sh33", 54.15), ("end", 55.70)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
