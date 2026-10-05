// Night Passenger — procedural audio engine (Web Audio API, no assets).
//
// Routing:
//   cabinBus ──┬───────────────────────────────┐
//              └─ cabin reverb (0.28 s IR) ────┤
//   exteriorBus ─ fog shelf ─ insulation LP ───┤
//   radio ─ small-speaker voicing ─> cabinBus  ├─ diegetic ─ muffle LP ─┐
//   scoreBus ──────────────────────────────────────────────────────────┼─ pause ─ master
//   large reverb (3.4 s) <─ score sends + outdoor sends ───────────────┘
//   master ─ compressor ─ safety soft-clip ─ destination
//
// One large convolver serves both the score and the outdoor sends: the
// outdoor send is pre-filtered by copies of the fog/insulation/muffle stages
// (linear filters commute), which saves a second multi-second convolution.

import {
  clamp, clamp01, lerp, expLerp, smoothstep, finite, mulberry32, gauss, randRange,
  glide, hold, loopSource, biquad, gainNode, monoGain, createPan,
  makeNoiseBuffers, makeReverbIR, makeSafetyCurve, renderRainRoof, renderRainOutdoor, renderCrackle,
} from './dsp.js';
import { Radio } from './radio.js';
import { Forest } from './forest.js';
import * as sfx from './sfx.js';

const LOOKAHEAD = 0.25; // seconds of audio scheduled ahead by the pump

const STATE_RANGES = {
  speed: [0, 30, 0],
  rpm: [700, 3500, 800],
  throttle: [0, 1, 0],
  rain: [0, 1, 0],
  wetness: [0, 1, 0],
  windowOpen: [0, 1, 0],
  dread: [0, 1, 0],
  insects: [0, 1, 1],
  gust: [0, 1, 0.3],
  radioInterference: [0, 1, 0],
  fog: [0, 1, 0],
  muffle: [0, 1, 0],
};

export class AudioEngine {
  constructor() {
    this._ctx = null;
    this._ready = false;
    this._starting = null;
    this._offline = false;
    this._timer = null;
    this._paused = false;
    this._pauseToken = 0;
    this._volume = 1;
    this._s = {};
    for (const [k, [, , def]] of Object.entries(STATE_RANGES)) this._s[k] = def;
    this._rng = mulberry32((Math.random() * 4294967296) >>> 0);
    this._walk = { pitch: 0, level: 0, surface: 0, wind: 0.45, hiss: 0, rain: 0 };
    this._buzz = { level: 0, pan: 0 };
    this._warned = false;
  }

  /** True once start() has built the audio graph. */
  get ready() {
    return this._ready;
  }

  /** The underlying (Offline)AudioContext, or null before start(). */
  get context() {
    return this._ctx;
  }

  /**
   * Create the AudioContext (or use opts.context), build the graph and start
   * the continuous layers at silent levels. Call from a user gesture.
   * Idempotent: later calls just resume. Never rejects.
   * @param {{context?: BaseAudioContext, windowSide?: -1|1, masterVolume?: number, seed?: number}} [opts]
   */
  async start(opts = {}) {
    if (this._ready) {
      if (!this._offline && !this._paused) await this._ctx.resume().catch(() => {});
      return;
    }
    if (this._starting) return this._starting;
    this._starting = (async () => {
      try {
        let ctx = opts.context || null;
        if (!ctx) {
          const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
          if (!AC) return;
          ctx = new AC();
        }
        this._offline = typeof ctx.startRendering === 'function';
        // resume inside the gesture, before the (synchronous) graph build
        const resumed = this._offline ? Promise.resolve() : ctx.resume().catch(() => {});
        this._ctx = ctx;
        if (Number.isFinite(opts.seed)) this._rng = mulberry32(opts.seed);
        if (Number.isFinite(opts.masterVolume)) this._volume = clamp01(opts.masterVolume);
        this._windowSide = opts.windowSide === -1 ? -1 : 1;
        this._build();
        this._ready = true;
        this.update(0, {});
        if (!this._offline) {
          this._timer = setInterval(() => this._tick(), 25);
          await resumed;
        }
      } catch (err) {
        console.warn('[AudioEngine] audio unavailable:', err);
        this._ready = false;
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
      } finally {
        this._starting = null;
      }
    })();
    return this._starting;
  }

