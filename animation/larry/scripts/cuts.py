"""Shot cut list (seconds on the edited voiceover timeline) shared by shots.py and assemble.sh."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 1.80), ("sh03", 2.96), ("sh04", 5.10), ("sh05", 6.72), ("sh06", 7.85),
        ("sh07", 9.60), ("sh08", 11.10), ("sh09", 13.05), ("sh10", 15.50), ("sh11", 16.50), ("sh12", 18.20),
        ("sh13", 19.80), ("sh14", 21.70), ("sh15", 22.70), ("sh16", 24.00), ("sh17", 25.45), ("sh18", 27.10),
        ("sh19", 28.70), ("sh20", 29.90), ("sh21", 32.30), ("sh22", 32.85), ("sh23", 33.75), ("sh24", 36.40),
        ("sh25", 37.20), ("sh26", 37.95), ("sh27", 39.85), ("sh28", 41.00), ("sh29", 42.25), ("sh30", 44.90),
        ("sh31", 46.62), ("end", 49.30)]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)
