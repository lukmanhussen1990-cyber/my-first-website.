"""Episode 11 "Stepdad" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.92), ("sh03", 4.40), ("sh04", 6.40), ("sh05", 8.75), ("sh06", 9.78),
        ("sh07", 12.45), ("sh08", 14.18), ("sh09", 15.05), ("sh10", 18.05), ("sh11", 19.22), ("sh12", 20.08),
        ("sh13", 20.72), ("sh14", 22.02), ("sh15", 22.78), ("sh16", 23.88), ("sh17", 24.75), ("sh18", 26.68),
        ("sh19", 27.55), ("sh20", 30.38), ("sh21", 31.62), ("sh22", 32.75), ("sh23", 35.82), ("sh24", 37.30),
        ("sh25", 38.85), ("sh26", 41.12), ("sh27", 42.72), ("sh28", 45.12), ("sh29", 46.40), ("sh30", 48.22),
        ("end", 50.20)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
