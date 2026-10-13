import sys, os, json, numpy as np, soundfile as sf
sys.path.insert(0,os.path.dirname(__file__)); from common import *
cfg=json.load(open(sys.argv[1])); out=sys.argv[2]
orig_i,_=sf.read(f'{D}/../src/ref_audio.wav',dtype='int16')
v,a,m=stems()
res=orig_i.copy(); wins=[]
for c in cfg:
    newv,(w0,w1)=build_vocal(c['name'],c['name'][:2],**c.get('kw',{}))
    delta=(newv-v)[w0:w1]
    mixf=orig_i[w0:w1].astype(np.float64)+delta*32768.0
    peak=np.abs(mixf).max()
    res[w0:w1]=np.clip(np.round(mixf),-32768,32767).astype(np.int16)
    wins.append(dict(name=c['name'],w0=int(w0),w1=int(w1),t0=w0/SR,t1=w1/SR,peak_dbfs=round(20*np.log10(peak/32768),2)))
sf.write(out,res,SR,subtype='PCM_16')
json.dump(wins,open(out.replace('.wav','_windows.json'),'w'),indent=1)
print(json.dumps(wins,indent=1))
