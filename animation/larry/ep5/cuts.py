"""Episode 5 "Larry's Wood" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.50), ("sh03", 2.80), ("sh04", 4.00), ("sh05", 7.10), ("sh06", 8.50),
        ("sh07", 10.40), ("sh08", 11.45), ("sh09", 14.00), ("sh10", 15.15), ("sh11", 17.05), ("sh12", 17.80),
        ("sh13", 19.90), ("sh14", 21.30), ("sh15", 23.05), ("sh16", 23.85), ("sh17", 26.35), ("sh18", 28.10),
        ("sh19", 30.40), ("sh20", 31.40), ("sh21", 32.95), ("sh22", 33.95), ("sh23", 35.55), ("sh24", 38.25),
        ("sh25", 41.95), ("sh26", 42.85), ("end", 46.00)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