  /** Duck quickly then suspend (true), or resume and unduck (false). */
  setPaused(paused) {
    if (!this._ready) return;
    paused = !!paused;
    if (paused === this._paused) return;
    this._paused = paused;
    const ctx = this._ctx;
    const token = ++this._pauseToken;
    const g = this._pause.gain;
    if (paused) {
      const now = ctx.currentTime;
      hold(g, now);
      g.setTargetAtTime(0, now, 0.04);
      if (!this._offline) {
        setTimeout(() => {
          if (token === this._pauseToken && this._paused) ctx.suspend().catch(() => {});
        }, 220);
      }
    } else {
      const resumed = this._offline ? Promise.resolve() : ctx.resume().catch(() => {});
      resumed.then(() => {
        if (token !== this._pauseToken) return;
        const now = ctx.currentTime;
        hold(g, now);
        g.setTargetAtTime(1, now, 0.08);
      });
    }
  }

  /** Master volume 0..1 (smoothed). */
  setMasterVolume(v) {
    this._volume = clamp01(finite(v, this._volume));
    if (this._ready) glide(this._master.gain, this._volume, this._ctx.currentTime, 0.05);
  }

  /**
   * Per-frame update. Missing fields keep their previous value; everything is
   * clamped. Also pumps the lookahead scheduler.
   * @param {number} dt seconds since last frame
   * @param {object} state see STATE_RANGES
   */
  update(dt, state) {
    if (!this._ready) return;
    const s = this._s;
    if (state && typeof state === 'object') {
      for (const k in STATE_RANGES) {
        const v = state[k];
        if (typeof v === 'number' && Number.isFinite(v)) s[k] = clamp(v, STATE_RANGES[k][0], STATE_RANGES[k][1]);
      }
    }
    dt = clamp(finite(dt, 1 / 60), 0, 0.25);
    const now = this._ctx.currentTime;
    const r = this._rng;
    const w = this._walk;
    const ou = (x, mu, theta, sigma, lim) => clamp(x + theta * (mu - x) * dt + sigma * Math.sqrt(dt) * gauss(r), -lim, lim);
    w.pitch = ou(w.pitch, 0, 0.7, 0.004, 0.012);
    w.level = ou(w.level, 0, 0.5, 0.07, 0.18);
    w.surface = ou(w.surface, 0, 0.25, 0.3, 0.7);
    w.wind = clamp(ou(w.wind - 0.45, 0, 0.12, 0.25, 0.45) + 0.45, 0, 1);
    w.hiss = ou(w.hiss, 0, 0.6, 0.3, 0.45);
    w.rain = ou(w.rain, 0, 0.3, 0.2, 0.3);

    const speedN = s.speed / 30;
    // --- engine: quiet, warm firing-frequency hum --------------------------
    const e = this._engine;
    const f = (s.rpm / 60) * 2 * (1 + w.pitch);
    glide(e.saw.frequency, f, now, 0.06);
    glide(e.sub.frequency, f * 0.5, now, 0.06);
    glide(e.h2.frequency, f * 2, now, 0.06);
    glide(e.noiseBp.frequency, clamp(f * 2, 40, 300), now, 0.1);
    glide(e.lp.frequency, 150 + 300 * Math.pow(s.throttle, 0.8) + 0.05 * (s.rpm - 700), now, 0.12);
    const engLevel = (0.025 + 0.022 * s.throttle + 0.016 * ((s.rpm - 700) / 2800)) * (1 + w.level);
    glide(e.level.gain, engLevel, now, 0.1);

    // --- road rumble ---------------------------------------------------------
    const rd = this._road;
    glide(rd.level.gain, 0.16 * Math.pow(speedN, 1.15) * (1 + 0.35 * w.surface), now, 0.15);
    glide(rd.lp.frequency, 190 + 110 * speedN + 50 * w.surface, now, 0.3);
    glide(rd.wheelLfo.frequency, Math.max(0.05, s.speed / 1.95), now, 0.1);

    // --- wet tyre hiss & spray ---------------------------------------------
    const ty = this._tyres;
    glide(ty.hiss.gain, 0.13 * s.wetness * Math.pow(speedN, 1.3) * (1 + 0.3 * w.hiss), now, 0.1);
    glide(ty.spray.gain, 0.09 * s.wetness * Math.pow(speedN, 1.5), now, 0.12);
    glide(ty.hp.frequency, 1900 * (1 + 0.15 * w.hiss), now, 0.2);

    // --- wind ------------------------------------------------------------------
    const wd = this._wind;
    const wo = s.windowOpen;
    const v2 = Math.min(1.5, (s.speed / 25) ** 2);
    glide(wd.bp.frequency, expLerp(350, 1400, w.wind) * (1 + 0.3 * wo), now, 0.3);
    glide(wd.bp.Q, lerp(1.1, 0.35, wo), now, 0.2);
    glide(wd.level.gain, 0.32 * v2 * (1 + 1.2 * wo), now, 0.15);
    glide(wd.gap.gain, 0.2 * wo * v2, now, 0.15);
    glide(wd.canopy.gain, 0.06 * s.gust + 0.02, now, 0.4);
    const throb = 0.4 * smoothstep(0.03, 0.4, wo);
    glide(wd.throb.gain, 1 - throb * Math.min(1, v2), now, 0.2);
    glide(wd.throbDepth.gain, throb * Math.min(1, v2), now, 0.2);
    glide(wd.buffet.gain, 0.17 * Math.pow(wo, 0.7) * v2, now, 0.2);
    glide(wd.lfo.frequency, 12 + 6 * clamp01(s.speed / 30), now, 0.3);

    // --- rain on the roof (cabin) and outside ------------------------------------
    const rr = this._rainRoof;
    const rain = s.rain;
    glide(rr.light.gain, smoothstep(0, 0.4, rain) * (1 - 0.3 * smoothstep(0.6, 1, rain)), now, 0.3);
    glide(rr.heavy.gain, smoothstep(0.3, 1, rain), now, 0.3);
    glide(rr.tone.frequency, expLerp(3500, 9500, rain), now, 0.3);
    glide(rr.level.gain, 0.3 * Math.pow(rain, 0.4) * (1 + 0.25 * w.rain), now, 0.25);
    glide(this._rainOut.drops.gain, 0.3 * rain, now, 0.3);
    glide(this._rainOut.hiss.gain, 0.17 * rain, now, 0.3);

    // --- exterior insulation, fog, muffle -------------------------------------------
    const x = this._ext;
    const wp = 1 - (1 - wo) * (1 - wo);
    const m = s.muffle;
    const insulHz = Math.min(this._nyq, 800 * Math.pow(15, wp));
    const muffleHz = Math.min(this._nyq, 20000 * Math.pow(380 / 20000, Math.pow(m, 0.8)));
    for (const c of x.chains) {
      glide(c.insul.frequency, insulHz, now, 0.08);
      glide(c.insulGain.gain, 0.35 + 0.65 * wp, now, 0.08);
      glide(c.fog.gain, -10 * s.fog, now, 0.5);
      glide(c.muffle.frequency, muffleHz, now, 0.12);
      glide(c.muffleGain.gain, 1 - 0.3 * m, now, 0.12);
    }
    glide(x.leak.gain, 0.06 * (1 - wp), now, 0.08);

    // --- score drone -----------------------------------------------------------------
    const d = s.dread;
    glide(this._drone.level.gain, 0.026 * d * d * smoothstep(0.08, 0.22, d), now, 0.6);
    glide(this._drone.shimmer.gain, 0.015 * smoothstep(0.45, 1, d), now, 0.8);

    this._radio.update(now, s.radioInterference);
    this._forest.update(now, s.insects);
    this._tick();
  }

