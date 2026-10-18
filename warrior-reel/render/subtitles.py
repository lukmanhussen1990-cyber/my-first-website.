#!/usr/bin/env python3
"""Word-synchronised subtitles, title card and end card for "The Warrior Who Couldn't Forgive".

Reads timeline/timeline.json (+ the dialogue takes in audio/dialogue/ for onset refinement) and writes
  out/subs/film.ass   ASS script (PlayRes 1080x1920) burned in at the final encode by ffmpeg/libass:
                        ffmpeg -i film.mp4 -vf "ass=out/subs/film.ass:fontsdir=assets/fonts" ...
  out/subs/film.srt   plain dialogue captions ("SPEAKER: text", <= 2 x 42 chars) for caption uploads

Usage (from the project root):
  python3 render/subtitles.py                      # regenerate film.ass + film.srt
  python3 render/subtitles.py --stills qa          # + QA stills (flat bg) at default timestamps -> out/subs/test/
  python3 render/subtitles.py --stills 7.3,12@frame.png --bg 0x88aa66   # T or T@background (png or hex colour)
  python3 render/subtitles.py --no-refine          # reveal words exactly at cue.words[].s (no audio refinement)

Sizes: every size in this file is a *pixel em* (CSS-like font-size). libass scales a face so that
winAscent+winDescent == Fontsize, so the ASS \fs written is em * (winAsc+winDesc)/unitsPerEm
(Pixelify Sans: x1.211 -> 64 px em = \fs77.5; Silkscreen: x1.25 -> 40 px em = \fs50).

Layout: the speaker label (Silkscreen) sits at a fixed baseline; dialogue lines (Pixelify Sans Bold) follow
below it at a fixed pitch, each line its own \an8 event so spacing is exact. Line breaks are balanced on
measured widths (<= 800 px so text stays in x 140..940, clear of the IG right rail; ~24 chars; max 3 lines;
no orphans; breaks preferred after punctuation). A cue is split into two "pages" only when it cannot fit
3 lines, or when a sentence break followed by a pause would otherwise fall mid-line.

Word reveal: each page is laid out once from the full text and every word carries its own override block
  {\\1a&HFF&\\3a&HFF&\\t(t0,t0+70,\\1a&H00&\\3a&H00&)}word     (and the same on \\4a in the shadow layer)
so unrevealed words are fully transparent but keep their place (stable layout), and each fades in over
70 ms when spoken. Spoken onsets are cue.words[].s; when the take is silent at words[].s (whisper glues a
pause onto the following word, e.g. L05 "I've" +0.75 s) the reveal is moved to the acoustic onset - 40 ms.
Text is the cue's display text (cue.text), aligned to cue.words token by token (difflib fallback).

Layers: 0 glow, 1 soft blurred drop shadows (fill/border transparent, shadow only), 2 crisp text with a
dark warm-brown outline. The title's stepped gradient fill uses horizontal \\clip strips on layer 2.

Fonts: assets/fonts/PixelifySans-Bold.ttf actually contains the *Regular* face (weight 400) and
PixelifySans-Regular.ttf the *Bold* face (weight 700) -- the file names are swapped upstream. libass picks
faces by family + weight, so style "Pixelify Sans" + Bold gets the real bold face (log:
"fontselect: (Pixelify Sans, 700, 0) -> PixelifySans-Bold"); this script measures with the same face.
"""
import argparse
import difflib
import json
import os
import re
import signal
import struct
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(ROOT, 'assets', 'fonts')

# ------------------------------------------------------------------------------------------------
# Design constants (pixel coordinates in the 1080x1920 frame)
# ------------------------------------------------------------------------------------------------
W, H = 1080, 1920
CX = 540

C_WHITE = '#FFFFFF'
C_OUTLINE = '#1C0F07'        # dark warm brown, almost black
C_SHADOW = '#0B0502'
C_JESUS = '#FFD37A'          # warm gold
C_KNIGHT = '#A9C8E8'         # steel blue
C_REF = '#F2A541'            # orange
C_GOLD = '#FFD46E'           # tagline gold
LABEL_COLOURS = {'JESUS': C_JESUS, 'KNIGHT': C_KNIGHT}

DLG = dict(family='Pixelify Sans', bold=True, em=64, bord=6, spacing=1,
           max_w=800, max_chars=24, hard_chars=26, max_lines=3,   # 800 px: x 140..940 (IG right rail)
           pitch=84,                      # baseline-to-baseline
           shadow=dict(bord=11, blur=9, dy=5, alpha=0x48))
LABEL = dict(family='Silkscreen', bold=False, em=40, bord=4, spacing=8,      # em multiple of 8 = crisp
             shadow=dict(bord=8, blur=7, dy=4, alpha=0x50))
LABEL_BASELINE = 1130                     # label baseline (fixed, so the label never jumps)
LABEL_GAP = 24                            # label baseline -> first dialogue cap top

TITLE_L1 = dict(family='Pixelify Sans', bold=True, em=112, bord=8, spacing=6,
                shadow=dict(bord=16, blur=14, dy=8, alpha=0x40))
TITLE_L2 = dict(family='Pixelify Sans', bold=True, em=60, bord=6, spacing=2,
                shadow=dict(bord=11, blur=10, dy=6, alpha=0x40))
