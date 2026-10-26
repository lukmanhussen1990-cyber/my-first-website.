#!/usr/bin/env python3
"""Build src/timeline.json from tools/script.json and the voice line files.

Real durations come from audio/voice/lines/index.json (written by ingest_voice.py).
Lines without audio get an estimated duration, so the whole video can be built
before the voice arrives. Caption chunks are laid out with the real Montserrat
ExtraBold metrics so no caption ever needs more than 2 lines.
"""
import json, os, re, sys
from PIL import ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = json.load(open(os.path.join(ROOT, 'tools', 'script.json')))
INDEX_PATH = os.path.join(ROOT, 'audio', 'voice', 'lines', 'index.json')
INDEX = json.load(open(INDEX_PATH)) if os.path.exists(INDEX_PATH) else {}

FONT_PATH = os.path.join(ROOT, 'assets', 'fonts', 'Montserrat-ExtraBold.ttf')
CAP_SIZES = [60, 58, 56, 54, 52]  # "about 60px": long lines shrink a little before they are ever split
FONTS = {sz: ImageFont.truetype(FONT_PATH, sz) for sz in CAP_SIZES}
CAP_MAX_W = 860          # px; caption block centered at x=490 -> 60px left margin, 160px right margin
LEAD_IN = 0.12           # s before the first line of a scene

SPOKEN = {'40': 'forty', '1950': 'nineteen fifty', '31': 'thirty one', '32': 'thirty two'}


def syllables(word):
    w = SPOKEN.get(word, word).lower()
    total = 0
    for part in w.split():
        part = re.sub(r'[^a-z]', '', part)
        if not part:
            continue
        groups = re.findall(r'[aeiouy]+', part)
        n = len(groups)
        if part.endswith('e') and n > 1 and not part.endswith('le'):
            n -= 1
        total += max(1, n)
    return total


def tokens(text):
    return re.findall(r"\S+", text)


def estimate_words(text, rate=5.3):
    """Estimated word timings (s) for a line, relative to line start."""
    t = 0.06
    out = []
    for tok in tokens(text):
        core = re.sub(r"[^\w']", '', tok)
        d = syllables(core) / rate + 0.05
        out.append({'w': tok, 's': round(t, 3), 'e': round(t + d, 3)})
        t += d
        if tok.endswith('...'):
            t += 0.45
        elif tok.endswith(('.', '?', '!')):
            t += 0.25
        elif tok.endswith(','):
            t += 0.1
    return out, t + 0.08


def fit_words(words, dur):
    """Scale estimated word timings to a real line duration."""
    if not words:
        return words
    end = words[-1]['e']
    k = (dur - 0.08) / max(end, 1e-3)
    return [{'w': w['w'], 's': round(w['s'] * k, 3), 'e': round(w['e'] * k, 3)} for w in words]


def text_w(s, size=60):
    return FONTS[size].getlength(s)


def layout(toks):
    """Largest size (60..52) at which the tokens fit in <=2 balanced lines -> (size, lines) or None."""
    full = ' '.join(toks)
    for size in CAP_SIZES:
        if text_w(full, size) <= CAP_MAX_W and size == CAP_SIZES[0]:
            return size, [full]
        best = None
        for i in range(1, len(toks)):
            l1, l2 = ' '.join(toks[:i]), ' '.join(toks[i:])
            w1, w2 = text_w(l1, size), text_w(l2, size)
            if max(w1, w2) > CAP_MAX_W:
                continue
            score = abs(w1 - w2)
            if re.search(r'[,.;:!?]$', toks[i - 1]):
                score -= 120
            if i == 1 or i == len(toks) - 1:
                score += 300
            if best is None or score < best[0]:
                best = (score, [l1, l2])
        if best:
            return size, best[1]
    return None


