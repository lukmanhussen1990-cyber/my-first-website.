#!/usr/bin/env python3
"""Q.03 SON OF THE FATHER — Step 2: voice + timeline.json

edge-tts en-US-AndrewMultilingualNeural (rate -5%, pitch -3 Hz: the same voice as Q.01 and Q.02), one clip per
sentence (WordBoundary timings), joined with our own pauses: 0.3 s between sentences, `extra_hold` (0.8 s of near
silence after the crowd shouts "Barabbas"), per-beat `gaps` between clips (0.5 s between "Bar means son" and "Abba
means father") and `pause_before` (0.7 s before "And here's the truth").

If voice/input/P01.mp3 ... P18.mp3 exist (the user's own recording, one file per beat, see VOICEOVER_SCRIPT.md) they
are used instead of TTS: each part is trimmed at its speech onset/offset (energy), its word timings come from
faster-whisper word timestamps aligned to the script words, and the same pauses are put between the parts.

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
END_CARD = 3.1   # seconds after the last word: CTA tail + end card + loop back to the Jesus hero shot

S = json.load(open(os.path.join(ROOT, "script.json")))
P = S["pauses"]


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


NUMWORD = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven"}


def same(display, spoken):
    d, s = norm(display), norm(spoken)
    if d.isdigit() and norm(say_number(int(d)).replace(" ", "")) == s.replace(" ", ""): return True
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
        if blocks and len(p.replace("*", "")) < 14 and not p.startswith('"') and len(blocks[-1].replace("*", "")) < 40:
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
# Clips listed in script.json "plain_take_clips" use the plain take (no word-boundary request: the service then
# speaks some weak words more clearly, e.g. "the just for the unjust") and get their word timings from
# faster-whisper word timestamps aligned to the script words instead.
PLAIN = set(S.get("plain_take_clips", []))
_WHISPER = None


def whisper_words(path, text):
    global _WHISPER
    import difflib
    from faster_whisper import WhisperModel
    if _WHISPER is None:
        _WHISPER = WhisperModel("small.en", device="cpu", compute_type="int8")
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = _WHISPER.transcribe(np.frombuffer(pcm, dtype=np.float32), beam_size=5, temperature=0, word_timestamps=True)
    heard = [(norm(w.word), w.start, w.end) for sg in segs for w in sg.words if norm(w.word)]
    want = [w for w in text.split() if norm(w)]
    sm = difflib.SequenceMatcher(a=[norm(w) for w in want], b=[h[0] for h in heard], autojunk=False)
    pair = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size): pair[blk.a + k] = blk.b + k
    out = [None] * len(want)
    for i in range(len(want)):
        if i in pair: out[i] = [heard[pair[i]][1], heard[pair[i]][2]]
    # words Whisper heard differently ("that" for "the"): share the gap between their matched neighbours
    i = 0
    while i < len(want):
        if out[i] is None:
            j = i
            while j < len(want) and out[j] is None: j += 1
            t0 = out[i - 1][1] if i > 0 else (heard[0][1] if heard else 0.05)
            t1 = out[j][0] if j < len(want) else (heard[-1][2] if heard else t0 + 0.3 * (j - i))
            n = j - i
            for k in range(n): out[i + k] = [t0 + (t1 - t0) * k / n, t0 + (t1 - t0) * (k + 1) / n]
            i = j
        else:
            i += 1
    return [dict(w=re.sub(r"^[^A-Za-z0-9']+|[^A-Za-z0-9']+$", "", w), start=round(a, 3), end=round(b, 3)) for w, (a, b) in zip(want, out)]


async def synth(text, path, voice, plain=False):
    import edge_tts
    import edge_tts.communicate as ec
    ca = "/root/.ccr/ca-bundle.crt"
    if os.path.exists(ca):
        ec._SSL_CTX = ssl.create_default_context(cafile=ca)
    kw = {} if plain else dict(boundary="WordBoundary")
    c = edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH, proxy=os.environ.get("HTTPS_PROXY"), **kw)
    words = []
    with open(path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append(dict(w=ch["text"], start=ch["offset"] / 1e7, end=(ch["offset"] + ch["duration"]) / 1e7))
    if plain:
        return whisper_words(path, text)
    return split_merged(words)


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def say_number(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + say_number(n % 100))
    return say_number(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + say_number(n % 1000))
def syllables(word):
    w = re.sub(r"[^a-z0-9]", "", word.lower())
    if w.isdigit(): return sum(syllables(x) for x in say_number(int(w)).split())
    groups = re.findall(r"[aeiouy]+", w)
    n = len(groups) - (1 if w.endswith("e") and len(groups) > 1 else 0)
    return max(1, n)


def split_merged(words):
    """edge-tts sometimes reports a quantity as one boundary ("969 years"): split it, sharing the time by syllables."""
    out = []
    for w in words:
        parts = w["w"].split()
        if len(parts) == 1: out.append(w); continue
        syl = [syllables(x) for x in parts]; tot = sum(syl); t = w["start"]; d = w["end"] - w["start"]
        for x, k in zip(parts, syl):
            out.append(dict(w=x, start=t, end=t + d * k / tot)); t += d * k / tot
    return out


def decode(path):
    wav = path.rsplit(".", 1)[0] + ".wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_f32le", wav], check=True)
    a, _ = sf.read(wav, dtype="float32")
    return a


def clip_audio(text, key):
    os.makedirs(CLIPS, exist_ok=True)
    mp3 = os.path.join(CLIPS, key + ".mp3")
    meta = mp3 + ".json"
    plain = key in PLAIN
    want = dict(text=text, voice=VOICE, rate=RATE, pitch=PITCH, **({"plain": True} if plain else {}))
    if os.path.exists(meta) and os.path.exists(mp3) and json.load(open(meta)).get("key") == want:
        return decode(mp3), split_merged(json.load(open(meta))["words"])
    expected = len([w for w in text.split() if norm(w)])
    for attempt in range(7):
        voice = VOICE if attempt < 5 else BACKUP
        try:
            words = asyncio.run(synth(text, mp3, voice, plain))
            a = decode(mp3)
            if len(words) < expected or len(a) / SR < words[-1]["end"] + 0.04:
                raise RuntimeError(f"truncated ({len(words)}/{expected} words, {len(a) / SR:.2f}s)")
            json.dump(dict(key=want, words=words, voice=voice), open(meta, "w"))
            return a, words
        except Exception as ex:
            print(f"  retry {key}: {ex.__class__.__name__} {ex}")
            time.sleep(2 * 2 ** min(attempt, 4))
    sys.exit(f"TTS failed for {key}: no working voice — stopping as requested (no robotic fallback).")


# ---------------------------------------------------------------- the user's own recording (one file per beat)
USER_DIR = os.path.join(HERE, "input")
def user_part(bi):
    f = os.path.join(USER_DIR, f"P{bi + 1:02d}.mp3")
    return f if os.path.exists(f) else None
USER = all(user_part(i) for i in range(len(S["beats"])))
# where a part gets a minimum pause between two of its words (word index -> seconds), e.g. the breath before "Abba"
USER_GAPS = {"B09": {3: 0.3, 8: 0.45}}


def user_clip(bi, text):
    os.makedirs(CLIPS, exist_ok=True)
    src = user_part(bi)
    a = decode_to(src, os.path.join(CLIPS, f"user_P{bi + 1:02d}.wav"))
    meta = os.path.join(CLIPS, f"user_P{bi + 1:02d}.json")
    st = os.stat(src)
    want = dict(src=os.path.basename(src), size=st.st_size, text=text)
    if os.path.exists(meta) and json.load(open(meta)).get("key") == want:
        words = json.load(open(meta))["words"]
    else:
        words = whisper_words(src, text)
        json.dump(dict(key=want, words=words), open(meta, "w"))
    return a, words


def decode_to(path, wav):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_f32le", wav], check=True)
    a, _ = sf.read(wav, dtype="float32")
    return a


def trim_user(a):
    """speech onset / offset by energy (10 ms windows): -42 dBFS in, -45 dBFS out; keep a short pre-roll and tail"""
    win = int(0.01 * SR); n = len(a) // win
    db = np.array([20 * np.log10(np.sqrt(np.mean(a[k * win:(k + 1) * win] ** 2)) + 1e-9) for k in range(n)])
    on = int(np.argmax(db > -42)); off = n - 1 - int(np.argmax(db[::-1] > -45))
    return max(0, (on - 3) * win), min(len(a), (off + 9) * win)


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
        clips = [b["text"].replace("*", "")] if USER else [c.strip() for c in b["tts"].split("|")]
        b_start = t
        b_words = []
        for ci, ctext in enumerate(clips):
            if USER:
                a, words = user_clip(S["beats"].index(b), ctext)
                s, e = trim_user(a)
                gaps = dict(USER_GAPS.get(b["id"], {}))
            else:
                a, words = clip_audio(ctext, f"{b['id']}_{ci}")
                s, e = trim(a, words)
                gaps = {int(k): v for k, v in (b.get("inner_gaps") or {}).items()}
            sid = f"{b['id']}.{ci + 1}"
            # cut the clip at word boundaries and stretch the pauses there to the wanted length
            cuts = [s]
            for i in sorted(gaps):
                cuts.append(int(((words[i]["end"] + words[i + 1]["start"]) / 2) * SR))
            cuts.append(e)
            shift, wi = 0.0, 0
            for k in range(len(cuts) - 1):
                seg = a[cuts[k]:cuts[k + 1]]
                off = t - cuts[k] / SR
                while wi < len(words) and words[wi]["start"] * SR < cuts[k + 1] - 1:
                    w = words[wi]; b_words.append(dict(spoken=w["w"], start=round(w["start"] + off, 3), end=round(w["end"] + off, 3), sentence=sid)); wi += 1
                pieces.append(seg); t += len(seg) / SR
                if k < len(cuts) - 2:
                    i = sorted(gaps)[k]; natural = words[i + 1]["start"] - words[i]["end"]
                    add = max(0.0, gaps[i] - natural)
                    pieces.append(np.zeros(int(add * SR), np.float32)); t += add
            if ci < len(clips) - 1:
                g = b["gaps"][ci] if b.get("gaps") else P["between_sentences"]
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
        if b.get("numbers_as_words") and len(disp) != len(b_words):
            # digits on screen, number words in the voice: one display token <- all words of that number
            grouped, j = [], 0
            for d in disp:
                tok = re.sub(r"[^0-9]", "", d["display"])
                n = len(say_number(int(tok)).split()) if tok.isdigit() else 1
                ws = b_words[j:j + n]; j += n
                grouped.append(dict(spoken=" ".join(w["spoken"] for w in ws), start=ws[0]["start"], end=ws[-1]["end"], sentence=ws[0]["sentence"]))
            if j != len(b_words):
                sys.exit(f"{b['id']}: number grouping used {j} of {len(b_words)} spoken words")
            b_words = grouped
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
    print("voice: the user's own recording (voice/input/P01-P18)" if USER else f"voice: edge-tts {VOICE}")
    voice, beats, words, t_end = build()
    voice = polish(voice)
    last_word = words[-1]["end"]
    total = round(last_word + END_CARD, 3)
    voice = np.pad(voice, (0, max(0, int(total * SR) - len(voice))))[: int(total * SR)]
    sf.write(os.path.join(HERE, "voice.wav"), voice, SR, subtype="PCM_24")
    tl = dict(episode=S["episode"], title=S["title"], fps=30, voice="user recording P01-P18" if USER else VOICE, rate=None if USER else RATE, pitch=None if USER else PITCH,
              voice_end=round(last_word, 3), duration=total, frames=int(np.ceil(total * 30)),
              scenes=scene_windows(beats, last_word), beats=beats, words=words)
    json.dump(tl, open(os.path.join(ROOT, "timeline.json"), "w"), indent=1)
    n = len(words)
    print(f"voice {last_word:.2f}s + end card -> {total:.2f}s ({tl['frames']} frames); {n} words, {n / last_word:.2f} words/s")


if __name__ == "__main__":
    main()
