"""Get word timings from the voiceover and match them to the script.

Usage: python3 align_voice.py [voice_file] [--model small.en] [--shouts folder]

Runs Whisper (faster-whisper, locally) to recognise the words, matches them to the script (so
subtitles always use the script spelling), then gets precise word times by CTC forced alignment of
the script to the audio (torchaudio wav2vec2). Writes build/timing.json:
  words:  every script word with start/end time, beat number and whether it is a yellow key word
  beats:  start/end of every voice line
  shouts: where Larry's separate "JOHN!" files go (if <shouts folder>/john_<beat>.wav exist)
"""
import argparse, difflib, json, os, re
import numpy as np
from common import *

NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
       "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen", "20": "twenty",
       "100": "hundred", "1000": "thousand", "1000000": "million"}


def norm_tokens(word):
    """Normalise one word into comparable tokens: lower case, no punctuation, digits spelled out."""
    w = word.lower().replace("’", "'")
    w = w.replace("$", " dollar ").replace("-", " ").replace("%", " percent ")
    out = []
    for t in w.split():
        t = re.sub(r"[^a-z0-9']", "", t).strip("'")
        if not t:
            continue
        if t.isdigit():
            t = NUM.get(t, t)
        if t == "dollars":
            t = "dollar"
        out.append(t)
    return out


def script_words(sc):
    """Script words (display spelling) with beat number, in order. Display drops , . … and quotes."""
    words = []
    for b in sc["beats"]:
        for raw in b["text"].split():
            disp = raw.strip('"').rstrip(",.").replace("...", "")
            disp = disp.rstrip(",.")
            if not disp:
                continue
            words.append({"text": disp, "beat": b["n"], "shout": bool(b.get("shout")) and disp.strip("!\"").upper() == "JOHN"})
    return words


def is_key(text, keys):
    t = re.sub(r"[^a-z]", "", text.lower())
    for k in keys:
        k = k.lower()
        stem = k[:-1] if k.endswith("s") and len(k) > 4 else k
        if t == k or t.startswith(stem) or (k in ("dollar", "million") and k in t):
            return True
    return False


def transcribe(path, model_name):
    from faster_whisper import WhisperModel
    audio = read_mono(path, 16000)
    m = WhisperModel(model_name, device="cpu", compute_type="int8", download_root=os.path.join(CACHE, "whisper"), cpu_threads=4)
    prompt = "Larry, John, bedsheet, haunted house, trapdoors, zombies, selfie, chicken exit, JOHN!"
    segs, _ = m.transcribe(audio, word_timestamps=True, beam_size=5, initial_prompt=prompt, vad_filter=False)
    words = []
    for s in segs:
        for w in s.words:
            words.append({"w": w.word.strip(), "s": float(w.start), "e": float(w.end)})
    return words, len(audio) / 16000


