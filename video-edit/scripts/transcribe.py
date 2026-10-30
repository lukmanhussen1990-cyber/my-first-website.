import json, sys
from faster_whisper import WhisperModel
name = sys.argv[1] if len(sys.argv) > 1 else "medium.en"
model = WhisperModel(name, device="cpu", compute_type="int8")
segs, info = model.transcribe(sys.argv[2], language="en", word_timestamps=True, beam_size=5, vad_filter=False,
    initial_prompt="Fable 5.1, Claude, Anthropic.")
out = []
for s in segs:
    out.append({"start": s.start, "end": s.end, "text": s.text,
                "words": [{"w": w.word, "s": w.start, "e": w.end, "p": w.probability} for w in s.words]})
    print(f"{s.start:6.2f}-{s.end:6.2f} {s.text}", flush=True)
json.dump(out, open(sys.argv[3], "w"), indent=1)
