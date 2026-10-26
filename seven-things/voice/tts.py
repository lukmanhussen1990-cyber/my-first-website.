#!/usr/bin/env python3
"""Q.01 SEVEN THINGS — Step 2: voice + timeline.json

edge-tts en-US-AndrewMultilingualNeural (rate -5%), one clip per sentence (WordBoundary timings),
joined with the pauses from script.json: 0.3 s between sentences, 0.25 s after each "Number X:",
1.0 s before "He that soweth discord", 0.7 s before the good news.

If input/voice.mp3 exists (your own recording of the same script) it is used instead and the word
timings come from faster-whisper word timestamps.

Writes: voice/voice.wav (48 kHz mono, polished) and timeline.json (every word with start/end,
keyword flag, sentence id, beat id, scene id + caption blocks + scene windows).
"""
import asyncio, json, os, re, ssl, subprocess, sys, time
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CLIPS = os.path.join(HERE, "clips")
SR = 48000
VOICE = os.environ.get("VOICE", "en-US-AndrewMultilingualNeural")
BACKUP = "en-US-ChristopherNeural"
RATE = os.environ.get("RATE", "-5%")
PITCH = os.environ.get("PITCH", "-3Hz")
LEAD_IN = 0.08
END_CARD = 3.6   # seconds after the last word: CTA tail + end card + loop back into the falling 7

S = json.load(open(os.path.join(ROOT, "script.json")))
P = S["pauses"]


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


NUMWORD = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven"}


def same(display, spoken):
    d, s = norm(display), norm(spoken)
    if d in NUMWORD:
        d = NUMWORD[d]
    return d == s or (len(d) > 3 and s.startswith(d[:4]))


# ---------------------------------------------------------------- caption blocks
def caption_blocks(beat):
    """Split the display text into caption blocks (one sentence each, max ~3 lines)."""
    text = beat["text"]
    if not text:
        return []
    parts, last = [], 0
    for m in re.finditer(r'[.?!:…]["”]?(\s+)(?=["“A-Z])', text):
        parts.append(text[last:m.start(1)])
        last = m.end(1)
    parts.append(text[last:])
    blocks = []
    for p in parts:
        if blocks and re.fullmatch(r"Number \d:", blocks[-1].strip()):
            blocks[-1] = blocks[-1] + " " + p      # keep "Number X:" with its quote
        elif blocks and len(p.replace("*", "")) < 14 and not p.startswith('"') and len(blocks[-1].replace("*", "")) < 40:
            blocks[-1] = blocks[-1] + " " + p      # tiny fragments ride with the previous sentence
        else:
            blocks.append(p)
    out = []
    for b in blocks:                               # long quotes: split at the comma nearest the middle
        plain = b.replace("*", "")
        if len(plain) > 92:
            commas = [m.start() for m in re.finditer(r", ", b)]
            mid = len(b) / 2
            c = min(commas, key=lambda i: abs(i - mid))
            out += [b[:c + 1], b[c + 2:]]
        else:
            out.append(b)
    return out


# ---------------------------------------------------------------- TTS
async def synth(text, path, voice):
    import edge_tts
    import edge_tts.communicate as ec
    ca = "/root/.ccr/ca-bundle.crt"
    if os.path.exists(ca):
        ec._SSL_CTX = ssl.create_default_context(cafile=ca)
    c = edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH, boundary="WordBoundary", proxy=os.environ.get("HTTPS_PROXY"))
    words = []
    with open(path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append(dict(w=ch["text"], start=ch["offset"] / 1e7, end=(ch["offset"] + ch["duration"]) / 1e7))
    return words


def decode(path):
    wav = path.rsplit(".", 1)[0] + ".wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_f32le", wav], check=True)
    a, _ = sf.read(wav, dtype="float32")
    return a


def clip_audio(text, key):
    os.makedirs(CLIPS, exist_ok=True)
    mp3 = os.path.join(CLIPS, key + ".mp3")
    meta = mp3 + ".json"
    want = dict(text=text, voice=VOICE, rate=RATE, pitch=PITCH)
    if os.path.exists(meta) and os.path.exists(mp3) and json.load(open(meta)).get("key") == want:
        return decode(mp3), json.load(open(meta))["words"]
    expected = len([w for w in text.split() if norm(w)])
    for attempt in range(7):
        voice = VOICE if attempt < 5 else BACKUP
        try:
            words = asyncio.run(synth(text, mp3, voice))
            a = decode(mp3)
            if len(words) < expected or len(a) / SR < words[-1]["end"] + 0.04:
                raise RuntimeError(f"truncated ({len(words)}/{expected} words, {len(a) / SR:.2f}s)")
            json.dump(dict(key=want, words=words, voice=voice), open(meta, "w"))
            return a, words
        except Exception as ex:
            print(f"  retry {key}: {ex.__class__.__name__} {ex}")
            time.sleep(2 * 2 ** min(attempt, 4))
    sys.exit(f"TTS failed for {key}: no working voice — stopping as requested (no robotic fallback).")


def trim(a, words):
    s = max(0, int((words[0]["start"] - 0.04) * SR))
    e = int((words[-1]["end"] + 0.08) * SR)
    win, thr = int(0.01 * SR), 10 ** (-48 / 20)
    lim = int((words[-1]["end"] + 0.4) * SR)
    while e + win < len(a) and e < lim and np.sqrt(np.mean(a[e:e + win] ** 2)) >= thr:
        e += win
    return s, min(e, len(a))


