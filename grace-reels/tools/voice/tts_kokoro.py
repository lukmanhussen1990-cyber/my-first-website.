"""Local narration with Kokoro-82M (Apache-2.0). Run with the kokoro venv.

  /root/venvs/kokoro/bin/python tools/voice/tts_kokoro.py --script episodes/the-mountain/script.json \
      --out episodes/the-mountain/audio/takes/kokoro --voice am_michael --speed 0.95
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import load_script, select_beats, spoken_text  # noqa: E402

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from kokoro import KPipeline  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--script", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--beats", default=None)
ap.add_argument("--voice", default="am_michael")
ap.add_argument("--speed", type=float, default=0.95)
args = ap.parse_args()

script = load_script(args.script)
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
pipe = KPipeline(lang_code=args.voice[0], repo_id="hexgrad/Kokoro-82M")
manifest = {"engine": "kokoro", "voice": args.voice, "clips": []}
for beat in select_beats(script, args.beats):
    text = spoken_text(beat["text"])
    audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=args.voice, speed=args.speed)])
    path = out / f"{beat['id']}_t0.wav"
    sf.write(path, audio, 24000)
    manifest["clips"].append({"beat": beat["id"], "take": 0, "path": path.name, "text": text, "sr": 24000})
    print(beat["id"], f"{len(audio) / 24000:.1f}s", flush=True)
(out / "manifest.json").write_text(json.dumps(manifest, indent=1))
