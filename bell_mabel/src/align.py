"""Align the exact caption script (romanised Hindi) to whisper word timestamps.

Whisper is used ONLY for timing. Caption text always comes from SCRIPT.
Usage: python align.py whisper.json env_db.npy out_words.json
"""
import json
import re
import sys
from difflib import SequenceMatcher

import numpy as np

SCRIPT = """PHONE PAR BOLA GAYA YE "HELLO", KISI KE AISE PYAAR SE SHURU HUA, JO KABHI SUN HI NAHI SAKTI THI.
BOSTON MEIN EK TEACHER THA, JO BEHRE BACHCHON KO BOLNA SIKHATA THA. USKI APNI MAA BHI SUN NAHI PAATI THI.
EK DIN USKE PAAS EK NAYI STUDENT AAYI. NAAM THA MABEL. SIRF PAANCH SAAL KI UMAR MEIN EK BEEMARI NE USKE SUNNE KI TAAKAT CHHEEN LI THI.
WOH USKE HOTHON KO PADHTI THI. AUR WOH, USKI AANKHON KO.
DHEERE-DHEERE TEACHER KO USSE PYAAR HO GAYA.
PAR MABEL KE PITA NE SAAF KEH DIYA: "PEHLE KUCH BANKAR DIKHAO."
TOH WOH DIN-RAAT LAG GAYA. RAAT BHAR TAARON, CHUMBAKON AUR AAWAAZ KE SAATH KAAM KARTA.
WOH CHAHTA THA KI AAWAAZ EK TAAR SE DOOR TAK PAHUNCH SAKE.
AUR PHIR, 1876 MEIN, TAAR KE US PAAR SE PEHLI BAAR EK INSAAN KI AAWAAZ AAYI.
DUNIYA NE PEHLA PHONE CALL SUNA.
EK SAAL BAAD, USNE MABEL SE SHAADI KI. AUR SHAADI KE TOHFE MEIN, APNI COMPANY KE LAGBHAG SAARE SHARES USI KE NAAM KAR DIYE.
JIS LADKI KE LIYE USNE AAWAAZ KO DOOR TAK PAHUNCHAYA, WAHI LADKI KABHI PHONE KI GHANTI NAHI SUN PAAYI.
SAALON BAAD, JAB USKI MAUT HUI, TOH USKE SAMMAAN MEIN POORE AMERICA KE PHONE EK MINUTE KE LIYE KHAMOSH KAR DIYE GAYE.
AUR SIRF PAANCH MAHINE BAAD, MABEL BHI CHALI GAYI.
IS TEACHER KA NAAM THA... ALEXANDER GRAHAM BELL.
JISNE POORI DUNIYA KO AAWAAZ DI, EK AISI LADKI KE PYAAR MEIN, JO KHUD KABHI SUN NAHI SAKTI THI."""