  // ---- one-shots ----------------------------------------------------------------

  /** Road bump / pothole: low thump + interior rattle. */
  bump(strength = 0.5) {
    if (this._ready) sfx.bump(this._fx, clamp(finite(strength, 0.5), 0, 1));
  }

  /** One wiper sweep (~0.55-0.8 s). */
  wiperStroke(duration = 0.7) {
    if (this._ready) sfx.wiperStroke(this._fx, clamp(finite(duration, 0.7), 0.3, 2));
  }

  /** Thunder: 0 = near crack + roar, 1 = very distant rumble (onset delayed ~distance*2.5 s). */
  thunder(distance = 0.5) {
    if (this._ready) sfx.thunder(this._fx, clamp01(finite(distance, 0.5)));
  }

  /** Oncoming car passing by: { side: -1|1, duration: ~2.5, loudness: 0..1 }. */
  passBy(opts = {}) {
    if (this._ready) sfx.passBy(this._fx, opts && typeof opts === 'object' ? opts : {});
  }

  /** Score stinger: 'notice' | 'heartbeat' | 'swell' | 'glitch' | 'arrival'. */
  stinger(kind) {
    if (this._ready) sfx.stinger(this._fx, String(kind));
  }

  /** The engine hum stutters/dips briefly. */
  engineFalter(duration = 0.8) {
    if (this._ready) sfx.engineFalter(this._fx, clamp(finite(duration, 0.8), 0.1, 4));
  }

