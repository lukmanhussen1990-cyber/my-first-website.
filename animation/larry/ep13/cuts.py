"""Episode 13 "Head of Laughing" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.95), ("sh03", 5.30), ("sh04", 6.55), ("sh05", 8.45), ("sh06", 9.92),
        ("sh07", 11.55), ("sh08", 13.22), ("sh09", 14.90), ("sh10", 17.10), ("sh11", 18.80), ("sh12", 21.00),
        ("sh13", 23.30), ("end", 25.90)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
