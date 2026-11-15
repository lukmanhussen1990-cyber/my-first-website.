import numpy as np, wave, sys
SR=44100; SPEED=1.3; DUR=25.2
out=np.zeros(int(SR*(DUR+1)))
rng=np.random.default_rng(7)
def t_(T): return T/SPEED
def add(sig, T, gain=1.0):
    i=int(t_(T)*SR); n=min(len(sig), len(out)-i)
    if n>0: out[i:i+n]+=sig[:n]*gain
def env(n, a=0.005, d=None, curve=4):
    t=np.arange(n)/SR; e=np.ones(n)
    na=max(1,int(a*SR)); e[:na]=np.linspace(0,1,na)
    if d is None: d=n/SR
    e*=np.exp(-curve*t/d)
    return e
def lp(x, a):  # one-pole lowpass, a in (0,1)
    y=np.zeros_like(x); acc=0.0
    for i in range(len(x)): acc+= a*(x[i]-acc); y[i]=acc
    return y
def lpf(x, fc):
    a=1-np.exp(-2*np.pi*fc/SR); 
    from scipy.signal import lfilter
    return lfilter([a],[1,-(1-a)],x)
try:
    import scipy.signal as ss
except ImportError:
    ss=None
def bandnoise(n, lo, hi):
    x=rng.standard_normal(n)
    X=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR)
    X[(f<lo)|(f>hi)]=0
    y=np.fft.irfft(X,n); return y/ (np.abs(y).max()+1e-9)
def sine(freq, n, phase=0):
    if np.isscalar(freq): return np.sin(2*np.pi*freq*np.arange(n)/SR+phase)
    return np.sin(2*np.pi*np.cumsum(freq)/SR+phase)
def saw(freq,n):
    ph=np.cumsum(np.full(n,freq) if np.isscalar(freq) else freq)/SR
    return 2*(ph%1)-1
def sq(freq,n):
    return np.sign(sine(freq,n))
N=lambda s:int(s*SR)

# --- thud
def thud():
    n=N(0.6); f=np.linspace(110,42,n)
    s=sine(f,n)*env(n,0.002,0.18)*1.0 + bandnoise(n,40,500)*env(n,0.001,0.06)*0.7
    return np.tanh(s*1.6)
# --- boop/poke
def boop(f0=500):
    n=N(0.12); f=np.linspace(f0,f0*2.2,n)
    return sine(f,n)*env(n,0.002,0.06)
# --- sparkle
def sparkle():
    n=N(0.6); s=np.zeros(n)
    for k,fr in enumerate([2093,2637,3136,4186]):
        i=N(0.05*k); m=n-i; s[i:]+=sine(fr,m)*env(m,0.002,0.12)*0.4
    return s
# --- smooch
def smooch():
    n=N(0.18); f=np.linspace(900,300,n)
    return (sine(f,n)*0.5+bandnoise(n,800,4000)*0.3)*env(n,0.003,0.05)
# --- whoosh
def whoosh(d=0.45, lo=300, hi=3000):
    n=N(d); x=bandnoise(n,lo,hi); t=np.linspace(0,1,n)
    return x*np.sin(np.pi*t)**2
# --- blower engine
def blower(d, intensity):
    n=N(d); t=np.arange(n)/SR
    rpm=np.interp(t,[0,0.35,d],[45,95,100])+3*np.sin(2*np.pi*7*t)
    s=saw(rpm,n)*0.35+saw(rpm*2.01,n)*0.15
    s=s+bandnoise(n,200,6000)*np.interp(t,[0,d],[0.2,0.5])*intensity
    a=np.minimum(1,t/0.15)*np.minimum(1,(d-t)/0.1)
    return np.tanh(s*1.5)*a
def wind(d):
    n=N(d); t=np.arange(n)/SR
    x=bandnoise(n,150,5000)*(0.7+0.3*np.sin(2*np.pi*3.3*t))
    a=np.minimum(1,t/0.08)*np.minimum(1,(d-t)/0.1)
    return x*a
# --- bell
def bell():
    n=N(1.4); s=np.zeros(n)
    for fr,g,dc in [(830,1,0.6),(1660*1.02,0.5,0.4),(2490*1.04,0.35,0.3),(3320*1.07,0.2,0.2)]:
        s+=sine(fr,n)*g*env(n,0.001,dc)
    return s*0.6
# --- DTMF
def dtmf(lo,hi,d=0.14):
    n=N(d); return (sine(lo,n)+sine(hi,n))*0.35*np.minimum(1,np.minimum(np.arange(n),n-np.arange(n))/200)