def split_caption(toks):
    """Token ranges, each of which fits in <= 2 lines (split only when shrinking is not enough)."""
    if layout(toks):
        return [(0, len(toks))]
    best = None
    for i in range(1, len(toks)):
        la, lb = layout(toks[:i]), layout(toks[i:])
        if not la or not lb:
            continue
        score = abs(text_w(' '.join(toks[:i])) - text_w(' '.join(toks[i:]))) - 60 * (la[0] + lb[0] - 104)
        if re.search(r'[,.;:!?]$', toks[i - 1]):
            score -= 1500
        if best is None or score < best[0]:
            best = (score, i)
    if best is None:
        mid = len(toks) // 2
        return split_caption(toks[:mid]) + [(mid + s, mid + e) for s, e in split_caption(toks[mid:])]
    i = best[1]
    return [(0, i), (i, len(toks))]


def main():
    fps = SCRIPT['fps']
    t = 0.0
    scenes = []
    for sc in SCRIPT['scenes']:
        start = t
        lines = []
        cur = start + LEAD_IN
        for k, ln in enumerate(sc['lines']):
            part = ln.get('part', sc['part'])
            key = part if ln.get('part') else f"{part}_{sum(1 for x in sc['lines'][:k] if not x.get('part')) + 1}"
            est_words, est_dur = estimate_words(ln['text'])
            info = INDEX.get(key)
            if info:
                dur = info['duration']
                words = info.get('words') or fit_words(est_words, dur)
                audio = info['file']
            else:
                dur, words, audio = est_dur, est_words, None
            if k > 0:
                cur += ln.get('gapBefore', SCRIPT['lineGap'])
            line = {
                'key': key, 'text': ln['text'], 'red': ln.get('red', []),
                'speaker': ln.get('speaker', 'narrator'), 'audio': audio, 'estimated': info is None,
                'start': round(cur, 3), 'end': round(cur + dur, 3), 'dur': round(dur, 3),
                'words': [{'w': w['w'], 's': round(cur + w['s'], 3), 'e': round(cur + w['e'], 3)} for w in words],
            }
            if ln.get('hitWord'):
                hw = [w for w in line['words'] if re.sub(r"[^\w]", '', w['w']).lower() == ln['hitWord']]
                line['hit'] = hw[-1]['s'] if hw else line['end'] - 0.3
            lines.append(line)
            cur += dur
        if sc.get('fixed'):
            end = start + sc['fixed']
        else:
            end = cur + SCRIPT['sceneTail'] - LEAD_IN + sc.get('extraTail', 0.0)
        # snap scene boundaries to whole frames
        end = round(end * fps) / fps
        captions = []
        for li, line in enumerate(lines):
            toks = tokens(line['text'])
            ranges = split_caption(toks)
            for ri, (a, b) in enumerate(ranges):
                cs = line['start'] if ri == 0 else line['words'][a]['s'] - 0.05
                if ri + 1 < len(ranges):
                    ce = line['words'][ranges[ri + 1][0]]['s'] - 0.05
                elif li + 1 < len(lines):
                    ce = lines[li + 1]['start']
                else:
                    ce = min(end - 0.05, line['end'] + 0.45)
                chunk = ' '.join(toks[a:b])
                size, clines = layout(toks[a:b])
                captions.append({'text': chunk, 'red': line['red'], 'start': round(cs, 3), 'end': round(ce, 3),
                                 'size': size, 'lines': clines})
        scenes.append({'id': sc['id'], 'name': sc['name'], 'label': sc['label'], 'battery': sc['battery'],
                       'start': round(start, 4), 'end': round(end, 4), 'lines': lines, 'captions': captions})
        t = end
    out = {'fps': fps, 'duration': round(t, 4), 'frames': int(round(t * fps)), 'scenes': scenes,
           'estimated': any(l['estimated'] for s in scenes for l in s['lines'])}
    with open(os.path.join(ROOT, 'src', 'timeline.json'), 'w') as f:
        json.dump(out, f, indent=1)
    print(f"timeline: {out['duration']:.2f}s, {out['frames']} frames, estimated={out['estimated']}")
    for s in scenes:
        print(f"  scene {s['id']:2d} {s['name']:<14} {s['start']:7.2f} -> {s['end']:7.2f}  ({s['end'] - s['start']:.2f}s)"
              f"  captions={len(s['captions'])}")
        for c in s['captions']:
            if len(c['lines']) > 2:
                print('   !! caption over 2 lines:', c['text'])


if __name__ == '__main__':
    main()
