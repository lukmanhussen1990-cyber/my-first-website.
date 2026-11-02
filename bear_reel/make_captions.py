"""Burned-in captions: audio/captions.ass (ASS v4+, 1080x1920).

Style (the user's last reels): white "Pixelify Sans" Bold, centred (\\an5 at 540,1104 = 57.5% height), 2-4 words at a time,
one line only, dark outline + soft drop shadow, short pop-in (85% -> 100% in 80 ms), no fades.
Burn with:  ffmpeg ... -vf "subtitles=audio/captions.ass:fontsdir=fonts"

Timing: every chunk appears on the video frame at (or just before) the moment its first word starts in
audio/voiceover.wav - never late, at most ~45 ms early - and stays until the next chunk starts (or until its
last word ends + 0.25 s when a pause follows). Word onsets are measured from the audio itself:
  1. line start/end: the first/last 2.5 ms frame that rises out of the silence between lines;
  2. word boundaries inside a line: pocketsphinx forced alignment of the line's exact words (if the
     pocketsphinx package is installed; otherwise the STT times of audio/words_aligned.json are the prior);
  3. each boundary is then snapped to the acoustic onset of the word's first sound in the energy/spectrum:
     stop consonants (p t k b d g ...) -> the release burst after the closure silence, fricatives (s sh f th h
     z v) -> the start of the hiss, vowels/sonorants -> the end of the energy dip between the words.
Run:  python3 make_captions.py [--debug]   (deterministic; prints the chunk table)
"""
import json, os, re, sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
OUT = P('audio', 'captions.ass')
FONT_NAME, FONT_FILE = 'Pixelify Sans', P('fonts', 'PixelifySans-Bold.ttf')
W, H, FPS = 1080, 1920, 30
FONT_SIZE = 88          # ASS size (font ascent+descent box) -> cap height ~51 px, line box ~88 px
OUTLINE = 7             # dark outline, px
SHADOW_OFF = 6          # soft drop shadow offset, px (down-right)
CAPTION_Y = 1104        # caption centre (57.5% of the height, measured on the user's last reels)
MAX_TEXT_W = 900        # one line only, >= ~70 px side margins: a chunk wider than this gets fewer words
POP_MS, POP_FROM = 80, 85
WORD_GAP = ' \\h'        # wider gap between words (space + hard space): the thick outline eats a plain space
TAIL = 0.25             # hold after the last word when a pause follows
MIN_GAP = 0.15          # never show a blank gap shorter than this between two chunks
LEAD_MAX = 0.050        # caption frame may be at most this much before the word onset (never after)
LEAD_AIM = 0.025        # aim: the frame nearest to 25 ms before the onset (frames are 33 ms apart)

# Natural 2-4 word phrases per voice line (exact script words; never split "Thanksgiving dinner",
# "mashed potatoes", "gastrocolic reflex", "third plate"). Lines not listed are chunked automatically.
CHUNKS = {
    "You just pooped in the forest.": ["You just", "pooped in the forest."],
    "Behind a tree.": ["Behind a tree."],
    "No toilet paper.": ["No toilet paper."],
    "So you grab a leaf.": ["So you", "grab a leaf."],
    "It's itchy.": ["It's itchy."],
    "Very itchy.": ["Very itchy."],
    "Then a branch snaps.": ["Then a branch", "snaps."],
    "You freeze.": ["You freeze."],
    "Something big is coming.": ["Something big", "is coming."],
    "It's a bear.": ["It's a bear."],
    "A really big bear.": ["A really big bear."],
    "It stops.": ["It stops."],
    "It sniffs the air.": ["It sniffs the air."],
    "Then it walks straight toward you.": ["Then it walks", "straight toward you."],
    "You can't run.": ["You can't run."],
    "You're not done yet.": ["You're not done yet."],
    "You hold your breath.": ["You hold your breath."],
    "What you don't know:": ["What you don't know:"],
    "bears can smell about seven times better than a bloodhound.": ["bears can smell", "about seven times", "better than", "a bloodhound."],
    "It smelled you from miles away.": ["It smelled you", "from miles away."],
    "The bear gets closer.": ["The bear gets closer."],
    "Closer.": ["Closer."],
    "It sniffs once.": ["It sniffs once."],
    "Its eyes start watering.": ["Its eyes", "start watering."],
    "It holds its nose.": ["It holds its nose."],
    "And runs away crying.": ["And runs away crying."],
    "Even the birds leave.": ["Even the birds leave."],
    "Enjoy your camping trip.": ["Enjoy your", "camping trip."],
}
NO_SPLIT = {('thanksgiving', 'dinner'), ('mashed', 'potatoes'), ('gastrocolic', 'reflex'), ('third', 'plate'),
            ('very', 'still'), ('one', 'bite'), ('every', 'bite'), ('the', 'whole'), ('your', 'stomach'),
            ('your', 'plate'), ('your', 'pants'), ('make', 'space')}