TITLE_CAPTOP = 540                        # cap top of "THE WARRIOR"
TITLE_GAP = 28                            # line-1 baseline -> line-2 cap top
TITLE_BANDS = ['#FFF8E6', '#FFEBBE', '#FFD98E']   # top -> bottom fill bands (warm off-white -> gold)
TITLE_DUR = 2.8
TITLE_CLAMP_TO_CUT = True     # end the title at the establishing-shot cut (L02.speechStart - 0.25, src/film.js)

VERSE = dict(family='Pixelify Sans', bold=True, em=52, bord=5, spacing=1, max_w=860, max_chars=28,
             pitch=70, shadow=dict(bord=10, blur=9, dy=5, alpha=0x50))
VERSE_CENTER_Y = 872                      # vertical centre of the verse block (700..1050)
REF = dict(family='Silkscreen', bold=False, em=32, bord=4, spacing=5,
           shadow=dict(bord=8, blur=7, dy=4, alpha=0x50))
REF_GAP = 44                              # verse last baseline -> reference cap top
TAG = dict(family='Pixelify Sans', bold=True, em=70, bord=7, spacing=1, max_w=800,
           shadow=dict(bord=14, blur=12, dy=6, alpha=0x40))
TAG_CAPTOP = 1226

WORD_FADE = 0.07
LEAD_IN = 0.05            # subtitle (label + page) appears at speechStart - LEAD_IN
HOLD = 0.5                # hold after speechEnd
FADE_OUT = 0.2
PAGE_FADE = 0.15
ONSET_LEAD = 0.04         # refined onsets: start the fade this much before the acoustic onset

WEAK_END = {'a', 'an', 'the', 'to', 'of', 'my', 'his', 'her', 'our', 'your', 'their', 'i', 'and', 'with',
            'for', 'in', 'on', 'at', 'is', 'so', 'that', 'this', 'he', 'you', "i'm", "i've", "you've", 'it'}


# ------------------------------------------------------------------------------------------------
# Fonts: tiny TrueType reader (family, weight, vertical metrics) + PIL for advances
# ------------------------------------------------------------------------------------------------
class Face:
    def __init__(self, path):
        self.path = path
        d = open(path, 'rb').read()
        n = struct.unpack('>H', d[4:6])[0]
        t = {}
        for i in range(n):
            tag, _cs, off, ln = struct.unpack('>4sIII', d[12 + 16 * i:28 + 16 * i])
            t[tag.decode('latin-1')] = (off, ln)
        o = t['head'][0]
        self.upem = struct.unpack('>H', d[o + 18:o + 20])[0]
        o = t['OS/2'][0]
        self.weight = struct.unpack('>H', d[o + 4:o + 6])[0]
        self.win_asc, self.win_desc = struct.unpack('>HH', d[o + 74:o + 78])
        self.family = self._name(d, t, (16, 1))
        self._pil = {}

    @staticmethod
    def _name(d, t, ids):
        o = t['name'][0]
        _fmt, count, soff = struct.unpack('>HHH', d[o:o + 6])
        found = {}
        for i in range(count):
            pid, eid, lid, nid, ln, off = struct.unpack('>HHHHHH', d[o + 6 + 12 * i:o + 18 + 12 * i])
            raw = d[o + soff + off:o + soff + off + ln]
            if pid == 3:
                s = raw.decode('utf-16-be', 'replace')
            elif pid == 1:
                s = raw.decode('mac_roman', 'replace')
            else:
                continue
            found.setdefault(nid, s)
        for nid in ids:
            if nid in found:
                return found[nid]
        return ''

    def ass_size(self, em):
        """ASS Fontsize that renders this face with the given pixel em under libass."""
        return em * (self.win_asc + self.win_desc) / self.upem

    def asc_px(self, em):
        return em * self.win_asc / self.upem

    def pil(self, em):
        key = round(em * 4)
        if key not in self._pil:
            try:
                from PIL import ImageFont
                self._pil[key] = ImageFont.truetype(self.path, em)
            except Exception:
                self._pil[key] = None
        return self._pil[key]

    def width(self, text, em, spacing=0.0):
        f = self.pil(em)
        if f is not None:
            w = f.getlength(text)
        else:
            w = 0.6 * em * len(text)
        return w + spacing * len(text)

    def cap_top(self, em):
        """Distance from the baseline up to the top of a capital (px)."""
        f = self.pil(em)
        if f is not None:
            return -f.getbbox('H', anchor='ls')[1]
        return 0.66 * em


_FACES = None


def face(family, bold):
    global _FACES
    if _FACES is None:
        _FACES = []
        for fn in sorted(os.listdir(FONTS_DIR)):
            if fn.lower().endswith(('.ttf', '.otf')):
                try:
                    _FACES.append(Face(os.path.join(FONTS_DIR, fn)))
                except Exception as e:  # pragma: no cover
                    print('warning: cannot read font', fn, e, file=sys.stderr)
    cands = [f for f in _FACES if f.family.lower() == family.lower()]
    if not cands:
        raise SystemExit(f'font family {family!r} not found in {FONTS_DIR}')
    want = 700 if bold else 400
    return min(cands, key=lambda f: abs(f.weight - want))


# ------------------------------------------------------------------------------------------------
# ASS helpers
# ------------------------------------------------------------------------------------------------
def ass_time(t):
    cs = max(0, int(round(t * 100)))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f'{h}:{m:02d}:{s:02d}.{cs:02d}'


def q(t):
    """Quantise a time to the centisecond grid used by ASS event times."""
    return round(t * 100) / 100