def ring(d=0.6):
    n=N(d); t=np.arange(n)/SR
    s=(sine(440,n)+sine(480,n))*0.3*(np.sin(2*np.pi*20*t)>0)
    return s*np.minimum(1,(d-t)/0.05)
# --- shutter
def shutter():
    n=N(0.09); s=bandnoise(n,1500,9000)*env(n,0.0005,0.012)
    m=N(0.05); s2=bandnoise(n,1000,7000)*0
    s[m:]+=bandnoise(n-m,1500,8000)*env(n-m,0.0005,0.01)*0.8
    return s
# --- sad trombone
def trombone():
    notes=[(311,0.3),(293,0.3),(277,0.3),(261,1.0)]
    s=np.zeros(0)
    for i,(fr,d) in enumerate(notes):
        n=N(d); t=np.arange(n)/SR
        vib=fr*(1+ (0.02*np.sin(2*np.pi*6*t) if i==3 else 0))
        x=saw(vib,n)*0.5+sine(vib,n)*0.5
        x=x*np.minimum(1,t/0.03)*np.minimum(1,(d-t)/0.06)
        s=np.concatenate([s,x])
    from numpy.fft import rfft,irfft,rfftfreq
    X=rfft(s); f=rfftfreq(len(s),1/SR); X*=1/(1+(f/1800)**2); s=irfft(X,len(s))
    return s/np.abs(s).max()
# --- charge whine
def charge(d):
    n=N(d); f=np.geomspace(500,3800,n)
    t=np.arange(n)/SR
    return sine(f,n)*0.5*np.minimum(1,t/0.1)*(0.4+0.6*t/d)
# --- crackle
def crackle(d, dens=60):
    n=N(d); s=np.zeros(n)
    k=int(d*dens)
    for _ in range(k):
        i=rng.integers(0,n-600); L=rng.integers(80,500)
        s[i:i+L]+=bandnoise(L,1000,9000)*env(L,0.0002,0.004)*rng.uniform(0.3,1)
    return s
# --- zap buzz
def zap(d=0.55):
    n=N(d); t=np.arange(n)/SR
    s=sq(120+30*np.sin(2*np.pi*13*t),n)*0.5+saw(240,n)*0.3+bandnoise(n,2000,10000)*0.5*(rng.random(n)>0.3)
    s*=np.minimum(1,t/0.005)*np.minimum(1,(d-t)/0.08)
    return np.tanh(s*1.4)+crackle(d,140)*0.8
# --- fire
def fire(d):
    n=N(d); t=np.arange(n)/SR
    x=bandnoise(n,200,3000)*0.35*(0.7+0.3*np.sin(2*np.pi*2.1*t))+crackle(d,25)*0.6
    return x*np.minimum(1,t/0.1)*np.minimum(1,(d-t)/0.3)
def sizzle(d):
    n=N(d); t=np.arange(n)/SR
    return bandnoise(n,3000,11000)*0.5*np.minimum(1,t/0.05)*np.exp(-1.5*t)
# --- vine boom
def boom():
    n=N(1.4); t=np.arange(n)/SR
    f=60+80*np.exp(-t*18)
    s=sine(f,n)*np.exp(-t*2.2)+sine(f*2,n)*0.3*np.exp(-t*4)
    s+=bandnoise(n,30,300)*np.exp(-t*20)*0.6
    return np.tanh(s*2.2)
def crack():
    n=N(0.35); s=bandnoise(n,1500,9000)*env(n,0.0005,0.05)
    s+=crackle(0.35,80)*0.6
    return s
def ding():
    n=N(1.0); s=sine(1568,n)*env(n,0.001,0.35)+sine(3136,n)*0.3*env(n,0.001,0.15)
    return s*0.6
def zip_():
    n=N(0.3); t=np.arange(n)/SR
    return bandnoise(n,2000,8000)*(np.sin(2*np.pi*60*t)>0)*np.sin(np.pi*t/0.3)

