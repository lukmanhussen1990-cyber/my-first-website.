import sys, os, json, numpy as np, soxr, librosa, torch
sys.path.insert(0,os.path.dirname(__file__))
from common import *
torch.set_num_threads(2)
from speechbrain.inference.speaker import EncoderClassifier
enc=EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb",savedir=f"{D}/work/ecapa",run_opts={"device":"cpu"})
from faster_whisper import WhisperModel
wm=WhisperModel(os.environ.get('WM','small'),device='cpu',compute_type='int8',cpu_threads=2)
v,a,m=stems()
def to16(x): 
    x=x.mean(1) if x.ndim>1 else x
    return soxr.resample(x,SR,16000).astype(np.float32)
def emb(x16):
    with torch.no_grad(): e=enc.encode_batch(torch.from_numpy(x16)[None])[0,0].numpy()
    return e/np.linalg.norm(e)
# narrator reference: all vocal speech outside brand windows
refsegs=[(2.6,9.3),(11.1,23.2),(24.7,41.9)]
ref=emb(np.concatenate([to16(v[int(a_*SR):int(b_*SR)]) for a_,b_ in refsegs]))
def wordstats(x, lab):
    x16=to16(x); e=emb(x16); cs=float(e@ref)
    xm=x.mean(1) if x.ndim>1 else x
    rms=librosa.feature.rms(y=xm,frame_length=1024,hop_length=256)[0]; db=20*np.log10(rms+1e-9)
    act=db>db.max()-25; idx=np.where(act)[0]
    dur=(idx[-1]-idx[0]+1)*256/SR if len(idx) else 0
    import parselmouth
    pt=parselmouth.Sound(xm,SR).to_pitch_ac(time_step=0.01,pitch_floor=60,pitch_ceiling=300)
    f0=pt.selected_array['frequency']; f0v=f0[f0>0]
    loud=10*np.log10((xm**2)[int(idx[0]*256):int((idx[-1]+1)*256)].mean()+1e-12) if len(idx) else -99
    return dict(lab=lab,spk=round(cs,3),dur=round(dur,3),f0_med=round(float(np.median(f0v)),1) if len(f0v) else None,
                f0_start=round(float(np.median(f0v[:5])),1) if len(f0v) else None, f0_end=round(float(np.median(f0v[-5:])),1) if len(f0v) else None,
                loud=round(loud,1))
def transcribe(x16):
    segs,_=wm.transcribe(x16,language='en',beam_size=5,word_timestamps=True,condition_on_previous_text=False)
    return ' '.join(w.word.strip()+f"[{w.start:.2f}]" for s in segs for w in s.words)
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='refs':
        # narrator own words (from vocal-stem alignment) for speaker-sim baseline
        words=[(4.56,4.95,'doctor'),(9.55,9.82,'meet'),(16.80,17.30,'search'),(18.30,18.72,'describe'),(18.94,19.45,'symptoms'),(20.88,21.34,'pinpoint'),(22.6,23.0,'occurs'),(37.9,38.5,'outcome'),(39.72,40.30,'diagnosis'),(41.36,41.80,'direction'),(32.2,32.82,'then'),(33.55,34.2,'specialist')]
        out=[wordstats(v[int(s*SR):int(e*SR)],l) for s,e,l in words]
        for k,o in OCC.items():
            s,e=o['span']; out.append(wordstats(v[int(s*SR):int(e*SR)],'ORIG_'+k))
        for r in out: print(r)
        json.dump(out,open(f'{D}/work/refstats.json','w'))
    else:
        res=[]
        for name in sys.argv[2:]:
            occ=name[:2]; kw=json.loads(os.environ.get('BV','{}'))
            newv,(w0,w1)=build_vocal(name,occ,**kw)
            w44,st,du,j=load_gen(name)
            s,e=OCC[occ]['span']
            word=newv[int(st*SR):int((st+du)*SR)]
            r=wordstats(word,name)
            p0,p1=OCC[occ]['phrase']
            r['asr_voc']=transcribe(to16(newv[int(p0*SR):int(p1*SR)]))
            r['asr_mix']=transcribe(to16(a[int(p0*SR):int(p1*SR)]+newv[int(p0*SR):int(p1*SR)]))
            print(json.dumps(r),flush=True); res.append(r)