def colour(hexrgb, alpha=0):
    h = hexrgb.lstrip('#')
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f'&H{alpha:02X}{b}{g}{r}&'.upper()


def scol(hexrgb, alpha=0):
    """Colour in a [V4+ Styles] line (&HAABBGGRR, no trailing &)."""
    return colour(hexrgb, alpha).rstrip('&')


def esc(text):
    return text.replace('\\', '\\\\').replace('{', '(').replace('}', ')')


def fmt(x):
    s = f'{x:.2f}'.rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


class Script:
    def __init__(self):
        self.events = []

    def add(self, layer, t0, t1, text, style='PixelifyBold', name=None):
        if q(t1) <= q(t0):
            return
        self.events.append((layer, q(t0), q(t1), style, text, name))

    def dump(self, title):
        out = [
            '[Script Info]',
            f'; {title} -- generated by render/subtitles.py from timeline/timeline.json. Do not edit by hand.',
            '; Burn in with: ffmpeg -i in.mp4 -vf "ass=out/subs/film.ass:fontsdir=assets/fonts" ...',
            f'Title: {title}',
            'ScriptType: v4.00+',
            f'PlayResX: {W}',
            f'PlayResY: {H}',
            'WrapStyle: 2',
            'ScaledBorderAndShadow: yes',
            'YCbCr Matrix: None',
            'Kerning: yes',
            '',
            '[V4+ Styles]',
            'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, '
            'Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, '
            'Alignment, MarginL, MarginR, MarginV, Encoding',
            # One style per font face (so libass resolves each face once, with no transient lookups); events
            # override size, spacing, colours and position explicitly.
            f'Style: PixelifyBold,Pixelify Sans,{fmt(face("Pixelify Sans", True).ass_size(DLG["em"]))},'
            f'{scol(C_WHITE)},{scol(C_WHITE)},{scol(C_OUTLINE)},{scol(C_SHADOW, 0x48)},'
            f'-1,0,0,0,100,100,{fmt(DLG["spacing"])},0,1,{fmt(DLG["bord"])},0,8,0,0,0,1',
            f'Style: Silkscreen,Silkscreen,{fmt(face("Silkscreen", False).ass_size(LABEL["em"]))},'
            f'{scol(C_WHITE)},{scol(C_WHITE)},{scol(C_OUTLINE)},{scol(C_SHADOW, 0x50)},'
            f'0,0,0,0,100,100,{fmt(LABEL["spacing"])},0,1,{fmt(LABEL["bord"])},0,8,0,0,0,1',
            '',
            '[Events]',
            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        ]
        for layer, t0, t1, style, text, name in sorted(self.events, key=lambda e: (e[1], e[0])):
            name = (name or '').replace(',', ' ')
            out.append(f'Dialogue: {layer},{ass_time(t0)},{ass_time(t1)},{style},{name},0,0,0,,{text}')
        return '\n'.join(out) + '\n'


def font_tags(spec):
    f = face(spec['family'], spec['bold'])
    # the face itself comes from the event style (style_for); only size and tracking are overridden
    return f'\\fs{fmt(f.ass_size(spec["em"]))}\\fsp{fmt(spec.get("spacing", 0))}'


def style_for(spec):
    fam = spec['family'].lower().replace(' ', '')
    if fam == 'pixelifysans' and spec['bold']:
        return 'PixelifyBold'
    if fam == 'silkscreen' and not spec['bold']:
        return 'Silkscreen'
    raise ValueError(f'no ASS style for {spec["family"]} bold={spec["bold"]}')


def line_top_for_baseline(spec, baseline):
    """\\an8 places the top of the line box at y; the baseline sits winAscent below it."""
    f = face(spec['family'], spec['bold'])
    return baseline - f.asc_px(spec['em'])


def text_events(sc, spec, t0, t1, x, baseline, runs, fill, layer_main=2, layer_shadow=1, fade=(0, 0),
                extra='', name=None, outline=C_OUTLINE, strips=None):
    """Emit a crisp outlined text line (layer_main) + its soft blurred drop shadow (layer_shadow).

    runs: list of (text, reveal_ms or None). reveal_ms = time (ms, relative to t0) at which the run starts
    fading in over WORD_FADE; None = visible from the start of the event.
    strips: optional [(y0, y1, fill)] -> the main layer is emitted once per horizontal strip (\\clip) with its
    own fill colour; strips tile the frame so every pixel is drawn exactly once (clean fades).
    """
    y = line_top_for_baseline(spec, baseline)
    pos = f'\\an8\\pos({fmt(x)},{fmt(y)})'
    fad = f'\\fad({int(round(fade[0] * 1000))},{int(round(fade[1] * 1000))})' if (fade[0] or fade[1]) else ''
    sh = spec['shadow']
    sa = sh['alpha']
    fwd = int(round(WORD_FADE * 1000))

    def body(main):
        parts = []
        for text, ms in runs:
            if ms is None or ms <= 0:
                if main:
                    parts.append('{\\1a&H00&\\3a&H00&}' + esc(text))
                else:
                    parts.append(f'{{\\4a&H{sa:02X}&}}' + esc(text))
            else:
                if main:
                    parts.append(f'{{\\1a&HFF&\\3a&HFF&\\t({ms},{ms + fwd},\\1a&H00&\\3a&H00&)}}' + esc(text))
                else:
                    parts.append(f'{{\\4a&HFF&\\t({ms},{ms + fwd},\\4a&H{sa:02X}&)}}' + esc(text))
        return ''.join(parts)

    common = f'{pos}{fad}{font_tags(spec)}{extra}'
    shadow = (f'{{{common}\\1a&HFF&\\3a&HFF&\\4c{colour(C_SHADOW)}\\bord{fmt(sh["bord"])}'
              f'\\xshad0\\yshad{fmt(sh["dy"])}\\blur{fmt(sh["blur"])}}}' + body(False))
    sc.add(layer_shadow, t0, t1, shadow, style=style_for(spec), name=name)
    for y0, y1, col in (strips or [(None, None, fill)]):
        clip = f'\\clip(0,{y0},{W},{y1})' if y0 is not None else ''
        main = (f'{{{common}\\1c{colour(col)}\\3c{colour(outline)}\\bord{fmt(spec["bord"])}\\shad0\\blur0{clip}}}'
                + body(True))
        sc.add(layer_main, t0, t1, main, style=style_for(spec), name=name)


