"""Shared helpers for the voice tools (no third-party imports, so every venv can use it)."""
import json
import re
from pathlib import Path


def load_script(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def select_beats(script, spec=None):
    """spec like 'b01-b04' or 'b03,b05'; None = all beats."""
    beats = script["beats"]
    if not spec:
        return beats
    ids = [b["id"] for b in beats]
    chosen = set()
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            chosen.update(ids[ids.index(a): ids.index(b) + 1])
        else:
            chosen.add(part)
    return [b for b in beats if b["id"] in chosen]


def display_words(text):
    """Words exactly as the captions show them: *keyword* marks kept, quotes kept."""
    return text.split()


def spoken_text(text):
    """Text sent to a TTS engine: no keyword stars, no quote marks, ellipsis kept as a pause."""
    t = text.replace("*", "")
    t = t.replace("“", "").replace("”", "").replace('"', "")
    t = t.replace("…", "...")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def plain_words(text):
    """Lower-case words without punctuation, for ASR checks and alignment."""
    t = spoken_text(text).lower().replace("...", " ")
    t = re.sub(r"[^a-z0-9' ]+", " ", t)
    return [w for w in t.split() if w]


def pause_before(script, index):
    """Seconds of silence before beat `index` (0 = first beat gets none)."""
    if index == 0:
        return 0.0
    beat = script["beats"][index]
    p = script.get("pauses", {})
    if beat.get("pauseBefore") is not None:
        return float(beat["pauseBefore"])
    if beat["text"].startswith("But notice"):
        return float(p.get("beforeTwist", 0.7))
    if beat.get("beat", "").startswith("JESUS") and script["beats"][index - 1].get("beat", "").startswith("ANSWER"):
        return float(p.get("beforeAnswer", 0.7))
    return float(p.get("default", 0.3))
