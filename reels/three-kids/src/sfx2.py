import numpy as np, wave, sys
SR=44100; SPEED=1.3; DUR=38.7
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


# ---------------- extra synths
def heartbeat():
    n=N(0.35); t=np.arange(n)/SR
    s=sine(55+40*np.exp(-t*30),n)*np.exp(-t*14)
    i=N(0.13); m=n-i; s[i:]+=sine(50+30*np.exp(-t[:m]*30),m)*np.exp(-t[:m]*16)*0.8
    return np.tanh(s*2.5)
def kaching():
    s=np.zeros(N(1.2))
    d=bandnoise(N(0.12),800,6000)*env(N(0.12),0.001,0.03); s[:len(d)]+=d*0.8
    b=bell(); s[N(0.1):N(0.1)+len(b)] += b[:len(s)-N(0.1)]*1.2
    for k in range(6):
        c=sine(3000+k*400,N(0.08))*env(N(0.08),0.001,0.02)*0.25; j=N(0.15+k*0.05); s[j:j+len(c)]+=c
    return s
def chomp():
    n=N(0.16); return (bandnoise(n,300,4000)*0.8+sine(np.linspace(180,90,n),n)*0.6)*env(n,0.001,0.04)
def crunch():
    return crackle(0.2,250)*0.9
def pop(f0=300):
    n=N(0.09); return sine(np.linspace(f0,f0*3,n),n)*env(n,0.001,0.03)
def tada():
    s=np.zeros(N(1.2))
    for k,(fr,st) in enumerate([(523,0),(659,0.08),(784,0.16),(1046,0.24)]):
        n=N(1.2-st); t=np.arange(n)/SR; x=(saw(fr,n)*0.4+sine(fr,n)*0.6)*np.minimum(1,t/0.01)*np.exp(-t*2.5)
        m=min(len(x),len(s)-N(st)); s[N(st):N(st)+m]+=x[:m]*0.35
    return s
def vroom():
    n=N(1.1); t=np.arange(n)/SR
    rpm=np.interp(t,[0,0.25,0.6,1.1],[60,180,140,90])
    s=saw(rpm,n)*0.5+saw(rpm*1.5,n)*0.25+bandnoise(n,100,3000)*0.25
    s*=np.minimum(1,t/0.03)*np.minimum(1,(1.1-t)/0.3)
    sc=bandnoise(N(0.5),1500,6000)*np.sin(np.pi*np.arange(N(0.5))/N(0.5))*0.6
    s[N(0.4):N(0.9)]+=sc
    return np.tanh(s*1.6)
def yip():
    n=N(0.12); f=np.interp(np.arange(n),[0,n*0.3,n],[900,1500,1100])
    return (sine(f,n)+0.3*sine(f*2,n))*env(n,0.005,0.05)
def gasp_sting():
    s=np.zeros(N(1.4))
    for k,(fr,st,d) in enumerate([(392,0,0.18),(370,0.2,0.18),(311,0.42,0.9)]):
        n=N(d); t=np.arange(n)/SR; x=(saw(fr,n)*0.5+saw(fr*1.005,n)*0.5)*np.minimum(1,t/0.01)*np.minimum(1,(d-t)/0.08)
        x+= (saw(fr/2,n)*0.5)*np.minimum(1,t/0.01)*np.minimum(1,(d-t)/0.08)
        m=min(n,len(s)-N(st)); s[N(st):N(st)+m]+=x[:m]*0.4
    X=np.fft.rfft(s); f=np.fft.rfftfreq(len(s),1/SR); X*=1/(1+(f/2500)**2); return np.fft.irfft(X,len(s))
def gasp_breath():
    n=N(0.35); t=np.arange(n)/SR
    return bandnoise(n,600,5000)*np.minimum(1,t/0.03)*np.exp(-t*6)
def key():
    n=N(0.03); return bandnoise(n,2000,8000)*env(n,0.0005,0.006)
def squeak():
    n=N(0.22); t=np.arange(n)/SR; f=1400+500*np.sin(2*np.pi*4.5*t)
    return (sine(f,n)*0.6+sine(f*2.01,n)*0.2)*np.sin(np.pi*t/0.22)
def scratch():
    n=N(0.7); t=np.arange(n)/SR
    f=np.interp(t,[0,0.15,0.3,0.45,0.7],[200,1400,300,1100,150])
    s=bandnoise(n,500,6000)*0.6*(0.5+0.5*np.sin(2*np.pi*np.cumsum(f)/SR))
    s+=saw(f*0.5,n)*0.25
    return s*np.minimum(1,t/0.01)*np.minimum(1,(0.7-t)/0.1)
def flatline(d=1.4):
    n=N(d); t=np.arange(n)/SR; return sine(1000,n)*0.4*np.minimum(1,t/0.01)*np.minimum(1,(d-t)/0.05)
def ecg_beep():
    n=N(0.1); return sine(1000,n)*0.4*env(n,0.002,0.06)
