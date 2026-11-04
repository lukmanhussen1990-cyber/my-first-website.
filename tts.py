#!/usr/bin/env python3
"""Narration: script.txt -> ElevenLabs -> audio/sceneNN.mp3 + audio/voice.wav + audio/timings.json

1. Every subtitle page of script.txt becomes one clip, audio/clips/sNN_pK.mp3, made with
   the ElevenLabs text-to-speech API (key: ELEVENLABS_API_KEY in .env or the environment).
   audio/clips/manifest.json remembers what each clip says and how it was made, so a clip is
   only generated again when its text, voice or settings change (re-runs cost nothing).
2. Clips are trimmed, levelled and joined per scene with a short gap. Scene length =
   lead + voice + tail (= voice + 0.8 s), at least plan.timing.min_scene, plus any "hold".
3. Writes audio/sceneNN.mp3 (one per scene, exactly the scene length), audio/voice.wav
   (the whole narration track) and audio/timings.json (page start/end -> subtitles, mouths).
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import wave

import numpy as np

from story import AUDIO, ROOT, clip_name, load_plan, parse_script

SR = 44100
CLIPS = AUDIO / "clips"
MANIFEST = CLIPS / "manifest.json"


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return os.environ.get("ELEVENLABS_API_KEY")


def elevenlabs(text, voice_id, tts, key):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128"
    body = json.dumps({"text": text, "model_id": tts["model_id"], "voice_settings": tts["voice_settings"]}).encode()
    req = urllib.request.Request(url, data=body, headers={
        "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ElevenLabs error {e.code}: {e.read().decode(errors='replace')[:300]}")


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def frames_db(x, hop=441):
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def trim_and_level(x, target_db=-19.0):
    """Cut leading/trailing silence and bring the spoken part to the same loudness."""
    db = frames_db(x)
    voiced = np.where(db > -45)[0]
    if len(voiced):
        a = max(0, voiced[0] * 441 - int(.04 * SR))
        b = min(len(x), (voiced[-1] + 1) * 441 + int(.12 * SR))
        x = x[a:b]
    db = frames_db(x)
    active = db[db > -40]
    if len(active):
        x = x * 10 ** ((target_db - 10 * np.log10(np.mean(10 ** (active / 10)))) / 20)
    peak = np.max(np.abs(x)) + 1e-9
    if peak > .89:  # keep peaks under -1 dBFS
        x = x * (.89 / peak)
    fade = int(.01 * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def write_wav(x, path):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def write_mp3(x, path):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", "192k", str(path)], input=x.astype(np.float32).tobytes(), check=True)


def main():
    plan = load_plan()
    tts, voices, T, fps = plan["tts"], plan["voices"], plan["timing"], plan["fps"]
    scenes = parse_script()
    if len(scenes) != len(plan["scenes"]):
        sys.exit(f"script.txt has {len(scenes)} lines but plan.json has {len(plan['scenes'])} scenes")
    CLIPS.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    key = None

    # 1) make sure every clip exists and matches the script
    for i, pages in enumerate(scenes, 1):
        for j, p in enumerate(pages, 1):
            name = clip_name(i, j)
            want = {"text": p["say"], "voice_id": voices[p["speaker"]]["voice_id"],
                    "model_id": tts["model_id"], "voice_settings": tts["voice_settings"]}
            have = {k: manifest.get(name, {}).get(k) for k in want}
            path = CLIPS / f"{name}.mp3"
            if path.exists() and have == want:
                continue
            key = key or load_env()
            if not key:
                sys.exit(f"{name} needs (re)generating but ELEVENLABS_API_KEY is not set (.env or environment).")
            print(f"ElevenLabs -> {name}: {p['say']}")
            path.write_bytes(elevenlabs(p["say"], want["voice_id"], tts, key))
            manifest[name] = dict(want, source="ElevenLabs API")
            MANIFEST.write_text(json.dumps(manifest, indent=1))

    # 2) build each scene's narration and the full voice track
    timings, track = {"scenes": []}, []
    for i, (pages, spec) in enumerate(zip(scenes, plan["scenes"]), 1):
        lead = spec.get("lead", T["lead"])
        t, parts, out_pages = lead, [np.zeros(int(lead * SR), np.float32)], []
        for j, p in enumerate(pages, 1):
            x = trim_and_level(decode(CLIPS / f"{clip_name(i, j)}.mp3"))
            if j > 1:
                parts.append(np.zeros(int(T["gap"] * SR), np.float32))
                t += T["gap"]
            out_pages.append({"start": round(t, 3), "end": round(t + len(x) / SR, 3),
                              "speaker": p["speaker"], "markup": p["markup"]})
            parts.append(x)
            t += len(x) / SR
        voice_len = t - lead
        dur = max(lead + voice_len + T["tail"] + spec.get("hold", 0), T["min_scene"])
        dur = round(dur * fps) / fps  # whole frames
        audio = np.concatenate(parts)
        audio = np.pad(audio, (0, max(0, int(round(dur * SR)) - len(audio))))[:int(round(dur * SR))]
        write_mp3(audio, AUDIO / f"scene{i:02d}.mp3")
        track.append(audio)
        timings["scenes"].append({"scene": i, "duration": dur, "voice": round(voice_len, 3), "pages": out_pages})
        print(f"audio/scene{i:02d}.mp3  voice {voice_len:4.2f}s -> scene {dur:5.2f}s")
    write_wav(np.concatenate(track), AUDIO / "voice.wav")
    total = sum(s["duration"] for s in timings["scenes"])
    timings["total"] = round(total, 3)
    (AUDIO / "timings.json").write_text(json.dumps(timings, indent=1))
    print(f"total {total:.2f}s -> audio/voice.wav, audio/timings.json")


if __name__ == "__main__":
    main()
