"""Shared helpers for the reel pipeline: read script.txt and plan.json.

script.txt  -> what is said (and shown as subtitles)
plan.json   -> what is shown (backgrounds, characters, effects, cards)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIO = ROOT / "audio"
OUT = ROOT / "out"


def load_plan():
    return json.loads((ROOT / "plan.json").read_text(encoding="utf-8"))


def to_speech(markup):
    """Subtitle markup -> plain text for the voice (drop *gold* marks and quotes)."""
    text = re.sub(r'[*"“”]', "", markup)
    return re.sub(r"\s+", " ", text).strip()


def parse_script(path=ROOT / "script.txt"):
    """Return a list of scenes; each scene is a list of subtitle pages:
    {"speaker": "narrator", "markup": "I can see *lies*.", "say": "I can see lies."}
    """
    scenes = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        pages = []
        for chunk in line.split(" / "):
            chunk = chunk.strip()
            speaker = "narrator"
            m = re.match(r"^\{(\w+)\}\s*", chunk)
            if m:
                speaker, chunk = m.group(1), chunk[m.end():]
            pages.append({"speaker": speaker, "markup": chunk, "say": to_speech(chunk)})
        scenes.append(pages)
    return scenes


def clip_name(scene_idx, page_idx):
    """1-based scene / page -> clip file stem, e.g. s01_p2"""
    return f"s{scene_idx:02d}_p{page_idx}"


if __name__ == "__main__":
    for i, pages in enumerate(parse_script(), 1):
        for j, p in enumerate(pages, 1):
            print(f"{clip_name(i, j)}\t{p['speaker']}\t{p['say']}")
