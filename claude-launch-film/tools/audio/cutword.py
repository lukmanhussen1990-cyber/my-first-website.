# cut "Claude" from a TTS sentence (MMS forced alignment + energy refinement), and write a gen/*.json/.wav placed at the brand onset
import sys, os, json, numpy as np, soundfile as sf, soxr, torch, librosa
sys.path.insert(0,os.path.dirname(__file__)); from common import *
torch.set_num_threads(2)
from torchaudio.pipelines import MMS_FA as B
model=B.get_model(); tok=B.get_tokenizer(); al=B.get_aligner()
TXT={'o1':"meet claude an ai powered health navigation",'o2':"claude analyzes the affected area",'o3':"because the right diagnosis starts with the right direction claude"}
v,a,m=stems()
for f in sys.argv[1:]:
    name=os.path.basename(f)[:-4]; occ=name[:2]
    w,sr=sf.read(f,dtype='float64'); w=w.mean(1) if w.ndim>1 else w
    w16=soxr.resample(w,sr,16000).astype(np.float32)
    with torch.inference_mode(): em,_=model(torch.from_numpy(w16)[None])
    words=TXT[occ].split(); spans=al(em[0],tok(words)); r=len(w16)/em.shape[1]/16000
    wi=words.index('claude'); sp=spans[wi]
    cs=sp[0].start*r; ce=sp[-1].end*r
    prev_end=spans[wi-1][-1].end*r if wi>0 else 0; next_start=spans[wi+1][0].start*r if wi+1<len(words) else len(w)/sr
    # energy refine
    rms=librosa.feature.rms(y=w,frame_length=int(0.01*sr),hop_length=int(0.0025*sr))[0]; db=20*np.log10(rms+1e-9); tt=np.arange(len(db))*0.0025
    pk=db[(tt>=cs)&(tt<=ce)].max(); thr=pk-35
    i=np.searchsorted(tt,cs)
    while i>0 and tt[i]>prev_end+0.02 and db[i-1]>thr: i-=1
    st=tt[i]
    k=np.searchsorted(tt,ce)
    lim=next_start-0.01 if occ!='o2' else next_start-0.03
    while k<len(db)-1 and tt[k]<lim and db[k+1]>thr: k+=1
    en=tt[k]+0.01
    word=w[int(st*sr):int(en*sr)].copy()
    n=int(0.004*sr); word[:n]*=np.linspace(0,1,n); n2=int(0.012*sr); word[-n2:]*=np.linspace(1,0,n2)
    # loudness match to original word (active-region power)
    s,e=OCC[occ]['span']; o=v[int(s*SR):int(e*SR)].mean(1)
    def act_pow(x):
        r_=librosa.feature.rms(y=x,frame_length=1024,hop_length=256)[0]; return np.mean(r_[r_>r_.max()*0.1]**2)
    word*=np.sqrt(act_pow(o)/act_pow(word))
    # onset alignment: the original word's onset (first strong energy) vs span start
    ro=librosa.feature.rms(y=o,frame_length=441,hop_length=110)[0]; on=np.argmax(20*np.log10(ro+1e-9)>20*np.log10(ro.max())-30)*110/SR
    c0=s-0.2; c1=e+0.5
    pre=soxr.resample(v[int(c0*SR):int(c1*SR)].mean(1),SR,sr)
    sfr=int(round((s-c0)*sr)); efr=int(round((e-c0)*sr))
    lead=int(round(on*sr))  # place word so its onset matches original onset
    wl=min(len(word), efr-sfr-lead)
    out=np.concatenate([pre[:sfr],np.zeros(lead),word[:wl],pre[efr:]])
    dur_frames=lead+wl
    os.makedirs(f'{D}/gen',exist_ok=True)
    sf.write(f'{D}/gen/{name}.wav',out,sr,subtype='FLOAT')
    json.dump(dict(name=name,clip=[c0,c1],span=[s,e],start_frame=sfr,dur_frames=dur_frames,hop=1,sr=sr,cut=[st,en],truncated=len(word)>wl),open(f'{D}/gen/{name}.json','w'))
    print(name,'cut',round(st,3),round(en,3),'len',round(len(word)/sr,3),'span',round(e-s,3),'trunc',len(word)>wl,flush=True)
