"""Shot timing and sound-effect cue times (seconds in audio/voiceover.mp3). No Blender imports."""

SHOTS = [
    ("intro", 0.00, 2.90),        # You love your mom. Your mom loves you.
    ("mom_walks", 2.90, 5.20),    # But one morning, she finds a big fat
    ("poop_close", 5.20, 7.40),   # poop in the middle of the living room floor.
    ("mom_gasp", 7.40, 9.70),     # (gasp) And she doesn't even ask questions.
    ("mom_stare", 9.70, 11.70),   # She just looks at you. Because,
    ("you_guilty", 11.70, 12.95), # let's be honest,
    ("sign", 12.95, 16.00),       # you've done this like six times this month.
    ("not_me", 16.00, 18.50),     # But this time, it really wasn't you.
    ("baby_reveal", 18.50, 21.00),# It was your little ... baby brother.
    ("point", 21.00, 23.50),      # So you point at him. And what does he do?
    ("baby_smile", 23.50, 25.00), # He smiles.
    ("cute", 25.00, 26.35),       # Cute as hell.
    ("mom_melts", 26.35, 27.40),  # Mom melts.
    ("screwed", 27.40, 28.70),    # You're screwed.
    ("grab_diaper", 28.70, 30.80),# So you grab his diaper for proof.
    ("clean", 30.80, 33.40),      # And it's perfectly ... clean.  (sparkle + ding)
    ("how", 33.40, 35.50),        # How? Nobody knows.
    ("smart", 35.50, 38.30),      # So you do the smartest thing a grown man can do.
    ("call", 38.30, 41.40),       # You call the police on a ... baby.
    ("door_burst", 41.40, 42.20), # Genius!  (door slam, siren)
    ("look_poop", 42.20, 43.90),  # The cops look at the poop.
    ("look_baby", 43.90, 45.10),  # Then at the baby.
    ("look_you", 45.10, 46.20),   # Then at you.
    ("arrest", 46.20, 47.60),     # And they arrest you.
    ("dragged", 47.60, 49.60),    # Mom didn't even try to stop them.
    ("wave", 49.60, 50.80),       # She just waved.
    ("wink", 50.80, 54.10),       # And the baby? He winked. Baby wins again. (fart, freeze)
]

# key moments used by the audio mix too
EVENTS = {
    "gasp": 7.30, "sign_flip": 14.45, "pop_hearts": 26.45, "ding": 32.25, "siren_start": 40.6,
    "door_slam": 41.45, "cuffs": 46.75, "wink": 52.10, "fart": 53.95,
}