# ------------------------------------------------------------------------------------------------
# Line breaking
# ------------------------------------------------------------------------------------------------
def _ends_clause(tok):
    return bool(re.search(r'([,.;:!?]|\.\.\.|…)["”’)]*$', tok))


def _ends_sentence(tok):
    return bool(re.search(r'([.!?]|\.\.\.|…)["”’)]*$', tok))


def _norm(tok):
    return re.sub(r"[^a-z0-9']", '', tok.lower().replace('’', "'"))


def break_lines(tokens, width_fn, max_w, max_chars, hard_chars, max_lines):
    """Balanced line breaks. Returns list of lines (lists of token indices), or None if impossible.

    Picks the fewest lines that fit, then minimises (normalised) width variance with penalties for
    orphans (a lone short word on a line), lines ending on a weak word, and bonuses for breaking
    after punctuation.
    """
    n = len(tokens)
    best = None
    for nl in range(1, max_lines + 1):
        if nl > n:
            break
        cands = []
        for cuts in _combinations(range(1, n), nl - 1):
            bounds = [0, *cuts, n]
            lines = [list(range(bounds[i], bounds[i + 1])) for i in range(nl)]
            texts = [' '.join(tokens[i] for i in ln) for ln in lines]
            ws = [width_fn(t) for t in texts]
            if any(w > max_w for w in ws) or any(len(t) > hard_chars for t in texts):
                continue
            mean = sum(ws) / nl
            cost = sum((w - mean) ** 2 for w in ws) / (mean * mean + 1e-9)
            for li, ln in enumerate(lines):
                t = texts[li]
                if len(t) > max_chars:
                    cost += 0.25 * (len(t) - max_chars)
                if nl > 1 and len(ln) == 1 and len(_norm(tokens[ln[0]])) < 7 and not (
                        li < nl - 1 and _ends_sentence(tokens[ln[0]])):
                    cost += 1.0                                  # orphan
                if li < nl - 1:
                    last = tokens[ln[-1]]
                    if _ends_clause(last):
                        cost -= 0.25 if _ends_sentence(last) else 0.15
                    elif _norm(last) in WEAK_END:
                        cost += 0.18
                    nxt = tokens[ln[-1] + 1]
                    if nxt[:1].isupper() and _ends_sentence(last):
                        cost -= 0.05
            # slight preference for a bottom-heavy (pyramid) shape when otherwise similar
            if nl == 2 and ws[0] > ws[1] * 1.25:
                cost += 0.03
            cands.append((cost, lines))
        if cands:
            cost, lines = min(cands, key=lambda c: c[0])
            best = lines
            break
    return best


def _combinations(seq, k):
    seq = list(seq)
    if k == 0:
        yield ()
        return
    for i in range(len(seq)):
        for rest in _combinations(seq[i + 1:], k - 1):
            yield (seq[i], *rest)


# ------------------------------------------------------------------------------------------------
# Word timing: align display tokens to whisper words, refine onsets with the audio
# ------------------------------------------------------------------------------------------------
def align_tokens(tokens, words):
    """Map each display token to (start, end) using cue.words (which may differ in case/punctuation)."""
    a = [_norm(t) for t in tokens]
    b = [_norm(w['w']) for w in words]
    times = [None] * len(tokens)
    if len(a) == len(b):
        for i in range(len(a)):
            times[i] = (words[i]['s'], words[i]['e'])
    else:
        sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
                for k in range(i2 - i1):
                    times[i1 + k] = (words[j1 + k]['s'], words[j1 + k]['e'])
            elif tag == 'replace':
                s, e = words[j1]['s'], words[j2 - 1]['e']
                for k in range(i2 - i1):
                    u0 = k / (i2 - i1)
                    u1 = (k + 1) / (i2 - i1)
                    times[i1 + k] = (s + (e - s) * u0, s + (e - s) * u1)
        # tokens with no match: borrow from neighbours
        for i in range(len(times)):
            if times[i] is None:
                prev = next((times[j] for j in range(i - 1, -1, -1) if times[j]), None)
                nxt = next((times[j] for j in range(i + 1, len(times)) if times[j]), None)
                s = prev[1] if prev else (nxt[0] if nxt else words[0]['s'])
                e = nxt[0] if nxt else (prev[1] if prev else words[-1]['e'])
                times[i] = (s, max(s, e))
    return times


_AUDIO_CACHE = {}


