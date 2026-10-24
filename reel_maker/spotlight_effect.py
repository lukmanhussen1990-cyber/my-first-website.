#!/usr/bin/env python3
"""The Spotlight Effect — hand-drawn stickman Instagram Reel.

Edit the config blocks below (SCRIPT, VOICE, SCENES) and run:

    python spotlight_effect.py voicetest                  # compare candidate voices with the reference narrator
    python spotlight_effect.py                            # voice -> timestamps -> audio -> render
    python spotlight_effect.py preview --scenes 1 8 10 12 # stills into build/spotlight_effect/previews/
"""

# ════════════════════════════════════════════════════════════════════ 1. SCRIPT
TITLE = "The Spotlight Effect"
OUTPUT = "spotlight_effect.mp4"

# (sentence, pause after it in seconds) — narrated exactly as written
SCRIPT = [
    ("You think everyone noticed your mistake.", 0.25),
    ("Your bad hair day.", 0.25),
    ("That awkward thing you said.", 0.50),  # end of the hook
    ("Psychology calls this the spotlight effect.", 0.25),
    ("We believe people are watching us way more than they actually are.", 0.25),
    ("In one famous study, students wore an embarrassing t-shirt into a room.", 0.25),
    ("They guessed half the people noticed.", 0.25),
    ("In reality, far fewer did.", 0.25),
    ("Why?", 0.25),
    ("Because everyone else is busy worrying about themselves.", 0.25),
    ("You're not under a spotlight.", 0.25),
    ("You're in a crowd of people who think they are.", 0.50),  # beat before the final line
    ("So dance a little.", 0.25),
    ("Nobody's watching.", 0.0),
]

# Words shown in yellow (with a hand-drawn underline) in the captions.
CAPTION_KEYWORDS = ["mistake", "hair", "awkward", "spotlight", "watching", "study", "half", "fewer", "themselves",
                    "crowd", "dance"]
CAPTION_HIGHLIGHT = "keyword"  # "keyword" = one key word per chunk; "active" = yellow follows the spoken word (reference behaviour)
CAPTION_MAX_WORDS = 4          # 2–4 words on screen at a time
WATERMARK = "@psych.sketches"  # drawn on every frame, below the captions and above Instagram's bottom UI
PREVIEW_SCENES = [1, 8, 10, 12]                 # `preview` stage default
PREVIEW_REFERENCE_FRAMES = [5, 34, 17, 38]      # ref_frames/frame_XXX.jpg shown under the previews

# ═════════════════════════════════════════════════════════════════════ 2. VOICE
VOICE = dict(
    name="am_michael",  # Kokoro voice; `python spotlight_effect.py voicetest` compares the candidates
    speed=0.92,
    lufs=-16.0,         # loudness of the narration
    lead_in=0.30,       # silence before the first word
    tail=1.60,          # silence after the last word (final hold)
)
# misaki phonemes for words to say differently: "t-shirt" in one breath, a stressed one-word "Why?"
PRONUNCIATIONS = {"t-shirt": "tˈiʃˌɜɹt", "Why": "wˈI"}
# Word timestamps: whisper transcribes voice.wav and must hear every word; timing="model" uses Kokoro's own
# phoneme durations (measured ±30 ms vs the audio), timing="whisper" uses whisper's word times instead.
WHISPER = dict(model="base", timing="model", max_drift=0.12)
MUSIC = dict(level_db=-24.0, sfx_db=-30.0)    # ambient pad under the voice, pops/whooshes/clicks on props

# ════════════════════════════════════════════════════════════════ 3. SCENE PLAN
# Each scene starts when its line starts. Canvas 1080x1920, ground at y=1120.
# Times: seconds after scene start, "@word", "@word.end", "@word+0.3", "end-0.2". Start with CUT for a new set-up.
# Poses: stand, stand_side, stand_worried, stand_think, stand_hold, hand_on_head, facepalm, sit, ... (reel_engine/rig.py)
# Faces: neutral, worried, nervous, curious, focused, surprised, smile, content, happy, laugh, sad, bored, blank
# Motions: walk, dance, spin, pat_head, laugh, nod, look_around, ...
# Props: spotlight, eyeline, hair, bubble, thought, palm, label, meter, doorway, shirt, notebook, floaters(icon="notes"),
#        qmark, ground, ... (reel_engine/props.py).  camera(zoom=..) pulls the whole picture back.
from reel_engine.dsl import CUT, act, actor, add, camera, label, motion, remove, scene, sfx, tween, walk  # noqa: E402

