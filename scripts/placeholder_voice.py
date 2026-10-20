"""Offline placeholder voice (Piper neural TTS) used ONLY when no ElevenLabs take
is cached and no ElevenLabs credits/key are available.

It writes the same cache format as scripts/voice.js (audio/vo/<id>.mp3 + .json
with per-word timestamps from Piper's phoneme alignments), tagged
"source": "offline-placeholder/...", so `node scripts/voice.js` replaces these
files with ElevenLabs takes as soon as ELEVENLABS_API_KEY works.

  .venv/bin/python scripts/placeholder_voice.py [--all] [scene ids...]
"""
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / ".cache/piper"
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

ROLES = {
    # model, HF path, length_scale, pitch ratio, breath-layer gain, whisper conversion
    "narrator": dict(model="en_US-john-medium", hf="en/en_US/john/medium", length=1.12, pitch=0.915, breath=0.22, whisper=False),
    "whisper": dict(model="en_GB-jenny_dioco-medium", hf="en/en_GB/jenny_dioco/medium", length=1.25, pitch=1.0, breath=0.0, whisper=True),
}
PAUSE = {"...": 0.62, "…": 0.62, "?": 0.5, ".": 0.42, "!": 0.42}


def ensure_model(role):
    cfg = ROLES[role]
    onnx = MODELS / f"{cfg['model']}.onnx"
    if not onnx.exists():
        MODELS.mkdir(parents=True, exist_ok=True)
        for ext in (".onnx", ".onnx.json"):
            url = f"{HF}/{cfg['hf']}/{cfg['model']}{ext}"
            subprocess.run(["curl", "-sSfL", "-o", str(MODELS / f"{cfg['model']}{ext}"), url], check=True)
    return onnx


def synth(voice, text, length):
    """Sentence chunks with our own pauses; returns audio + phonetic word spans
    [start, end, is_chunk_end] in seconds."""
    sr = voice.config.sample_rate
    out, words, t = [], [], 0.0
    for chunk in voice.synthesize(text, SynthesisConfig(length_scale=length, noise_w_scale=0.9), include_alignments=True):
        audio = chunk.audio_float_array.astype(np.float32)
        # phoneme alignments -> word spans (words are separated by " ", punctuation = pause)
        pos, cur = 0, None
        for al in chunk.phoneme_alignments or []:
            p, n = al.phoneme, al.num_samples
            if p in (" ", "^", "$") or p in ",.;:!?…" or not p.strip():
                if cur:
                    words.append(cur)
                    cur = None
            else:
                if cur is None:
                    cur = [t + pos / sr, t + (pos + n) / sr, False]
                else:
                    cur[1] = t + (pos + n) / sr
            pos += n
        if cur:
            words.append(cur)
        if words:
            words[-1][2] = True
        out.append(audio)
        t += len(audio) / sr
        tail = "".join(chunk.phonemes)[-4:]
        pause = 0.3
        for k, v in PAUSE.items():
            if k in tail:
                pause = v
                break
        out.append(np.zeros(int(pause * sr), np.float32))
        t += pause
    return np.concatenate(out), words, sr


def noise_vocode(x, sr, tilt_db=6.0):
    """Replace the excitation with noise but keep the spectral envelope -> whisper."""
    n_fft, hop = 1024, 256
    win = np.hanning(n_fft).astype(np.float32)
    pad = np.pad(x, (n_fft, n_fft))
    frames = np.lib.stride_tricks.sliding_window_view(pad, n_fft)[::hop] * win
    spec = np.fft.rfft(frames, axis=1)
    logmag = np.log(np.abs(spec) + 1e-7)
    ceps = np.fft.irfft(logmag, axis=1)
    lifter = np.zeros(n_fft)
    lifter[:34] = 1
    lifter[-33:] = 1
    env = np.exp(np.fft.rfft(ceps * lifter, axis=1).real)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    shape = (freqs / 4000.0).clip(0.08, 2.0) ** (tilt_db / 6.0)
    shape *= 1 / (1 + (300 / np.maximum(freqs, 1)) ** 4)  # whispers have no chest
    rng = np.random.default_rng(7)
    noise = np.exp(1j * rng.uniform(0, 2 * np.pi, spec.shape))
    y_frames = np.fft.irfft(noise * env * shape, axis=1) * win
    y = np.zeros(len(pad) + n_fft)
    for i, f in enumerate(y_frames):
        y[i * hop:i * hop + n_fft] += f
    y = y[n_fft:n_fft + len(x)]
    return (y / (np.abs(y).max() + 1e-9) * 0.9).astype(np.float32)


