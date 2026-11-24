"""Episode 18 "He's Just Shy" (Dale's point of view) cut list (seconds on the voiceover timeline), shared by shots.py
and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.45), ("sh03", 4.05), ("sh04", 6.15), ("sh05", 7.62), ("sh06", 8.80),
        ("sh07", 10.20), ("sh08", 11.65), ("sh09", 12.88), ("sh10", 14.15), ("sh11", 15.95), ("sh12", 17.30),
        ("sh13", 18.55), ("sh14", 20.45), ("sh15", 21.65), ("sh16", 23.42), ("sh17", 24.40), ("sh18", 25.85),
        ("sh19", 27.15), ("sh20", 28.40), ("sh21", 30.52), ("sh22", 32.62), ("sh23", 33.68), ("sh24", 35.28),
        ("sh25", 36.48), ("sh26", 37.75), ("sh27", 39.60), ("sh28", 40.60), ("sh29", 42.55), ("sh30", 44.05),
        ("sh31", 45.08), ("sh32", 47.68), ("sh33", 48.78), ("sh34", 50.50), ("sh35", 52.02), ("sh36", 54.15),
        ("sh37", 55.20), ("end", 56.65)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
