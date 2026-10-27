"""Make a TEMPORARY voiceover with Piper (local neural TTS) so the reel can be built and timed.

The real voiceover is the user's ElevenLabs file. Swap it in with `swap_voice.sh` (see README).
Outputs:
  audio/voice_temp.wav         narration (Larry's "JOHN!" lines are left as gaps)
  audio/shouts_temp/john_6.wav  temp Larry shout for beat 6
  audio/shouts_temp/john_13.wav temp Larry shout for beat 13
"""
import os, wave, io, re
import numpy as np
from common import *

PIPER_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/"
NARRATOR = ("ryan/high/en_US-ryan-high", 0.70)   # voice, length_scale (<1 = faster)
LARRY = ("joe/medium/en_US-joe-medium", 2.4)

# Temp-voice only: small spelling/pace tweaks so Piper pronounces these lines clearly.
# (Subtitles always use script.json; the user's own voiceover replaces all of this.)
TTS_TEXT = {
    18: "Then you add a graveyard, flying bats, and a giant iron gate. Larry's sheet gets stuck in the gate. Twice!",
    21: "Then, at midnight... something floats in through the wall. A real, ghost.",
    24: "Then it turns the corner... and sees Larry. In his old one-dollar bed sheet. Eating chips.",
}
TTS_SPEED = {21: 0.80, 24: 0.78, 26: 0.76}

def voice(path):
    from piper import PiperVoice
    onnx = fetch(PIPER_BASE + path + ".onnx", os.path.join(CACHE, "piper", os.path.basename(path) + ".onnx"))
    fetch(PIPER_BASE + path + ".onnx.json", onnx + ".json")
    return PiperVoice.load(onnx)

def tts(v, text, length_scale):
    from piper import SynthesisConfig
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        v.synthesize_wav(text, wf, syn_config=SynthesisConfig(length_scale=length_scale, noise_scale=0.7, noise_w_scale=0.9))
    buf.seek(0)
    with wave.open(buf) as wf:
        sr = wf.getframerate(); x = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    # resample to 48 kHz
    n = int(len(x) * SR / sr)
    return np.interp(np.arange(n) * sr / SR, np.arange(len(x)), x).astype(np.float32)

def larry_shout(v):
    """A goofy, panicked "JOOOHN!": slow TTS, then a rising-falling pitch glide (variable-rate resample)."""
    x = trim_silence(tts(v, "Johhhn!", LARRY[1]), 0.02)
    n = len(x); pos = 0.0; out = []
    while pos < n - 1:
        p = pos / n
        rate = 1.30 + 0.28 * np.sin(np.pi * min(1, p * 1.3))       # +4.5 → +9 semitones and back
        i = int(pos); f = pos - i
        out.append(x[i] * (1 - f) + x[i + 1] * f); pos += rate
    y = np.array(out, dtype=np.float32)
    y = np.tanh(y * 2.2) / np.tanh(2.2)                                # a bit of "yell" saturation
    fade = int(0.03 * SR); y[-fade:] *= np.linspace(1, 0, fade)
    return y * 0.9

def main():
    sc = load_script()
    nar = voice(NARRATOR[0]); lar = voice(LARRY[0])
    pieces = []
    for b in sc["beats"]:
        text = TTS_TEXT.get(b["n"], b["text"])
        speed = TTS_SPEED.get(b["n"], NARRATOR[1])
        if b.get("shout"):
            narr_text = text.split('"')[0].strip()
            pieces.append(("narr", b["n"], tts(nar, narr_text, speed)))
            shout = larry_shout(lar)
            write_wav(os.path.join(AUDIO, "shouts_temp", f"john_{b['n']}.wav"), shout)
            pieces.append(("gap_for_shout", b["n"], np.zeros(int((len(shout) / SR + (1.2 if b.get("echo") else 0.15)) * SR), np.float32)))
        else:
            pieces.append(("narr", b["n"], tts(nar, text, speed)))
        # pause after each line: longer after "..." endings and at the big story turns
        gap = 0.16
        if text.rstrip().endswith("..."): gap = 0.30
        if b["n"] in (20,): gap = 0.55          # breath before midnight
        if b["n"] == 24: gap = 1.0              # CRUNCH + one second of silence
        if b["n"] == 25: gap = 0.35
        pieces.append(("gap", b["n"], np.zeros(int(gap * SR), np.float32)))
    # Piper pads each clip with ~0.1-0.2 s of silence; trim it so the pace stays fast
    track = []
    for kind, n, x in pieces:
        if kind == "narr":
            x = trim_silence(x, 0.004, pad=0.03)
        track.append(x)
    y = np.concatenate([np.zeros(int(0.15 * SR), np.float32)] + track)
    y = y / (np.abs(y).max() + 1e-9) * 0.89
    write_wav(os.path.join(AUDIO, "voice_temp.wav"), y)
    print("voice_temp.wav", round(len(y) / SR, 2), "s")

if __name__ == "__main__":
    main()