# ---------------------------------------------------------------- Devanagari
CONS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh',
    'फ़': 'f', 'य़': 'y',
}
NUKTA_MAP = {'क': 'k', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f'}
VOW = {'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai',
       'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e'}
MATRA = {'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o',
         'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e'}
VIRAMA = '्'
NUKTA = '़'


def deva_to_latin(s):
    out = []
    i = 0
    s = s.strip()
    while i < len(s):
        ch = s[i]
        if ch in CONS:
            base = CONS[ch]
            if i + 1 < len(s) and s[i + 1] == NUKTA:
                base = NUKTA_MAP.get(ch, base)
                i += 1
            nxt = s[i + 1] if i + 1 < len(s) else ''
            if nxt in MATRA:
                out.append(base + MATRA[nxt])
                i += 2
                continue
            if nxt == VIRAMA:
                out.append(base)
                i += 2
                continue
            out.append(base + 'a')
            i += 1
            continue
        if ch in VOW:
            out.append(VOW[ch])
        elif ch in 'ंँ':
            out.append('n')
        elif ch == 'ः':
            out.append('h')
        elif ch.isascii() and ch.isalnum():
            out.append(ch.lower())
        i += 1
    w = ''.join(out)
    # schwa deletion at word end (approx.)
    if len(w) > 2 and w.endswith('a') and not w.endswith('aa'):
        w = w[:-1]
    return w


def key(word):
    """crude phonetic skeleton for fuzzy matching"""
    w = word.lower()
    w = re.sub(r'[^a-z0-9]', '', w)
    if w.isdigit():
        return w
    reps = [('chh', 'c'), ('ch', 'c'), ('ph', 'f'), ('kh', 'k'), ('gh', 'g'), ('jh', 'j'), ('th', 't'),
            ('dh', 'd'), ('bh', 'b'), ('sh', 's'), ('w', 'v'), ('z', 'j'), ('q', 'k'), ('c', 'k'), ('x', 'ks')]
    for a, b in reps:
        w = w.replace(a, b)
    # 'c' from ch was converted to k by the c->k rule above; keep distinct marker
    w = re.sub(r'(.)\1+', r'\1', w)
    if not w:
        return w
    head = w[0]
    rest = re.sub(r'[aeiouy]', '', w[1:])
    rest = rest.replace('h', '')
    return head + rest


def sim(a, b):
    ka, kb = key(a), key(b)
    if not ka or not kb:
        return 0.0
    if ka == kb:
        return 1.0
    return SequenceMatcher(None, ka, kb).ratio()


def script_words():
    toks = SCRIPT.split()
    words = []
    for line_i, line in enumerate(SCRIPT.split('\n')):
        for t in line.split():
            words.append({'text': t, 'line': line_i})
    assert len(words) == len(toks)
    return words


def clean(t):
    return re.sub(r'[^A-Za-z0-9-]', '', t)


def align(sw, ww):
    """DP alignment of script words sw (list of str) to whisper words ww (list of str).
    returns list mapping script index -> list of whisper indices"""
    n, m = len(sw), len(ww)
    NEG = -1e9
    dp = np.full((n + 1, m + 1), NEG)
    bp = {}
    dp[0, 0] = 0
    skip_s, skip_w = -0.45, -0.35
    for i in range(n + 1):
        for j in range(m + 1):
            cur = dp[i, j]
            if cur <= NEG / 2:
                continue
            # 1:1
            if i < n and j < m:
                v = cur + sim(sw[i], ww[j]) * 1.0 - 0.15
                if v > dp[i + 1, j + 1]:
                    dp[i + 1, j + 1] = v
                    bp[(i + 1, j + 1)] = (i, j, '11')
            # 1 script : 2 whisper
            if i < n and j + 1 < m:
                v = cur + sim(sw[i], ww[j] + ww[j + 1]) * 1.6 - 0.45
                if v > dp[i + 1, j + 2]:
                    dp[i + 1, j + 2] = v
                    bp[(i + 1, j + 2)] = (i, j, '12')
            # 2 script : 1 whisper
            if i + 1 < n and j < m:
                v = cur + sim(sw[i] + sw[i + 1], ww[j]) * 1.6 - 0.45
                if v > dp[i + 2, j + 1]:
                    dp[i + 2, j + 1] = v
                    bp[(i + 2, j + 1)] = (i, j, '21')
            if i < n:
                v = cur + skip_s
                if v > dp[i + 1, j]:
                    dp[i + 1, j] = v
                    bp[(i + 1, j)] = (i, j, 's')
            if j < m:
                v = cur + skip_w
                if v > dp[i, j + 1]:
                    dp[i, j + 1] = v
                    bp[(i, j + 1)] = (i, j, 'w')
    # backtrack
    i, j = n, m
    mapping = [[] for _ in range(n)]
    ops = []
    while (i, j) != (0, 0):
        pi, pj, op = bp[(i, j)]
        ops.append((pi, pj, op))
        if op == '11':
            mapping[pi].append(pj)
        elif op == '12':
            mapping[pi] += [pj, pj + 1]
        elif op == '21':
            mapping[pi].append(pj)
            mapping[pi + 1].append(pj)
            mapping[pi + 1].append(-1)  # marker: shares whisper word with previous
        i, j = pi, pj
    return mapping


def main():
    wj, envp, outp = sys.argv[1], sys.argv[2], sys.argv[3]
    segs = json.load(open(wj))
    ww = []
    for s in segs:
        for w in s['words']:
            txt = w['w'].strip()
            txt = re.sub(r'[।,.!?"\'“”]', '', txt)
            if not txt:
                continue
            ww.append({'deva': txt, 'lat': deva_to_latin(txt), 's': w['s'], 'e': w['e'], 'p': w['p']})
    sw = script_words()
    mapping = align([clean(w['text']) for w in sw], [w['lat'] for w in ww])
    env = np.load(envp)  # 10ms frames dB
    thr = env.max() - 38

    out = []
    for i, w in enumerate(sw):
        idx = [k for k in mapping[i] if k >= 0]
        shared = -1 in mapping[i]
        rec = dict(w)
        if idx:
            s = min(ww[k]['s'] for k in idx)
            e = max(ww[k]['e'] for k in idx)
            rec['wh'] = ' '.join(ww[k]['deva'] for k in idx)
            rec['lat'] = ' '.join(ww[k]['lat'] for k in idx)
            rec['s'], rec['e'] = s, e
            rec['shared'] = shared
            rec['sim'] = round(sim(clean(w['text']), ''.join(ww[k]['lat'] for k in idx)), 2)
        else:
            rec['s'] = rec['e'] = None
        out.append(rec)
    # words sharing a whisper word with previous: split the span proportionally to letters
    i = 0
    while i < len(out):
        if out[i].get('shared'):
            a = out[i - 1]
            b = out[i]
            s, e = a['s'], a['e']
            la, lb = len(clean(a['text'])), len(clean(b['text']))
            mid = s + (e - s) * la / (la + lb)
            a['e'] = mid
            b['s'] = mid
            b['e'] = e
        i += 1
    # interpolate missing
    for i, r in enumerate(out):
        if r['s'] is None:
            prev = next((out[k] for k in range(i - 1, -1, -1) if out[k]['s'] is not None), None)
            nxt = next((out[k] for k in range(i + 1, len(out)) if out[k]['s'] is not None), None)
            ps = prev['e'] if prev else 0.0
            ns = nxt['s'] if nxt else ps + 0.4
            r['s'], r['e'] = ps, max(ps + 0.05, ns)
            r['interp'] = True

    # onset refinement (perceived word onset):
    #  1) whisper often lets a word's span swallow the pause before it -> if a
    #     >=100 ms silence sits in the first half of the span, start after it.
    #  2) otherwise, if a silence->speech onset lies just before the whisper
    #     start (and after the previous word's start), use that onset.
    def sil(k):
        return k < 0 or k >= len(env) or env[k] < thr

    prev_s = -1.0
    for r in out:
        s, e = r['s'], r['e']
        k0, k1 = int(round(s * 100)), int(round(e * 100))
        limit = k0 + max(3, int((k1 - k0) * 0.5))
        k = k0
        best = None
        while k < limit:
            if sil(k):
                j = k
                while j < k1 and sil(j):
                    j += 1
                if j - k >= 10 and j < k1 - 4:
                    best = j
                k = j
            else:
                k += 1
        if best is None:
            for k in range(k0, max(1, k0 - 20), -1):
                if sil(k - 1) and not sil(k) and all(sil(q) for q in range(max(0, k - 12), k)):
                    if k / 100.0 > prev_s + 0.12:
                        best = k
                    break
        if best is not None:
            r['s_raw'] = s
            s = best / 100.0
        r['s'] = s
        prev_s = s
    # monotonic + minimal gap
    for i in range(1, len(out)):
        if out[i]['s'] < out[i - 1]['s'] + 0.04:
            out[i]['s'] = out[i - 1]['s'] + 0.04
    for i, r in enumerate(out):
        r['s'] = round(r['s'], 3)
        r['e'] = round(max(r['e'], r['s'] + 0.05), 3)
    json.dump(out, open(outp, 'w'), ensure_ascii=False, indent=1)
    for i, r in enumerate(out):
        flag = ' INTERP' if r.get('interp') else ''
        print(f"{i:3d} {r['s']:7.2f} {r['e']:7.2f}  {r['text']:<14} {r.get('wh', ''):<16} {r.get('lat', ''):<14} {r.get('sim', '')}{flag}")


if __name__ == '__main__':
    main()
