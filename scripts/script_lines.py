"""Narration script — single source of truth for voice, captions and scene timing.

Display text conventions
  *WORD*  -> highlight word (rendered in Cinzel caps, coral red)
  " | "   -> caption break (a new caption block starts here)
TTS text is derived from the display text (markers removed, caps lowered) unless `tts` is given.
`gap` is the silence (seconds) after the line, tuned to the reference pacing (0.4–0.7 s).
`card` lines are Scripture: read aloud, shown on a card instead of the caption band.
"""

LINES = [
    dict(id="S1", gap=0.55,
         text="If God was going to *FLOOD* the earth anyway… why make Noah build an ark for years?"),
    dict(id="S2", gap=0.45,
         text="God could have saved Noah in a *SECOND.*"),
    dict(id="S3", gap=0.50,
         text="Instead: year after year of *HAMMERING…* in front of a laughing crowd."),
    dict(id="S4", gap=0.45,
         text="And not one *CLOUD* in the sky."),
    dict(id="S5", gap=0.55,
         text="So why the wait?"),
    dict(id="S6", gap=0.55,
         text="Because the ark wasn't just a *BOAT.* | It was a *WARNING* the whole world could see."),
    dict(id="S7", gap=0.60,
         text="Every nail, every beam, every year… was another *INVITATION.*"),
    dict(id="S8", gap=0.60, card=True,
         text="…the *LONGSUFFERING* of God *WAITED* in the days of Noah, while the ark was a preparing…",
         tts="The longsuffering of God waited, in the days of Noah, while the ark was a preparing.",
         ref="1 PETER 3:20 · KJV"),
    dict(id="S9", gap=0.50,
         text="Noah wasn't only a builder. | He was a *PREACHER.*"),
    dict(id="S10", gap=0.50,
         text="Then the animals came… and still the people *LAUGHED.*"),
    dict(id="S11", gap=0.45,
         text="And the ark had only *ONE* door."),
    dict(id="S12", gap=0.45,
         text="Anyone could have walked through it."),
    dict(id="S13", gap=2.60,  # S14 breathing beat (rain + thunder) lives in this gap
         text="It stood open for *YEARS.* | They chose not to come."),
    dict(id="S15", gap=0.55,
         text="Thousands of years later, Jesus said this:"),
    dict(id="S16", gap=0.65, card=True,
         text="I am *THE DOOR:* by me if any man enter in, he shall be *SAVED…*",
         tts="I am the door: by me if any man enter in, he shall be saved.",
         ref="JOHN 10:9 · KJV"),
    dict(id="S17", gap=0.60,
         text="The ark was never only about *JUDGMENT.* | The door is still *OPEN* today."),
    dict(id="S18", gap=0.50,
         text="Was the ark about *JUDGMENT…* or *MERCY?*"),
    dict(id="S19", gap=3.20,  # logo outro (S20) lives in this gap
         text="Tell us why in the comments."),
]

LEAD_IN = 0.10  # seconds of silence before the first word (hook is on screen from frame 1)


def tts_text(line):
    if "tts" in line:
        return line["tts"]
    t = line["text"].replace("*", "").replace(" | ", " ")
    # lower-case shouted highlight words so the voice doesn't over-stress / spell them
    out = []
    for w in t.split(" "):
        core = "".join(c for c in w if c.isalpha())
        if len(core) > 1 and core.isupper():
            w = w.lower()
            if out == []:
                w = w[0].upper() + w[1:]
        out.append(w)
    return " ".join(out)