S, C = 1.05, 0.92            # hero scale, crowd scale
HERO_X = 540
LABEL = dict(y=330, size=72)
EYE = (16, 3)                # eye position relative to a head, towards where the person faces

# the audience in scenes 1-5: (id, x, scale, has long hair, facing, pose, face, eye-line bow)
# mixed heights like a real crowd, so every eye-line clears the heads in between
AUDIENCE = [("c1", 92, 1.0, False, 1, "stand_side", "curious", 70), ("c2", 210, 0.92, True, 1, "stand_think",
            "focused", 40), ("c3", 325, 0.84, False, 1, "stand", "neutral", 0),
            ("c4", 755, 0.84, False, -1, "stand_think", "focused", 0), ("c5", 870, 0.92, True, -1, "stand_side",
            "curious", 40), ("c6", 988, 1.0, False, -1, "stand", "neutral", 70)]
# the room in scenes 6-13: id -> (x, hair, facing, pose)
ROOM = {"m1": (120, False, -1, "stand_side"), "m2": (330, True, -1, "stand_hold"),
        "m3": (790, False, 1, "stand_think"), "m4": (965, True, 1, "stand_side")}
WORRIES = {"m1": ("my hair?", 170, 520), "m2": ("did I say\nit right?", 365, 360),
           "m3": ("am I weird?", 745, 380), "m4": ("my shoes?", 925, 545)}
# the bigger crowd revealed by the pull-back in scene 11
EXTRAS = [("e1", -420, True), ("e2", -230, False), ("e3", -40, True), ("e4", 1120, False), ("e5", 1310, True),
          ("e6", 1500, False)]


def small_spot(pid, x, head_top, at, from_x=HERO_X, keep=True):
    """A little stage light above one person (slides out of the hero's big beam when `from_x` is set)."""
    return [add(pid, "spotlight", at=at, x=from_x, src_x=from_x, top_y=head_top - 150, top_w=26, w=60, on=0.0,
                lamp=True, enter="none", keep=keep, sfx=None),
            tween(pid, at=at, dur=0.55, ease="out", x=x, src_x=x, on=0.85)]


