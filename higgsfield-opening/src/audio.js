// Synthesises the sound design for the opening -> audio.wav (48 kHz, stereo, 16-bit)
const fs=require('fs');
const SR=48000, DUR=6.0, N=Math.round(SR*DUR);
const Lc=new Float64Array(N), Rc=new Float64Array(N);
let seed=20251004; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
const noise=()=>rnd()*2-1;
const c01=x=>Math.min(1,Math.max(0,x)), seg=(t,a,b)=>c01((t-a)/(b-a)), lerp=(a,b,k)=>a+(b-a)*k;
class Biquad{constructor(){this.x1=this.x2=this.y1=this.y2=0;}
  bp(f,Q){const w=2*Math.PI*f/SR,s=Math.sin(w),c=Math.cos(w),a=s/(2*Q),a0=1+a;this.b0=a/a0;this.b1=0;this.b2=-a/a0;this.a1=-2*c/a0;this.a2=(1-a)/a0;return this;}
  lp(f,Q){const w=2*Math.PI*f/SR,s=Math.sin(w),c=Math.cos(w),a=s/(2*Q),a0=1+a;this.b0=(1-c)/2/a0;this.b1=(1-c)/a0;this.b2=(1-c)/2/a0;this.a1=-2*c/a0;this.a2=(1-a)/a0;return this;}
  hp(f,Q){const w=2*Math.PI*f/SR,s=Math.sin(w),c=Math.cos(w),a=s/(2*Q),a0=1+a;this.b0=(1+c)/2/a0;this.b1=-(1+c)/a0;this.b2=(1+c)/2/a0;this.a1=-2*c/a0;this.a2=(1-a)/a0;return this;}
  run(x){const y=this.b0*x+this.b1*this.x1+this.b2*this.x2-this.a1*this.y1-this.a2*this.y2;this.x2=this.x1;this.x1=x;this.y2=this.y1;this.y1=y;return y;}}
// ---- timeline (must match anim.html) ----
const T={draw0:0.30,draw1:1.85,burst:1.85,let0:2.02,stag:0.065,shine0:3.05,shine1:3.95,out0:5.25,out1:5.95};

// layers
const riseL=[new Biquad(),new Biquad()], riseR=[new Biquad(),new Biquad()];
const bodyL=new Biquad(), bodyR=new Biquad();
const whooshL=new Biquad().lp(1400,0.8), whooshR=new Biquad().lp(1400,0.8);
const shimL=new Biquad().bp(6500,1.5), shimR=new Biquad().bp(7000,1.5);
const tickL=new Biquad().bp(4200,3), tickR=new Biquad().bp(4600,3);
const shineL=new Biquad(), shineR=new Biquad();
let subPhase=0, padPh=[0,0,0,0], bellPh=[0,0,0];
const bellF=[1046.5,1568.0,2093.0], padF=[55,110,164.81,220];