def _envelope(path):
    if path in _AUDIO_CACHE:
        return _AUDIO_CACHE[path]
    env = None
    try:
        import numpy as np
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                             capture_output=True, check=True).stdout
        x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
        hop = 160
        n = len(x) // hop
        rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
        db = 20 * np.log10(rms)
        thr = float(np.percentile(db, 98)) - 30.0
        env = (db > thr)
    except Exception as e:
        print(f'  (onset refinement skipped for {os.path.relpath(path, ROOT)}: {e})', file=sys.stderr)
    _AUDIO_CACHE[path] = env
    return env


def refine_onsets(cue, times, log):
    """Delay a word's reveal when the take is silent at its whisper start (pause glued onto the word)."""
    path = os.path.join(ROOT, cue['file'])
    if not os.path.exists(path):
        return times
    voiced = _envelope(path)
    if voiced is None:
        return times
    fs = cue['fileStart']
    out = []
    for (s, e), tok in zip(times, cue['_tokens']):
        i0 = int(round((s - fs) / 0.01))
        i1 = int(round((e - fs) / 0.01))
        i0 = max(0, min(i0, len(voiced) - 1))
        i1 = max(i0, min(i1, len(voiced)))
        k = i0
        tail = 0
        while k < i1 and voiced[k] and tail < 15:          # skip <=150 ms tail of the previous word
            k += 1
            tail += 1
        new_s = s
        if tail < 15:
            sil0 = k
            while k < i1 and not voiced[k]:
                k += 1
            sil = k - sil0
            if sil >= 10 and k < i1 - 2 and voiced[k:k + 5].sum() >= 3:
                cand = fs + k * 0.01 - ONSET_LEAD
                cand = min(cand, e - 0.06)
                if cand - s >= 0.06:
                    new_s = cand
        if new_s != s:
            log.append(f'{cue["id"]} "{tok}": {s:.2f} -> {new_s:.2f} (+{new_s - s:.2f}s, silent at words[].s)')
        out.append((new_s, e))
    return out


# ------------------------------------------------------------------------------------------------
# Dialogue
# ------------------------------------------------------------------------------------------------
def plan_pages(tokens, times, width_fn):
    """Split a cue into pages (each <= DLG.max_lines lines). Pages only when the whole cue cannot be laid out
    in <= 3 lines, or when it would need 3 lines and splits cleanly into two <= 2-line pages at a sentence
    break followed by a pause."""
    args = (width_fn, DLG['max_w'], DLG['max_chars'], DLG['hard_chars'])
    whole = break_lines(tokens, *args, DLG['max_lines'])
    if whole is not None and len(whole) <= 2:
        return [(0, len(tokens), whole)]
    line_ends = {ln[-1] + 1 for ln in whole} if whole is not None else set()
    best = None
    for i in range(1, len(tokens)):
        last = tokens[i - 1]
        if not _ends_clause(last):
            continue
        gap = times[i][0] - times[i - 1][1]
        if whole is not None:
            # A 3-line layout exists: only page when a sentence break followed by a real pause falls in the
            # middle of a line (e.g. "betrayed me. He opened"); otherwise the 3-line block reads better.
            if not (_ends_sentence(last) and gap >= 0.3 and i not in line_ends):
                continue
        a = break_lines(tokens[:i], *args, 2)
        b = break_lines(tokens[i:], *args, 2)
        if a is None or b is None:
            continue
        score = 0.0
        score += 0 if _ends_sentence(last) else 0.5
        score += 0 if gap >= 0.3 else 0.4
        score += abs(i - (len(tokens) - i)) * 0.05
        if best is None or score < best[0]:
            best = (score, i, a, b)
    if best is not None:
        _, i, a, b = best
        return [(0, i, a), (i, len(tokens), [[j + i for j in ln] for ln in b])]
    if whole is not None:
        return [(0, len(tokens), whole)]
    # fallback: force pages of <= 3 lines greedily
    pages, start = [], 0
    while start < len(tokens):
        end = len(tokens)
        while end > start + 1 and break_lines(tokens[start:end], *args, DLG['max_lines']) is None:
            end -= 1
        lines = break_lines(tokens[start:end], *args, DLG['max_lines']) or [[0]]
        pages.append((start, end, [[j + start for j in ln] for ln in lines]))
        start = end
    return pages


