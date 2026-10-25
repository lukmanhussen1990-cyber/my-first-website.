"""Turn TTS takes (or your own recording) into voice.wav + timeline.json. Run with system python3.

For every beat it picks the best take automatically:
  1. speech-to-text check (faster-whisper): every script word must be there,
  2. naturalness score (UTMOS),
  3. no stretched/mumbled takes (speaking rate sanity),
then trims each clip, levels it, joins the clips with the script's pauses and force-aligns every
word (torchaudio MMS_FA) so all animation can follow the voice exactly.

  python3 tools/voice/assemble.py --script episodes/the-mountain/script.json \
      --takes episodes/the-mountain/audio/takes/chatterbox --out episodes/the-mountain

  # your own recording instead of TTS (whole file, no re-timing):
  python3 tools/voice/assemble.py --script ... --external input/voice.mp3 --out episodes/the-mountain
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio

sys.path.insert(0, str(Path(__file__).parent))
from common import load_script, pause_before, plain_words, select_beats  # noqa: E402

SR = 48000
LEAD_IN = 0.15
TAIL = 0.6
SPEECHMOS = Path.home() / ".cache/grace-reels/SpeechMOS"


def load_mono(path, sr):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def resample(a, sr_from, sr_to):
    return torchaudio.functional.resample(torch.from_numpy(a), sr_from, sr_to).numpy()


def voiced_bounds(a, sr, rel_db=-38.0, pad=0.05):
    fr = int(sr * 0.01)
    n = len(a) // fr
    rms = np.sqrt((a[: n * fr].reshape(n, fr) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms / (rms.max() + 1e-12))
    idx = np.where(db > rel_db)[0]
    if len(idx) == 0:
        return 0, len(a)
    s = max(0, idx[0] * fr - int(pad * sr))
    e = min(len(a), (idx[-1] + 1) * fr + int(pad * sr))
    return s, e


def level(a, sr, target_db=-19.0, peak_db=-1.5):
    fr = int(sr * 0.02)
    n = len(a) // fr
    rms = np.sqrt((a[: n * fr].reshape(n, fr) ** 2).mean(1) + 1e-12)
    voiced = rms[rms > rms.max() * 0.1]
    gain = 10 ** (target_db / 20) / (np.sqrt((voiced ** 2).mean()) + 1e-9)
    b = a * gain
    peak = np.abs(b).max() + 1e-9
    lim = 10 ** (peak_db / 20)
    if peak > lim:
        b *= lim / peak
    f = int(sr * 0.006)
    b[:f] *= np.linspace(0, 1, f)
    b[-f:] *= np.linspace(1, 0, f)
    return b


def edit_accuracy(ref, hyp):
    d = np.zeros((len(ref) + 1, len(hyp) + 1), dtype=int)
    d[:, 0] = np.arange(len(ref) + 1)
    d[0, :] = np.arange(len(hyp) + 1)
    for i in range(1, len(ref) + 1):
        for j in range(1, len(hyp) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (ref[i - 1] != hyp[j - 1]))
    return 1.0 - d[-1, -1] / max(1, len(ref))


def parse_display(text):
    """Caption words with keyword flags. *two words* = one keyword group."""
    words, inside, span = [], False, -1
    cur, kw, grp = "", False, None
    for ch in text + " ":
        if ch == "*":
            inside = not inside
            span += inside
            continue
        if ch.isspace():
            if cur:
                words.append({"text": cur, "keyword": kw, "kwGroup": grp})
            cur, kw, grp = "", False, None
            continue
        cur += ch
        if inside and ch.isalnum():
            kw, grp = True, span
    return words


def norm_word(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


class Judge:
    def __init__(self):
        from faster_whisper import WhisperModel
        self.asr = WhisperModel("small.en", device="cpu", compute_type="int8")
        if not SPEECHMOS.exists():
            SPEECHMOS.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["git", "clone", "-q", "--depth", "1", "--branch", "v1.2.0",
                            "https://github.com/tarepan/SpeechMOS.git", str(SPEECHMOS)], check=True)
        self.mos = torch.hub.load(str(SPEECHMOS), "utmos22_strong", source="local", trust_repo=True)
        b = torchaudio.pipelines.MMS_FA
        self.fa_model = b.get_model(with_star=False)
        self.fa_tok = b.get_tokenizer()
        self.fa_align = b.get_aligner()

    def transcript(self, a16):
        segs, _ = self.asr.transcribe(a16, beam_size=5, language="en", condition_on_previous_text=False)
        return " ".join(s.text for s in segs)

    def utmos(self, a16):
        with torch.no_grad():
            return float(self.mos(torch.from_numpy(a16).unsqueeze(0), 16000))

    def align(self, a16, words):
        wav = torch.from_numpy(a16).unsqueeze(0)
        with torch.inference_mode():
            emission, _ = self.fa_model(wav)
        spans = self.fa_align(emission[0], self.fa_tok(words))
        ratio = wav.size(1) / emission.size(1) / 16000
        return [(s[0].start * ratio, s[-1].end * ratio) for s in spans]


def score_take(judge, a, sr, beat_text):
    s, e = voiced_bounds(a, sr)
    a = a[s:e]
    a16 = resample(a, sr, 16000)
    target = plain_words(beat_text)
    hyp = [norm_word(w) for w in judge.transcript(a16).split()]
    hyp = [w for w in hyp if w]
    acc = edit_accuracy(target, hyp)
    mos = judge.utmos(a16)
    wps = len(target) / (len(a) / sr)
    return {"accuracy": acc, "utmos": mos, "wps": wps, "seconds": len(a) / sr, "heard": " ".join(hyp)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--takes", help="folder with manifest.json from a tts_*.py tool")
    ap.add_argument("--external", help="your own full recording (mp3/wav)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--beats", default=None, help="subset like b01-b04 (for voice samples)")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--end-card", type=float, default=3.0)
    ap.add_argument("--tempo", type=float, default=1.0, help="speed factor for the joined voice (rubberband, pitch kept)")
    args = ap.parse_args()

    script = load_script(args.script)
    out = Path(args.out)
    (out / "audio").mkdir(parents=True, exist_ok=True)
    judge = Judge()
    beats = select_beats(script, args.beats)
    full_index = {b["id"]: k for k, b in enumerate(script["beats"])}
    report = []

    if args.external:
        full = load_mono(args.external, SR)
        s, e = voiced_bounds(full, SR)
        full = np.concatenate([np.zeros(int(LEAD_IN * SR), np.float32), level(full[s:e], SR)])
        clips = [(None, full)]
    else:
        manifest = json.loads((Path(args.takes) / "manifest.json").read_text())
        clips = []
        for i, beat in enumerate(beats):
            cands = [c for c in manifest["clips"] if c["beat"] == beat["id"]]
            if not cands:
                raise SystemExit(f"no takes for {beat['id']}")
            scored = []
            for c in cands:
                a = load_mono(Path(args.takes) / c["path"], SR)
                sc = score_take(judge, a, SR, beat["text"])
                scored.append((c, a, sc))
            med_wps = np.median([x[2]["wps"] for x in scored])

            def rank(x):
                sc = x[2]
                slow = max(0.0, med_wps / sc["wps"] - 1.25) if len(scored) > 2 else 0.0
                return (round(min(sc["accuracy"], 0.97), 2), sc["utmos"] - 3 * slow)

            best = max(scored, key=rank)
            report.append({"beat": beat["id"], "chosen": best[0]["path"],
                           "takes": [{"path": x[0]["path"], **x[2]} for x in scored]})
            a = best[1]
            s, e = voiced_bounds(a, SR)
            a = level(a[s:e], SR)
            hold = beat.get("holdBefore")
            if hold:
                words = plain_words(beat["text"])
                spans = judge.align(resample(a, SR, 16000), words)
                k = words.index(norm_word(hold["word"]))
                cut = int((spans[k - 1][1] + spans[k][0]) / 2 * SR)
                a = np.concatenate([a[:cut], np.zeros(int(hold["seconds"] * SR), np.float32), a[cut:]])
            gap = LEAD_IN if i == 0 else pause_before(script, full_index[beat["id"]])
            clips.append((gap, a))
            print(f"{beat['id']}: {best[0]['path']}  acc {best[2]['accuracy']:.2f}  utmos {best[2]['utmos']:.2f}"
                  f"  {best[2]['seconds']:.1f}s  heard: {best[2]['heard']}", flush=True)

    # join
    parts, offsets, t = [], [], 0.0
    for gap, a in clips:
        if gap:
            parts.append(np.zeros(int(gap * SR), np.float32))
            t += gap
        offsets.append(t)
        parts.append(a.astype(np.float32))
        t += len(a) / SR
    voice = np.concatenate(parts + [np.zeros(int(TAIL * SR), np.float32)])
    if abs(args.tempo - 1.0) > 1e-3:
        tmp_in, tmp_out = out / "audio/_tmp_in.wav", out / "audio/_tmp_out.wav"
        sf.write(tmp_in, voice, SR, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp_in), "-af",
                        f"rubberband=tempo={args.tempo}:pitch=1:formant=preserved", str(tmp_out)], check=True)
        voice = load_mono(tmp_out, SR)
        tmp_in.unlink()
        tmp_out.unlink()
    sf.write(out / "audio/voice.wav", voice, SR, subtype="PCM_24")

    # align every word on the final file, beat by beat (robust and exact)
    v16 = resample(voice, SR, 16000)
    all_words, beat_rows = [], []
    if args.external:
        flat = [(i, w) for i, b in enumerate(beats) for w in parse_display(b["text"])]
        spans = judge.align(v16, [norm_word(w["text"]) for _, w in flat])
        per_beat = {}
        for (i, w), (s, e) in zip(flat, spans):
            per_beat.setdefault(i, []).append((w, s, e))
    else:
        per_beat = {}
        scale = 1.0 / args.tempo
        for i, beat in enumerate(beats):
            disp = parse_display(beat["text"])
            s0 = int(offsets[i] * scale * 16000) - 800
            s1 = int((offsets[i] * scale + len(clips[i][1]) / SR * scale) * 16000) + 800
            s0, s1 = max(0, s0), min(len(v16), s1)
            spans = judge.align(v16[s0:s1], [norm_word(w["text"]) for w in disp])
            per_beat[i] = [(w, s + s0 / 16000, e + s0 / 16000) for w, (s, e) in zip(disp, spans)]

    for i, beat in enumerate(beats):
        rows = per_beat[i]
        for w, s, e in rows:
            all_words.append({"i": len(all_words), "text": w["text"], "keyword": w["keyword"],
                              "kwGroup": None if w["kwGroup"] is None else f"{beat['id']}.{w['kwGroup']}",
                              "start": round(s, 3), "end": round(e, 3), "beat": beat["id"], "scene": beat["scene"]})
        beat_rows.append({"id": beat["id"], "scene": beat["scene"], "text": beat["text"],
                          "start": round(rows[0][1], 3), "end": round(rows[-1][2], 3),
                          "wordStart": all_words[-len(rows)]["i"], "wordEnd": all_words[-1]["i"]})

    voice_end = len(voice) / SR
    duration = voice_end + args.end_card
    timeline = {"episode": script["episode"], "slug": script["slug"], "fps": args.fps, "sampleRate": SR,
                "voiceSeconds": round(voice_end, 3), "durationSeconds": round(duration, 3),
                "durationInFrames": int(np.ceil(duration * args.fps)), "endCardStart": round(voice_end, 3),
                "beats": beat_rows, "words": all_words}
    (out / "timeline.json").write_text(json.dumps(timeline, indent=1))
    (out / "audio/voice_report.json").write_text(json.dumps(report, indent=1))
    n = len(all_words)
    print(f"voice {voice_end:.1f}s, total {duration:.1f}s, {n} words, {n / (beat_rows[-1]['end'] - beat_rows[0]['start']) * 60:.0f} wpm")


if __name__ == "__main__":
    main()