  /** Power-window motor whine. */
  windowMotor(duration = 1.5) {
    if (this._ready) sfx.windowMotor(this._fx, clamp(finite(duration, 1.5), 0.3, 5));
  }

  /** Small interior switch click. */
  click() {
    if (this._ready) sfx.click(this._fx);
  }

  /** Radio on/off with a soft click and a short burst of static. */
  radioPower(on) {
    if (!this._ready) return;
    sfx.click(this._fx, 0.8);
    this._radio.setPower(!!on, this._ctx.currentTime + 0.02);
  }

  /** Cycle FM -> AM -> OFF (with a short tuning burst; no click); returns the new label. */
  radioNext() {
    if (!this._ready) return this.radioLabel;
    return this._radio.next(this._ctx.currentTime + 0.02);
  }

  /** "96.4 FM · NIGHT DRIVE", "AM 1520 · ···" or "OFF". Before start() it names the station the radio starts on. */
  get radioLabel() {
    return this._ready ? this._radio.label : '96.4 FM · NIGHT DRIVE';
  }

  /** Failing sodium streetlight buzz: level 0..1, pan -1..1. */
  setBuzz(level, pan) {
    this._buzz.level = clamp01(finite(level, this._buzz.level));
    this._buzz.pan = clamp(finite(pan, this._buzz.pan), -1, 1);
    if (!this._ready) return;
    const now = this._ctx.currentTime;
    glide(this._buzzNodes.level.gain, 0.15 * Math.pow(this._buzz.level, 1.2), now, 0.15);
    this._buzzNodes.pan.set(this._buzz.pan, now, 0.15);
  }

  // ---- internals ----------------------------------------------------------------

  _tick() {
    if (!this._ready) return;
    const now = this._ctx.currentTime;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const until = now + (hidden ? 1.5 : LOOKAHEAD);
    try {
      this._radio.schedule(now, until);
      this._forest.schedule(now, until);
      this._scheduleWeather(now, until);
    } catch (err) {
      if (!this._warned) console.warn('[AudioEngine] scheduler error:', err);
      this._warned = true;
    }
  }

