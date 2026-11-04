#!/usr/bin/env python3
"""Beats + the drop of the user's song (free local tools only).
- "drink for me": faster-whisper (find_drop.py, small.en on the whole song) heard "drink ... me, drink ... me" at
  78.74 s and 80.06 s. Whisper word starts come a little early; the vocal energy (harmonic part, 400-3500 Hz) has the
  closure of the "dr-" at 78.93-78.97 s and 80.25-80.29 s, which sit exactly on the librosa beats 78.963 s and
  80.287 s (2 beats apart). So the transformation hits at DROP = 78.963 s (song time).
- beats: librosa beat_track on the song (89.1 BPM, one beat = 0.673 s).
Writes audio/beats.json: {"S0": start of the clip (song time), "drop": ..., "beats": [video-time beats]}"""
import json, subprocess
import numpy as np, librosa

SR = 22050
DROP = 78.963
y = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", "audio/raw/my_song.mp3", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout, np.float32).copy()
a = 55.0
tempo, bt = librosa.beat.beat_track(y=y[int(a * SR):int(105 * SR)], sr=SR, units="time", tightness=120)
bt = np.round(bt + a, 3)
k_drop = int(np.argmin(np.abs(bt - DROP)))
assert abs(bt[k_drop] - DROP) < 0.02, (bt[k_drop], DROP)
S0 = float(bt[k_drop - 7])                       # start the video 7 beats (4.69 s) before "drink for me"
beats = [round(float(b - S0), 3) for b in bt if S0 - 0.01 <= b <= S0 + 20]
json.dump({"S0": S0, "drop_song": DROP, "drop": round(DROP - S0, 3), "tempo": float(np.round(np.atleast_1d(tempo)[0], 2)), "beats": beats},
          open("audio/beats.json", "w"), indent=1)
print(f"tempo {float(np.round(np.atleast_1d(tempo)[0], 2))} BPM, clip starts at {S0:.3f} s (song), drop at video {DROP - S0:.3f} s")
print("beats (video time):", beats[:26])
