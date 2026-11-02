"""Stand-in voiceover made with a local voice (Piper TTS on this machine: free, no credits).

Every script line is spoken by its character's voice (script.json "voices"), trimmed, given its character's sound
(yell = higher pitch + small bathroom echo, kid = higher pitch with shifted formants, ...), levelled, and put on one
timeline: LEAD_IN, then each line after its pause (gaps.default or the line's pause_before), then TAIL.
Word times: speech-to-text (faster-whisper small.en) on each line clip; when the heard words do not match the
script words, the line's words are spread over the clip by syllable count.

Usage:  python3 make_voiceover.py           (voice models in ./voices, see README)
Writes  audio/voiceover.wav (48 kHz mono), audio/voiceover.mp3, audio/vo_lines.json, audio/voiceover.words.json
"""
import json
import os
import re
import subprocess
import wave

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "audio")
RAW = os.path.join(OUT, "raw")
VOICES = os.environ.get("PIPER_VOICES", os.path.join(HERE, "voices"))
SR = 48000
SCRIPT = json.load(open(os.path.join(HERE, "script.json")))
LEAD_IN, TAIL = 0.2, 0.85
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))

FX = {  # ffmpeg filters per character sound (after the pitch change)
    "narrator": "highpass=f=70,acompressor=threshold=0.1:ratio=3:attack=5:release=90:makeup=1.5",
    "flat": "highpass=f=80,acompressor=threshold=0.1:ratio=2.5:attack=5:release=90:makeup=1.4",
    "yell": "highpass=f=140,acompressor=threshold=0.05:ratio=6:attack=2:release=60:makeup=2.5,"
            "aecho=0.85:0.55:23|41|67:0.32|0.22|0.14",
    "kid": "highpass=f=160,acompressor=threshold=0.1:ratio=3:attack=4:release=80:makeup=1.6",
}


def synth(voice, text, length_scale, path):
    from piper import PiperVoice, SynthesisConfig
    v = PiperVoice.load(os.path.join(VOICES, voice + ".onnx"))
    with wave.open(path, "wb") as w:
        v.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=length_scale, noise_scale=0.6, noise_w_scale=0.7))


def process(src, dst, pitch, fx):
    chain = []
    if pitch and abs(pitch - 1) > 1e-3:
        chain.append(f"rubberband=pitch={pitch}:formant={'shifted' if fx == 'kid' else 'preserved'}")
    chain.append(FX[fx])
    chain.append(f"aresample={SR}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", ",".join(chain), "-ac", "1", "-ar", str(SR), dst],
                   check=True)


def trim(a, thr_db=-42.0, pad_in=0.015, pad_out=0.06):
    hop = int(0.005 * SR)
    env = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2) + 1e-12) for i in range(0, len(a) - hop, hop)])
    ref = env.max()
    on = np.where(20 * np.log10(env / ref + 1e-12) > thr_db)[0]
    s0 = max(0, on[0] * hop - int(pad_in * SR))
    s1 = min(len(a), (on[-1] + 1) * hop + int(pad_out * SR))
    b = a[s0:s1].copy()
    f = int(0.004 * SR)
    b[:f] *= np.linspace(0, 1, f)
    b[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return b


def level(a, gain_db):
    # speech level: RMS of the loud part -> about -20 dBFS (+ the character's gain), peaks kept under -1.5 dBFS
    hop = int(0.02 * SR)
    r = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, max(1, len(a) - hop), hop)])
    loud = r[r > r.max() * 0.25] if r.size else np.array([1e-3])
    g = 10 ** ((-20 + gain_db) / 20) / (np.sqrt(np.mean(loud ** 2)) + 1e-9)
    b = a * g
    pk = np.abs(b).max()
    lim = 10 ** (-1.5 / 20)
    return b * (lim / pk) if pk > lim else b


def syllables(w):
    w = norm(w).replace("'", "")
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and n > 1 and not w.endswith(("le", "ee")):
        n -= 1
    return max(1, n)


def word_times(clip, words, model):
    a16 = subprocess.run(["ffmpeg", "-v", "error", "-i", clip, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    segs, _ = model.transcribe(np.frombuffer(a16, np.float32).copy(), language="en", word_timestamps=True,
                               beam_size=5, condition_on_previous_text=False, vad_filter=False,
                               initial_prompt=" ".join(words))
    heard = [w for s in segs for w in s.words]
    if [norm(w.word) for w in heard] == [norm(w) for w in words]:
        return [(w.start, w.end) for w in heard], "stt"
    dur = sf.info(clip).duration
    n = np.array([syllables(w) for w in words], float)
    edges = np.concatenate([[0], np.cumsum(n) / n.sum()]) * (dur - 0.08) + 0.02
    return [(edges[i], edges[i + 1]) for i in range(len(words))], f"spread (heard {[w.word for w in heard]})"


def main():
    os.makedirs(RAW, exist_ok=True)
    from faster_whisper import WhisperModel
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    clips = []
    for i, L in enumerate(SCRIPT["lines"], 1):
        V = SCRIPT["voices"][L["who"]]
        say = L.get("say") or L["text"]
        tts, fxd = os.path.join(RAW, f"l{i:02d}_tts.wav"), os.path.join(RAW, f"l{i:02d}_fx.wav")
        synth(L.get("voice", V["model"]), say, L.get("length_scale", V.get("length_scale", 1.0)), tts)
        process(tts, fxd, L.get("pitch", V.get("pitch")), V.get("fx", "narrator"))
        a, sr = sf.read(fxd, dtype="float64")
        a = level(trim(a), V.get("gain_db", 0))
        clip = os.path.join(RAW, f"l{i:02d}.wav")
        sf.write(clip, a, SR, subtype="PCM_24")
        clips.append((i, L, a, clip))
    y = [np.zeros(int(LEAD_IN * SR))]
    t = LEAD_IN
    meta, words_out = [], []
    for i, L, a, clip in clips:
        if i > 1:
            g = L.get("pause_before", SCRIPT["gaps"].get("tts", 0.16))
            y.append(np.zeros(int(g * SR)))
            t += int(g * SR) / SR
        script_words = L["text"].split()
        times, how = word_times(clip, script_words, model)
        for w, (s, e) in zip(script_words, times):
            words_out.append({"w": w, "s": round(t + s, 3), "e": round(t + e, 3), "line": i})
        meta.append({"i": i, "who": L["who"], "text": L["text"], "start": round(t, 3), "end": round(t + len(a) / SR, 3)})
        print(f"{i:2d} {L['who']:5s} {t:6.2f}-{t + len(a) / SR:6.2f}  {L['text']:52s} {how}")
        y.append(a)
        t += len(a) / SR
    y.append(np.zeros(int(TAIL * SR)))
    y = np.concatenate(y)
    sf.write(os.path.join(OUT, "voiceover.wav"), y, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, "voiceover.wav"), "-b:a", "192k",
                    os.path.join(OUT, "voiceover.mp3")], check=True)
    json.dump({"source": "local Piper TTS (stand-in)", "duration": round(len(y) / SR, 3), "lines": meta},
              open(os.path.join(OUT, "vo_lines.json"), "w"), indent=1)
    json.dump(words_out, open(os.path.join(OUT, "voiceover.words.json"), "w"), indent=0)
    print(f"voiceover: {len(y) / SR:.2f} s")


if __name__ == "__main__":
    main()
