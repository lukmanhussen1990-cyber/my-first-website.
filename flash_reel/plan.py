#!/usr/bin/env python3
"""Shot plan for the Flash POV reel -> shots.json. Every cut sits on a beat of the song (audio/beats.json);
the god-like transformation starts exactly on "drink for me" (beat 7 = video 4.690 s). No voiceover: only the song,
the storm and the text "POV: your girlfriend texts she's home alone" (+ the phone message)."""
import json

B = json.load(open("audio/beats.json"))
b = B["beats"]
FPS = 30
TAIL = 1.6                     # the last shot (the freeze) runs this long after its beat
END = round((b[23] + TAIL) * FPS) / FPS
SHOTS = [  # (first beat, size, scene)
    (0, "medium", "YOU on the couch at night, scrolling his phone, bored. Rain on the window, lightning."),
    (2, "close-up", "The phone buzzes: a message from \"Babe\" (heart): \"I'm home alone\" (smiley)."),
    (4, "slow zoom", "Slow zoom on his face: his eyes go wide, he slowly looks at the camera."),
    (7, "low angle", "\"drink for me\": he stands up slowly, a lightning bolt strikes him from the sky. BOOM, red lightning everywhere."),
    (9, "close-up", "His eyes glow, the wind blows his hair back, the rain swirls round him."),
    (10, "wide", "A long dark cape billows out behind him (red suit, a simple lightning bolt); the hoodie drops on the couch."),
    (11, "wide (slow motion)", "Outside in the storm: the slow-motion walk toward the camera, cape flowing, lightning behind him. Step, step."),
    (13, "medium (slow motion)", "Chin up, shoulders back, a calm evil smile. Step, step."),
    (15, "wide", "He zooms past cars in a red blur with a lightning trail: the cars spin."),
    (16, "low angle", "Straight up the side of a building."),
    (17, "wide", "Over the bridge in the rain."),
    (18, "medium", "Leaves fly, a man's hat blows off."),
    (19, "wide", "Round the corner toward her street."),
    (20, "medium", "He screeches to a stop at her front door (porch light), smoke; fixes his hair, big smile, knocks."),
    (22, "medium", "The door opens: HER DAD, arms crossed, staring. The music and the thunder stop: only rain."),
    (23, "close-up (freeze)", "Freeze on his face: the smile drops, a sweat drop slides down, the lightning fizzles out with a small spark."),
]
out = []
for i, (k, size, scene) in enumerate(SHOTS):
    t0 = b[k]; t1 = b[SHOTS[i + 1][0]] if i + 1 < len(SHOTS) else END
    out.append({"id": i + 1, "t0": round(t0, 3), "t1": round(t1, 3), "dur": round(t1 - t0, 3), "beat": k, "size": size, "scene": scene,
                "captions": [], "voice": "", "key": False, "black": False, "image": f"images/shot_{i + 1:02d}.png", "clip": f"clips/shot_{i + 1:02d}.mp4"})
json.dump({"fps": FPS, "duration": END, "drop": B["drop"], "shots": out}, open("shots.json", "w"), indent=1)
for o in out:
    print(f"{o['id']:2d} beat {o['beat']:2d}  {o['t0']:6.3f}-{o['t1']:6.3f} ({o['dur']:.2f}s) {o['size']:20s} {o['scene'][:60]}")
print(f"{len(out)} shots, {END:.2f} s; the transformation starts at {B['drop']:.3f} s (song {B['drop_song']:.3f} s)")
