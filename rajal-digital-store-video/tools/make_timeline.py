#!/usr/bin/env python3
"""Turn the measured voice-over clips into the master timeline.

Reads build/vo_words.json, decides when every sentence is spoken and when every
scene starts (transitions are snapped to the music's beat grid), and writes
build/timeline.json (for the audio tools) and build/timeline.js (for index.html).
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"

FPS = 30
WIDTH, HEIGHT = 1920, 1080
BPM = 110
BEAT = 60.0 / BPM

INTRO_LEAD = 1.25      # first word of the video is spoken this long after t=0
SCENE_LEAD = 0.80      # first word of a scene comes this long after its transition starts
TRANSITION = 0.70      # length of the wipe between scenes
GAP_DEFAULT = 0.40     # silence between sentences of one scene (word end -> next word start)
GAP_AFTER = {"pan.1": 0.50, "flight.1": 0.45, "cta.1": 0.50}   # let a visual beat land
END_HOLD = 2.10        # end card stays up this long after the last word


def ceil_to_beat(t: float) -> float:
    return math.ceil(t / BEAT - 1e-6) * BEAT


def main():
    vo = json.loads((BUILD / "vo_words.json").read_text(encoding="utf-8"))
    clips = vo["clips"]
    scene_ids = []
    for c in clips:
        if c["scene"] not in scene_ids:
            scene_ids.append(c["scene"])

    out_clips = []
    scenes = []
    cursor = INTRO_LEAD          # absolute time at which the next sentence's first word is spoken
    for si, sid in enumerate(scene_ids):
        sc_clips = [c for c in clips if c["scene"] == sid]
        if si == 0:
            start = 0.0
        else:
            prev_end = out_clips[-1]["speechEnd"]
            start = ceil_to_beat(prev_end + 0.10)
            cursor = start + SCENE_LEAD
        for ci, c in enumerate(sc_clips):
            first = c["words"][0]["t"]
            last = c["words"][-1]
            clip_start = cursor - first
            words = [{"w": w["w"], "t": round(clip_start + w["t"], 3), "d": w["d"]} for w in c["words"]]
            speech_end = clip_start + last["t"] + last["d"]
            out_clips.append({
                "id": c["id"], "scene": sid, "file": c["file"], "text": c["text"],
                "start": round(clip_start, 3),
                "speechStart": round(cursor, 3),
                "speechEnd": round(speech_end, 3),
                "duration": c["duration"],
                "words": words,
            })
            cursor = speech_end + GAP_AFTER.get(c["id"], GAP_DEFAULT)
        scenes.append({"id": sid, "start": round(start, 3)})

    last_end = out_clips[-1]["speechEnd"]
    duration = ceil_to_beat(last_end + END_HOLD)
    for i, sc in enumerate(scenes):
        nxt = scenes[i + 1]["start"] if i + 1 < len(scenes) else None
        sc["end"] = round(nxt + TRANSITION, 3) if nxt is not None else round(duration, 3)

    tl = {
        "fps": FPS, "width": WIDTH, "height": HEIGHT,
        "bpm": BPM, "beat": round(BEAT, 5),
        "transition": TRANSITION,
        "duration": round(duration, 3),
        "voice": vo["voice"],
        "scenes": scenes,
        "clips": out_clips,
    }
    (BUILD / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    (BUILD / "timeline.js").write_text("window.TIMELINE = " + json.dumps(tl, ensure_ascii=False) + ";\n", encoding="utf-8")

    print(f"duration {duration:.2f}s  ({int(duration * FPS)} frames @ {FPS} fps), beat {BEAT:.3f}s")
    for s in scenes:
        print(f"  scene {s['id']:7s} {s['start']:6.2f} -> {s['end']:6.2f}")
    for c in out_clips:
        print(f"  clip  {c['id']:8s} words {c['speechStart']:6.2f} -> {c['speechEnd']:6.2f}")


if __name__ == "__main__":
    main()