SCENES = [
    # 1 ─ he thinks everyone noticed: spotlight clicks on, every eye-line points at him
    scene("You think everyone noticed your mistake.",
          add("ground", "ground", x0=75, x1=1005, enter="none", keep="always"),
          actor("me", x=HERO_X, scale=S, pose="stand_worried", face="worried", z=0.5),
          *[actor(cid, x=x, scale=sc, hair=h, facing=f, pose=p, face=fc, turn=0.55, look=(0.4, -0.15))
            for cid, x, sc, h, f, p, fc, bow in AUDIENCE],
          add("spot", "spotlight", at=0.25, x=HERO_X, top_y=-40, top_w=80, w=190, on=0.0, enter="none", keep=True,
              sfx=None),
          tween("spot", at=0.25, dur=0.06, on=1.0), sfx("click", at=0.25, gain_db=6),
          *[add(f"look_{cid}", "eyeline", at=0.5 + 0.12 * i, hold=(cid, "head", EYE),
                target=("me", "head", (-44 if f > 0 else 44, -6 + 6 * (bow > 0))), bend=bow, col="yellow",
                enter="draw", keep=True, sfx=None)
            for i, (cid, x, sc, h, f, p, fc, bow) in enumerate(AUDIENCE)],
          act("me", at="@mistake", dur=0.3, face="sad")),

    # 2 ─ bad hair day: a messy scribble pops up, he tries to flatten it, it springs back
    scene("Your bad hair day.",
          add("hair", "hair", at="@hair", hold=("me", "head"), scale=S, mess=1.0, keep=True),
          act("me", at="@hair+0.1", dur=0.22, pose="hand_on_head", face="worried", look=(0.2, -1.0)),
          motion("me", "pat_head", at="@hair+0.32", dur=0.5),
          tween("hair", at="@hair+0.35", dur=0.25, mess=0.3),
          tween("hair", at="@day+0.2", dur=0.18, ease="back", mess=1.0),
          act("me", at="@day+0.3", dur=0.3, pose="stand_worried", look=(0, 0))),

    # 3 ─ the awkward reply: "you too!", sweat, hand over the face
    scene("That awkward thing you said.",
          add("said", "bubble", at="@awkward", hold=("me", "head", (150, -125)), text="you too!", size=50),
          act("me", at="@thing", dur=0.25, face="nervous"),
          act("c2", at="@said", dur=0.2, face="surprised"), act("c5", at="@said", dur=0.2, face="surprised"),
          act("me", at="@said", dur=0.25, pose="facepalm"),
          add("palm", "palm", at="@said+0.12", hold=("me", "hand_a", (4, -2)), size=31, keep=True, sfx=None)),

    # 4 ─ the name of it
    scene("Psychology calls this the spotlight effect.",
          remove("palm", at=0.05),
          act("me", at=0.05, dur=0.4, pose="stand_worried", face="worried"),
          act("c2", at=0.1, dur=0.3, face="focused"), act("c5", at=0.1, dur=0.3, face="curious"),
          label("SPOTLIGHT EFFECT", at="@spotlight", box=True, box_col="yellow", enter="draw", keep=True, **LABEL),
          tween("spot", at="@spotlight", dur=0.2, on=1.35), tween("spot", at="@effect", dur=0.4, on=1.0)),

    # 5 ─ what we think vs reality
    scene("We believe people are watching us way more than they actually are.",
          add("think", "meter", at="@believe", x=125, y=650, scale=0.78, level=0.04, fill_col="red",
              label="you think", label_size=46),
          tween("think", at="@watching", dur=0.9, level=0.93),
          add("real", "meter", at="@more", x=955, y=650, scale=0.78, level=0.04, fill_col="green",
              label="reality", label_size=46),
          tween("real", at="@actually", dur=0.6, level=0.2),
          act("me", at="@watching", dur=0.4, look=(-0.8, -0.6)),
          act("me", at="@actually", dur=0.4, look=(0.8, -0.6))),

    # 6 ─ the study: he walks into a room in an embarrassing t-shirt
    scene("In one famous study, students wore an embarrassing t-shirt into a room.", CUT,
          add("door", "doorway", x0=40, x1=210, h=400, enter="draw", keep=True),
          label("study", at="@study", x=600, **{**LABEL, "size": 70}),
          add("nb", "notebook", at="@study", x=462, y=332, scale=1.1),
          actor("me", x=125, scale=S, pose="stand_side", face="worried", turn=0.45, z=0.5),
          *[actor(mid, x=x, scale=C, hair=h, facing=f, pose=p, face="neutral", turn=0.5, look=(0.4, 0.3))
            for mid, (x, h, f, p) in ROOM.items() if mid != "m1"],
          walk("me", HERO_X + 20, at="@students", dur=1.6),
          add("shirt", "shirt", at="@embarrassing-0.1", hold=("me", "body"), enter="draw", keep=True),
          act("me", at="@room", dur=0.4, pose="stand_worried", turn=0.0)),

    # 7 ─ his guess: half of them noticed
    scene("They guessed half the people noticed.",
          add("guess", "thought", at="@guessed", x=640, y=505, text="50%\nnoticed?", size=52, face=True,
              target=("me", "head_top"), keep=True),
          act("me", at="@guessed", dur=0.3, face="worried", look=(0.5, -1.0))),

    # 8 ─ reality: only one or two glance at him; "50%" gets crossed out
    scene("In reality, far fewer did.",
          remove("door", at=0.0),
          actor("m1", x=ROOM["m1"][0], scale=C, facing=-1, pose="stand_side", face="neutral", turn=0.5,
                look=(0.3, 0.6)),
          act("m3", at="@far", dur=0.25, facing=-1, turn=0.6, look=(0.5, 0.0)),
          add("glance3", "eyeline", at="@far+0.15", hold=("m3", "head", EYE), target=("me", "head", (44, 4)),
              col="yellow", enter="draw", sfx=None),
          act("m2", at="@fewer", dur=0.2, facing=1, look=(0.5, 0.0)),
          add("glance2", "eyeline", at="@fewer+0.1", hold=("m2", "head", EYE), target=("me", "head", (-44, 4)),
              col="yellow", enter="draw", until="@did.end", sfx=None),
          act("m2", at="@did.end", dur=0.25, facing=-1, look=(0.4, 0.6)),
          tween("guess", at="@fewer", dur=0.35, strike=1.0), sfx("flip", at="@fewer"),
          act("me", at="@did", dur=0.3, face="curious", look=(0, 0))),

    # 9 ─ everyone else is busy worrying about themselves
    scene("Why? Because everyone else is busy worrying about themselves.",
          remove("guess", at=0.05),
          add("why", "qmark", at="@Why", x=HERO_X + 70, y=600, size=96, until="@Because"),
          act("me", at="@Because", dur=0.3, face="neutral"),
          motion("me", "look_around", at="@everyone", dur=2.6),
          act("m3", at="@everyone", dur=0.3, facing=1, look=(0.3, -1.0)),
          *[item for i, (mid, (txt, bx, by)) in enumerate(WORRIES.items()) for item in (
              add(f"worry_{mid}", "thought", at=["@everyone", "@else", "@busy", "@worrying"][i], x=bx, y=by, text=txt,
                  size=38, target=(mid, "head_top")),
              act(mid, at=["@everyone", "@else", "@busy", "@worrying"][i], dur=0.3, face="worried",
                  look=(0.2, -1.0)))]),

    # 10 ─ not under a spotlight: his beam flickers and splits into one small light per person
    scene("You're not under a spotlight.",
          add("big", "spotlight", at=0.05, x=HERO_X + 20, top_y=-40, top_w=80, w=190, on=0.0, enter="none",
              until="@spotlight+0.5", sfx=None),
          tween("big", at=0.05, dur=0.06, on=1.0), sfx("click", at=0.05, gain_db=6),
          act("me", at=0.1, dur=0.3, face="worried", look=(0, -0.6)),
          tween("big", at="@under", dur=0.05, on=0.25), tween("big", at="@under+0.08", dur=0.05, on=1.0),
          tween("big", at="@under+0.2", dur=0.05, on=0.15), tween("big", at="@under+0.28", dur=0.05, on=1.0),
          sfx("click", at="@under", gain_db=-2),
          tween("big", at="@spotlight", dur=0.4, on=0.0),
          *small_spot("spot_me", HERO_X + 20, 674, "@spotlight", from_x=HERO_X + 20),
          *[item for mid, (x, h, f, p) in ROOM.items() for item in small_spot(f"spot_{mid}", x, 729, "@spotlight")],
          sfx("pop", at="@spotlight+0.1"),
          *[act(mid, at="@spotlight", dur=0.3, face="worried", look=(0, -1.0)) for mid in ROOM]),

    # 11 ─ pull back: a whole crowd, every one of them under their own little spotlight
    scene("You're in a crowd of people who think they are.",
          tween("ground", at=0, dur=0.3, x0=-760, x1=1840),
          *[actor(eid, x=x, scale=C, hair=h, facing=1 if x < HERO_X else -1, pose="stand_worried", face="worried",
                  turn=0.3, look=(0.0, -1.0)) for eid, x, h in EXTRAS],
          *[add(f"spot_{eid}", "spotlight", x=x, top_y=729 - 150, top_w=26, w=60, on=0.85, lamp=True, enter="none",
                keep=True, sfx=None) for eid, x, h in EXTRAS],
          camera(at=0.05, dur=2.6, zoom=0.52),
          act("me", at="@crowd", dur=0.4, face="curious", look=(0, 0))),

    # 12 ─ his light clicks off; he dances
    scene("So dance a little.",
          tween("spot_me", at="@So", dur=0.08, on=0.0), sfx("click", at="@So", gain_db=6),
          camera(at="@So", dur=0.9, zoom=0.82),
          act("me", at="@So+0.1", dur=0.3, pose="stand", face="happy", look=(0, 0)),
          motion("me", "dance", at="@dance", dur=6.0),
          motion("me", "spin", at="@little", dur=0.6),
          add("notes", "floaters", at="@dance", hold=("me", "head", (0, -40)), icon="notes", rate=3.2, life=1.5,
              height=1.3, drift=30, keep=True, enter="fade", sfx=None),
          *[add(f"own_{mid}", "thought", at="@So", x=x, y=470 if mid in ("m1", "m3") else 370,
                text=WORRIES[mid][0].split("\n")[0], size=30, target=(mid, "head_top"), keep=True, enter="fade",
                sfx=None) for mid, (x, h, f, p) in ROOM.items()],
          *[add(f"own_{eid}", "thought", at="@So", x=x, y=455, text="?", size=34, target=(eid, "head_top"),
                keep=True, enter="fade", sfx=None) for eid, x, h in EXTRAS]),

    # 13 ─ nobody turns. Everything fades but the dancer and "watching".
    scene("Nobody's watching.",
          *[act(mid, at=0.1, dur=0.3, look=(0.0, -1.0)) for mid in ROOM],
          camera(at="@watching", dur=2.2, ease="out", zoom=0.95, cy=930)),
]

# The ending: everything fades except these, which hold on screen.
FINALE = dict(keep_word="watching", keep_actors=["me"], keep_props=["shirt"], at="@watching.end+0.15", fade=0.5)


if __name__ == "__main__":
    import sys

    from reel_engine.pipeline import main
    main(sys.modules[__name__])
