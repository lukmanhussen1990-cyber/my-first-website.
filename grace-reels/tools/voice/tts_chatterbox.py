"""Local narration with Chatterbox (Resemble AI, MIT). Run with the chatterbox venv.

One clip per beat, several seeded takes each; tools/voice/assemble.py picks the best take.
Only use --prompt with voices you are licensed to use (synthetic/stock voices, or your own recording).
Chatterbox adds Resemble's inaudible Perth watermark to every clip.

  /root/venvs/chatterbox/bin/python tools/voice/tts_chatterbox.py \
      --script episodes/the-mountain/script.json --out episodes/the-mountain/audio/takes/chatterbox --takes 3
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import load_script, select_beats, spoken_text  # noqa: E402

import torch  # noqa: E402
import torchaudio as ta  # noqa: E402
from chatterbox.tts import ChatterboxTTS  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--script", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--beats", default=None)
ap.add_argument("--takes", type=int, default=3)
ap.add_argument("--prompt", default=None)
ap.add_argument("--exaggeration", type=float, default=0.45)
ap.add_argument("--cfg", type=float, default=0.45)
ap.add_argument("--temperature", type=float, default=0.75)
ap.add_argument("--seed", type=int, default=1000)
args = ap.parse_args()

script = load_script(args.script)
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(4)
model = ChatterboxTTS.from_pretrained(device="cpu")
if args.prompt:
    model.prepare_conditionals(args.prompt, exaggeration=args.exaggeration)

manifest_path = out / "manifest.json"
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"engine": "chatterbox", "clips": []}
texts = {b["id"]: spoken_text(b["text"]) for b in script["beats"]}
manifest["clips"] = [c for c in manifest["clips"] if c["text"] == texts.get(c["beat"])]  # drop takes of edited lines
done = {(c["beat"], c["take"]) for c in manifest["clips"]}
order = [b["id"] for b in script["beats"]]

for beat in select_beats(script, args.beats):
    text = spoken_text(beat["text"])
    for take in range(args.takes):
        if (beat["id"], take) in done:
            continue
        torch.manual_seed(args.seed + order.index(beat["id"]) * 17 + take)
        t0 = time.time()
        wav = model.generate(text, exaggeration=args.exaggeration, cfg_weight=args.cfg, temperature=args.temperature)
        path = out / f"{beat['id']}_t{take}.wav"
        ta.save(str(path), wav, model.sr)
        manifest["clips"].append({"beat": beat["id"], "take": take, "path": path.name, "text": text, "sr": model.sr})
        manifest_path.write_text(json.dumps(manifest, indent=1))
        print(f"{beat['id']} take {take}: {wav.shape[-1] / model.sr:.1f}s audio in {time.time() - t0:.0f}s", flush=True)