BREAK_BEFORE = {'on', 'at', 'to', 'a', 'the', 'is', 'it', 'and', 'in', 'with', 'for', 'of', 'your'}
# pocketsphinx pronunciations for words missing from its dictionary
EXTRA_PRON = {}

norm = lambda w: re.sub(r"[^a-z0-9']", '', w.lower())


# ---------------------------------------------------------------- text
def text_width(s, size=FONT_SIZE):
    """Pixel width of s in Pixelify Sans Bold at an ASS font size (libass maps ascent+descent to size)."""
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        return len(s) * size * 0.47
    if not hasattr(text_width, 'f'):
        f = TTFont(FONT_FILE)
        os2 = f['OS/2']
        text_width.f = (f.getBestCmap(), f['hmtx'], f['head'].unitsPerEm, os2.usWinAscent + os2.usWinDescent)
    cmap, hm, upm, box = text_width.f
    return sum(hm[cmap.get(ord(c), cmap[ord('?')])][0] for c in s) * size / box


def auto_chunks(words):
    """Fallback chunker: 2-3 word phrases, break at punctuation / before function words, keep NO_SPLIT pairs."""
    groups, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        if nxt is None:
            groups.append(cur); break
        pair = (norm(w), norm(nxt))
        if pair in NO_SPLIT:
            continue
        if re.search(r'[,.:;!?]$', w) or len(cur) >= 3 or (len(cur) >= 2 and norm(nxt) in BREAK_BEFORE):
            groups.append(cur); cur = []
    out = []
    for g in groups:      # merge single words into a neighbour (single-word chunks only for 1-word lines)
        if len(g) == 1 and out and len(out[-1]) < 4 and not re.search(r'[.!?]$', out[-1][-1]):
            out[-1] = out[-1] + g
        elif out and len(out[-1]) == 1 and len(out[-1] + g) <= 4:
            out[-1] = out[-1] + g
        else:
            out.append(g)
    return [' '.join(g) for g in out]


def caption_text(chunk_words, who):
    s = ' '.join(chunk_words)
    s = re.sub(r'[,.:;]+$', '', s)          # drop trailing , . : ;  (keep ? ! and apostrophes)
    if who != 'N':
        s = '"' + s + '"'                   # character lines in quotes
    return s


def split_line(text):
    words = text.split()
    plan = CHUNKS.get(text) or auto_chunks(words)
    sizes = [len(c.split()) for c in plan]
    assert sum(sizes) == len(words) and ' '.join(plan).split() == words, (text, plan)
    out, k = [], 0
    for n in sizes:
        out.append(list(range(k, k + n))); k += n
    return out


# ---------------------------------------------------------------- audio features
HOP = 0.0025            # analysis hop (s)
SIL_DB = -52.0          # frame energy (dB re. the loudest speech) below this = silence
ALIGN_EARLY = 0.015     # boundaries without an acoustic landmark: shift to the start of the transition


