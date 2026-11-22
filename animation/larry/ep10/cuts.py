"""Episode 10 "The Show" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh.
Loop format: the last word ("because...") runs straight back into the first line."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.02), ("sh03", 4.20), ("sh04", 5.35), ("sh05", 7.85), ("sh06", 9.30),
        ("sh07", 11.80), ("sh08", 12.85), ("sh09", 14.65), ("sh10", 16.85), ("sh11", 18.70), ("sh12", 20.05),
        ("sh13", 21.72), ("sh14", 23.50), ("end", 26.45)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
