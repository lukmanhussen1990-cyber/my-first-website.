import numpy as np, soundfile as sf, soxr, json, os
D='/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/audio'
SR=44100
_v=None
def stems():
    global _v
    if _v is None:
        v,_=sf.read(f'{D}/vocals_htdemucs_ft.wav',dtype='float64'); a,_=sf.read(f'{D}/accomp_htdemucs_ft.wav',dtype='float64')
        m,_=sf.read(f'{D}/../src/ref_audio.wav',dtype='float64')
        _v=(v,a,m)
    return _v
OCC={'o1':dict(span=[10.20,10.90],phrase=[9.3,14.6]),
     'o2':dict(span=[24.12,24.55],phrase=[23.85,25.98]),
     'o3':dict(span=[42.38,43.05],phrase=[41.0,43.6])}
def load_gen(name):
    """return generated word (mono, 44.1k), aligned so index 0 = span start; plus full gen and meta"""
    j=json.load(open(f'{D}/gen/{name}.json')); w,sr=sf.read(f'{D}/gen/{name}.wav',dtype='float64')
    w44=soxr.resample(w,sr,SR)
    st=j['start_frame']*j['hop']/sr; du=j['dur_frames']*j['hop']/sr
    return w44, st, du, j
def eqp(n):
    t=np.linspace(0,1,n); return np.sin(t*np.pi/2)  # fade-in gain, equal power
def gen_track(name, t0, t1):
    """generated vocal mapped onto absolute timeline [t0,t1) at 44.1k (mono), using F5 frame grid."""
    j=json.load(open(f'{D}/gen/{name}.json')); w,sr=sf.read(f'{D}/gen/{name}.wav',dtype='float64')
    hop=j['hop']; c0=j['clip'][0]; sf_=j['start_frame']; df=j['dur_frames']
    a_,b_=j['clip']; ef=sf_+round(((j['span'][1]-j['span'][0]) )*sr/hop) if 'end_frame' not in j else j['end_frame']
    ef=round((j['span'][1]-a_)*sr/hop)
    s_abs=c0+sf_*hop/sr; e_abs=c0+ef*hop/sr; du=df*hop/sr
    t=t0+np.arange(int(round((t1-t0)*SR)))/SR
    out=np.zeros_like(t)
    m1=t< s_abs+du; idx=(t[m1]-c0)*sr
    out[m1]=np.interp(idx,np.arange(len(w)),w)
    m2=t>=e_abs; idx=(t[m2]-e_abs)*sr+(sf_+df)*hop
    out[m2]=np.interp(idx,np.arange(len(w)),w)
    # silence gap (if any) gets a 5 ms fade from word end
    return out, s_abs, s_abs+du, e_abs
def build_vocal(name, occ, xf_in=0.02, xf_out=0.02, gain_db=0.0, pre=0.0, post=0.0, hf=None, gate_lead=True, shift=0.0, align_onset=False, align_onset_bias=0.0, gen_onset=None, word_end=None):
    """new vocal (N,2): original outside; inside [s-pre-xf_in, e+post+xf_out] generated; equal-power crossfades.
       gain applied only to the word part [s_abs, word_end]."""
    v,a,m=stems()
    j=json.load(open(f'{D}/gen/{name}.json'))
    s,e=j['span']
    t0=s-pre-xf_in; t1=e+post+xf_out
    T,s_abs,wend,e_abs=gen_track(name,t0,t1)
    t=t0+np.arange(len(T))/SR
    g=np.ones_like(T); gl=10**(gain_db/20)
    rr=int(0.01*SR)
    ramp=np.clip((t-(s_abs-0.01))/0.01,0,1)*np.clip(((wend+0.01)-t)/0.01,0,1)
    g=1+(gl-1)*ramp
    T=T*g
    if wend<e_abs:  # silence gap
        gap=(t>=wend)&(t<e_abs); T[gap]=0
    if gate_lead or shift or align_onset:
        # find generated word onset (first 5ms frame within 35 dB of word peak) and silence the lead-in before it
        wm_=(t>=s_abs)&(t<wend); idx=np.where(wm_)[0]
        fr=int(0.005*SR); env=np.array([np.abs(T[k:k+fr]).max() for k in range(idx[0],idx[-1],fr)])
        thr=env.max()*10**(-35/20); k0=idx[0]+np.argmax(env>thr)*fr
        if gen_onset is not None: k0=int(round((gen_onset-t0)*SR))
        k0=max(idx[0],k0-int(0.010*SR))   # keep 10 ms before onset
        lead=np.zeros_like(T); lead[k0:]=1; r=int(0.004*SR); lead[k0:k0+r]=np.linspace(0,1,r)
        lead[:idx[0]]=1  # before the span: keep (crossfade zone)
        T=T*lead
        self_onset=t[k0]
        if align_onset:
            # original onset in the vocal stem (first 5 ms frame within 30 dB of the word peak)
            vo=v[int(round(t0*SR)):int(round(t0*SR))+len(T)].mean(1)
            oi=np.where((t>=s)&(t<e))[0]
            envo=np.array([np.abs(vo[k:k+fr]).max() for k in range(oi[0],oi[-1],fr)])
            on_o=t[oi[0]+np.argmax(envo>envo.max()*10**(-30/20))*fr]
            env2=np.array([np.abs(T[k:k+fr]).max() for k in range(idx[0],idx[-1],fr)])
            on_g=t[idx[0]+np.argmax(env2>env2.max()*10**(-30/20))*fr] if gen_onset is None else gen_onset
            shift=on_o-on_g+align_onset_bias
            self_onsets=(on_o,on_g); print(f'  onset orig {on_o:.3f} gen {on_g:.3f} shift {shift*1000:.0f} ms',flush=True)
        if shift:
            n=int(round(shift*SR))
            if n<0:
                W=np.zeros_like(T); a0=k0; a1=idx[-1]+1 if word_end is None else int(round((word_end-t0)*SR))
                seg=T[a0:a1].copy(); dst=a0+n
                f=int(0.012*SR)
                fo_=np.ones(len(seg)); fo_[len(seg)-f:]=np.linspace(1,0,f)
                W[dst:dst+len(seg)]=seg*fo_
                cont=np.zeros_like(T); cont[a1:]=T[a1:]; fi=int(0.010*SR)
                cont[a1:a1+fi]*=np.linspace(0,1,fi)
                T=W+cont
    w0=int(round(t0*SR)); L=len(T); w1=w0+L
    nin=int(round(xf_in*SR)); nout=int(round(xf_out*SR))
    fade=np.ones(L); fade[:nin]=eqp(nin); fade[L-nout:]=eqp(nout)[::-1]
    fo=np.sqrt(np.clip(1-fade**2,0,1))
    s0=int(round(s*SR)); e0=int(round(e*SR))
    seg_o=v[s0:e0]; bal=np.sqrt((seg_o**2).mean(0)); bal=bal/np.sqrt((bal**2).mean())
    newv=v.copy()
    newv[w0:w1]=v[w0:w1]*fo[:,None]+T[:,None]*bal[None,:]*fade[:,None]
    return newv,(w0,w1)
def load_gen(name):
    j=json.load(open(f'{D}/gen/{name}.json')); 
    s,e=j['span']; T,s_abs,wend,e_abs=gen_track(name,s,e)
    return T, s_abs, wend-s_abs, j
