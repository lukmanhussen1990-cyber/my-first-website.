"""Episode 9 "Broke Back In" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.25), ("sh03", 2.10), ("sh04", 3.95), ("sh05", 5.70), ("sh06", 7.40),
        ("sh07", 8.50), ("sh08", 10.60), ("sh09", 11.90), ("sh10", 14.15), ("sh11", 15.90), ("sh12", 16.95),
        ("sh13", 18.42), ("sh14", 19.90), ("sh15", 22.10), ("sh16", 23.38), ("sh17", 25.78), ("sh18", 27.45),
        ("sh19", 28.55), ("sh20", 31.12), ("sh21", 32.35), ("sh22", 33.45), ("sh23", 36.08), ("sh24", 37.75),
        ("sh25", 39.75), ("sh26", 41.25), ("sh27", 42.33), ("sh28", 45.55), ("sh29", 47.50), ("sh30", 49.10),
        ("sh31", 50.70), ("sh32", 53.45), ("sh33", 55.42), ("end", 57.60)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
