"""Transcribe voiceover.mp3 with Whisper (faster-whisper) using word-level timestamps.
Writes words_raw.json: [{"word","start","end","prob"}...]"""
import json, sys, time
import subprocess
import numpy as np
from faster_whisper import WhisperModel


def load_audio_16k(path):
    # decode with ffmpeg to 16 kHz mono float32 (avoids PyAV version issues)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

audio = sys.argv[1] if len(sys.argv) > 1 else 'voiceover.mp3'
out = sys.argv[2] if len(sys.argv) > 2 else 'words_raw.json'
model_name = sys.argv[3] if len(sys.argv) > 3 else 'medium.en'
t0 = time.time()
model = WhisperModel(model_name, device='cpu', compute_type='int8', cpu_threads=4)
segments, info = model.transcribe(
    load_audio_16k(audio),
    language='en',
    word_timestamps=True,
    beam_size=5,
    vad_filter=False,
    condition_on_previous_text=True,
    initial_prompt='Bucket Man, Golden Throne, Stinky Hill, Swamp of Smells, Weird Bucket Boy, Flush King, WHOOSH.',
)
words = []
for seg in segments:
    print(f"[{seg.start:7.2f} -> {seg.end:7.2f}] {seg.text}")
    for w in seg.words:
        words.append({'word': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3), 'prob': round(w.probability, 3)})
json.dump(words, open(out, 'w'), indent=1)
print(f"{len(words)} words, {time.time() - t0:.1f}s, duration {info.duration:.2f}s")
