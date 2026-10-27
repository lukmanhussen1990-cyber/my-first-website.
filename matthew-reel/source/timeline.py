"""Builds the global timeline: VO clip placement, word timings, caption pages."""
import json, os, re, subprocess, numpy as np
from script_data import SEGMENTS
HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, 'vo')
FPS = 30
SR = 48000
# gap (s) between the end of a segment's last word and the next segment's first word
GAPS = {
 's01':0.60,'s02':0.35,'s03':1.00,'s04':0.50,'s05':0.30,'s06':0.30,'s07':0.55,'s08':0.50,'s09':0.40,
 's10':0.50,'s11':0.50,'s12a':0.30,'s12b':0.45,'s13a':0.40,'s13b':0.60,'s14a':0.50,'s14b':0.65,'s15':1.30,
 's16':0.40,'s17':0.55,'s18':0.35,'s19':0.60,'s20':0.45,'s21a':0.40,'s21b':0.65,'s22':0.35,'s23':0.45,
}
FIRST_WORD_AT = 0.30
END_CARD = 2.0
TAIL_AFTER_LAST = 0.35

def load_audio(path):
    raw = subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def syllables(w):
    w = w.lower()
    if re.fullmatch(r'\d+', w):
        return {'400':3}.get(w, len(w))
    groups = re.findall(r'[aeiouy]+', w)
    n = max(1, len(groups) - (1 if w.endswith('e') and len(groups)>1 else 0))
    return n

def norm(w): return re.sub(r"[^a-z0-9']", '', w.lower().replace('’',"'"))

def parse_markup(markup):
    """-> list of pages; page = list of lines; line = list of (word, color)"""
    pages = []
    for ptxt in markup.split(' | '):
        lines = []
        for ltxt in ptxt.split(' / '):
            words = []
            for tok in re.findall(r'\{[grn]:[^}]*\}|\S+', ltxt):
                m = re.fullmatch(r'\{([grn]):([^}]*)\}', tok)
                if m:
                    for sub in m.group(2).split(' '):
                        words.append((sub, m.group(1)))
                else:
                    words.append((tok, None))
            lines.append(words)
        pages.append(lines)
    return pages

def build():
    t = FIRST_WORD_AT
    segs = []; all_words = []
    for i,(sid, scene, markup) in enumerate(SEGMENTS):
        d = json.load(open(os.path.join(VO, sid+'.json')))
        toks = []
        for w in d['words']:
            parts = w['w'].split()
            if len(parts) == 1:
                toks.append((parts[0], w['t'], w['d']))
            else:
                syl = [syllables(p) for p in parts]; tot = sum(syl); acc = 0
                for p, s in zip(parts, syl):
                    toks.append((p, w['t'] + w['d']*acc/tot, w['d']*s/tot)); acc += s
        audio = load_audio(os.path.join(VO, sid+'.mp3'))
        first = toks[0][1]
        clip_start = t - first
        last_end = toks[-1][1] + toks[-1][2]
        # energy-based check of onset
        env = np.sqrt(np.convolve(audio**2, np.ones(480)/480, mode='same'))
        on = np.argmax(env > 0.01) / SR
        pages = parse_markup(markup)
        flat = [(w,c,pi,li) for pi,pg in enumerate(pages) for li,ln in enumerate(pg) for (w,c) in ln]
        if len(flat) != len(toks):
            raise SystemExit(f'{sid}: {len(flat)} caption words vs {len(toks)} tokens: {[x[0] for x in flat]} {[x[0] for x in toks]}')
        words = []
        for (w,c,pi,li),(tw,ts,td) in zip(flat, toks):
            if norm(w) != norm(tw): print(f'  WARN {sid}: caption "{w}" vs tts "{tw}"')
            words.append({'w':w,'c':c,'page':pi,'line':li,'t0':clip_start+ts,'t1':clip_start+ts+td,'seg':sid,'scene':scene})
        seg = {'id':sid,'scene':scene,'clip':sid+'.mp3','clip_start':clip_start,
               'start':t,'end':clip_start+last_end,'words':words,'npages':len(pages),'onset_check':on-first,
               'audio_len':len(audio)/SR}
        segs.append(seg); all_words += words
        t = seg['end'] + GAPS.get(sid, 0.0)
    total = segs[-1]['end'] + TAIL_AFTER_LAST + END_CARD
    total = round(total*FPS)/FPS
    # caption pages: each page visible from (its first word - lead) until the next page appears
    pages = []
    for s in segs:
        for pi in range(s['npages']):
            ws = [w for w in s['words'] if w['page']==pi]
            pages.append({'seg':s['id'],'scene':s['scene'],'words':ws,'t0':ws[0]['t0'],'t1':ws[-1]['t1']})
    for i,p in enumerate(pages):
        prev_end = pages[i-1]['t1'] if i else 0.0
        lead = 0.12
        p['show'] = max(prev_end + 0.05, p['t0'] - lead) if i else 0.0
    for i,p in enumerate(pages):
        nxt = pages[i+1]['show'] if i+1 < len(pages) else segs[-1]['end'] + TAIL_AFTER_LAST
        # within a segment the page holds until the next page; at a long gap it fades a little early
        p['hide'] = min(nxt, p['t1'] + 1.6)
        if i + 1 == len(pages):
            p['hide'] = p['t1'] + 0.75   # the last line holds a moment longer, under the end-card build
    return {'segments':segs,'pages':pages,'total':total,'words':all_words}

if __name__ == '__main__':
    tl = build()
    for s in tl['segments']:
        print(f"{s['id']:5s} sc{s['scene']:2d} {s['start']:6.2f}-{s['end']:6.2f} onset_chk {s['onset_check']*1000:+5.0f}ms  " + ' '.join(f"{w['w']}@{w['t0']:.2f}" for w in s['words']))
    print('TOTAL', tl['total'])
    json.dump(tl, open(os.path.join(HERE,'timeline.json'),'w'), indent=1)