def build_dialogue(sc, tl, refine, log, srt):
    fb = face(DLG['family'], DLG['bold'])
    flab = face(LABEL['family'], LABEL['bold'])
    em = DLG['em']

    def width_fn(t):
        return fb.width(t, em, DLG['spacing'])

    cap = fb.cap_top(em)
    first_baseline = LABEL_BASELINE + LABEL_GAP + cap
    cues = tl['cues']
    B = tl['beats']
    for ci, cue in enumerate(cues):
        tokens = cue['text'].split()
        cue['_tokens'] = tokens
        times = align_tokens(tokens, cue['words'])
        if refine:
            times = refine_onsets(cue, times, log)
        start = cue['speechStart'] - LEAD_IN
        if ci + 1 < len(cues):
            next_start = cues[ci + 1]['speechStart'] - LEAD_IN
        else:
            next_start = B.get('endCardStart', tl['duration']) + FADE_OUT
        end = min(cue['speechEnd'] + HOLD + FADE_OUT, next_start, tl['duration'])
        fade_out = max(0.05, min(FADE_OUT, end - cue['speechEnd'] - 0.05))

        pages = plan_pages(tokens, times, width_fn)
        # page boundaries
        bounds = [start]
        for pi in range(1, len(pages)):
            first_tok = pages[pi][0]
            s_next = times[first_tok][0]
            e_prev = times[first_tok - 1][1]
            # keep the finished page up until just before the next one is spoken (>= 0.3 s after its last
            # word), so the block is never left empty for long
            bt = max(e_prev + 0.3, s_next - 0.12)
            bt = min(bt, s_next - 0.05)
            bounds.append(bt)
        bounds.append(end)

        # speaker label: one event for the whole cue
        lab_runs = [(cue['speaker'], None)]
        text_events(sc, LABEL, start, end, CX, LABEL_BASELINE, lab_runs, LABEL_COLOURS.get(cue['speaker'], C_WHITE),
                    fade=(0.08, fade_out), name=f'{cue["id"]} label')

        for pi, (a, b, lines) in enumerate(pages):
            p0, p1 = q(bounds[pi]), q(bounds[pi + 1])
            last_page = pi == len(pages) - 1
            fo = fade_out if last_page else PAGE_FADE
            fi = 0.0
            for li, ln in enumerate(lines):
                runs = []
                for k, ti in enumerate(ln):
                    txt = tokens[ti] + (' ' if k < len(ln) - 1 else '')
                    ms = int(round((times[ti][0] - p0) * 1000))
                    runs.append((txt, ms if ms > 0 else None))
                baseline = first_baseline + li * DLG['pitch']
                text_events(sc, DLG, p0, p1, CX, baseline, runs, C_WHITE, fade=(fi, fo),
                            name=f'{cue["id"]} p{pi + 1} l{li + 1}')
            # SRT entry per page
            srt.append((p0, p1 - fo * 0.5, cue['speaker'], ' '.join(tokens[a:b]),
                        [' '.join(tokens[i] for i in ln) for ln in lines]))
        cue.pop('_tokens', None)


# ------------------------------------------------------------------------------------------------
# Title card
# ------------------------------------------------------------------------------------------------
def pixel_diamond(cx, cy, unit, rows):
    """Stepped (pixel-art) diamond as an ASS drawing: rows = half-widths in units from the middle row."""
    parts = []
    n = len(rows)
    for r in range(-(n - 1), n):
        hw = rows[abs(r)] * unit
        y0 = cy + r * unit - unit / 2
        y1 = y0 + unit
        parts.append(f'm {fmt(cx - hw)} {fmt(y0)} l {fmt(cx + hw)} {fmt(y0)} {fmt(cx + hw)} {fmt(y1)} '
                     f'{fmt(cx - hw)} {fmt(y1)}')
    return ' '.join(parts)


def ornament_drawing(half_len, unit=4):
    """Horizontal divider: thin bars with a pixel diamond in the centre and small diamonds at the ends.
    Drawn around (0,0)."""
    u = unit
    parts = [pixel_diamond(0, 0, u, [3, 2, 1])]
    gap0, gap1 = 5 * u, half_len
    for sgn in (-1, 1):
        x0, x1 = sgn * gap0, sgn * gap1
        lo, hi = min(x0, x1), max(x0, x1)
        parts.append(f'm {fmt(lo)} {fmt(-u / 2)} l {fmt(hi)} {fmt(-u / 2)} {fmt(hi)} {fmt(u / 2)} {fmt(lo)} {fmt(u / 2)}')
        parts.append(pixel_diamond(sgn * (half_len + 3 * u), 0, u, [1.5, 0.5]))
    return ' '.join(parts)


def ornament_events(sc, t0, t1, cx, cy, half_len, col, fade, grow_ms=600, layer=2, name=None):
    draw = ornament_drawing(half_len)
    base = f'\\an7\\pos({fmt(cx)},{fmt(cy)})\\fad({int(fade[0] * 1000)},{int(fade[1] * 1000)})'
    grow = f'\\fscx0\\t(0,{grow_ms},0.6,\\fscx100)' if grow_ms else ''
    sc.add(layer - 1, t0, t1, f'{{{base}{grow}\\1a&HFF&\\3a&HFF&\\4c{colour(C_SHADOW)}\\4a&H50&\\bord6\\xshad0'
                              f'\\yshad3\\blur5\\p1}}{draw}{{\\p0}}', name=name)
    sc.add(layer, t0, t1, f'{{{base}{grow}\\1c{colour(col)}\\3c{colour(C_OUTLINE)}\\bord3\\shad0\\blur0\\p1}}'
                          f'{draw}{{\\p0}}', name=name)


def banded_text(sc, spec, t0, t1, baseline, text, bands, fade, name):
    """Outlined text whose fill is a stepped vertical gradient (pixel-art title look): the main layer is cut
    into horizontal strips across the cap height, each with its own fill colour."""
    f = face(spec['family'], spec['bold'])
    cap = f.cap_top(spec['em'])
    top = baseline - cap
    n = len(bands)
    edges = [int(round(top + cap * k / n)) for k in range(n + 1)]
    edges[0], edges[-1] = 0, H
    strips = [(edges[k], edges[k + 1], bands[k]) for k in range(n)]
    text_events(sc, spec, t0, t1, CX, baseline, [(text, None)], bands[-1], fade=fade, name=name, strips=strips)


