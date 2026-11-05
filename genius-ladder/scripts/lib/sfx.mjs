// Procedural sound effects — every sound is synthesized from noise, sines and envelopes.
import { SR } from './pcm.mjs';

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; };
}
const buf = (sec) => new Float32Array(Math.round(sec * SR));
const lpK = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / SR);

function normalize(x, peak) {
  let m = 1e-9;
  for (const v of x) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

// falling sine "body" hit
function thump(x, at, f0, f1, decay, amp) {
  let ph = 0;
  for (let i = Math.round(at * SR); i < x.length; i++) {
    const t = i / SR - at;
    const f = f1 + (f0 - f1) * Math.exp(-t * 18);
    ph += (2 * Math.PI * f) / SR;
    x[i] += Math.sin(ph) * Math.exp(-t / decay) * amp;
  }
}
// filtered noise burst
function burst(x, at, dur, fc, amp, seed, hp = 0) {
  const r = rand(seed), k = lpK(fc), kh = hp ? lpK(hp) : 0;
  let y = 0, yh = 0;
  for (let i = Math.round(at * SR); i < Math.min(x.length, Math.round((at + dur) * SR)); i++) {
    const t = i / SR - at;
    y += k * (r() - y);
    let v = y;
    if (hp) { yh += kh * (y - yh); v = y - yh; }
    x[i] += v * amp * Math.exp(-t / (dur * 0.3));
  }
}
function ping(x, at, f, decay, amp) {
  for (let i = Math.round(at * SR); i < x.length; i++) {
    const t = i / SR - at;
    x[i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay) * amp;
  }
}

export const SFX = {
  crunch() {
    const x = buf(0.6), r = rand(3);
    for (let n = 0; n < 34; n++) {
      const at = Math.pow((r() + 1) / 2, 1.6) * 0.42;
      burst(x, at, 0.03 + ((r() + 1) / 2) * 0.05, 2500 + ((r() + 1) / 2) * 3500, 0.6 + r() * 0.3, 10 + n, 400);
    }
    thump(x, 0, 140, 60, 0.09, 0.9);
    burst(x, 0, 0.25, 900, 1.2, 77);
    return normalize(x, 0.9);
  },
  bang() {
    const x = buf(0.45);
    thump(x, 0, 220, 70, 0.07, 1);
    burst(x, 0, 0.05, 6000, 1.2, 5);
    for (const [f, d] of [[620, 0.09], [1390, 0.06], [2210, 0.045], [3170, 0.03]]) ping(x, 0, f, d, 0.25);
    return normalize(x, 0.95);
  },
  skrrt() {
    const x = buf(1.0), r = rand(9);
    let ph = 0, y = 0;
    const k = lpK(3200);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      const f = 820 - 360 * t + 40 * Math.sin(t * 60);
      ph += f / SR;
      const saw = 2 * (ph % 1) - 1;
      const stick = Math.sin(2 * Math.PI * 31 * t) > -0.2 ? 1 : 0.25; // stick-slip chatter
      const env = Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.65) / 0.08);
      y += k * (saw * 0.8 + r() * 0.45 - y);
      x[i] = y * stick * env;
    }
    return normalize(x, 0.8);
  },
  thud() {
    const x = buf(0.6);
    thump(x, 0, 110, 42, 0.16, 1);
    burst(x, 0, 0.18, 500, 1.4, 21);
    burst(x, 0.01, 0.12, 3000, 0.4, 22, 800); // grass rustle
    return normalize(x, 1);
  },
  thump() {
    const x = buf(0.35);
    thump(x, 0, 150, 80, 0.07, 1);
    burst(x, 0, 0.1, 1200, 0.8, 31);
    return normalize(x, 0.8);
  },
  squeak() {
    const x = buf(0.55);
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      const seg = t < 0.22 ? t / 0.22 : (t - 0.27) / 0.24;
      const on = t < 0.22 || (t > 0.27 && t < 0.51);
      const f = 1500 + 900 * Math.max(0, seg) + 120 * Math.sin(t * 2 * Math.PI * 22);
      ph += (2 * Math.PI * f) / SR;
      x[i] = on ? Math.sin(ph) * Math.sin(Math.PI * Math.min(1, Math.max(0, seg))) * 0.8 : 0;
    }
    return normalize(x, 0.7);
  },
  pssh() {
    const x = buf(1.2), r = rand(41);
    let y = 0, yl = 0;
    const kh = lpK(2600), kl = lpK(9000);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      yl += kl * (r() - yl);
      y += kh * (yl - y);
      const env = Math.min(1, t / 0.06) * (t > 0.9 ? Math.exp(-(t - 0.9) / 0.08) : 1) * (0.85 + 0.15 * Math.sin(t * 2 * Math.PI * 7));
      x[i] = (yl - y) * env;
    }
    return normalize(x, 0.6);
  },
  click() {
    const x = buf(0.2);
    burst(x, 0, 0.006, 9000, 1, 51);
    ping(x, 0, 3300, 0.012, 0.8);
    burst(x, 0.045, 0.006, 9000, 0.8, 52);
    ping(x, 0.045, 2400, 0.018, 0.9);
    return normalize(x, 0.85);
  },
  clatter() {
    const x = buf(0.8), r = rand(61);
    for (let n = 0; n < 6; n++) {
      const at = n * 0.07 + ((r() + 1) / 2) * 0.05;
      const a = 1 - n * 0.13;
      ping(x, at, 280 + ((r() + 1) / 2) * 260, 0.035, a * 0.8);
      burst(x, at, 0.04, 2000, a, 62 + n);
    }
    return normalize(x, 0.8);
  },
  crash() {
    const x = buf(1.0), r = rand(71);
    thump(x, 0, 120, 50, 0.12, 1);
    for (let n = 0; n < 8; n++) {
      const at = n * 0.06 + ((r() + 1) / 2) * 0.04;
      ping(x, at, 230 + ((r() + 1) / 2) * 300, 0.04, 0.7 - n * 0.07);
      burst(x, at, 0.05, 2500, 0.8 - n * 0.08, 72 + n);
    }
    return normalize(x, 0.95);
  },
  splat() {
    const x = buf(0.25);
    burst(x, 0, 0.18, 700, 1, 81);
    thump(x, 0, 300, 120, 0.04, 0.5);
    return normalize(x, 0.6);
  },
  sting() {
    const x = buf(1.3);
    for (const [f, a] of [[110, 0.5], [116.5, 0.4], [55, 0.6]]) {
      let ph = 0;
      for (let i = 0; i < x.length; i++) {
        const t = i / SR;
        ph += f / SR;
        x[i] += (2 * (ph % 1) - 1) * a * Math.min(1, t / 0.01) * Math.exp(-t / 0.5);
      }
    }
    let y = 0;
    const k = lpK(900);
    for (let i = 0; i < x.length; i++) { y += k * (x[i] - y); x[i] = y; }
    return normalize(x, 0.7);
  },
  boom() {
    const x = buf(1.4);
    thump(x, 0, 90, 34, 0.45, 1);
    burst(x, 0, 0.3, 300, 0.6, 91);
    return normalize(x, 0.9);
  },
};

// quiet night ambience: crickets (4.6 kHz chirp trains)
export function crickets(sec) {
  const x = buf(sec), r = rand(101);
  for (const voice of [{ f: 4650, p: 0.62, a: 1 }, { f: 4180, p: 0.81, a: 0.6 }, { f: 5050, p: 0.97, a: 0.45 }]) {
    for (let t = ((r() + 1) / 2) * voice.p; t < sec; t += voice.p * (0.9 + r() * 0.1)) {
      for (let c = 0; c < 3; c++) {
        const at = t + c * 0.055;
        for (let i = Math.round(at * SR); i < Math.min(x.length, Math.round((at + 0.035) * SR)); i++) {
          const u = (i / SR - at) / 0.035;
          x[i] += Math.sin(2 * Math.PI * voice.f * (i / SR)) * Math.sin(Math.PI * u) * voice.a;
        }
      }
    }
  }
  return normalize(x, 1);
}