def align(script, heard):
    """Map each script word to heard word times (token-level difflib alignment + interpolation)."""
    s_tok, s_idx = [], []
    for i, w in enumerate(script):
        for t in norm_tokens(w["text"]):
            s_tok.append(t); s_idx.append(i)
    h_tok, h_idx = [], []
    pending_dollar = None      # "$10 million" is heard as dollar-ten-million; the script says ten million dollars
    for j, w in enumerate(heard):
        toks = norm_tokens(w["w"])
        if pending_dollar is not None and not (toks and toks[0] in ("million", "thousand", "hundred", "billion")):
            h_tok.append("dollar"); h_idx.append([pending_dollar]); pending_dollar = None
        if w["w"].strip().startswith("$") and len(toks) >= 2 and toks[0] == "dollar":
            toks = toks[1:]; pending_dollar = j
        for t in toks:
            h_tok.append(t); h_idx.append([j])
        if pending_dollar is not None and toks and toks[-1] in ("million", "thousand", "hundred", "billion"):
            h_tok.append("dollar"); h_idx.append([j]); pending_dollar = None
    if pending_dollar is not None:
        h_tok.append("dollar"); h_idx.append([pending_dollar])
    # merge split compounds ("bed sheet" -> "bedsheet", "trap doors" -> "trapdoors") when the script has them
    s_set = set(s_tok)
    k = 0
    while k < len(h_tok) - 1:
        if h_tok[k] + h_tok[k + 1] in s_set and h_tok[k] not in s_set:
            h_tok[k] = h_tok[k] + h_tok[k + 1]; h_idx[k] = h_idx[k] + h_idx[k + 1]; del h_tok[k + 1]; del h_idx[k + 1]
        k += 1
    sm = difflib.SequenceMatcher(a=s_tok, b=h_tok, autojunk=False)
    times = [None] * len(script)
    owners = {}                                  # heard word -> script words mapped onto it
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            i = s_idx[a + k]
            for j in h_idx[b + k]:
                owners.setdefault(j, [])
                if i not in owners[j]:
                    owners[j].append(i)
                s, e = heard[j]["s"], heard[j]["e"]
                if times[i] is None:
                    times[i] = [s, e]
                else:
                    times[i][0] = min(times[i][0], s); times[i][1] = max(times[i][1], e)
    for j, idxs in owners.items():               # several script words share one heard word: split its span
        if len(idxs) > 1:
            s, e = heard[j]["s"], heard[j]["e"]
            lens = np.array([max(2, len(script[i]["text"])) for i in idxs], float)
            edges = s + (e - s) * np.concatenate([[0], np.cumsum(lens) / lens.sum()])
            for k, i in enumerate(sorted(idxs)):
                times[i] = [float(edges[k]), float(edges[k + 1])]
    was_heard = [t is not None for t in times]
    # interpolate unmatched words between their matched neighbours (by character length)
    i = 0
    while i < len(script):
        if times[i] is not None:
            i += 1; continue
        j = i
        while j < len(script) and times[j] is None:
            j += 1
        t0 = times[i - 1][1] if i > 0 else 0.0
        t1 = times[j][0] if j < len(script) else t0 + 0.35 * (j - i)
        lens = np.array([max(2, len(script[k]["text"])) for k in range(i, j)], float)
        edges = t0 + (t1 - t0) * np.concatenate([[0], np.cumsum(lens) / lens.sum()])
        for k in range(i, j):
            times[k] = [float(edges[k - i]), float(edges[k - i + 1])]
        i = j
    return times, was_heard