def build_title(sc, tl):
    B = tl['beats']
    t0 = B['establishStart'] + 0.25
    t1 = t0 + TITLE_DUR
    # The establishing shot cuts to the two-shot 0.25 s before L02 (src/film.js); in the two-shot the heads
    # sit where the title is, so the title finishes its fade-out at that cut.
    l02 = next((c for c in tl['cues'] if c['speechStart'] > B['establishStart']), None)
    if l02 is not None and TITLE_CLAMP_TO_CUT:
        t1 = min(t1, l02['speechStart'] - 0.25)
    fade = (0.4, 0.4)
    f1 = face(TITLE_L1['family'], True)
    f2 = face(TITLE_L2['family'], True)
    words = tl['title'].upper().replace("'", '’').split()
    # "THE WARRIOR" / "WHO COULDN'T FORGIVE": break before the relative clause if there is one
    k = next((i for i, w in enumerate(words) if w in ('WHO', 'THAT', 'WHICH')), len(words) // 2)
    l1, l2 = ' '.join(words[:k]), ' '.join(words[k:])
    l1 = l1.replace('’', "'")
    l2 = l2.replace('’', "'")
    b1 = TITLE_CAPTOP + f1.cap_top(TITLE_L1['em'])
    b2 = b1 + TITLE_GAP + f2.cap_top(TITLE_L2['em'])
    banded_text(sc, TITLE_L1, t0, t1, b1, l1, TITLE_BANDS, fade, 'title l1')
    banded_text(sc, TITLE_L2, t0 + 0.1, t1, b2, l2, TITLE_BANDS, fade, 'title l2')
    w2 = f2.width(l2, TITLE_L2['em'], TITLE_L2['spacing'])
    ornament_events(sc, t0 + 0.2, t1, CX, b2 + 34, min(280, w2 / 2 - 70), '#FFD37A', (0.3, fade[1]),
                    name='title ornament')
    return t0, t1


# ------------------------------------------------------------------------------------------------
# End card
# ------------------------------------------------------------------------------------------------
def build_end_card(sc, tl):
    B = tl['beats']
    ec = tl['endCard']
    t_start = B['endCardStart']
    t_end = tl['duration'] - 0.05           # src/film.js fades the picture to black over [dur-0.9, dur-0.05]
    out = (tl['duration'] - 0.05) - (tl['duration'] - 0.9)
    fv = face(VERSE['family'], VERSE['bold'])

    def width_fn(t):
        return fv.width(t, VERSE['em'], VERSE['spacing'])

    halves = [h.strip() for h in ec['verse'].split('\n') if h.strip()]
    lines = []
    for hi, h in enumerate(halves):
        toks = h.split()
        if hi == 0:
            toks[0] = '“' + toks[0]
        if hi == len(halves) - 1:
            toks[-1] = toks[-1] + '”'
        br = break_lines(toks, width_fn, VERSE['max_w'], VERSE['max_chars'], VERSE['max_chars'] + 4, 3)
        if br is None:
            br = [list(range(len(toks)))]
        for ln in br:
            lines.append(' '.join(toks[i] for i in ln))
    cap = fv.cap_top(VERSE['em'])
    n = len(lines)
    block_h = cap + (n - 1) * VERSE['pitch']
    first_baseline = VERSE_CENTER_Y - block_h / 2 + cap
    for i, ln in enumerate(lines):
        t0 = t_start + 0.15 + 0.14 * i
        text_events(sc, VERSE, t0, t_end, CX, first_baseline + i * VERSE['pitch'], [(ln, None)], C_WHITE,
                    fade=(0.55, out), name=f'endcard verse l{i + 1}')
    last_baseline = first_baseline + (n - 1) * VERSE['pitch']
    fr = face(REF['family'], REF['bold'])
    ref_baseline = last_baseline + REF_GAP + fr.cap_top(REF['em'])
    text_events(sc, REF, t_start + 0.6, t_end, CX, ref_baseline, [(ec['reference'], None)], C_REF,
                fade=(0.5, out), name='endcard reference')
    ft = face(TAG['family'], TAG['bold'])
    tw = ec['tagline']
    tag = dict(TAG)
    while tag['em'] > 40 and ft.width(tw, tag['em'], tag['spacing']) > tag['max_w']:
        tag['em'] -= 1                                   # keep the tagline inside the safe width
    tag_baseline = TAG_CAPTOP + ft.cap_top(tag['em'])
    orn_y = (ref_baseline + TAG_CAPTOP) / 2
    ornament_events(sc, t_start + 1.0, t_end, CX, orn_y, 150, '#F2A541', (0.4, out), grow_ms=700,
                    name='endcard ornament')
    # soft warm glow behind the tagline + the tagline itself
    gy = line_top_for_baseline(tag, tag_baseline)
    sc.add(0, t_start + 1.4, t_end,
           f'{{\\an8\\pos({fmt(CX)},{fmt(gy)})\\fad(900,{int(out * 1000)}){font_tags(tag)}\\1a&HFF&'
           f'\\3c{colour("#FFB347")}\\3a&HB8&\\bord22\\shad0\\blur22}}{esc(tw)}', name='endcard tagline glow')
    text_events(sc, tag, t_start + 1.4, t_end, CX, tag_baseline, [(tw, None)], C_GOLD, fade=(0.6, out),
                name='endcard tagline')
    return dict(lines=lines, verse_top=first_baseline - cap, verse_bottom=last_baseline, ref=ref_baseline,
                tag=tag_baseline)


# ------------------------------------------------------------------------------------------------
# SRT
# ------------------------------------------------------------------------------------------------
def srt_time(t):
    ms = max(0, int(round(t * 1000)))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def write_srt(path, entries):
    out = []
    for i, (t0, t1, spk, text, _lines) in enumerate(entries, 1):
        full = f'{spk}: {text}'
        toks = full.split()
        br = break_lines(toks, len, 42, 42, 42, 2) or [list(range(len(toks)))]
        body = '\n'.join(' '.join(toks[k] for k in ln) for ln in br)
        out.append(f'{i}\n{srt_time(t0)} --> {srt_time(t1)}\n{body}\n')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))


