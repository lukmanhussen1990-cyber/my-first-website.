# Force-align script.txt to the voiceover and write timeline/words.json.
# Uses PocketSphinx (bundled en-us model) because the narration text is known
# exactly; display words always come from the script, never from the recogniser.
import json, re, subprocess, sys, wave
from pocketsphinx import Decoder

HERE = __file__.rsplit("/", 1)[0] or "."
SPOKEN = {"ﷺ": "peace be upon him"}
EXTRA_DICT = {
    "allah": "AA L AH",
    "travelling": "T R AE V AH L IH NG",
}


def parse_script(path):
    lines = [l.rstrip("\n") for l in open(path, encoding="utf-8") if l.strip() and not l.startswith("#")]
    tokens = []
    for li, line in enumerate(lines):
        for gi, group in enumerate(line.split("|")):
            hl = False
            for raw in group.split():
                opens, closes = "{" in raw, "}" in raw
                if opens:
                    hl = True
                text = raw.replace("{", "").replace("}", "")
                tokens.append({"text": text, "hl": hl, "line": li + 1, "group": gi})
                if closes:
                    hl = False
    return tokens


def spoken_words(text):
    if text in SPOKEN:
        return SPOKEN[text].split()
    w = re.sub(r"[^a-z']", "", text.lower().replace("’", "'"))
    return [w] if w else []


def main():
    wav = sys.argv[1]
    tokens = parse_script(f"{HERE}/script.txt")
    words, owner = [], []
    for i, t in enumerate(tokens):
        for w in spoken_words(t["text"]):
            words.append(w)
            owner.append(i)

    d = Decoder(samprate=16000, bestpath=False)
    for w, pron in EXTRA_DICT.items():
        if d.lookup_word(w) is None:
            d.add_word(w, pron, False)
    missing = [w for w in set(words) if d.lookup_word(w) is None]
    if missing:
        sys.exit(f"missing pronunciations: {missing}")

    wf = wave.open(wav)
    data = wf.readframes(wf.getnframes())
    d.set_align_text(" ".join(words))
    d.start_utt()
    d.process_raw(data, full_utt=True)
    d.end_utt()
    segs = [s for s in d.seg() if s.word not in ("<s>", "</s>", "<sil>", "[NOISE]")]
    segs = [s for s in segs if not s.word.startswith("(")]
    if len(segs) != len(words):
        sys.exit(f"alignment returned {len(segs)} words, expected {len(words)}")

    for t in tokens:
        t["s"], t["e"] = None, None
    for s, i in zip(segs, owner):
        t = tokens[i]
        st, en = s.start_frame / 100.0, (s.end_frame + 1) / 100.0
        t["s"] = st if t["s"] is None else min(t["s"], st)
        t["e"] = en if t["e"] is None else max(t["e"], en)
    for t in tokens:
        t["s"], t["e"] = round(t["s"], 2), round(t["e"], 2)

    json.dump(tokens, open(f"{HERE}/timeline/words.json", "w"), ensure_ascii=False, indent=0)
    with open(f"{HERE}/timeline/words.js", "w", encoding="utf-8") as f:
        f.write("window.WORDS = " + json.dumps(tokens, ensure_ascii=False) + ";\n")
    for t in tokens:
        print(f'{t["line"]:>2} {t["group"]:>2} {t["s"]:7.2f} {t["e"]:7.2f} {"*" if t["hl"] else " "} {t["text"]}')


if __name__ == "__main__":
    main()
