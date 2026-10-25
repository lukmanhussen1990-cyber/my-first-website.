"""Local narration with Kokoro-82M (Apache-2.0). Run with the kokoro venv.

Scripture quotes are read a little slower than narration. Old KJV words that Kokoro's dictionary
does not know get explicit phonemes from LEXICON (misaki notation; extend it per episode with --lexicon).

  /root/venvs/kokoro/bin/python tools/voice/tts_kokoro.py --script episodes/the-mountain/script.json \
      --out episodes/the-mountain/audio/takes/kokoro --voice am_michael --speed 0.95
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import load_script, select_beats, spoken_text  # noqa: E402

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from kokoro import KPipeline  # noqa: E402

LEXICON = {
    "lovest": "lˈʌvəst",
    "thine": "ðˈIn",
    "hast": "hˈæst",
    "doth": "dˈʌθ",
    "saith": "sˈɛθ",
    "taketh": "tˈAkəθ",
    "spake": "spˈAk",
    "yea": "jˈA",
    "jehovahjireh": "ʤəhˌOvəʤˈIɹə",
}

ap = argparse.ArgumentParser()
ap.add_argument("--script", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--beats", default=None)
ap.add_argument("--voice", default="am_michael")
ap.add_argument("--speed", type=float, default=0.95)
ap.add_argument("--quote-speed", type=float, default=0.92)
ap.add_argument("--lexicon", default=None, help="extra JSON {word: phonemes}")
args = ap.parse_args()

lexicon = dict(LEXICON)
if args.lexicon:
    lexicon.update(json.loads(Path(args.lexicon).read_text()))


def with_phonemes(text):
    for word, ph in lexicon.items():
        text = re.sub(rf"\b({word})\b", rf"[\1](/{ph}/)", text, flags=re.IGNORECASE)
    return text


script = load_script(args.script)
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
pipe = KPipeline(lang_code=args.voice[0], repo_id="hexgrad/Kokoro-82M")
manifest = {"engine": "kokoro", "voice": args.voice, "clips": []}
for beat in select_beats(script, args.beats):
    text = spoken_text(beat["text"])
    is_quote = beat["text"].lstrip().startswith('"')
    speed = beat.get("speed", args.quote_speed if is_quote else args.speed)
    audio = np.concatenate([r.audio.numpy() for r in pipe(with_phonemes(text), voice=args.voice, speed=speed)])
    path = out / f"{beat['id']}_t0.wav"
    sf.write(path, audio, 24000)
    manifest["clips"].append({"beat": beat["id"], "take": 0, "path": path.name, "text": text, "sr": 24000, "speed": speed})
    print(beat["id"], f"{len(audio) / 24000:.1f}s at speed {speed}", flush=True)
(out / "manifest.json").write_text(json.dumps(manifest, indent=1))
