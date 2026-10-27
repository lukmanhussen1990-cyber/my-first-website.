"""Timeline access: word / segment times from timeline.json (all scene events are keyed to the voice)."""
import json, os, re

_TL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timeline.json')))
SEG = {s['id']: s for s in _TL['segments']}
TOTAL = _TL['total']
TL = _TL


def _norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'"))


def _word(seg, key):
    ws = SEG[seg]['words']
    if isinstance(key, int):
        return ws[key]
    k = _norm(key)
    for w in ws:
        if _norm(w['w']) == k:
            return w
    raise KeyError(f'{seg}: {key}')


def w0(seg, key):
    """start time of a word"""
    return _word(seg, key)['t0']


def w1(seg, key):
    """end time of a word"""
    return _word(seg, key)['t1']


def s0(seg):
    return SEG[seg]['start']


def s1(seg):
    return SEG[seg]['end']