def choir(d=2.2):
    n=N(d); t=np.arange(n)/SR; s=np.zeros(n)
    for fr in [523.25,659.25,783.99,1046.5]:
        for det in [0.997,1.0,1.003]:
            s+=saw(fr*det*(1+0.004*np.sin(2*np.pi*5*t)),n)*0.08
    X=np.fft.rfft(s); f=np.fft.rfftfreq(n,1/SR); X*=1/(1+(f/1800)**2); s=np.fft.irfft(X,n)
    return s*np.minimum(1,t/0.4)*np.minimum(1,(d-t)/0.5)
def harp():
    s=np.zeros(N(1.5))
    for k,fr in enumerate([523,587,659,784,880,1046,1175,1318]):
        p=pluck(fr,0.6); j=N(k*0.05); s[j:j+len(p)]+=p[:len(s)-j]*0.3
    return s
def pluck(freq, d=0.5):
    n=N(d); L=int(SR/freq); buf=rng.uniform(-1,1,L); o=np.zeros(n)
    for i in range(n):
        o[i]=buf[i%L]; buf[i%L]=0.5*(buf[i%L]+buf[(i+1)%L])*0.996
    return o
def crickets(d):
    n=N(d); t=np.arange(n)/SR
    gate=(np.sin(2*np.pi*14*t)>0.3)*(np.sin(2*np.pi*0.9*t)>-0.2)
    return sine(4300,n)*0.25*gate*np.minimum(1,t/0.3)*np.minimum(1,(d-t)/0.3)
def footstep():
    n=N(0.08); return bandnoise(n,100,1200)*env(n,0.001,0.02)
def tap():
    n=N(0.05); return bandnoise(n,1500,6000)*env(n,0.0005,0.008)
def rustle(d=0.4):
    n=N(d); t=np.arange(n)/SR; return bandnoise(n,2000,9000)*0.4*np.sin(np.pi*t/d)*(0.6+0.4*(rng.random(n)>0.5))
def thump():
    n=N(0.12); t=np.arange(n)/SR; return sine(70+50*np.exp(-t*40),n)*np.exp(-t*25)

# ---------------- placement (ORIGINAL voiceover seconds)
add(kaching(),0.25,1.0)
for k in range(5): add(rustle(0.3),0.4+k*0.6,0.25)
add(whoosh(0.35,400,4000),3.4,0.35)
for k in range(6): add(footstep(),3.6+k*0.22,0.5); 
for k in range(3): add(tap(),3.7+k*0.44,0.6)
add(sparkle(),5.45,0.7)
add(heartbeat(),6.36,0.5); add(heartbeat(),6.8,0.5)
add(sparkle(),7.6,0.35)
add(sparkle(),9.0,0.9)
add(np.concatenate([ding()[:N(0.4)]]),10.12,0.35)
add(kaching(),12.18,1.2)
add(whoosh(0.35,300,3000),13.7,0.3)
for k,tp in enumerate([15.3,15.48,15.66,15.84,16.02,16.2,16.38,16.56,16.74,16.92]): add(pop(260+k*35),tp,1.4)
for tp in [18.05,18.45,18.85]: add(chomp(),tp,1.8); add(crunch(),tp+0.02,1.2)
add(tada(),20.12,0.9); add(boom()*0.5,20.12,0.4)
add(vroom(),20.85,0.55)
add(yip(),22.55,1.4); add(yip(),22.72,1.2)
for k,tp in enumerate([24.26,24.4,24.54]): add(pop(350+k*80),tp,1.6)
for k in range(3): add(ecg_beep(),26.32+k*0.12,0.4)
for k in range(10): add(rustle(0.15),26.4+k*0.1,0.35)
add(crickets(8.3),27.65,0.12)
for k in range(24): add(key(),29.36+k*0.065,1.6)
add(gasp_sting(),31.0,1.1); add(gasp_breath(),31.02,0.8)
add(harp(),32.35,0.8)
add(sparkle(),33.4,0.3)
add(crickets(2.9),36.05,0.18)
for k in range(5): add(squeak(),37.4+k*0.48,0.8)
for k in range(5): add(squeak()*0.6,38.95+k*0.48,0.6)
for k in range(5): add(thump()*0.5,39.0+k*0.48,0.8)
add(scratch(),41.48,1.3)
for k in range(8): add(thump(),42.62+k*0.556,1.6)
for k in range(2): add(ecg_beep(),44.9+k*0.45,0.5)
add(flatline(1.6),45.15,0.42)
add(rustle(0.5),45.7,0.4)
add(choir(2.2),47.9,1.0); add(harp(),47.95,0.6)
def write(name, x, peak=0.9):
    x=x if peak is None else x/(np.abs(x).max()+1e-9)*peak
    x=np.clip(x,-1,1)
    with wave.open(name,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x*32767).astype(np.int16).tobytes())
print('sfx peak', np.abs(out).max()); write(sys.argv[1]+'/sfx2.wav', out/1.8, None)
print('ok', len(out)/SR)
