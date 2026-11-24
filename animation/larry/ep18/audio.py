"""Episode 18 audio: the user's voiceover only (no SFX, no music - the user's standing preference since episode 2),
padded to the episode length. Usage: python3 -I audio.py <vo.mp3> <out.wav>   then normalize.sh to -14 LUFS."""
import os, subprocess, sys, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cuts import TOTAL
SR = 48000
VO, OUT = sys.argv[1], sys.argv[2]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", VO, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(raw, dtype=np.float32)
N = int(round(TOTAL * SR))
mix = np.zeros(N, np.float32)
mix[:min(N, len(vo))] = vo[:N]
pcm = (np.clip(np.stack([mix, mix], axis=1), -1, 1) * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", OUT, N / SR, "s")
