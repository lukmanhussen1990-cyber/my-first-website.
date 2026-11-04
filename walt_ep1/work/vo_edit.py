# Tighten pauses in the uploaded voiceover and remap word timings.
import json, re, subprocess, numpy as np
SR = 44100
LEAD = 0.15
raw = subprocess.run(['ffmpeg','-v','error','-i','../assets/el_voice/take1.mp3','-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
a = np.frombuffer(raw, dtype=np.float32).copy()
dur = len(a)/SR
toks = open('vo_silence.txt').read().split('\n')
sil=[]; cur=None
for t in toks:
    if not t: continue
    k,v = t.split(': '); v=float(v)
    if k=='silence_start': cur=v
    else:
        if cur is not None: sil.append((cur,v))
        cur=None
words = [w for s in json.load(open('vo_words.json')) for w in s['words']]
POLL_START = words[202]['s']
# pauses right BEFORE these word indices are comedic beats -> keep them longer
BEATS = {34:0.5, 41:0.55, 66:0.55, 78:0.45, 91:0.55, 117:0.5, 119:0.45, 140:0.5, 150:0.4, 155:0.4, 174:0.6, 199:0.6, 70:0.35, 96:0.35, 144:0.4, 159:0.4, 89:0.4}
def word_after(t):
    for i,w in enumerate(words):
        if w['s'] >= t-0.12: return i
    return None
segs=[]  # list of (src_start, src_end) to keep
pos=0.0
plan=[]
for (s,e) in sil:
    D=e-s
    if D<0.18: continue
    wi = word_after(e)
    if s >= POLL_START-0.3:
        new = min(D, 0.15+0.8*(D-0.15))
    elif wi in BEATS:
        new = min(D, BEATS[wi])
    else:
        new = min(D, 0.17+0.3*(D-0.17))
    cut = D-new
    if cut < 0.03: continue
    # remove the middle of the silence
    cs = s + new/2; ce = cs + cut
    plan.append((cs,ce,wi))
# build keep segments
keep=[]; p=0.0
for cs,ce,wi in plan:
    keep.append((p,cs)); p=ce
keep.append((p,dur))
# assemble with 8ms crossfades
fade=int(0.008*SR)
out=[np.zeros(int(LEAD*SR),dtype=np.float32)]
for i,(s0,e0) in enumerate(keep):
    seg=a[int(s0*SR):int(e0*SR)].copy()
    if i>0: seg[:fade]*=np.linspace(0,1,fade)
    if i<len(keep)-1: seg[-fade:]*=np.linspace(1,0,fade)
    out.append(seg)
o=np.concatenate(out)
# time map src->dst
def remap(t):
    shift=0.0
    for cs,ce,wi in plan:
        if t>=ce: shift+=ce-cs
        elif t>cs: return cs-shift+LEAD
    return t-shift+LEAD
nw=[{'i':i,'w':w['w'].strip(),'s':round(remap(w['s']),3),'e':round(remap(w['e']),3)} for i,w in enumerate(words)]
o.astype(np.float32).tofile('vo_tight.f32')
json.dump(nw, open('words_tight.json','w'), indent=0)
print('cuts',len(plan),'removed %.2fs'%sum(ce-cs for cs,ce,_ in plan),'new len %.2f'%(len(o)/SR))
print('poll starts at %.2f, VO ends %.2f'%(nw[213]['s'], nw[-1]['e']))
