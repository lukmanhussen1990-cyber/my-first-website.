"""Free fallback narration with edge-tts (exact word boundaries). Run with system python3.

  python3 tools/voice/tts_edge.py --script episodes/the-mountain/script.json \
      --out episodes/the-mountain/audio/takes/edge --voice en-US-AndrewMultilingualNeural --rate=-5%
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import load_script, select_beats, spoken_text  # noqa: E402

import edge_tts  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--script", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--beats", default=None)
ap.add_argument("--voice", default="en-US-AndrewMultilingualNeural")
ap.add_argument("--rate", default="-5%")
ap.add_argument("--pitch", default="+0Hz")
args = ap.parse_args()


async def main():
    script = load_script(args.script)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"engine": "edge", "voice": args.voice, "clips": []}
    for beat in select_beats(script, args.beats):
        text = spoken_text(beat["text"])
        com = edge_tts.Communicate(text, args.voice, rate=args.rate, pitch=args.pitch,
                                   boundary="WordBoundary", proxy=os.environ.get("HTTPS_PROXY"))
        path = out / f"{beat['id']}_t0.mp3"
        words = []
        with open(path, "wb") as f:
            async for chunk in com.stream():
                if chunk["type"] == "audio":
                    f.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    words.append({"text": chunk["text"], "start": chunk["offset"] / 1e7,
                                  "end": (chunk["offset"] + chunk["duration"]) / 1e7})
        manifest["clips"].append({"beat": beat["id"], "take": 0, "path": path.name, "text": text, "words": words})
        print(beat["id"], len(words), "words", flush=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))


asyncio.run(main())
