"""Check every scripture quote in an episode, word for word, against the KJV verse text.

Quotes = text inside "double quotes" in script.json beats, plus every card quote in the episode's
cues.js. Each quote (with "…" marking left-out words) must appear in its verse, in order.

  python3 tools/check_kjv.py episodes/the-mountain
"""
import json
import re
import sys
from pathlib import Path

# Full KJV text of every verse this series has quoted so far. Add verses here for new episodes.
KJV = {
    "GENESIS 22:2": "And he said, Take now thy son, thine only son Isaac, whom thou lovest, and get thee into the land of Moriah; and offer him there for a burnt offering upon one of the mountains which I will tell thee of.",
    "GENESIS 22:4": "Then on the third day Abraham lifted up his eyes, and saw the place afar off.",
    "GENESIS 22:5": "And Abraham said unto his young men, Abide ye here with the ass; and I and the lad will go yonder and worship, and come again to you.",
    "GENESIS 22:6": "And Abraham took the wood of the burnt offering, and laid it upon Isaac his son; and he took the fire in his hand, and a knife; and they went both of them together.",
    "GENESIS 22:7": "And Isaac spake unto Abraham his father, and said, My father: and he said, Here am I, my son. And he said, Behold the fire and the wood: but where is the lamb for a burnt offering?",
    "GENESIS 22:8": "And Abraham said, My son, God will provide himself a lamb for a burnt offering: so they went both of them together.",
    "GENESIS 22:12": "And he said, Lay not thine hand upon the lad, neither do thou any thing unto him: for now I know that thou fearest God, seeing thou hast not withheld thy son, thine only son from me.",
    "GENESIS 22:13": "And Abraham lifted up his eyes, and looked, and behold behind him a ram caught in a thicket by his horns: and Abraham went and took the ram, and offered him up for a burnt offering in the stead of his son.",
    "GENESIS 22:14": "And Abraham called the name of that place Jehovahjireh: as it is said to this day, In the mount of the LORD it shall be seen.",
    "HEBREWS 11:19": "Accounting that God was able to raise him up, even from the dead; from whence also he received him in a figure.",
    "JOHN 19:17": "And he bearing his cross went forth into a place called the place of a skull, which is called in the Hebrew Golgotha:",
    "ROMANS 8:32": "He that spared not his own Son, but delivered him up for us all, how shall he not with him also freely give us all things?",
    "JOHN 1:29": "The next day John seeth Jesus coming unto him, and saith, Behold the Lamb of God, which taketh away the sin of the world.",
}


def words(s):
    return re.sub(r"[^a-z' ]+", " ", s.lower().replace("…", " ").replace("*", "")).split()


def in_verse(quote, verse):
    """Every '…'-separated fragment must appear in the verse, in order, word for word."""
    vw = words(verse)
    pos = 0
    for frag in [f for f in re.split(r"…|\.\.\.", quote) if words(f)]:
        fw = words(frag)
        found = -1
        for i in range(pos, len(vw) - len(fw) + 1):
            if vw[i:i + len(fw)] == fw:
                found = i
                break
        if found < 0:
            return False
        pos = found + len(fw)
    return True


def main(ep_dir):
    ep = Path(ep_dir)
    script = json.loads((ep / "script.json").read_text())
    checks = []
    for b in script["beats"]:
        for q in re.findall(r'"([^"]+)"', b["text"]):
            checks.append((f"narration {b['id']}", q, b.get("card", {}) and b["card"] and b["card"]["ref"]))
        if b.get("card"):
            checks.append((f"card {b['id']}", b["card"]["quote"], b["card"]["ref"]))
    cues = (Path(__file__).resolve().parent.parent / "src/episodes" / ep.name / "cues.js").read_text()
    for quote, ref in re.findall(r'quote: "([^"]+)", ref: "([^"]+)"', cues):
        checks.append(("cues.js card", quote, ref))
    ok = True
    for where, quote, ref in checks:
        refs = [ref.split(" · ")[0]] if ref else list(KJV)
        hit = [r for r in refs if r in KJV and in_verse(quote, KJV[r])]
        if not hit and ref:  # narration quote without a card: search every verse
            hit = [r for r in KJV if in_verse(quote, KJV[r])]
        status = "OK " if hit else "BAD"
        ok &= bool(hit)
        print(f"{status} {where:16s} {(hit[0] if hit else ref or '?'):14s} {quote}")
    print("ALL QUOTES MATCH THE KJV" if ok else "SOME QUOTES DO NOT MATCH")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "episodes/the-mountain"))
