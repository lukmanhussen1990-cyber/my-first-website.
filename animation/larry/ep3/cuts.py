"""Episode 3 "Larry's Meat" cut list (seconds on the voiceover timeline), shared by shots.py and assemble.sh.
The voiceover needs no edit; the timeline is the raw vo.mp3 plus a short tail for the final reaction."""
FPS = 24
CUTS = [("sh01", 0.00), ("sh02", 2.30), ("sh03", 3.40), ("sh04", 4.55), ("sh05", 5.70), ("sh06", 7.55),
        ("sh07", 8.55), ("sh08", 10.95), ("sh09", 12.55), ("sh10", 14.10), ("sh11", 14.95), ("sh12", 17.45),
        ("sh13", 18.95), ("sh14", 21.45), ("sh15", 22.35), ("sh16", 24.15), ("sh17", 25.15), ("sh18", 26.30),
        ("sh19", 27.45), ("sh20", 29.15), ("sh21", 30.55), ("sh22", 31.60), ("sh23", 33.30), ("sh24", 34.50),
        ("sh25", 36.45), ("sh26", 38.10), ("sh27", 39.35), ("sh28", 40.85), ("sh29", 42.25), ("sh30", 43.20),
        ("sh31", 44.60), ("end", 46.50)]
TOTAL = CUTS[-1][1]
SHOT_NAMES = [n for n, _ in CUTS[:-1]]


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * FPS) - round(t * FPS)
    raise KeyError(name)


if __name__ == "__main__":
    print(len(SHOT_NAMES), "shots,", sum(frames_of(n) for n in SHOT_NAMES), "frames")