def features(x, sr):
    hop, win = int(sr * HOP), int(sr * 0.010)
    n = (len(x) - win) // hop + 1
    idx = np.arange(n)[:, None] * hop + np.arange(win)[None, :]
    S = np.abs(np.fft.rfft(x[idx] * np.hanning(win), axis=1)) ** 2
    f = np.fft.rfftfreq(win, 1 / sr)
    band = lambda a, b: 10 * np.log10(S[:, (f >= a) & (f < b)].sum(1) + 1e-10)
    sm = lambda v: np.convolve(np.pad(v, 1, mode='edge'), np.ones(3) / 3, mode='valid')
    t = (np.arange(n) * hop + win / 2) / sr
    full = band(60, 10000)
    ref = np.percentile(full, 99.5)
    return {'t': t, 'all': sm(full) - ref, 'lo': sm(band(60, 1000)) - ref, 'hi': sm(band(2500, 10000)) - ref}


def fi(F, t):
    return int(np.clip(round((t - F['t'][0]) / HOP), 0, len(F['t']) - 1))


def line_edges(F, L, rel=40.0):
    """Speech start/end of a line: first/last frame (out of the silence between lines) whose energy is within
    `rel` dB of the line's loudest frame - the point where the voice becomes clearly audible over a music/SFX bed."""
    e = F['all']
    a, b = fi(F, L['start'] - 0.15), fi(F, L['end'] + 0.15)
    thr = max(SIL_DB, e[fi(F, L['start']):fi(F, L['end']) + 1].max() - rel)
    s0 = fi(F, L['start'])
    while s0 > a and e[s0 - 1] > SIL_DB:          # back to the silence before the line
        s0 -= 1
    on = next((i for i in range(s0, b) if e[i] > thr and e[i:i + 4].min() > thr), fi(F, L['start']))
    e0 = fi(F, L['end'])
    while e0 < b and e[e0 + 1] > SIL_DB:          # forward to the silence after the line
        e0 += 1
    off = next((i for i in range(e0, on, -1) if e[i] > thr and e[i - 4:i + 1].min() > thr), fi(F, L['end']))
    return F['t'][on], F['t'][off]