# ------------------------------------------------------------------------------------------------
# QA stills
# ------------------------------------------------------------------------------------------------
def default_qa_times(tl):
    B = tl['beats']
    ts = []
    for cue in tl['cues']:
        w = cue['words']
        ts.append(cue['speechStart'] - 0.02)                      # label only, no words yet
        ts.append((w[len(w) // 2]['s'] + w[len(w) // 2]['e']) / 2)  # mid-sentence
        ts.append(cue['speechEnd'] + 0.25)                        # full line holding
    ts += [B['establishStart'] + 0.3, B['establishStart'] + 1.5, B['establishStart'] + 2.0,
           B['endCardStart'] + 0.3, B['endCardStart'] + 0.9, B['endCardStart'] + 2.5, tl['duration'] - 0.4]
    return sorted(set(round(t, 2) for t in ts))


def render_still(ass_path, t, bg, out_png):
    if bg is None or re.match(r'^(0x|#)?[0-9a-fA-F]{6}$', bg):
        col = '0x' + bg.lstrip('#')[-6:] if bg else '0x88aa66'
        inp = ['-f', 'lavfi', '-i', f'color=c={col}:s={W}x{H}:d=1']
        pre = ''
    elif not os.path.exists(bg):
        raise SystemExit(f'background not found: {bg}')
    else:
        inp = ['-i', bg]
        pre = f'scale={W}:{H}:flags=lanczos,'
    vf = f'{pre}settb=AVTB,setpts={t:.3f}/TB,ass={ass_path}:fontsdir={os.path.relpath(FONTS_DIR, ROOT)}'
    r = subprocess.run(['ffmpeg', '-v', 'debug', '-y', *inp, '-vf', vf, '-frames:v', '1', out_png],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:], file=sys.stderr)
        raise SystemExit('ffmpeg failed')
    sel = sorted(set(re.findall(r'fontselect: \((.*?)\) -> (.*)', r.stderr)))
    warn = sorted(set(l for l in r.stderr.splitlines()
                      if re.search(r'fallback|Glyph 0x[0-9A-F]+ not found|failed to find', l, re.I)))
    return sel, warn


# ------------------------------------------------------------------------------------------------
def main():
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--timeline', default=os.path.join(ROOT, 'timeline', 'timeline.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'out', 'subs'))
    ap.add_argument('--no-refine', action='store_true', help='use cue.words[].s verbatim for word reveals')
    ap.add_argument('--stills', default=None,
                    help='"qa" or comma list of T or T@background (png path or hex colour) -> out/subs/test/')
    ap.add_argument('--bg', default=None, help='default background for --stills (png or hex colour)')
    args = ap.parse_args()

    tl = json.load(open(args.timeline, encoding='utf-8'))
    os.makedirs(args.out, exist_ok=True)
    sc = Script()
    log, srt = [], []
    build_dialogue(sc, tl, not args.no_refine, log, srt)
    t_title = build_title(sc, tl)
    ec = build_end_card(sc, tl)

    ass_path = os.path.join(args.out, 'film.ass')
    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(sc.dump(tl.get('title', 'film')))
    write_srt(os.path.join(args.out, 'film.srt'), srt)

    print(f'wrote {os.path.relpath(ass_path, ROOT)} ({len(sc.events)} events) and '
          f'{os.path.relpath(os.path.join(args.out, "film.srt"), ROOT)} ({len(srt)} captions)')
    for (t0, t1, spk, text, lines) in srt:
        print(f'  {t0:6.2f}-{t1:6.2f} {spk:<6} | ' + ' / '.join(lines))
    print(f'  title {t_title[0]:.2f}-{t_title[1]:.2f}; end card verse: ' + ' / '.join(ec['lines']))
    for l in log:
        print('  onset:', l)

    if args.stills:
        test_dir = os.path.join(args.out, 'test')
        os.makedirs(test_dir, exist_ok=True)
        items = default_qa_times(tl) if args.stills == 'qa' else args.stills.split(',')
        fonts_seen, warns = set(), set()
        for it in items:
            it = str(it)
            if '@' in it:
                ts, bg = it.split('@', 1)
            else:
                ts, bg = it, args.bg
            t = float(ts)
            tag = os.path.splitext(os.path.basename(bg))[0] if bg and os.path.exists(bg) else 'flat'
            png = os.path.join(test_dir, f'test_{t:05.2f}_{tag}.png')
            sel, warn = render_still(os.path.relpath(ass_path, ROOT), t, bg, png)
            fonts_seen.update(sel)
            warns.update(warn)
            print('  still', os.path.relpath(png, ROOT))
        for a, b in sorted(fonts_seen):
            print(f'  libass fontselect: ({a}) -> {b}')
        for w in sorted(warns):
            print('  WARNING:', w)


if __name__ == '__main__':
    main()