# ---------------- placement (T in ORIGINAL voiceover seconds)
add(sparkle(),0.15,0.35)
add(sparkle(),1.0,0.25)
add(sparkle(),3.0,0.35)
add(whoosh(0.4,400,4000),3.95,0.35)
add(thud(),4.44,0.95)
add(sparkle(),5.4,0.45)
for tp in [7.3,7.62,8.0,8.22]: add(boop(520 if tp!=8.0 else 620),tp-0.05,1.0)
add(smooch(),9.2,0.6); add(smooch(),9.55,0.4)
add(whoosh(0.3,600,6000),10.22,0.4)
add(blower(1.9,0.4),10.7,0.42)
add(blower(1.7,1.0),12.55,0.5)
add(wind(1.6),12.6,0.55)
add(bell(),14.25,0.5); add(bell(),14.55,0.5)
add(charge(0.8)*0.25,15.2,0.25)
for i,(lo,hi) in enumerate([(852,1477),(697,1209),(697,1209)]): add(dtmf(lo,hi),16.3+i*0.2,0.45)
add(ring(0.8),16.95,0.35)
for p in [18.2,18.8,19.3,18.5,19.0,19.6,18.95,19.55,19.05,19.75]: add(shutter(),p-0.02,1.4)
add(trombone(),20.05,0.32)
add(zip_(),21.45,0.4)
add(whoosh(0.3,500,5000),21.95,0.35)
add(charge(1.15),22.25,0.18)
add(crackle(0.45,90),22.3,0.5)
add(np.concatenate([np.zeros(10),bell()[:N(0.5)]]),22.75,0.25)
add(zap(0.62),23.42,0.42)
add(boom()*0.6,23.45,0.35)
add(fire(3.0),23.95,0.35)
add(sizzle(1.0),24.3,0.35)
add(boom(),27.1,0.5)
add(crack(),28.25,0.55)
add(thud()*0.7,28.3,0.7)
for p in [28.9,29.6,30.2]: add(crackle(0.12,200),p,0.35)
add(ding(),30.72,0.45)
add(crackle(0.12,200),31.1,0.3)

# --------------- light bouncy music bed (Karplus-Strong plucks)
def pluck(freq, d=0.5, bright=0.5):
    n=N(d); L=int(SR/freq); buf=rng.uniform(-1,1,L); o=np.zeros(n)
    for i in range(n):
        o[i]=buf[i%L]
        buf[i%L]=0.5*(buf[i%L]+buf[(i+1)%L])*0.996
    return o
music=np.zeros(len(out))
bpm=128; beat=60/bpm
chords=[[261.6,329.6,392.0],[220.0,261.6,329.6],[174.6,220.0,261.6],[196.0,246.9,293.7]]
bass=[65.4,55.0,43.65,49.0]
cache={}
def P(f,d=0.45):
    k=(round(f,1),d)
    if k not in cache: cache[k]=pluck(f,d)
    return cache[k]
t=0.0; bar=0
while t<DUR:
    ch=chords[bar%4]
    for b in range(4):
        tb=t+b*beat
        i=int(tb*SR)
        def put(sig,g,at):
            j=int(at*SR); m=min(len(sig),len(music)-j)
            if m>0: music[j:j+m]+=sig[:m]*g
        put(P(bass[bar%4]*2,0.5),0.5,tb)
        put(P(ch[b%3]*2,0.35),0.25,tb+beat/2)
        put(P(ch[(b+1)%3]*2,0.3),0.18,tb+beat*0.75)
        # soft hat
        n=N(0.03); put(bandnoise(n,6000,12000)*env(n,0.0005,0.01),0.12,tb+beat/2)
        if b in (1,3): n2=N(0.12); put(bandnoise(n2,150,2500)*env(n2,0.001,0.04),0.18,tb)
        if b in (0,2): n3=N(0.25); put(sine(np.linspace(120,45,n3),n3)*env(n3,0.002,0.08),0.5,tb)
    t+=4*beat; bar+=1
# music dips: drop out during corpse (sad), and right at BRO for impact
tt=np.arange(len(music))/SR
gain=np.ones(len(music))
def dip(T0,T1,g):
    a,b=t_(T0),t_(T1)
    m=(tt>=a)&(tt<b); gain[m]=g
dip(20.0,23.45,0.25); dip(27.05,27.7,0.0)
from numpy import convolve
k=np.ones(2000)/2000; gain=np.convolve(gain,k,mode='same')
music*=gain
music*=np.minimum(1,tt/0.3)*np.clip((DUR+0.2-tt)/0.6,0,1)

def write(name, x, peak=0.9):
    x=x if peak is None else x/(np.abs(x).max()+1e-9)*peak
    x=np.clip(x,-1,1)
    with wave.open(name,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x*32767).astype(np.int16).tobytes())
print('sfx peak', np.abs(out).max()); write(sys.argv[1]+'/sfx.wav', out/1.6, None)
write(sys.argv[1]+'/music.wav', music, 0.9)
print('ok', len(out)/SR)