# ---------------------------------------------------------------- forced alignment (prior)
def ps_align(x, sr, lines, edges):
    """pocketsphinx forced alignment of every line (words + phones), or None if unavailable."""
    try:
        from pocketsphinx import Decoder
        from scipy.signal import resample_poly
    except ImportError:
        return None
    x16 = resample_poly(x, 1, sr // 16000) if sr % 16000 == 0 else resample_poly(x, 16000, sr)
    dither = np.random.default_rng(7).standard_normal(len(x16)) * 3e-5
    x16 = x16 + dither
    res = []
    for k, L in enumerate(lines):
        s, e = edges[k]
        a = s - 0.25 if k == 0 else max(s - 0.25, (edges[k - 1][1] + s) / 2)
        b = e + 0.25 if k == len(lines) - 1 else min(e + 0.25, (e + edges[k + 1][0]) / 2)
        seg = x16[int(a * 16000):int(b * 16000)]
        raw = (np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes()
        words = [re.sub(r"[^a-z']", '', w.lower()) for w in L['text'].split()]
        d = Decoder(samprate=16000, bestpath=False, loglevel='FATAL')
        try:
            for w in words:
                if w in EXTRA_PRON:
                    d.add_word(w, EXTRA_PRON[w], True)
            d.set_align_text(' '.join(words))
            for _ in range(2):
                d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
                if _ == 0:
                    d.set_alignment()
            al = []   # copy out while iterating (the iterator reuses its objects)
            for w in d.get_alignment():
                if w.name in ('<s>', '</s>', '<sil>', '(NULL)'):
                    continue
                al.append({'s': a + w.start / 100, 'e': a + (w.start + w.duration) / 100,
                           'ph': [(p.name, a + p.start / 100, a + (p.start + p.duration) / 100) for p in w]})
        except Exception as ex:  # word missing from the dictionary etc. -> STT prior for this line
            print(f'  pocketsphinx: line {L["i"]} not aligned ({ex}); using STT prior', file=sys.stderr)
            res.append(None); continue
        if len(al) != len(words):
            res.append(None); continue
        res.append(al)
    return res


# ---------------------------------------------------------------- onset snapping
def first_sound(w):
    w = norm(w).lstrip("'")
    if re.match(r'(th|sh|ch|ph|wh|kn|gn)', w):
        return {'th': 'fric', 'sh': 'fric', 'ch': 'stop', 'ph': 'fric', 'wh': 'son', 'kn': 'son', 'gn': 'son'}[w[:2]]
    c = w[:1]
    if c in 'pbtdkgcqj':
        return 'stop'
    if c in 'sfvzhx':
        return 'fric'
    return 'son'


def _burst(F, a, b):
    """Release burst of a stop in frames [a, b]: biggest jump out of a closure; returns (frame, rise) or None."""
    e, ehi = F['all'], F['hi']
    best, bi = -1e9, None
    for i in range(a, b + 1):
        clo = e[max(i - 10, 0):i + 1].min()                      # closure level in the 25 ms before
        rise = e[min(i + 3, len(e) - 1)] - clo
        score = rise + 0.5 * (ehi[min(i + 2, len(e) - 1)] - ehi[max(i - 2, 0)])
        if rise > 9 and score > best:
            best, bi = score, i
    if bi is None:
        return None
    clo = e[max(bi - 10, 0):bi + 1].min()
    j = bi
    while j > a and e[j - 1] > clo + 3:                          # first frame leaving the closure floor
        j -= 1
    return j


def snap(F, w, prior, first_phone, lo, hi, line_first=False):
    """Acoustic onset of word `w` near the alignment boundary `prior` (s), searched within [lo, hi].
    Returns (time, how)."""
    t, e, elo, ehi = F['t'], F['all'], F['lo'], F['hi']
    tilt = ehi - elo
    kind = first_sound(w)
    lo, hi = min(lo, prior - 0.01), max(hi, prior + 0.02)     # never an empty search window
    if line_first:            # prior = first frame out of the silence between lines (incl. pre-voicing)
        return prior, 'line'
    b = fi(F, prior)
    # inside a pause (e.g. "Every bite, | it gets worse"): the word starts where the sound comes back
    if e[b] < SIL_DB:
        j = b
        while j < fi(F, hi) and not (e[j:j + 4].min() > SIL_DB):
            j += 1
        prior, b = t[j], j
        if kind != 'stop':
            return t[j], kind + '-after-pause'
    if kind == 'stop':
        # release burst after the closure silence, inside the first phone of the alignment
        a = fi(F, max(lo, prior - 0.03))
        z = fi(F, min(hi, (first_phone[1] if first_phone else prior + 0.12) + 0.03))
        j = _burst(F, a, z)
        return (t[j], 'stop-burst') if j is not None else (prior, 'stop-nobust')
    if kind == 'son':
        # after the previous word's hiss (e.g. "adds | mashed", "stares | at", "hits | your"): the word starts
        # where the hiss stops (spectral tilt collapses, voicing comes in)
        a, z = fi(F, max(lo, prior - 0.05)), fi(F, min(hi, prior + 0.04))
        drops = [tilt[max(k - 3, 0)] - tilt[min(k + 3, len(e) - 1)] for k in range(a, z + 1)]
        k = int(np.argmax(drops))
        if drops[k] >= 10 and ehi[max(a + k - 4, 0)] > -40:
            return t[a + k], 'son-hiss-end'
    # deep energy dip just before the boundary (prosodic break, voiced fricative constriction)
    a, z = fi(F, max(lo, prior - 0.06)), fi(F, min(hi, prior + 0.015))
    i = a + int(np.argmin(e[a:z + 1]))
    left = e[max(i - 24, 0):i + 1].max(); right = e[i:i + 17].max()
    if min(left, right) - e[i] >= 8:
        j = i                       # the word starts where the energy climbs out of the dip
        while j < z and e[j + 1] < e[i] + 3:
            j += 1
        return t[j], kind + '-dip'
    if kind == 'fric':
        # start of this word's hiss: high band rises against the low band
        a, z = fi(F, max(lo, prior - 0.03)), fi(F, min(hi, prior + 0.02))
        rises = [tilt[min(k + 3, len(e) - 1)] - tilt[max(k - 3, 0)] for k in range(a, z + 1)]
        k = int(np.argmax(rises))
        if rises[k] >= 8:
            j = a + k
            while j > a and tilt[min(j + 2, len(e) - 1)] - tilt[max(j - 4, 0)] > 0.35 * rises[k]:
                j -= 1
            return min(t[j], prior), 'fric-hiss'
    # no acoustic landmark (vowel-to-vowel / l-to-l glide, e.g. "turkey | on"): the aligner puts the boundary
    # mid-transition; the new sound is already audible ~15 ms before that
    return prior - ALIGN_EARLY, kind + '-align'


# ---------------------------------------------------------------- timing
def word_onsets(x, sr, lines, words_aligned, debug=False):
    F = features(x, sr)
    edges = [line_edges(F, L) for L in lines]
    ps = ps_align(x, sr, lines, edges)
    method = 'pocketsphinx forced alignment + energy snapping' if ps else 'STT prior + energy snapping'
    out = []
    for k, L in enumerate(lines):
        ws = [w for w in words_aligned if w['line'] == L['i']]
        s0, e0 = edges[k]
        al = ps[k] if ps else None
        if al is None:            # STT prior, rescaled into the measured speech span
            a0, a1 = ws[0]['s'], ws[-1]['e']
            al = [{'s': s0 + (w['s'] - a0) / max(a1 - a0, 1e-3) * (e0 - s0),
                   'e': s0 + (w['e'] - a0) / max(a1 - a0, 1e-3) * (e0 - s0), 'ph': []} for w in ws]
        res = []
        for j, w in enumerate(ws):
            if j == 0:
                on, kind = snap(F, w['w'], s0, None, s0 - 0.01, s0 + 0.1, line_first=True)
            else:
                lo = min(res[-1]['s'] + 0.04, al[j]['s'] - 0.01)
                hi = al[j + 1]['s'] - 0.02 if j + 1 < len(ws) else e0 - 0.05
                fp = al[j]['ph'][0][1:] if al[j]['ph'] else None
                on, kind = snap(F, w['w'], al[j]['s'], fp, lo, hi)
            res.append({'w': w['w'], 's': float(on), 'prior': al[j]['s'], 'stt': w['s'], 'kind': kind,
                        'e': float(e0) if j == len(ws) - 1 else float(al[j]['e']), 'line': L['i']})
        for j in range(len(res) - 1):    # word end never after the next word's onset
            res[j]['e'] = min(res[j]['e'], res[j + 1]['s'])
        out.append(res)
    return out, method


def frame_at_or_before(t):
    """Index of the video frame on which a caption for a word starting at t appears: the frame nearest to
    t - LEAD_AIM, never after t and never more than LEAD_MAX before it."""
    k = int(np.floor((t - LEAD_AIM) * FPS + 0.5))
    while k / FPS > t + 1e-9:
        k -= 1
    while (k + 1) / FPS <= t + 1e-9 and t - k / FPS > LEAD_MAX:
        k += 1
    return k


def ass_time(k):
    """ASS timestamp for frame k (centiseconds strictly between frame k-1 and frame k: libass truncates ms)."""
    cs = max(0, int(np.floor(k * 100 / FPS - 0.2)))
    return f'{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}'


def build_chunks(lines, onsets):
    chunks = []
    for L, ws in zip(lines, onsets):
        for idx in split_line(L['text']):
            cw = [ws[i] for i in idx]
            chunks.append({'line': L['i'], 'who': L.get('who', 'N'), 'text': caption_text([w['w'] for w in cw], L.get('who', 'N')),
                           'onset': cw[0]['s'], 'last_end': cw[-1]['e'], 'words': [w['w'] for w in cw]})
    for c in chunks:      # one line only: too wide -> report (the table above keeps every chunk narrower)
        c['width'] = text_width(c['text'].replace(' ', '  '))
        if c['width'] > MAX_TEXT_W:
            raise SystemExit(f"caption too wide ({c['width']:.0f} px > {MAX_TEXT_W}): {c['text']} - use fewer words")
    for i, c in enumerate(chunks):
        c['k0'] = frame_at_or_before(c['onset'])
    for i, c in enumerate(chunks):
        hold = int(np.ceil((c['last_end'] + TAIL) * FPS))
        if i + 1 < len(chunks):
            nk = chunks[i + 1]['k0']
            c['k1'] = nk if (nk - hold) / FPS < MIN_GAP else hold
        else:
            c['k1'] = hold
        assert c['k1'] > c['k0'], c
    return chunks


# ---------------------------------------------------------------- ASS
def ass_color(rgb, a=0):
    r, g, b = rgb
    return f'&H{a:02X}{b:02X}{g:02X}{r:02X}'


def write_ass(chunks, path):
    white, dark = (255, 255, 255), (16, 12, 10)
    head = f"""[Script Info]
; Captions for the bear reel - generated by make_captions.py (do not edit by hand)
; Burn with: ffmpeg ... -vf "subtitles=audio/captions.ass:fontsdir=web/fonts"
Title: You just pooped in the forest
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{FONT_NAME},{FONT_SIZE},{ass_color(white)},{ass_color(white)},{ass_color(dark)},{ass_color(dark, 0x80)},-1,0,0,0,100,100,2,0,1,{OUTLINE},0,5,40,40,0,1
Style: Shadow,{FONT_NAME},{FONT_SIZE},{ass_color(dark, 0x70)},{ass_color(dark, 0x70)},{ass_color(dark, 0x70)},{ass_color(dark, 0xFF)},-1,0,0,0,100,100,2,0,1,{OUTLINE + 3},0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    pop = f'\\fscx{POP_FROM}\\fscy{POP_FROM}\\t(0,{POP_MS},\\fscx100\\fscy100)'
    ev = []
    for c in chunks:
        a, b = ass_time(c['k0']), ass_time(c['k1'])
        txt = c['text'].replace('{', '(').replace('}', ')').replace(' ', WORD_GAP)
        cx, cy = W // 2, CAPTION_Y
        ev.append(f"Dialogue: 0,{a},{b},Shadow,,0,0,0,,{{\\an5\\pos({cx + SHADOW_OFF},{cy + SHADOW_OFF})\\blur9{pop}}}{txt}")
        ev.append(f"Dialogue: 1,{a},{b},Caption,,0,0,0,,{{\\an5\\pos({cx},{cy}){pop}}}{txt}")
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(head + '\n'.join(ev) + '\n')


def main():
    debug = '--debug' in sys.argv
    lines = json.load(open(P('audio', 'vo_lines.json')))['lines']
    words = json.load(open(P('audio', 'voiceover.words.json')))
    x, sr = sf.read(P('audio', 'voiceover.wav'), dtype='float64', always_2d=True)
    x = x.mean(1)
    onsets, method = word_onsets(x, sr, lines, words, debug)
    chunks = build_chunks(lines, onsets)
    write_ass(chunks, OUT)
    json.dump([w for ws in onsets for w in ws], open(P('audio', 'word_onsets.json'), 'w'), indent=0, default=float)
    print(f'captions: {len(chunks)} chunks -> {os.path.relpath(OUT, HERE)}  (word onsets: {method})')
    print(f"{'start':>7} {'end':>7}  {'onset':>7} {'lead ms':>7}  text")
    for c in chunks:
        print(f"{c['k0'] / FPS:7.3f} {c['k1'] / FPS:7.3f}  {c['onset']:7.3f} {1000 * (c['onset'] - c['k0'] / FPS):7.0f}  {c['text']}")
    if debug:
        json.dump({'onsets': onsets, 'chunks': chunks}, open(os.environ.get('CAPTIONS_DEBUG', '/tmp/captions_debug.json'), 'w'), indent=1, default=float)
        for ws in onsets:
            print('  ' + '  '.join(f"{w['w']}@{w['s']:.3f}({w['kind']},ps{w['prior']:.2f})" for w in ws))


if __name__ == '__main__':
    main()
