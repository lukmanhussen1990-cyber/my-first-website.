"""Word-level timings for the voiceover (faster-whisper). Writes work/words.json"""
import json, sys, subprocess
import numpy as np
from faster_whisper import WhisperModel
audio = sys.argv[1] if len(sys.argv) > 1 else 'voiceover.mp3'
size = sys.argv[2] if len(sys.argv) > 2 else 'small.en'
model = WhisperModel(size, device='cpu', compute_type='int8')
raw = subprocess.run(['ffmpeg','-v','error','-i',audio,'-f','s16le','-ac','1','-ar','16000','-'],capture_output=True,check=True).stdout
pcm = np.frombuffer(raw, np.int16).astype(np.float32)/32768.0
segments, info = model.transcribe(pcm, word_timestamps=True, vad_filter=False, beam_size=5,
                                  condition_on_previous_text=True)
words = []
for seg in segments:
    print(f"[{seg.start:6.2f} - {seg.end:6.2f}] {seg.text}")
    for w in seg.words:
        words.append({'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3), 'p': round(w.probability, 3)})
json.dump({'duration': info.duration, 'words': words}, open('work/words_%s.json' % size.replace('.', '_'), 'w'), indent=1)
print(len(words), 'words, duration', info.duration)
