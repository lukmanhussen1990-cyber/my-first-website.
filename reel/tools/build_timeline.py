"""Build assets/timeline.json: part start times + caption words (script spelling, whisper timing).
Usage: python build_timeline.py <voice_dir> <out.json>"""
import sys, json, re, difflib

SCRIPT = {
    1: "Adult cats almost never meow at each other. That sound? It's only for you.",
    2: "It starts with kittens. They meow to call mom: I'm cold, I'm hungry, come here!",
    3: "As they grow up, they mostly stop meowing at other cats. They use body language instead.",
    4: "A flick of the tail. A sniff. A long stare. And if that fails… a hiss.",
    5: "So why keep meowing at us? Scientists think it's simple: we answer. Meow… food.",
    6: "That's probably why feral cats, with no humans around, meow way less than pet cats.",
    7: "And every cat seems to build its own meows, just for its own human.",
    8: "A long, loud one at the food bowl… a short, sweet one at the door. And you understand both.",
    9: "In a small 2015 study, owners did best with their own cat's meows. A stranger's cat? Just guessing.",
    10: "So when your cat meows at you, it's not just noise. It's a language made just for you.",
}
LEAD_IN = 0.15
GAP_BEFORE = {2: 0.4, 3: 0.3, 6: 0.4, 7: 0.35, 10: 0.3}  # extra air before mood changes
DEFAULT_GAP = 0.25
TAIL = 1.7
EQUIV = {"weigh": "way", "2015": "2015", "twenty": "2015", "fifteen": "2015"}


def norm(w):
    w = re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))
    return EQUIV.get(w, w)


def align(script_words, asr):
    """Map each script word to (start, end) using the ASR word timings."""
    a = [norm(w) for w in script_words]
    b = [norm(w["w"]) for w in asr]
    times = [None] * len(a)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (i2 - i1) == (j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = (asr[j1 + k]["s"], asr[j1 + k]["e"])
        elif j2 > j1 and i2 > i1:  # spread the ASR span evenly over the script words
            s, e = asr[j1]["s"], asr[j2 - 1]["e"]
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    # fill any gaps (script words with no ASR match) by interpolation
    for i, t in enumerate(times):
        if t is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev + 0.3)
            times[i] = (prev, max(prev + 0.05, nxt))
    return times


def main():
    vdir, out_path = sys.argv[1], sys.argv[2]
    asr = json.load(open(f"{vdir}/words.json"))
    t = LEAD_IN
    parts = []
    for pid in sorted(SCRIPT):
        if pid > 1:
            t += GAP_BEFORE.get(pid, DEFAULT_GAP)
        info = asr[str(pid)]
        words = SCRIPT[pid].split()
        times = align(words, info["words"])
        parts.append({
            "id": pid, "file": info["file"], "start": round(t, 3), "dur": info["dur"], "text": SCRIPT[pid],
            "words": [{"w": w, "s": round(t + s, 3), "e": round(t + e, 3)} for w, (s, e) in zip(words, times)],
        })
        t += info["dur"]
    total = round(t + TAIL, 3)
    json.dump({"fps": 30, "total": total, "parts": parts}, open(out_path, "w"), indent=1)
    print(f"total {total:.2f}s, {len(parts)} parts")
    for p in parts:
        print(p["id"], p["start"], " ".join(f"{w['w']}@{w['s']:.2f}" for w in p["words"][:6]), "...")


if __name__ == "__main__":
    main()
