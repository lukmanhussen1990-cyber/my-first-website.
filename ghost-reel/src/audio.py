# Code-generated music + SFX, mixed under the voiceover with ffmpeg.
import numpy as np, wave, sys
SR=44100; D=21.0; n=int(SR*D); t=np.arange(n)/SR; rng=np.random.default_rng(3)
mix=np.zeros(n)
def put(sig,at,g=1.0):
    i=int(at*SR); sig=sig[:max(0,n-i)]; mix[i:i+len(sig)]+=sig*g
def env(m,a=0.01,r=0.1):
    e=np.ones(m); ia=int(a*SR); ir=int(r*SR); e[:ia]=np.linspace(0,1,ia); e[-ir:]=np.linspace(1,0,ir); return e
def tone(f,d,vib=0,vr=5):
    m=int(d*SR); x=np.arange(m)/SR; ph=2*np.pi*np.cumsum(f*(1+vib*np.sin(2*np.pi*vr*x)) if np.ndim(f) else np.full(m,f)*(1+vib*np.sin(2*np.pi*vr*x)))/SR; return np.sin(ph)
def noise(d): return rng.standard_normal(int(d*SR))
def lp(x,k):
    y=np.copy(x); 
    for i in range(1,len(y)): y[i]=y[i-1]+k*(x[i]-y[i-1])
    return y
# music: silly spooky waltz (pizzicato bass + theremin lead) in A minor
bpm=132; beat=60/bpm; bass=[110,130.8,146.8,164.8]; lead=[440,523.3,493.9,415.3,440,659.3,587.3,523.3]
b=0; i=0
while b*beat<D-0.5:
    f=bass[(b//3)%4]*(1 if b%3==0 else 1.5 if b%3==1 else 2)
    m=int(0.28*SR); x=np.arange(m)/SR; put(np.sin(2*np.pi*f*x)*np.exp(-x*11),b*beat,0.16 if b%3==0 else 0.09)
    if b%3==0:
        d=beat*3; f0=lead[(b//3)%8]; s=tone(f0,d,0.012,5.5)*env(int(d*SR),0.15,0.3); put(s,b*beat,0.05)
    b+=1
# SFX
def wooo(d=0.8): 
    f=np.linspace(330,620,int(d*SR)); f=np.where(np.arange(len(f))>len(f)*0.6,f[::-1]*1.1,f); return tone(f,d,0.03,7)*env(len(f),0.12,0.3)
put(wooo(0.8),0.05,0.16); put(wooo(0.9),5.5,0.14)
r=noise(0.38); r=(r-lp(r,0.25))*np.linspace(1,0.1,len(r))*(1+0.6*np.sign(np.sin(2*np.pi*np.linspace(40,140,len(r))*np.arange(len(r))/SR))); put(r,6.60,0.2)      # rip
m=int(0.5*SR); x=np.arange(m)/SR; put(np.sin(2*np.pi*(70-30*x)*x)*np.exp(-x*9)+lp(noise(0.5),0.15)*np.exp(-x*22)*1.5,8.57,0.55)                       # door slam
for k,a in enumerate([9.95,10.2,10.45]):                                                                                                               # window squeak
    d=0.2; f=np.linspace(1400+k*150,2100+k*150,int(d*SR)); put(tone(f,d,0.02,30)*env(len(f),0.02,0.06),a,0.07)
m=int(0.7*SR); x=np.arange(m)/SR; put(np.sin(2*np.pi*np.cumsum(160+220*np.exp(-x*5)*(1+0.5*np.sin(2*np.pi*13*x)))/SR)*np.exp(-x*4.5),10.70,0.3)       # boing
for a in [19.0,20.15]:                                                                                                                                 # snore
    m=int(0.75*SR); x=np.arange(m)/SR; s=lp(noise(0.75),0.08)*(0.5+0.5*np.sign(np.sin(2*np.pi*28*x)))*np.sin(np.pi*x/0.75)**2; put(s*3,a,0.3)
d=1.1; m=int(d*SR); x=np.arange(m)/SR; aw=sum(tone(np.linspace(f*1.12,f,m),d,0.01,5) for f in [392,494,587])/3*env(m,0.2,0.5); put(aw,19.55,0.13)   # aww sting
mix=np.clip(mix,-1,1)
w=wave.open(sys.argv[1],'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes()); w.close()
