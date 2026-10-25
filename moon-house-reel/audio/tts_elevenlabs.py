"""Narrator with ElevenLabs: one file per line + exact word timings.

    python audio/tts_elevenlabs.py                     # uses ELEVENLABS_API_KEY (env or .env)
        [--voice-id oXpouBLuKFVTJwcJO3YL] [--model eleven_multilingual_v2] [--speed 1.05]

    python audio/tts_elevenlabs.py --from-files DIR    # no API: use MP3/WAV files you made in the
                                                       # ElevenLabs app (line_01.mp3 ... line_07.mp3)

Writes voice/line_XX.wav (48 kHz mono) and voice/timings.json in the same format
as the Piper fallback, so audio/mix.py and subs/make_ass.py work unchanged.

Word timings: from the API's /with-timestamps character alignment when the API
is used; for files you bring yourself they are measured from the audio with a
local speech aligner (faster-whisper word timestamps, matched to the script so
every word is spelled exactly as written).
"""
import argparse
import base64
import difflib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, SR, VOICE_DIR, display_words, load_script, norm, read_wav, save_timings, write_wav  # noqa: E402

API = "https://api.elevenlabs.io/v1"
DEFAULT_VOICE = "oXpouBLuKFVTJwcJO3YL"     # "Holden - warm narrator" (library voice; add it to My Voices)
FALLBACK_VOICES = ["cjVigY5qzO86Huf0OWal", "nPczCjzI2devNBz1zQrb"]  # premade: Eric, Brian


def api_key():
    key = os.environ.get("ELEVENLABS_API_KEY")
    env = os.path.join(ROOT, ".env")
    if not key and os.path.exists(env):
        for line in open(env):
            if line.strip().startswith("ELEVENLABS_API_KEY"):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    return key


def tts_with_timestamps(key, voice, model, text, speed):
    body = {
        "text": text, "model_id": model,
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.25, "use_speaker_boost": True, "speed": speed},
    }
    req = urllib.request.Request(f"{API}/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def words_from_chars(text, align):
    """Character alignment -> start/end per display word of the script."""
    chars = align["characters"]; t0 = align["character_start_times_seconds"]; t1 = align["character_end_times_seconds"]
    spoken = "".join(chars)
    out, pos = [], 0
    for w in display_words(text):
        i = spoken.find(w, pos)
        if i < 0:                       # e.g. apostrophe style differs: match loosely
            i = spoken.lower().find(norm(w)[:3], pos)
        if i < 0:
            out.append(None); continue
        j = i + len(w) - 1
        out.append({"text": w, "start": t0[i], "end": t1[min(j, len(t1) - 1)]})
        pos = j + 1
    fill_gaps(out, text)
    return out


def fill_gaps(out, text):
    words = display_words(text)
    for k, o in enumerate(out):
        if o is None:
            prev = out[k - 1]["end"] if k > 0 and out[k - 1] else 0.0
            nxt = next((x["start"] for x in out[k + 1:] if x), prev + 0.3)
            out[k] = {"text": words[k], "start": prev, "end": max(prev + 0.05, nxt)}


def align_local(path, text):
    """Word timings for a file without timestamps: faster-whisper, matched to the script words."""
    from faster_whisper import WhisperModel
    model = align_local.model = getattr(align_local, "model", None) or WhisperModel("base.en", device="cpu", compute_type="int8")
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], check=True, capture_output=True).stdout
    audio = np.frombuffer(pcm, dtype=np.float32)
    segs, _ = model.transcribe(audio, word_timestamps=True, language="en", initial_prompt=text)
    rec = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
    words = display_words(text)
    sm = difflib.SequenceMatcher(None, [norm(w) for w in words], [norm(r[0]) for r in rec], autojunk=False)
    out = [None] * len(words)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("equal", "replace"):
            for k in range(min(i2 - i1, j2 - j1)):
                out[i1 + k] = {"text": words[i1 + k], "start": rec[j1 + k][1], "end": rec[j1 + k][2]}
    fill_gaps(out, text)
    # whisper's word starts run ~0.1 s early (measured against exact TTS alignments): correct it
    prev = 0.0
    for o in out:
        o["start"] = round(max(prev, min(o["start"] + 0.11, o["end"] - 0.03)), 3)
        prev = o["start"] + 0.03
    return out


def to_wav48(src, dst):
    a = read_wav(src)                                  # ffmpeg decode -> 48 kHz mono float
    peak = np.max(np.abs(a)) or 1.0
    write_wav(dst, a / peak * 0.89)
    return len(a) / SR


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice-id", default=os.environ.get("ELEVENLABS_VOICE_ID", DEFAULT_VOICE))
    ap.add_argument("--model", default=os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"))
    ap.add_argument("--speed", type=float, default=1.05, help="0.7-1.2, >1 is faster")
    ap.add_argument("--from-files", help="folder with line_01..line_07 audio files made in the ElevenLabs app")
    args = ap.parse_args()
    os.makedirs(VOICE_DIR, exist_ok=True)
    lines_out = []
    lines = load_script()["lines"]

    if args.from_files:
        for ln in lines:
            src = next((os.path.join(args.from_files, ln["id"] + e) for e in (".mp3", ".wav", ".m4a", ".ogg") if os.path.exists(os.path.join(args.from_files, ln["id"] + e))), None)
            if not src:
                sys.exit(f"missing {ln['id']}.mp3/.wav in {args.from_files}")
            dst = os.path.join(VOICE_DIR, ln["id"] + ".wav")
            dur = to_wav48(src, dst)
            words = align_local(dst, ln["text"])
            lines_out.append({"id": ln["id"], "scene": ln["scene"], "text": ln["text"], "file": os.path.relpath(dst, ROOT), "duration": round(dur, 3), "words": words})
            print(f"{ln['id']}: {dur:.2f}s (aligned locally)")
        save_timings("elevenlabs-files", lines_out)
        return

    key = api_key()
    if not key:
        sys.exit("No ELEVENLABS_API_KEY (set it in the environment or in .env).")
    voices = [args.voice_id] + [v for v in FALLBACK_VOICES if v != args.voice_id]
    voice = voices[0]
    for ln in lines:
        while True:
            try:
                res = tts_with_timestamps(key, voice, args.model, ln["text"], args.speed)
                break
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")
                if e.code in (400, 404) and "voice" in msg.lower() and len(voices) > 1:
                    print(f"voice {voice} not available ({e.code}); trying {voices[1]}")
                    voices.pop(0); voice = voices[0]
                    continue
                sys.exit(f"ElevenLabs error {e.code}: {msg[:300]}")
        mp3 = os.path.join(VOICE_DIR, ln["id"] + ".mp3")
        with open(mp3, "wb") as f:
            f.write(base64.b64decode(res["audio_base64"]))
        dst = os.path.join(VOICE_DIR, ln["id"] + ".wav")
        dur = to_wav48(mp3, dst)
        words = words_from_chars(ln["text"], res.get("alignment") or res["normalized_alignment"])
        lines_out.append({"id": ln["id"], "scene": ln["scene"], "text": ln["text"], "file": os.path.relpath(dst, ROOT), "duration": round(dur, 3), "words": words})
        print(f"{ln['id']}: {dur:.2f}s  " + " ".join(f"{w['text']}@{w['start']:.2f}" for w in words))
    save_timings(f"elevenlabs:{voice}:{args.model}", lines_out)


if __name__ == "__main__":
    main()