for(let i=0;i<N;i++){
  const t=i/SR; let l=0,r=0;
  // --- riser: band-swept noise while the mark draws itself
  if(t>=T.draw0-0.05 && t<T.draw1+0.4){
    const u=seg(t,T.draw0,T.draw1);
    const f=260*Math.pow(4200/260,Math.pow(u,1.15));
    riseL[0].bp(f,1.6); riseL[1].bp(f*1.5,2.5); riseR[0].bp(f*1.04,1.6); riseR[1].bp(f*1.56,2.5);
    bodyL.lp(lerp(180,1800,u),0.9); bodyR.lp(lerp(190,1900,u),0.9);
    let amp=0.03+0.42*Math.pow(u,2.0);
    if(t>T.draw1) amp*=Math.exp(-(t-T.draw1)/0.07);
    const nl=noise(), nr=noise();
    l+=amp*(riseL[0].run(nl)*1.0+riseL[1].run(nl)*0.5+bodyL.run(nl)*0.35);
    r+=amp*(riseR[0].run(nr)*1.0+riseR[1].run(nr)*0.5+bodyR.run(nr)*0.35);
  }
  // --- impact at burst: sub thump + click + air whoosh
  if(t>=T.burst){
    const d=t-T.burst;
    const f=42+70*Math.exp(-d/0.11); subPhase+=2*Math.PI*f/SR;
    const sub=Math.sin(subPhase)*0.62*Math.exp(-d/0.42)*(1-Math.exp(-d/0.003));
    l+=sub; r+=sub;
    const click=noise()*0.35*Math.exp(-d/0.010);
    const n2=noise(), n3=noise();
    const wl=whooshL.run(n2)*0.5*Math.exp(-d/0.33), wr=whooshR.run(n3)*0.5*Math.exp(-d/0.33);
    l+=click+wl; r+=click+wr;
  }
  // --- letters: airy shimmer bed + very soft ticks
  if(t>=T.let0-0.05 && t<T.let0+1.4){
    const u=seg(t,T.let0,T.let0+1.3); const env=Math.sin(Math.PI*u)*0.07;
    l+=shimL.run(noise())*env; r+=shimR.run(noise())*env;
    let tk=0; for(let k=0;k<10;k++){const d=t-(T.let0+k*T.stag+0.12); if(d>=0&&d<0.08) tk+=Math.exp(-d/0.014);}  // +0.12s: when each letter lands
    const pan=0.35; const n=noise()*tk*0.16;
    l+=tickL.run(n)*(1-pan*0.5); r+=tickR.run(n)*(1+pan*0.5);
  }
  // --- shine: bright noise sweep panned L->R + soft bell
  if(t>=T.shine0&&t<T.shine1+1.2){
    const u=seg(t,T.shine0,T.shine1); const d=t-T.shine0;
    shineL.hp(lerp(2500,9000,u),1.2); shineR.hp(lerp(2500,9000,u),1.2);
    const env=Math.sin(Math.PI*c01(u))*0.085;
    const n=noise(); const pan=u; // 0=L 1=R
    l+=shineL.run(n)*env*Math.cos(pan*Math.PI/2); r+=shineR.run(n)*env*Math.sin(pan*Math.PI/2);
    let bell=0; for(let k=0;k<3;k++){bellPh[k]+=2*Math.PI*bellF[k]/SR; bell+=Math.sin(bellPh[k])*[1,0.5,0.3][k];}
    bell*=0.045*(1-Math.exp(-d/0.03))*Math.exp(-d/0.75);
    l+=bell*0.9; r+=bell*1.1;
  }
  // --- warm pad from the impact to the end
  if(t>=T.burst){
    const d=t-T.burst; let pl=0,pr=0;
    for(let k=0;k<4;k++){padPh[k]+=2*Math.PI*padF[k]/SR; const w=[1,0.6,0.35,0.22][k]; pl+=Math.sin(padPh[k])*w; pr+=Math.sin(padPh[k]*1.0+k*0.9)*w;}
    const trem=1+0.12*Math.sin(2*Math.PI*0.7*t);
    const env=0.11*(1-Math.exp(-d/0.9))*trem*(1-seg(t,T.out0,T.out1-0.1));
    l+=pl*env; r+=pr*env;
  }
  Lc[i]=l; Rc[i]=r;
}
// master: gentle tail fade, soft clip, peak normalise
const master=(x,t)=>{const fade=1-Math.pow(seg(t,T.out0+0.1,T.out1+0.03),3); return Math.tanh(1.15*x*fade)/Math.tanh(1.15);};
let peak=0; for(let i=0;i<N;i++){const t=i/SR; Lc[i]=master(Lc[i],t); Rc[i]=master(Rc[i],t); peak=Math.max(peak,Math.abs(Lc[i]),Math.abs(Rc[i]));}
const g=0.89/peak;
const buf=Buffer.alloc(44+N*4); let o=0;
const w32=v=>{buf.writeUInt32LE(v,o);o+=4;}, w16=v=>{buf.writeUInt16LE(v,o);o+=2;};
buf.write('RIFF',o);o+=4; w32(36+N*4); buf.write('WAVE',o);o+=4; buf.write('fmt ',o);o+=4; w32(16); w16(1); w16(2); w32(SR); w32(SR*4); w16(4); w16(16); buf.write('data',o);o+=4; w32(N*4);
for(let i=0;i<N;i++){buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,Lc[i]*g))*32767),o);o+=2;buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,Rc[i]*g))*32767),o);o+=2;}
fs.writeFileSync('audio.wav',buf); console.log('audio.wav written, peak before norm', peak.toFixed(3));
