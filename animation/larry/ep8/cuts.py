"""Episode 8 "Dale's Deck" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.18), ("sh03", 2.64), ("sh04", 4.95), ("sh05", 7.55), ("sh06", 8.85),
        ("sh07", 9.50), ("sh08", 11.60), ("sh09", 12.95), ("sh10", 13.75), ("sh11", 17.15), ("sh12", 19.00),
        ("sh13", 21.00), ("sh14", 22.10), ("sh15", 25.35), ("sh16", 26.90), ("sh17", 28.45), ("sh18", 31.80),
        ("sh19", 33.90), ("sh20", 36.45), ("end", 40.30)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
