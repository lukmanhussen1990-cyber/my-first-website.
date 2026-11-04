#!/usr/bin/env python3
"""Mix for the Flash POV reel: the user's song is the main sound (not sped up, not pitched: just cut), + the storm.
- the song clip: from S0 (audio/beats.json) to the moment her dad opens the door; 0.35 s fade-in, a quick 0.08 s
  fade at the cut (the music stops there, as asked: "only the rain sound stays");
- the code-made effects (audio/sfx_cues.json) at their gains; thunder never runs past the door moment;
- master: ffmpeg loudnorm two-pass (linear) to -14 LUFS, true peak -1.5 dBTP -> audio/mix_final.wav (48 kHz stereo)."""
import json, re, subprocess
import numpy as np, soundfile as sf
from events import T, DUR

SR = 48000
B = json.load(open("audio/beats.json"))
n = int(round(DUR * SR))
raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{B['S0']:.3f}", "-t", f"{T['song_end']:.3f}", "-i", "audio/raw/my_song.mp3",
                      "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
song = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
fi, fo = int(0.35 * SR), int(0.08 * SR)
song[:fi] *= np.linspace(0, 1, fi)[:, None]; song[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.zeros((n, 2)); mix[:len(song)] += song[:n]
cues = json.load(open("audio/sfx_cues.json"))
for c in cues:
    x, sr = sf.read(c["file"], always_2d=True)
    if x.shape[1] == 1: x = np.repeat(x, 2, axis=1)
    g = 10 ** (c["gain_db"] / 20); i0 = int(round(c["t"] * SR))
    end = n
    if "thunder" in c["file"] or "screech" in c["file"] or "crackle" in c["file"]:
        end = min(n, int(round(T["dad"] * SR)))                 # the thunder stops right when her dad opens the door
    if "screech" in c["file"]: end = min(end, i0 + int(0.75 * SR))
    seg = x[:max(0, end - i0)] * g
    if len(seg) > int(0.06 * SR) and end < n: seg[-int(0.06 * SR):] *= np.linspace(1, 0, int(0.06 * SR))[:, None]
    mix[i0:i0 + len(seg)] += seg
fo2 = int(0.3 * SR); mix[-fo2:] *= np.linspace(1, 0, fo2)[:, None]
mix /= max(1.0, np.abs(mix).max() / 0.89)
sf.write("audio/mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")
m = subprocess.run(["ffmpeg", "-hide_banner", "-i", "audio/mix.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
      f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "audio/mix.wav", "-af", af, "-ar", str(SR), "-c:a", "pcm_s24le", "audio/mix_final.wav"], check=True)
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", "audio/mix_final.wav", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]; TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1]
print(f"song {T['song_end']:.3f} s (from {B['S0']:.3f} s in the song) + {len(cues)} effects -> audio/mix_final.wav: {I} LUFS, true peak {TP} dBTP, {DUR:.3f} s")
