#!/usr/bin/env python3
"""Hand-drawn stickman Instagram Reel generator.

Edit the three config blocks below (SCRIPT, VOICE, SCENES) and run:

    python thirty_days_no_reels.py                      # voice -> timestamps -> audio -> render
    python thirty_days_no_reels.py preview --scenes 1 5 10 14   # stills into build/30_days_no_reels/previews/
"""

# ════════════════════════════════════════════════════════════════════ 1. SCRIPT
TITLE = "What 30 days without Reels does to your brain"
OUTPUT = "30_days_no_reels.mp4"

# (sentence, pause after it in seconds) — narrated exactly as written
SCRIPT = [
    ("Ironically, you're watching this on Reels.", 0.50),  # hook
    ("But here's what happens if you quit for thirty days.", 0.25),
    ("Week one feels terrible.", 0.25),
    ("You reach for your phone without thinking.", 0.25),
    ("Your brain is begging for its usual dopamine.", 0.25),
    ("Week two, boredom shows up.", 0.25),
    ("And boredom is where creativity starts.", 0.25),
    ("Week three, your focus comes back.", 0.25),
    ("A book doesn't feel slow anymore.", 0.25),
    ("By day thirty, normal life feels enjoyable again.", 0.25),
    ("You didn't lose anything.", 0.25),
    ("You got your attention back.", 0.50),  # beat before the final line
    ("Now, save this, and close the app.", 0.0),
]

# Words shown in yellow (with a hand-drawn underline) in the captions.
CAPTION_KEYWORDS = ["Reels", "thirty", "terrible", "phone", "dopamine", "boredom", "creativity",
                    "focus", "book", "enjoyable", "lose", "attention", "save", "close"]
CAPTION_HIGHLIGHT = "keyword"  # "keyword" = one key word per chunk; "active" = yellow follows the spoken word (reference behaviour)
CAPTION_MAX_WORDS = 4          # 2–4 words on screen at a time
PREVIEW_SCENES = [1, 5, 10, 14]                 # `preview` stage default
PREVIEW_REFERENCE_FRAMES = [13, 31, 38, 21]     # ref_frames/frame_XXX.jpg shown under the previews
WATERMARK = "@psych.sketches"  # drawn on every frame, below the captions and above Instagram's bottom UI

# ═════════════════════════════════════════════════════════════════════ 2. VOICE
VOICE = dict(
    name="am_michael",  # Kokoro voice (tested: am_michael, am_adam, am_fenrir, bm_george -> voice_tests/)
    speed=0.92,
    lufs=-16.0,         # loudness of the narration
    lead_in=0.30,       # silence before the first word
    tail=1.60,          # silence after the last word (final hold)
)
PRONUNCIATIONS = {}     # e.g. {"Kokoro": "kˈOkəɹO"} — misaki phonemes for words it gets wrong
# Word timestamps: whisper transcribes voice.wav and must hear every word; timing="model" uses Kokoro's own
# phoneme durations (measured ±30 ms vs the audio here), timing="whisper" uses whisper's word times instead.
WHISPER = dict(model="base", timing="model", max_drift=0.12)
MUSIC = dict(level_db=-24.0, sfx_db=-30.0)    # ambient pad under the voice, pops/whooshes on props

# ════════════════════════════════════════════════════════════════ 3. SCENE PLAN
# Each scene starts when its line starts. Canvas is 1080x1920, ground at y=1120.
# Times: seconds after scene start, "@word", "@word.end", "@word+0.3", "end-0.2".
# Start a scene's items with CUT to cross-fade to a new set-up instead of continuing the previous one.
# Poses: stand, stand_side, stand_hold, stand_offer, stand_cheer, sit, sit_slump, sit_hunch_phone,
#        sit_phone, sit_drop, sit_pocket, sit_sketch, sit_book, sit_up   (reel_engine/rig.py)
# Faces: neutral, blank, sad, stressed, bored, curious, focused, smile, content, happy, laugh, surprised
# Props: phone, calendar, box, brain, battery, cloud, bulb, clock, sketch, pencil, meter, book, sun, tree,
#        grass, heart, tick, orb, bookmark, label, qmark, floaters, buzz, glow, chair, table, eyeline, arrow
from reel_engine.dsl import CUT, act, actor, add, label, motion, remove, scene, sfx, tween, walk  # noqa: E402

HERO_X, BOX_X, S = 330, 625, 1.15    # hero's seat x, box x, character scale
LABEL = dict(y=360, size=78)          # yellow topic labels ("week 1" ...), clear of the top 12% UI zone
PHONE = ("me", "hand_a", (7, -12))    # where a held phone sits relative to the right hand

