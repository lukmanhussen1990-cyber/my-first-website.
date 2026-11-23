"""Episode 12 "Nose" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.30), ("sh03", 2.80), ("sh04", 4.85), ("sh05", 6.05), ("sh06", 8.30),
        ("sh07", 9.85), ("sh08", 11.45), ("sh09", 12.90), ("sh10", 13.92), ("sh11", 16.30), ("sh12", 17.70),
        ("sh13", 18.90), ("sh14", 21.90), ("sh15", 23.15), ("end", 25.50)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
