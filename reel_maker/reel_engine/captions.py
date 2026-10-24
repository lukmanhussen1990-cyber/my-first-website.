"""Karaoke captions in the reference style.

A chunk of 2-4 words fades in all dim grey, each word turns warm white the
moment it is spoken, and key words turn yellow while a hand-drawn yellow
underline draws on beneath them.
"""
from __future__ import annotations

import math

import numpy as np

from .align import norm
from .ink import Canvas, color, text_width, through

Y = 1344          # 70% of the frame height (reference)
SIZE = 86         # Kalam Bold; shrinks to fit MAX_W
MAX_W = 940
SPOKEN = "#f3ecdd"
UPCOMING = "#4b4b4a"
KEY = "yellow"
WEAK_END = {"a", "an", "the", "to", "and", "of", "your", "its", "my", "for", "is"}
GOOD_START = {"if", "for", "and", "but", "so", "when", "because", "with", "without", "on", "in", "at", "by", "of"}


def chunk_sentence(words, keywords, max_words):
    n = len(words)
    best = [0.0] + [math.inf] * n
    back = [0] * (n + 1)
    size_cost = {1: 2.0, 2: 0.3, 3: 0.0, 4: 0.1}
    for j in range(1, n + 1):
        for i in range(max(0, j - max_words), j):
            k = j - i
            c = best[i] + size_cost.get(k, 0.6 * k)
            last = words[j - 1]["text"]
            if j < n:
                nxt = norm(words[j]["text"])
                c += 0.0 if last[-1] in ",.?!;:" else (0.5 if nxt in GOOD_START else 1.0)
                c += 0.8 if norm(last) in WEAK_END else 0.0
            if any(w["text"][-1] in ",;:" for w in words[i:j - 1]):
                c += 0.6  # avoid chunks that run past a comma ("thirty, normal")
            if sum(norm(w["text"]) in keywords for w in words[i:j]) > 1:
                c += 5.0
            if c < best[j]:
                best[j], back[j] = c, i
    cuts, j = [], n
    while j > 0:
        cuts.append((back[j], j))
        j = back[j]
    return [words[a:b] for a, b in reversed(cuts)]


class Captions:
    def __init__(self, words, keywords, mode="keyword", max_words=4):
        self.mode = mode
        self.kw = {norm(k) for k in keywords}
        chunks = []
        by_sentence = {}
        for w in words:
            by_sentence.setdefault(w["sentence"], []).append(w)
        for s in sorted(by_sentence):
            chunks += chunk_sentence(by_sentence[s], self.kw, max_words)
        self.chunks = []
        for i, ch in enumerate(chunks):
            t0 = ch[0]["start"] - 0.10 if i > 0 or ch[0]["start"] > 0.6 else -1.0  # first chunk: on screen at frame 0
            t1 = chunks[i + 1][0]["start"] - 0.12 if i + 1 < len(chunks) else math.inf
            size = SIZE
            texts = [w["text"] for w in ch]
            space = text_width(" ", size)
            total = sum(text_width(s, size) for s in texts) + space * (len(texts) - 1)
            if total > MAX_W:
                size = SIZE * MAX_W / total
                space = text_width(" ", size)
                total = sum(text_width(s, size) for s in texts) + space * (len(texts) - 1)
            xs, x = [], 540 - total / 2
            for s in texts:
                wdt = text_width(s, size)
                xs.append((x, wdt))
                x += wdt + space
            self.chunks.append({"words": ch, "t0": t0, "t1": t1, "size": size, "xs": xs})

    def lines(self):
        return [" ".join(w["text"] for w in c["words"]) for c in self.chunks]

    def draw(self, cv: Canvas, t: float, finale=None):
        for c in self.chunks:
            if not (c["t0"] <= t <= c["t1"] + 0.1):
                continue
            a = min(1.0, (t - c["t0"]) / 0.10)
            if t > c["t1"]:
                a *= max(0.0, 1 - (t - c["t1"]) / 0.08)
            self._draw_chunk(cv, c, t, a, finale)

    def _word_state(self, c, i, t):
        w = c["words"][i]
        spoken = t >= w["start"] - 0.02
        k = min(1.0, max(0.0, (t - w["start"] + 0.02) / 0.07))
        if self.mode == "active":
            nxt = c["words"][i + 1]["start"] if i + 1 < len(c["words"]) else math.inf
            key = spoken and t < nxt - 0.02
            ul_t0 = w["start"]
        else:
            key = spoken and norm(w["text"]) in self.kw
            ul_t0 = w["start"]
        return spoken, k, key, ul_t0

    def _draw_chunk(self, cv, c, t, alpha, finale):
        size = c["size"]
        y = Y
        fin_k = 0.0
        if finale and t > finale["t"]:
            fin_k = min(1.0, (t - finale["t"]) / finale.get("fade", 0.5))
        for i, (w, (x, wdt)) in enumerate(zip(c["words"], c["xs"])):
            spoken, k, key, ul_t0 = self._word_state(c, i, t)
            keep = finale is not None and norm(w["text"]) == norm(finale.get("keep_word", ""))
            wa = alpha * ((1 - fin_k) if not keep else 1.0)
            if wa <= 0.003:
                continue
            base = np.array(color(UPCOMING))
            target = np.array(color(KEY if key else SPOKEN))
            col = tuple(base + (target - base) * (k if spoken else 0.0))
            if key and self.mode == "active" and not spoken:
                col = tuple(base)
            cv.text(w["text"], x, y, size, col, wa, anchor="l", jitter=False)
            if key or (keep and fin_k > 0):
                u = min(1.0, max(0.0, (t - ul_t0) / 0.28))
                ue = 1 - (1 - u) ** 3
                if ue > 0:
                    core = w["text"].rstrip(",.?!;:")
                    cw = text_width(core, size)
                    y0 = y + size * 0.44
                    cv.stroke(through((x - 2, y0), (x + cw / 2, y0 + 5), (x + cw + 4, y0 - 2), n=18),
                              ("ul", c["t0"], i), 5.2, KEY, alpha=wa, progress=ue, wobble=0.6, boil=0.5)