SCENES = [
    # 1 ─ hooked on the phone
    scene("Ironically, you're watching this on Reels.",
          add("ground", "ground", enter="none", keep="always"),
          add("chair", "chair", x=HERO_X, scale=S, enter="none", keep=True),
          actor("me", x=HERO_X, scale=S, pose="sit_hunch_phone", face="blank", turn=0.75, look=(0.5, 0.8)),
          motion("me", "swipe", at=0, dur=3.2),
          add("phone", "phone", hold=PHONE, scale=0.8, scroll=True, enter="none", keep=True, sfx=None),
          add("likes", "floaters", hold=("me", "hand_a", (62, -40)), at=0.4, enter="fade", rate=2.4, drift=40),
          label("ironic", at="@Ironically", x=700, y=560, size=78, until="end-0.25"),
          add("arrow1", "arrow", at="@Ironically+0.25", x0=650, y0=610, x1=525, y1=800, bend=-50, enter="draw",
              until="end-0.25", sfx=None)),

    # 2 ─ 30-day calendar, phone goes into the box
    scene("But here's what happens if you quit for thirty days.",
          add("cal", "calendar", at="@But", x=820, y=545, scale=1.3, pages=[1, 7, 14, 21, 30], page=0),
          tween("cal", at="@here's", dur=0.22, page=1), sfx("flip", at="@here's"),
          tween("cal", at="@what", dur=0.22, page=2), sfx("flip", at="@what"),
          tween("cal", at="@happens+0.15", dur=0.22, page=3), sfx("flip", at="@happens+0.15"),
          tween("cal", at="@thirty", dur=0.28, page=4), sfx("flip", at="@thirty"),
          add("box", "box", at="@happens", x=BOX_X, scale=1.25, closed=0.0, label="30 days", keep=True),
          act("me", at="@if-0.1", dur=0.4, pose="sit_drop", face="neutral", look=(0.6, 0.9)),
          remove("phone", at="@quit", exit="none"),
          add("falling", "phone", at="@quit", at_hold=PHONE, scale=0.8, until="@quit+0.45", screen=0.6,
              enter="none", exit="fade", z=-4, sfx="whoosh"),
          tween("falling", at="@quit", dur=0.38, ease="in", y=1085, screen=0.0),
          act("me", at="@quit+0.2", dur=0.45, pose="sit", face="neutral", look=(0.3, 0.2)),
          tween("box", at="@days", dur=0.3, ease="back", closed=1.0), sfx("thud", at="@days+0.15")),

    # 3 ─ week 1 feels terrible (and he keeps staring at the box)
    scene("Week one feels terrible.",
          label("week 1", at="@Week", **LABEL),
          act("me", at="@Week", dur=0.5, pose="sit_slump", face="sad", look=(0.6, 0.5)),
          add("crave", "eyeline", at="@one", hold=("me", "head", (34, 6)), x1=BOX_X - 30, y1=905, enter="draw",
              sfx=None),
          add("pull", "glow", at="@one", x=BOX_X, y=930, r=170, strength=0.16, pulse=1.0, col="screen",
              enter="fade", sfx=None),
          act("me", at="@terrible-0.1", dur=0.3, face="stressed"),
          motion("me", "bounce_leg", at="@feels", dur=1.6)),

    # 4 ─ reaching for a phone that isn't there (twice)
    scene("You reach for your phone without thinking.",
          act("me", at=0, dur=0.4, pose="sit", face="blank", look=(0.3, 0.3)),
          act("me", at="@reach", dur=0.25, pose="sit_pocket", look=(0.4, 1.0)),
          motion("me", "pat", at="@reach+0.25", dur=0.4),
          add("q1", "qmark", at="@your", x=445, y=650, size=96, until="@without"),
          act("me", at="@your", dur=0.3, pose="sit", face="curious", look=(0, -0.2)),
          add("buzz", "buzz", at="@phone", until="@phone+0.6", x=BOX_X, y=1020, scale=1.25, enter="fade", sfx=None),
          act("me", at="@without", dur=0.25, pose="sit_pocket", face="blank", look=(0.4, 1.0)),
          motion("me", "pat", at="@without+0.25", dur=0.4),
          add("q2", "qmark", at="@thinking", x=490, y=615, size=110),
          act("me", at="@thinking", dur=0.3, pose="sit", face="curious", look=(0, -0.2))),

    # 5 ─ the brain begs for dopamine
    scene("Your brain is begging for its usual dopamine.",
          tween("box", at=0, dur=0.4, alpha=0.55),
          add("brain", "brain", at="@brain", x=390, y=575, scale=1.35, pulse=1.0, tremble=0.0),
          tween("brain", at="@begging", dur=0.3, tremble=1.0),
          act("me", at="@brain", dur=0.4, face="stressed", look=(0.1, -1.0)),
          add("dopa", "battery", at="@begging", x=770, y=570, scale=1.35, level=0.14, flash=1.0, label="dopamine",
              label_col="yellow"),
          tween("dopa", at="@usual", dur=0.6, level=0.06)),

    # 6 ─ week 2: boredom, a slow ticking clock
    scene("Week two, boredom shows up.",
          label("week 2", at="@Week", **LABEL),
          act("me", at="@Week", dur=0.5, pose="sit_slump", face="bored", look=(0.6, 0.0)),
          add("clock", "clock", at="@two", x=BOX_X, y=824, scale=1.25, keep=True),
          add("cloud", "cloud", at="@boredom", x=430, y=530, scale=1.3, enter="draw", keep=True, scribble_draw=0.0,
              dots=[(-0.3, 1.22, 13), (-0.38, 1.45, 9)]),
          tween("cloud", at="@boredom+0.2", dur=0.9, scribble_draw=1.0)),

    # 7 ─ the lightbulb: boredom turns into creativity
    scene("And boredom is where creativity starts.",
          add("bulb", "bulb", at="@creativity", x=430, y=515, scale=1.35, on=0.0, keep=True),
          tween("bulb", at="@creativity+0.05", dur=0.05, on=1.0),
          tween("bulb", at="@creativity+0.12", dur=0.05, on=0.15),
          tween("bulb", at="@creativity+0.2", dur=0.05, on=1.0),
          tween("bulb", at="@creativity+0.3", dur=0.04, on=0.35),
          tween("bulb", at="@creativity+0.38", dur=0.08, on=1.0),
          sfx("ding", at="@creativity+0.2", gain_db=-3),
          act("me", at="@creativity", dur=0.3, face="surprised", look=(0.0, -1.0)),
          tween("cloud", at="@creativity+0.45", dur=0.5, scribble=0.0),
          tween("cloud", at="@creativity+0.8", dur=0.4, outline_alpha=0.0),
          remove("clock", at="@creativity+0.4"),
          remove("bulb", at="@starts+0.1"),
          remove("cloud", at="@starts+0.3", exit="none"),
          act("me", at="@starts-0.15", dur=0.45, pose="sit_sketch", face="smile", look=(0.6, 0.6)),
          add("sketch", "sketch", at="@starts-0.1", hold=("me", "hand_b", (90, 22)), scale=0.95, progress=0.0,
              keep=True),
          add("pencil", "pencil", at="@starts", hold=("me", "hand_a", (0, 0)), keep=True, enter="fade", sfx=None),
          tween("sketch", at="@starts+0.15", dur=3.2, ease="linear", progress=0.75),
          remove("box", at="@starts-0.1"),
          motion("me", "scribble", at="@starts+0.1", dur=3.3)),

    # 8 ─ week 3: focus meter fills red -> green
    scene("Week three, your focus comes back.",
          label("week 3", at="@Week", **LABEL),
          act("me", at="@Week", dur=0.4, face="focused"),
          add("focus", "meter", at="@focus-0.25", x=885, y=1000, scale=1.25, level=0.06, label="focus"),
          tween("focus", at="@focus+0.1", dur=1.3, level=0.95),
          tween("sketch", at="@focus", dur=1.2, ease="linear", progress=1.0),
          motion("me", "scribble", at=0, dur=2.6)),

    # 9 ─ reading, pages turning, small smile
    scene("A book doesn't feel slow anymore.",
          remove("pencil", at=0),
          remove("sketch", at=0.05),
          act("me", at=0.05, dur=0.4, pose="sit_book", face="smile", look=(0.4, 0.7)),
          add("book", "book", at="@book", hold=("me", "hands", (30, 18)), scale=1.3, flip=0.0),
          tween("book", at="@feel", dur=0.4, flip=1.0), tween("book", at="@slow-0.02", dur=0.01, flip=0.0),
          motion("me", "page_turn", at="@feel", dur=0.45),
          tween("book", at="@anymore", dur=0.4, flip=1.0), tween("book", at="@anymore+0.42", dur=0.01, flip=0.0),
          motion("me", "page_turn", at="@anymore", dur=0.45),
          sfx("flip", at="@feel+0.1"), sfx("flip", at="@anymore+0.1"),
          act("me", at="@anymore", dur=0.4, face="content")),

    # 10 ─ day 30: up, out into the sun, a friend, laughter
    scene("By day thirty, normal life feels enjoyable again.",
          label("day 30", at="@day", **LABEL),
          act("me", at=0.15, dur=0.55, pose="stand_side", x=HERO_X + 70, face="smile", look=(0.2, -0.2)),
          remove("chair", at=0.45),
          add("sun", "sun", at="@thirty", x=190, y=520, scale=1.3, enter="draw"),
          add("tree", "tree", at="@thirty+0.2", x=900, scale=1.3, enter="draw"),
          add("grass", "grass", at="@normal", xs=[150, 245, 610, 760, 990], enter="draw", sfx=None),
          walk("me", HERO_X + 140, at="@normal", dur=0.9),
          actor("friend", x=1200, scale=S, pose="stand_side", face="smile", facing=-1, turn=0.6, hair=True),
          walk("friend", 700, at="@normal-0.1", dur=1.25),
          act("friend", at="@enjoyable-0.1", dur=0.3, face="laugh"),
          act("me", at="@enjoyable-0.1", dur=0.3, face="laugh", look=(0, 0)),
          motion("me", "laugh", at="@enjoyable", dur=1.5),
          motion("friend", "laugh", at="@enjoyable+0.05", dur=1.5),
          add("heart", "heart", at="@enjoyable", x=585, y=575, size=50, sparkle=1.0, rise=14)),

    # 11 ─ recap: the box, nothing lost
    scene("You didn't lose anything.", CUT,
          actor("me", x=300, scale=S, pose="stand", face="content", turn=0.35),
          add("box2", "box", x=760, scale=1.25, closed=1.0, label="30 days", ghost_phone=True, enter="fade",
              keep=True),
          add("lost", "label", at="@lose", x=645, y=470, text="lost: nothing", col="ink", size=80),
          add("tick", "tick", at="@lose", x=330, y=470, scale=1.4, check=0.0),
          tween("tick", at="@anything", dur=0.3, check=1.0), sfx("tick", at="@anything+0.1", gain_db=4)),

    # 12 ─ attention comes back (orb), dopamine refills green
    scene("You got your attention back.",
          add("dopa2", "battery", at="@got", x=300, y=470, scale=1.35, level=0.12, flash=1.0, label="dopamine",
              label_col="yellow"),
          add("orb", "orb", at="@got", x=760, y=900, r=26, until="@attention+0.42", exit="pop", sfx="whoosh"),
          tween("orb", at="@got+0.2", dur=0.75, ease="linear", x=318),
          tween("orb", at="@got+0.2", dur=0.38, ease="out", y=520),
          tween("orb", at="@got+0.58", dur=0.37, ease="in", y=684),
          add("headglow", "glow", at="@attention+0.38", x=300, y=684, r=160, strength=0.55, enter="fade",
              until="@back", sfx=None),
          act("me", at="@attention+0.35", dur=0.3, face="happy"),
          tween("dopa2", at="@attention+0.4", dur=0.9, flash=0.0, level=1.0)),

    # 13 ─ bookend: sitting with the phone again, calmly. Save it.
    scene("Now, save this,", CUT,
          add("chair2", "chair", x=HERO_X, scale=S, enter="fade", keep=True),
          actor("me", x=HERO_X, scale=S, pose="sit_phone", face="neutral", turn=0.7, look=(0.5, 0.6)),
          add("phone2", "phone", hold=PHONE, scale=0.8, scroll=True, scroll_speed=40, keep=True, enter="fade",
              sfx=None),
          add("save", "bookmark", at="@save-0.05", x=540, y=520, scale=1.3, keep=True),
          tween("save", at="@this", dur=0.25, fill=1.0), sfx("pop", at="@this", gain_db=-2)),

    # 14 ─ close the app: screen off, phone down, look up, smile
    scene("and close the app.",
          remove("save", at="@and", exit="pop"),
          tween("phone2", at="@close", dur=0.16, screen=0.0), sfx("click", at="@close", gain_db=2),
          act("me", at="@close+0.25", dur=0.5, pose="sit", look=(0.3, 0.5)),
          act("me", at="@app", dur=0.45, pose="sit_up", face="content", look=(0.2, -0.6))),
]

# The ending: everything fades except this caption word, which holds on screen.
FINALE = dict(keep_word="close", at="@app.end+0.15", fade=0.5)


if __name__ == "__main__":
    import sys

    from reel_engine.pipeline import main
    main(sys.modules[__name__])