  _scheduleWeather(now, until) {
    const s = this._s;
    const r = this._rng;
    const wx = this._wx;
    if (wx.nextGust < until) {
      const t = Math.max(wx.nextGust, now);
      const g = this._wind.gust.gain;
      if (s.gust > 0.03) {
        const rise = randRange(r, 0.4, 1.4);
        const top = randRange(r, 0.2, 1.2);
        const fall = randRange(r, 0.8, 2.5);
        g.setTargetAtTime(1 + s.gust * randRange(r, 0.5, 1.6), t, rise / 3);
        g.setTargetAtTime(randRange(r, 0.75, 1), t + rise + top, fall / 3);
        wx.nextGust = t + rise + top + fall * randRange(r, 0.4, 1) + randRange(r, 0.5, 6) * (1.3 - s.gust);
      } else {
        g.setTargetAtTime(1, t, 0.8);
        wx.nextGust = t + 1;
      }
    }
    if (wx.nextPuddle < until) {
      const t = Math.max(wx.nextPuddle, now);
      const wet = s.wetness * clamp01(s.speed / 12);
      if (wet > 0.1 && r() < 0.8) {
        const p = this._tyres.puddle.gain;
        p.setTargetAtTime(1 + wet * randRange(r, 0.5, 2), t, 0.03);
        p.setTargetAtTime(1, t + randRange(r, 0.1, 0.45), 0.12);
      }
      wx.nextPuddle = t + randRange(r, 1.2, 6) / Math.max(0.3, wet + 0.2);
    }
    if (wx.nextFlicker < until) {
      const t = Math.max(wx.nextFlicker, now);
      let next = t + randRange(r, 0.6, 3);
      if (this._buzz.level > 0.02 && r() < 0.7) next = Math.max(next, sfx.buzzFlicker(this._fx, t, 0.6 + 0.4 * r()) + 0.3);
      wx.nextFlicker = next;
    }
  }

