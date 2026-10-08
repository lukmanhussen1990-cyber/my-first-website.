#!/usr/bin/env python3
"""Generate the Bengali voice-over, one clip per sentence of script.json.

Uses the Bengali neural voices exposed by `edge-tts` (pip install edge-tts).
Besides the audio, the service reports a timestamp for every spoken word; those
are saved to build/vo_words.json so the animation can hit exact words.

    python tools/make_voiceover.py            # uses script.json
    VO_VOICE=bn-IN-BashkarNeural python tools/make_voiceover.py   # male voice
"""
import asyncio
import json
import os
import ssl
import subprocess
import sys
from pathlib import Path

import edge_tts
import edge_tts.communicate as ec

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
BUILD = ROOT / "build"

# edge-tts pins certifi's CA list. Behind a TLS-inspecting proxy, point it at the
# proxy-provided bundle instead (never disable verification).
CA_BUNDLE = os.environ.get("CA_BUNDLE", "/root/.ccr/ca-bundle.crt")
if os.path.exists(CA_BUNDLE):
    ec._SSL_CTX = ssl.create_default_context(cafile=CA_BUNDLE)


def probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]
    )
    return float(out.decode().strip())


async def synth(text: str, voice: str, rate: str, pitch: str, out: Path, retries: int = 3):
    last = None
    for attempt in range(1, retries + 1):
        try:
            com = edge_tts.Communicate(
                text, voice, rate=rate, pitch=pitch, boundary="WordBoundary",
                proxy=os.environ.get("HTTPS_PROXY"),
            )
            audio = bytearray()
            words = []
            async for chunk in com.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    words.append({
                        "w": chunk["text"],
                        "t": round(chunk["offset"] / 1e7, 3),
                        "d": round(chunk["duration"] / 1e7, 3),
                    })
            if not audio:
                raise RuntimeError("no audio received")
            out.write_bytes(bytes(audio))
            return words
        except Exception as e:  # network hiccup: back off and retry
            last = e
            print(f"  attempt {attempt} failed: {e}", file=sys.stderr)
            await asyncio.sleep(2 * attempt)
    raise last


async def main():
    cfg = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
    voice = os.environ.get("VO_VOICE", cfg["voice"])
    AUDIO.mkdir(exist_ok=True)
    BUILD.mkdir(exist_ok=True)
    for stale in AUDIO.glob("vo_*.mp3"):
        stale.unlink()
    result = {"voice": voice, "clips": []}
    for scene in cfg["scenes"]:
        for n, text in enumerate(scene["sentences"], start=1):
            cid = f"{scene['id']}.{n}"
            out = AUDIO / f"vo_{scene['id']}_{n}.mp3"
            words = await synth(text, voice, cfg["rate"], cfg["pitch"], out)
            dur = probe_duration(out)
            result["clips"].append({
                "id": cid,
                "scene": scene["id"],
                "file": f"audio/{out.name}",
                "text": text,
                "duration": round(dur, 3),
                "words": words,
            })
            print(f"{cid:8s} {dur:5.2f}s  {len(words):2d} words  {text}")
    (BUILD / "vo_words.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