def write_wav(path, x, sr):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def text_words(text):
    return [w for w in text.replace("—", " ").split() if any(c.isalnum() for c in w)]


def map_words(text, spans):
    """Align text words to phonetic word spans. espeak merges some function words
    ("in the") and splits others ("A.M."), so this is a small DP over groups:
    k words -> 1 span or 1 word -> k spans, matching duration to letters and
    sentence ends to chunk ends."""
    toks = text_words(text)
    letters = [max(1, sum(c.isalnum() for c in w)) for w in toks]
    rate = sum(e - s for s, e, _ in spans) / sum(letters)
    ends_sentence = [w.rstrip("\"'")[-1:] in ".?!…" for w in toks]
    INF = float("inf")
    n, m = len(toks), len(spans)
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0
    moves = [(1, 1, 0.0), (2, 1, 0.35), (3, 1, 0.9), (1, 2, 0.35), (1, 3, 0.9)]
    for i in range(n + 1):
        for j in range(m + 1):
            if dp[i][j] == INF:
                continue
            for a, b, pen in moves:
                if i + a > n or j + b > m:
                    continue
                dur = spans[j + b - 1][1] - spans[j][0]
                exp = sum(letters[i:i + a]) * rate
                cost = pen + np.log((dur + 0.05) / (exp + 0.05)) ** 2
                if ends_sentence[i + a - 1] != spans[j + b - 1][2]:
                    cost += 4.0
                if dp[i][j] + cost < dp[i + a][j + b]:
                    dp[i + a][j + b] = dp[i][j] + cost
                    back[i + a][j + b] = (i, j, a, b)
    out, i, j = [], n, m
    while i or j:
        pi, pj, a, b = back[i][j]
        s, e = spans[pj][0], spans[pj + b - 1][1]
        group = letters[pi:pi + a]
        acc = s
        for k in range(a):  # split a merged span by letters
            d = (e - s) * group[k] / sum(group)
            out.append(dict(text=toks[pi + k], start=round(acc, 3), end=round(acc + d, 3)))
            acc += d
        i, j = pi, pj
    out.sort(key=lambda w: w["start"])
    return out


def main():
    story = json.loads((ROOT / "src/story.json").read_text())
    argv = sys.argv[1:]
    force = "--all" in argv
    only = {a for a in argv if not a.startswith("--")}
    voices = {}
    for scene in story["scenes"]:
        role = scene.get("voice")
        if not role or (only and scene["id"] not in only):
            continue
        mp3 = ROOT / "audio/vo" / f"{scene['id']}.mp3"
        meta_path = mp3.with_suffix(".json")
        if meta_path.exists() and not force:
            meta = json.loads(meta_path.read_text())
            if meta.get("text") == scene["text"]:
                print(f"[cache] {scene['id']} ({meta.get('source')})")
                continue
        cfg = ROLES[role]
        if role not in voices:
            voices[role] = PiperVoice.load(str(ensure_model(role)), include_alignments=True)
        x, spans, sr = synth(voices[role], scene["text"], cfg["length"])
        x = x / (np.abs(x).max() + 1e-9) * 0.8
        if cfg["whisper"]:
            x = noise_vocode(x, sr, tilt_db=7.0)
        elif cfg["breath"]:
            x = x + cfg["breath"] * noise_vocode(x, sr, tilt_db=9.0)
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / "raw.wav"
            write_wav(raw, x, sr)
            af = [f"rubberband=pitch={cfg['pitch']}:formant=preserved"] if cfg["pitch"] != 1.0 else []
            af += [
                "highpass=f=70",
                "equalizer=f=140:t=q:w=1.0:g=2.5",
                "equalizer=f=3200:t=q:w=1.2:g=-1.5",
                "acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3",
                "aresample=44100",
            ]
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", ",".join(af), "-ac", "1", "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], check=True)
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)]))
        meta = dict(
            id=scene["id"],
            text=scene["text"],
            voice_id=None,
            model_id=None,
            source=f"offline-placeholder/piper:{cfg['model']}" + ("+noise-vocoder-whisper" if cfg["whisper"] else ""),
            note="PLACEHOLDER - not ElevenLabs. Run `node scripts/voice.js` with ELEVENLABS_API_KEY to replace.",
            duration=round(dur, 3),
            words=map_words(scene["text"], spans),
        )
        meta_path.write_text(json.dumps(meta, indent=2) + "\n")
        print(f"[piper] {scene['id']} {dur:.2f}s  {scene['text']}")


if __name__ == "__main__":
    main()