  _build() {
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const r = this._rng;
    this._nyq = ctx.sampleRate * 0.45;
    const res = {
      noise: makeNoiseBuffers(ctx, 4.5),
      crackle: renderCrackle(ctx),
      rainLight: renderRainRoof(ctx, { seconds: 3.4, taps: 380, heavy: 9, bed: 0.05, seed: 7 }),
      rainHeavy: renderRainRoof(ctx, { seconds: 2.65, taps: 1700, heavy: 34, bed: 0.25, seed: 8 }),
      rainOut: renderRainOutdoor(ctx),
    };
    this._res = res;
    const N = res.noise;

    // --- master chain --------------------------------------------------------
    this._master = gainNode(ctx, this._volume);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.01;
    comp.release.value = 0.35;
    const pre = gainNode(ctx, 0.5);
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSafetyCurve();
    const post = gainNode(ctx, 2);
    this._master.connect(comp).connect(pre).connect(shaper).connect(post).connect(ctx.destination);
    this._pause = gainNode(ctx, 1);
    this._pause.connect(this._master);

    // --- diegetic mix with "holding breath" muffle --------------------------------
    const diegetic = gainNode(ctx, 1);
    const muffle = biquad(ctx, 'lowpass', this._nyq, 0.6);
    const muffleGain = gainNode(ctx, 1);
    diegetic.connect(muffle).connect(muffleGain).connect(this._pause);

    // --- score bus ---------------------------------------------------------------------
    const score = gainNode(ctx, 1);
    score.connect(this._pause);
    const bigVerb = ctx.createConvolver();
    bigVerb.normalize = false;
    bigVerb.buffer = makeReverbIR(ctx, { duration: 3.4, rt60: 3.1, preDelay: 0.03, attack: 0.06, cutStart: 6000, cutEnd: 1300, seed: 3, level: 0.8 });
    bigVerb.connect(this._pause);
    const scoreVerb = gainNode(ctx, 1);
    scoreVerb.connect(bigVerb);

    // --- cabin bus -----------------------------------------------------------------------
    const cabin = gainNode(ctx, 1);
    cabin.connect(diegetic);
    const cabinSend = gainNode(ctx, 0.22);
    const cabinConv = ctx.createConvolver();
    cabinConv.normalize = false;
    cabinConv.buffer = makeReverbIR(ctx, {
      duration: 0.28, rt60: 0.2, preDelay: 0.002, attack: 0.002, cutStart: 6000, cutEnd: 1800, seed: 5, level: 0.8,
      early: [{ t: 0.0023, g: 0.5, spread: 0.0004 }, { t: 0.0041, g: 0.35, spread: -0.0006 }, { t: 0.0067, g: 0.3, spread: 0.0009 }, { t: 0.0098, g: 0.2, spread: 0.0003 }],
    });
    cabin.connect(cabinSend).connect(cabinConv).connect(diegetic);

    // --- exterior bus: fog shelf -> cabin insulation (+ faint high leak) -------------------
    const ext = gainNode(ctx, 1);
    const fog = biquad(ctx, 'highshelf', 3000, 0.7, 0);
    const insul = biquad(ctx, 'lowpass', 800, 0.6);
    const insulGain = gainNode(ctx, 0.35);
    const leakHp = biquad(ctx, 'highpass', 1800, 0.6);
    const leak = gainNode(ctx, 0.06);
    ext.connect(fog);
    fog.connect(insul).connect(insulGain).connect(diegetic);
    fog.connect(leakHp).connect(leak).connect(insulGain);
    // outdoor reverb send: same fog/insulation/muffle response, applied before the shared IR
    const extVerb = gainNode(ctx, 0.85);
    const v = {
      fog: biquad(ctx, 'highshelf', 3000, 0.7, 0),
      insul: biquad(ctx, 'lowpass', 800, 0.6),
      insulGain: gainNode(ctx, 0.35),
      muffle: biquad(ctx, 'lowpass', this._nyq, 0.6),
      muffleGain: gainNode(ctx, 1),
    };
    extVerb.connect(v.fog).connect(v.insul).connect(v.insulGain).connect(v.muffle).connect(v.muffleGain).connect(bigVerb);
    this._ext = { leak, chains: [{ fog, insul, insulGain, muffle, muffleGain }, v] };

    this._bus = { cabin, ext, extVerb, score, scoreVerb };

    // --- 1. engine ---------------------------------------------------------------------
    const eSum = monoGain(ctx, 1);
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    const sub = ctx.createOscillator();
    const h2 = ctx.createOscillator();
    saw.connect(gainNode(ctx, 0.3)).connect(eSum);
    sub.connect(gainNode(ctx, 0.35)).connect(eSum);
    h2.connect(gainNode(ctx, 0.2)).connect(eSum);
    const eNoise = loopSource(ctx, N.brown, now, r);
    const noiseBp = biquad(ctx, 'bandpass', 100, 0.8);
    eNoise.connect(monoGain(ctx, 0.6)).connect(noiseBp).connect(eSum);
    const eLp = biquad(ctx, 'lowpass', 300, 0.5);
    const eLevel = gainNode(ctx, 0);
    const falter = gainNode(ctx, 1);
    eSum.connect(eLp).connect(eLevel).connect(falter).connect(cabin);
    for (const o of [saw, sub, h2]) o.start(now);
    this._engine = { saw, sub, h2, noiseBp, lp: eLp, level: eLevel, falter, oscs: [saw, sub, h2] };

    // --- 2. road rumble ------------------------------------------------------------------
    const road = loopSource(ctx, N.brown, now, r);
    const rHp = biquad(ctx, 'highpass', 45, 0.7);
    const rLp = biquad(ctx, 'lowpass', 250, 0.7);
    const rLevel = gainNode(ctx, 0);
    const wheel = gainNode(ctx, 1);
    const wheelLfo = ctx.createOscillator();
    wheelLfo.frequency.value = 0.1;
    wheelLfo.connect(gainNode(ctx, 0.08)).connect(wheel.gain);
    road.connect(rHp).connect(rLp).connect(rLevel).connect(wheel).connect(cabin);
    wheelLfo.start(now);
    this._road = { level: rLevel, lp: rLp, wheelLfo };

    // --- 3. wet tyre hiss + spray ---------------------------------------------------------
    const hissSrc = loopSource(ctx, N.white, now, r);
    const tHp = biquad(ctx, 'highpass', 1900, 0.5);
    const tLp = biquad(ctx, 'lowpass', 7000, 0.5);
    const hiss = gainNode(ctx, 0);
    const puddle = gainNode(ctx, 1);
    hissSrc.connect(tHp).connect(tLp).connect(hiss).connect(puddle).connect(cabin);
    const sprSrc = loopSource(ctx, N.pink, now, r);
    const sBp = biquad(ctx, 'bandpass', 750, 0.6);
    const spray = gainNode(ctx, 0);
    sprSrc.connect(sBp).connect(spray).connect(puddle);
    this._tyres = { hiss, spray, puddle, hp: tHp };

    // --- 4. wind (+ open-window gap hiss and buffeting) -----------------------------------
    const windSrc = loopSource(ctx, N.pink, now, r);
    const wBp = biquad(ctx, 'bandpass', 700, 1.1);
    const wLevel = gainNode(ctx, 0);
    const throb = gainNode(ctx, 1);
    const gust = gainNode(ctx, 1);
    windSrc.connect(wBp).connect(wLevel).connect(throb).connect(gust).connect(ext);
    const canSrc = loopSource(ctx, N.pink, now, r);
    const canBp = biquad(ctx, 'bandpass', 1000, 0.35);
    const canopy = gainNode(ctx, 0);
    canSrc.connect(canBp).connect(canopy).connect(gust);
    const windowPan = createPan(ctx, 0.4 * this._windowSide);
    const gapSrc = loopSource(ctx, N.white, now, r);
    const gHp = biquad(ctx, 'highpass', 1100, 0.6);
    const gLp = biquad(ctx, 'lowpass', 7000, 0.6);
    const gap = gainNode(ctx, 0);
    gapSrc.connect(gHp).connect(gLp).connect(gap).connect(throb);
    // buffeting: a 12-18 Hz pressure throb inside the cabin
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 14;
    const throbDepth = gainNode(ctx, 0);
    lfo.connect(throbDepth).connect(throb.gain);
    const bufSrc = loopSource(ctx, N.brown, now, r);
    const bLp = biquad(ctx, 'lowpass', 150, 0.7);
    const bAm = gainNode(ctx, 0.5);
    lfo.connect(gainNode(ctx, 0.5)).connect(bAm.gain);
    const buffet = gainNode(ctx, 0);
    bufSrc.connect(bLp).connect(bAm).connect(buffet).connect(windowPan.input);
    windowPan.output.connect(cabin);
    lfo.start(now);
    this._wind = { bp: wBp, level: wLevel, gap, canopy, throb, throbDepth, buffet, lfo, gust };

    // --- 5. rain on the roof --------------------------------------------------------------------
    const rlSrc = loopSource(ctx, res.rainLight, now, r);
    const rhSrc = loopSource(ctx, res.rainHeavy, now, r);
    const rlG = gainNode(ctx, 0);
    const rhG = gainNode(ctx, 0);
    const rTone = biquad(ctx, 'lowpass', 3000, 0.5);
    const rrLevel = gainNode(ctx, 0);
    rlSrc.connect(rlG).connect(rTone);
    rhSrc.connect(rhG).connect(rTone);
    rTone.connect(rrLevel).connect(cabin);
    this._rainRoof = { light: rlG, heavy: rhG, tone: rTone, level: rrLevel };

    // --- 6. outdoor rain -----------------------------------------------------------------------
    const roSrc = loopSource(ctx, res.rainOut, now, r);
    const drops = gainNode(ctx, 0);
    roSrc.connect(drops).connect(ext);
    const rhSrc2 = loopSource(ctx, N.pink, now, r);
    const roHp = biquad(ctx, 'highpass', 500, 0.6);
    const roLp = biquad(ctx, 'lowpass', 9000, 0.6);
    const roHiss = gainNode(ctx, 0);
    rhSrc2.connect(roHp).connect(roLp).connect(roHiss).connect(ext);
    this._rainOut = { drops, hiss: roHiss };

    // --- 7. forest ---------------------------------------------------------------------------
    this._forest = new Forest(ctx, ext, extVerb, res, now, diegetic);

    // --- 8. drone (score) ----------------------------------------------------------------------
    const dLevel = gainNode(ctx, 0);
    const dLp = biquad(ctx, 'lowpass', 150, 2.5);
    const dLfo = ctx.createOscillator();
    dLfo.frequency.value = 0.037;
    dLfo.connect(gainNode(ctx, 70)).connect(dLp.frequency);
    dLp.connect(dLevel);
    dLevel.connect(score);
    dLevel.connect(gainNode(ctx, 0.3)).connect(scoreVerb);
    const rub = gainNode(ctx, 0.2);
    const rubLfo = ctx.createOscillator();
    rubLfo.frequency.value = 0.071;
    rubLfo.connect(gainNode(ctx, 0.18)).connect(rub.gain);
    rub.connect(dLp);
    const droneOsc = [];
    for (const [fq, type, g, dest] of [
      [41.2, 'triangle', 0.5, dLp], [41.53, 'sine', 0.4, dLp], [55, 'sine', 0.28, dLp],
      [82.6, 'triangle', 0.22, dLp], [43.65, 'triangle', 1, rub],
    ]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = fq;
      o.connect(gainNode(ctx, g)).connect(dest);
      droneOsc.push(o);
    }
    const shimmer = gainNode(ctx, 0);
    const trem = gainNode(ctx, 0.6);
    const tremLfo = ctx.createOscillator();
    tremLfo.frequency.value = 0.13;
    tremLfo.connect(gainNode(ctx, 0.4)).connect(trem.gain);
    for (const [fq, g] of [[1318.5, 0.4], [1975.5, 0.28], [1396.9, 0.14], [2637, 0.08]]) {
      const o = ctx.createOscillator();
      o.frequency.value = fq;
      o.connect(gainNode(ctx, g)).connect(trem);
      droneOsc.push(o);
    }
    const airSrc = loopSource(ctx, N.white, now, r);
    const airBp = biquad(ctx, 'bandpass', 7000, 1.4);
    airSrc.connect(airBp).connect(gainNode(ctx, 0.5)).connect(trem);
    trem.connect(shimmer);
    shimmer.connect(score);
    shimmer.connect(gainNode(ctx, 0.8)).connect(scoreVerb);
    for (const o of [...droneOsc, dLfo, rubLfo, tremLfo]) o.start(now);
    this._drone = { level: dLevel, shimmer };

    // --- 9. radio --------------------------------------------------------------------------------
    this._radio = new Radio(ctx, cabin, res, now);

    // --- 10. streetlight buzz -------------------------------------------------------------------
    const bSaw = ctx.createOscillator();
    bSaw.type = 'sawtooth';
    bSaw.frequency.value = 120;
    const bSq = ctx.createOscillator();
    bSq.type = 'square';
    bSq.frequency.value = 120;
    const bSum = gainNode(ctx, 1);
    bSaw.connect(biquad(ctx, 'lowpass', 2600, 0.7)).connect(gainNode(ctx, 0.5)).connect(bSum);
    bSq.connect(biquad(ctx, 'bandpass', 1300, 0.8)).connect(gainNode(ctx, 0.2)).connect(bSum);
    const bCr = loopSource(ctx, res.crackle, now, r, 1.6);
    const crackle = gainNode(ctx, 0.15);
    bCr.connect(crackle).connect(bSum);
    const flicker = gainNode(ctx, 1);
    const bLevel = gainNode(ctx, 0);
    const bPan = createPan(ctx, 0);
    bSum.connect(flicker).connect(bLevel).connect(bPan.input);
    bPan.output.connect(ext);
    bPan.output.connect(gainNode(ctx, 0.06)).connect(cabin);
    bSaw.start(now);
    bSq.start(now);
    this._buzzNodes = { level: bLevel, pan: bPan, flicker, crackle };

    this._wx = { nextGust: now + 1, nextPuddle: now + 2, nextFlicker: now + 0.5 };
    this._fx = {
      ctx, res, bus: this._bus, rng: r, state: this._s,
      engine: this._engine, radio: this._radio, windowSide: this._windowSide,
      buzz: this._buzzNodes,
    };
    if (this._buzz.level > 0) {
      bLevel.gain.value = 0.15 * Math.pow(this._buzz.level, 1.2);
      bPan.set(this._buzz.pan, now, 0.01);
    }
  }
}

export default AudioEngine;
