"""Write audio/cues.json: every sound effect placed on the exact animation times.

The times mirror scene/js/story.js (scene starts S*, "So ..." cues C*), so if the
animation is retimed, update the constants here and re-run:
    python audio/make_cues.py && python audio/synth.py --cues audio/cues.json --out build
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "scene", "timeline.json")))
S = [s["start"] for s in TL["scenes"]] + [TL["duration"]]
C = {s["id"]: s["cue"] for s in TL["scenes"]}
MUSIC_STOP = TL["events"]["music_stop"]

beds, events = [], []


def ev(kind, t, gain_db=0.0, pan=0.0, **params):
    events.append({"type": kind, "t": round(t, 3), "gain_db": gain_db, "pan": pan, "params": params})


def bed(kind, start, end, gain_db=0.0, pan=0.0, **params):
    beds.append({"type": kind, "start": round(start, 3), "end": round(end, 3), "gain_db": gain_db, "pan": pan, "params": params})


# --- whole-film beds -------------------------------------------------------
bed("breath_helmet", 0.2, 35.6, gain_db=-7)           # muffled breathing inside the helmet

# --- S1: landing, flag, shovel, tiny hole -----------------------------------
ev("whoosh_soft", 0.1, -6, -0.2, dur=1.0, direction=-1)   # jetpack descent
ev("land_thud", 1.12, -1, -0.15, size=0.9)
ev("pop", 1.2, -4, -0.2, pitch=1.1)                        # flag appears
ev("flag_plant", 1.72, -1, -0.25)
ev("whoosh_soft", 1.88, -12, -0.25, dur=0.4)               # flag unfurls
ev("pop", 2.05, -3, 0.0, pitch=1.3)                        # shovel appears
ev("sparkle", 2.1, -10, 0.0, count=3, dur=0.4)
ev("land_thud", 2.8, -9, 0.1, size=0.5)
ev("shovel_scrape", 2.95, -3, 0.1)
ev("dust_toss", 3.02, -4, 0.15)
ev("land_thud", 3.75, -8, 0.0, size=0.45)                  # hops into the tiny hole
ev("land_thud", 5.35, -9, 0.1, size=0.45)
# dig cycles: scrape on the push down, toss on the throw
for scrape, toss in [(5.2, 5.55), (6.3, 6.65), (7.4, 7.75), (8.6, 8.95), (9.8, 10.15)]:
    ev("shovel_scrape", scrape, -3, 0.1)
    ev("dust_toss", toss, -2 if toss == 6.65 else -4, -0.2)
ev("whoosh_soft", 6.7, -8, -0.4, dur=1.4, direction=-1)    # the big scoop sails away

# --- S2: the slow digging machine snaps together and digs -------------------
c2 = C[2]
for i in range(10):
    ev("pop", c2 + i * 0.12, -5, 0.35, pitch=0.85 + i * 0.06)
ev("snap", c2 + 10 * 0.12 + 0.05, -2, 0.35, pitch=1.0)
ev("thumbs", c2 + 1.3, -12, 0.35, pitch=1.2)               # the machine's eye lights up
bed("machine_hum", 12.3, 15.3, gain_db=-4, pan=0.3)
for t in (12.5, 13.05, 13.9, 14.35):
    ev("servo", t, -6, 0.3, dur=0.45)
ev("shovel_scrape", 12.94, -6, 0.2, bright=0.7)
ev("shovel_scrape", 14.18, -6, 0.2, bright=0.7)
bed("dust_pour", 13.55, 14.15, gain_db=-5, pan=0.45)
bed("dust_pour", 14.55, 15.15, gain_db=-5, pan=0.45)
# the room drops into the pit
ev("whoosh_soft", 14.35, -5, 0.0, dur=0.6)
ev("land_thud", 14.95, 0, 0.0, size=1.3)
ev("door_clunk", 14.97, -4, 0.0, weight=1.2)

# --- S3: sharp sticky dust, magnifier, seals, door with brushes -------------
c3 = C[3]
ev("brush", 15.25, -12, -0.2, dur=0.5)                       # dust settles on the suit
ev("whoosh_soft", 16.1, -6, 0.3, dur=0.45)                  # magnifier pops in
ev("pop", 16.2, -6, 0.3, pitch=1.2)
ev("sparkle", 16.45, -7, 0.3, count=6, dur=0.9)             # glinting jagged grains
for t in (16.75, 17.15, 17.55, 17.95):
    ev("brush", t, -9, -0.1, dur=0.22)                      # patting the dust (it sticks)
ev("whoosh_soft", 18.6, -10, 0.3, dur=0.35, direction=-1)
for i in range(4):
    ev("seal_click", c3 + 0.15 + i * 0.25, -1, (-0.25 if i % 2 else 0.25), pitch=1.0 + 0.08 * i)
ev("pop", c3 + 1.15, -4, -0.4, pitch=0.9)                   # the entrance hut snaps together
ev("snap", c3 + 1.4, -4, -0.4, pitch=0.9)
ev("land_thud", 21.55, -9, -0.3, size=0.45)
for t in (21.4, 21.68, 21.95):
    ev("brush", t, -4, -0.35, dur=0.3)
ev("sparkle", 21.65, -6, -0.35, count=7, dur=0.7)           # suit is clean
ev("servo", 21.85, -9, -0.35, dur=0.3)                      # door slides open
ev("door_clunk", 22.78, -10, -0.35, weight=0.6)

# --- S4: hot day / freezing night, dig deeper ---------------------------------
c4 = C[4]
ev("pop", S[3] + 0.5, -8, -0.4, pitch=1.1)                  # thermometer
for t, mode in [(23.1, "hot"), (24.7, "cold"), (25.55, "hot"), (26.15, "cold"), (28.05, "hot")]:
    ev("temp_tick", t, -3, 0.0, mode=mode)
bed("machine_hum", c4 + 0.05, c4 + 2.8, gain_db=-5, pan=0.4)
for t in (c4 + 0.2, c4 + 0.9, c4 + 1.7, c4 + 2.3):
    ev("servo", t, -7, 0.4, dur=0.45)
bed("dust_pour", c4 + 1.55, c4 + 2.1, gain_db=-7, pan=0.5)
bed("dust_pour", c4 + 2.55, c4 + 3.0, gain_db=-7, pan=0.5)
ev("servo", c4 + 2.1, -4, 0.0, dur=0.9, pitch=0.6, up=False)   # the room moves down
ev("land_thud", c4 + 3.0, -5, 0.0, size=0.8)
ev("pop", c4 + 3.25, -7, -0.4, pitch=1.0)                   # steady thermometer
ev("sparkle", c4 + 3.35, -12, -0.4, count=3, dur=0.6)

# --- S5: no air; airlock + oxygen tanks; helmet off ---------------------------
c5 = C[5]
ev("pop", 31.35, -6, 0.3, pitch=0.7)                        # "no air" bubble
ev("pop", c5, -4, -0.4, pitch=0.8)                          # airlock snaps on
ev("snap", c5 + 0.3, -3, -0.4, pitch=0.8)
ev("door_clunk", c5 + 0.75, -3, -0.45, weight=1.0)
ev("door_clunk", c5 + 1.1, -4, -0.5, weight=0.9)
ev("airlock_hiss", c5 + 0.5, -2, -0.4, dur=1.4)
for i in range(3):
    ev("pop", c5 + 0.95 + i * 0.25, -4, -0.2 + 0.1 * i, pitch=1.0 + 0.12 * i)   # oxygen tanks
bed("air_fill", c5 + 1.4, c5 + 3.9, gain_db=-1, pan=0.0)
ev("seal_click", 35.6, -6, 0.0, pitch=0.8)                  # helmet unlatches
ev("whoosh_soft", 36.05, -10, -0.2, dur=0.8)
ev("land_thud", 36.95, -12, -0.3, size=0.35)
ev("happy_breath", 36.3, 0, 0.0)
ev("thumbs", 36.35, -9, 0.3, pitch=1.0)

# --- S6: space rocks; thick dust layer over the roof ---------------------------
c6 = C[6]
for (t0, t1, pan) in [(37.85, 38.55, -0.4), (38.85, 39.45, 0.4), (39.75, 40.35, -0.1), (43.95, 44.55, 0.05)]:
    ev("rock_whoosh", t0, -4, pan, dur=t1 - t0, direction=1 if pan >= 0 else -1)
    ev("rock_thud", t1, -1 if t1 < 44 else -4, pan, size=1.0 if t1 < 44 else 0.7)
    ev("sparkle", t1 + 0.02, -9, pan, count=4, dur=0.5)
bed("machine_hum", c6 - 0.6, c6 + 3.1, gain_db=-5, pan=0.45)
for t in (c6 - 0.5, c6 + 0.4, c6 + 1.3, c6 + 2.2):
    ev("servo", t, -7, 0.45, dur=0.45)
for t0 in (c6 + 0.25, c6 + 1.25, c6 + 2.25):
    bed("dust_pour", t0 + 0.05, t0 + 0.95, gain_db=-3, pan=0.1)
ev("pop", c6 + 3.5, -6, -0.3, pitch=1.15)                   # round window + dome
ev("thumbs", 44.75, -6, 0.1, pitch=1.15)

# --- S7: cozy finished house; phone; no signal ----------------------------------
s7 = S[6]
for i, order in enumerate([0, 1, 1.5, 2, 2.5, 3]):
    ev("pop", s7 + 0.15 + order * 0.28, -5, (-0.3 + 0.12 * i), pitch=0.9 + 0.08 * i)   # furniture
ev("sparkle", s7 + 0.4, -9, 0.0, count=5, dur=1.0)          # warm lights on
ev("pop", s7 + 0.6, -9, -0.2, pitch=1.3)                    # helmet onto the shelf
ev("land_thud", 46.6, -10, 0.1, size=0.35)                  # flops into the chair
ev("pop", 49.45, -9, 0.15, pitch=1.4)                       # phone out
ev("phone_popup", MUSIC_STOP, -2, 0.1)
bed("machine_hum", MUSIC_STOP + 0.05, TL["duration"], gain_db=-17, base=58.0, whine=0.0)   # quiet room tone under the stare
ev("pop", 53.92, -17, 0.0, pitch=1.7, dur=0.08)              # tiny deadpan blink
ev("pop", MUSIC_STOP + 0.02, -7, 0.1, pitch=0.75)           # big "no signal" icon

data = {"duration": TL["duration"], "music_stop": MUSIC_STOP,
        "scenes": [[S[i], S[i + 1]] for i in range(7)], "beds": beds, "events": events}
with open(os.path.join(ROOT, "audio", "cues.json"), "w") as f:
    json.dump(data, f, indent=1)
print(f"wrote audio/cues.json: {len(beds)} beds, {len(events)} events")