def forced_align(audio16k, words):
    """Precise word times: CTC forced alignment of the known script letters to the audio
    (torchaudio wav2vec2, 20 ms frames). Returns [(start, end) or None] per word."""
    import torch, torchaudio
    os.environ.setdefault("TORCH_HOME", os.path.join(CACHE, "torch"))
    bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
    model = bundle.get_model().eval()
    labels = bundle.get_labels()
    idx = {c: i for i, c in enumerate(labels)}
    letters = []
    for w in words:
        t = w["text"].upper().replace("-", "|").replace("’", "'")
        letters.append([c for c in t if c in idx])
    targets, owner = [], []
    for k, ch in enumerate(letters):
        if not ch:
            continue
        if targets:
            targets.append(idx["|"]); owner.append(-1)
        for c in ch:
            targets.append(idx[c]); owner.append(k)
    wav = torch.from_numpy(audio16k).unsqueeze(0)
    with torch.inference_mode():
        em, _ = model(wav)
        em = torch.log_softmax(em, dim=-1)
    T = em.shape[1]
    sec_per_frame = len(audio16k) / 16000 / T
    ali, scores = torchaudio.functional.forced_align(em, torch.tensor([targets], dtype=torch.int32), blank=0)
    spans = torchaudio.functional.merge_tokens(ali[0], scores[0].exp())
    out = [None] * len(words)
    for sp, k in zip(spans, owner):
        if k < 0:
            continue
        s, e = sp.start * sec_per_frame, sp.end * sec_per_frame
        out[k] = [min(out[k][0], s), max(out[k][1], e)] if out[k] else [s, e]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("voice", nargs="?", default=os.path.join(AUDIO, "voice_temp.wav"))
    ap.add_argument("--model", default="small.en")
    ap.add_argument("--shouts", default=None, help="folder with Larry's john_<beat>.wav shout files "
                    "(default: audio/shouts_temp for the temp voice, audio/shouts otherwise)")
    args = ap.parse_args()
    if args.shouts is None:
        temp = os.path.basename(args.voice).startswith("voice_temp")
        args.shouts = os.path.join(AUDIO, "shouts_temp" if temp else "shouts")
    sc = load_script()
    heard, dur = transcribe(args.voice, args.model)
    script = script_words(sc)

    # Larry's separate shout files (audio/shouts/john_<beat>.wav). If the narrator does not say a
    # beat's JOHN!, that spot is a gap and the shout fills it; if he does, the shout is layered on it.
    shout_files = {b["n"]: os.path.join(args.shouts, f"john_{b['n']}.wav") for b in sc["beats"] if b.get("shout")}
    shout_files = {n: p for n, p in shout_files.items() if os.path.exists(p)}
    times, was_heard = align(script, heard)
    matched = sum(was_heard)
    for w, t, h in zip(script, times, was_heard):
        w["s"], w["e"], w["heard"] = round(t[0], 3), round(t[1], 3), h
    # precise times from forced alignment of the script (shout words that the narrator does not say
    # are left out: their time comes from the shout file placement below)
    spoken = [w for w in script if not (w["shout"] and w["beat"] in shout_files and not w["heard"])]
    audio16 = read_mono(args.voice, 16000)
    fa = forced_align(audio16, spoken)
    moved = 0
    for w, t in zip(spoken, fa):
        if t is None:
            continue
        if w["heard"] and abs(t[0] - w["s"]) > 1.0:     # disagrees badly with Whisper: keep Whisper's time
            moved += 1
            continue
        w["s"], w["e"] = round(t[0], 3), round(t[1], 3)
    if moved:
        print(f"note: {moved} words kept Whisper timing (voice may differ from the script there)")
    shouts = []
    for n, path in sorted(shout_files.items()):
        b = next(b for b in sc["beats"] if b["n"] == n)
        k = next(k for k, w in enumerate(script) if w["beat"] == n and w["shout"])
        sw = script[k]
        if sw["heard"]:        # narrator also says JOHN!: put the shout right on that word
            start = sw["s"]
        else:                  # gap in the narration: start 0.12 s after the line's last spoken word
            start = script[k - 1]["e"] + 0.12
        length = len(read_mono(path)) / SR
        sw["s"], sw["e"] = round(start, 3), round(start + length, 3)
        shouts.append({"beat": n, "file": os.path.relpath(path, REEL), "start": round(start, 3), "length": round(length, 3),
                       "echo": bool(b.get("echo")), "over_narration": bool(sw["heard"])})
    narr_script = script

    keys = sc["keywords"]
    words = [{"text": w["text"], "s": w["s"], "e": w["e"], "beat": w["beat"], "key": is_key(w["text"], keys), "shout": w["shout"],
              "heard": w["heard"]}
             for w in script]
    # keep words strictly increasing (Whisper can overlap neighbours by a few ms)
    for k in range(1, len(words)):
        if words[k]["s"] < words[k - 1]["s"] + 0.04:
            words[k]["s"] = round(words[k - 1]["s"] + 0.04, 3)
        words[k]["e"] = max(words[k]["e"], words[k]["s"] + 0.05)
    beats = []
    for b in sc["beats"]:
        ws = [w for w in words if w["beat"] == b["n"]]
        beats.append({"n": b["n"], "start": ws[0]["s"], "end": ws[-1]["e"], "text": b["text"]})
    out = {"voice": os.path.relpath(os.path.abspath(args.voice), REEL), "duration": round(dur, 3), "words": words,
           "beats": beats, "shouts": shouts, "matched_words": matched, "script_words": len(narr_script),
           "heard": heard}
    os.makedirs(BUILD, exist_ok=True)
    with open(os.path.join(BUILD, "timing.json"), "w") as f:
        json.dump(out, f, indent=1)
    print(f"voice {dur:.2f}s  matched {matched}/{len(narr_script)} script words  shouts {len(shouts)}")
    for b in beats:
        print(f"  beat {b['n']:2d}  {b['start']:6.2f} - {b['end']:6.2f}")


if __name__ == "__main__":
    main()