def polish(x):
    tmp_in, tmp_out = os.path.join(CLIPS, "_in.wav"), os.path.join(CLIPS, "_out.wav")
    sf.write(tmp_in, x, SR, subtype="FLOAT")
    chain = ",".join([
        "highpass=f=70", "equalizer=f=150:t=q:w=1.0:g=2.0", "equalizer=f=3000:t=q:w=1.2:g=1.2",
        "equalizer=f=7000:t=q:w=2.0:g=-2.5", "acompressor=threshold=-20dB:ratio=2.4:attack=8:release=140:makeup=2",
        "aecho=0.85:0.9:26|44:0.09|0.05", "alimiter=limit=0.89",
    ])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp_in, "-af", chain, "-c:a", "pcm_f32le", tmp_out], check=True)
    y, _ = sf.read(tmp_out, dtype="float32")
    return y


# ---------------------------------------------------------------- build
def build():
    pieces = [np.zeros(int(LEAD_IN * SR), np.float32)]
    t = LEAD_IN
    beats_out, words_out = [], []
    beats = [b for b in S["beats"] if b["tts"]]
    for bi, b in enumerate(beats):
        pb = b.get("pause_before", 0.0)
        if bi > 0:
            prev_gap = P["between_sentences"]
            gap = max(prev_gap, pb)
            pieces.append(np.zeros(int(gap * SR), np.float32)); t += gap
        clips = [c.strip() for c in b["tts"].split("|")]
        b_start = t
        b_words = []
        for ci, ctext in enumerate(clips):
            a, words = clip_audio(ctext, f"{b['id']}_{ci}")
            s, e = trim(a, words)
            off = t - s / SR
            sid = f"{b['id']}.{ci + 1}"
            for w in words:
                b_words.append(dict(spoken=w["w"], start=round(w["start"] + off, 3), end=round(w["end"] + off, 3), sentence=sid))
            pieces.append(a[s:e]); t += (e - s) / SR
            if ci < len(clips) - 1:
                g = P["after_number_x"] if re.fullmatch(r"Number \w+:", ctext) else P["between_sentences"]
                pieces.append(np.zeros(int(g * SR), np.float32)); t += g
        b_end = t
        hold = b.get("extra_hold", 0.0)
        if hold:
            pieces.append(np.zeros(int(hold * SR), np.float32)); t += hold
        # map display tokens -> spoken words (1:1 in order, tolerant of digits / punctuation)
        blocks = caption_blocks(b)
        disp = []
        for k, blk in enumerate(blocks):
            for tok in blk.split():
                disp.append(dict(display=tok.replace("*", ""), kw="*" in tok, block=k))
        if len(disp) != len(b_words):
            sys.exit(f"{b['id']}: {len(disp)} display tokens vs {len(b_words)} spoken words")
        for d, w in zip(disp, b_words):
            if not same(d["display"], w["spoken"]):
                print(f"  note {b['id']}: display '{d['display']}' ~ spoken '{w['spoken']}'")
            words_out.append(dict(w=d["display"], spoken=w["spoken"], start=w["start"], end=w["end"], kw=d["kw"],
                                  sentence=w["sentence"], beat=b["id"], scene=b["scene"], block=f"{b['id']}#{d['block']}"))
        beats_out.append(dict(id=b["id"], scene=b["scene"], start=round(b_start, 3), end=round(b_end, 3), hold_end=round(t, 3),
                              blocks=[x.replace("*", "") for x in blocks], card=b.get("card"), mood=b["mood"]))
        print(f"{b['id']} {b_start:6.2f}-{b_end:6.2f}  {b['tts']}")
    voice = np.concatenate(pieces)
    return voice, beats_out, words_out, t


def scene_windows(beats, voice_end):
    scenes = {}
    for b in beats:
        s = scenes.setdefault(b["scene"], dict(start=b["start"], end=b["hold_end"]))
        s["end"] = max(s["end"], b["hold_end"])
    scenes["S16"] = dict(start=round(voice_end + 0.35, 3), end=round(voice_end + END_CARD, 3))
    return scenes


def main():
    user = os.path.join(ROOT, "input", "voice.mp3")
    if os.path.exists(user):
        sys.exit("input/voice.mp3 found: run voice/align_user.py (faster-whisper word timestamps) instead.")
    voice, beats, words, t_end = build()
    voice = polish(voice)
    last_word = words[-1]["end"]
    total = round(last_word + END_CARD, 3)
    voice = np.pad(voice, (0, max(0, int(total * SR) - len(voice))))[: int(total * SR)]
    sf.write(os.path.join(HERE, "voice.wav"), voice, SR, subtype="PCM_24")
    tl = dict(episode=S["episode"], title=S["title"], fps=30, voice=VOICE, rate=RATE, pitch=PITCH,
              voice_end=round(last_word, 3), duration=total, frames=int(np.ceil(total * 30)),
              scenes=scene_windows(beats, last_word), beats=beats, words=words)
    json.dump(tl, open(os.path.join(ROOT, "timeline.json"), "w"), indent=1)
    n = len(words)
    print(f"voice {last_word:.2f}s + end card -> {total:.2f}s ({tl['frames']} frames); {n} words, {n / last_word:.2f} words/s")


if __name__ == "__main__":
    main()
