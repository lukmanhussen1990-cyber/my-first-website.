/*
 * Ambient soundscape — a rain-soaked, abandoned neon city at night.
 *
 *   city     drone (detuned saws under a breathing ~180 Hz low-pass)
 *            + rain hiss and drop texture (stereo) + wandering wind
 *            + faint high shimmer + distant events every 8–20 s
 *            (far metallic hits, a siren wail, a low rumble)
 *   tension  the city bed plus a sub heartbeat (~70 bpm) and a dissonant pad
 *
 * The bed is long-lived; switching kinds crossfades only the tension layer
 * (~1.5 s) over it, so the city never "restarts".
 */
import type { Ambience } from '../audio';
import { SILENT, approach, driveCurve, rand, randLog } from './dsp';
import { beds, type Graph } from './graph';
import { hiss, tone } from './kit';
import { Voice, fadeIn } from './voice';

const XFADE = 1.5;
const BPM = 70;
/** Overall soundscape level — a bed under the UI, never competing with it. */
const LEVEL = 0.65;

/** Layer levels (linear gain into the music bus). Tuned so the bed sits well under the UI. */
export const MIX = {
  drone: 0.02,
  rain: 0.062,
  drops: 0.1,
  wind: 0.06,
  shimmer: 0.45,
  events: 1,
  heartbeat: 0.5,
  pad: 0.75,
};

type Timer = ReturnType<typeof setTimeout>;

interface Bed {
  voice: Voice;
  rain: GainNode;
  shimmer: GainNode;
}

function cityBed(v: Voice): Bed {
  const { t } = v;
  const b = beds(v.g);

  // Drone: two detuned saws on A1 + a quiet fifth, under a resonant low-pass
  // whose cutoff and level breathe on slow LFOs.
  const drone = v.gain(MIX.drone, v.out);
  const lp = v.filter('lowpass', 180, 2.2, drone);
  v.osc('sine', 0.045, t, null, v.gain(55, lp.frequency));
  v.osc('sine', 0.031, t, null, v.gain(MIX.drone * 0.3, drone.gain));
  v.osc('sawtooth', 55, t, null, lp, -7);
  v.osc('sawtooth', 55, t, null, lp, 6);
  v.osc('sawtooth', 82.41, t, null, v.gain(0.35, lp), 3);
  v.osc('sine', 55, t, null, v.gain(0.35, drone));
  v.send(0.2, drone);

  // Rain: two decorrelated pink loops panned wide, band-limited to a soft hiss,
  // plus a sparse drop texture for detail.
  const rain = v.gain(MIX.rain, v.out);
  v.osc('sine', 0.023, t, null, v.gain(MIX.rain * 0.2, rain.gain));
  for (const [pan, rate] of [
    [-0.65, 1],
    [0.65, 0.973],
  ]) {
    const pn = v.pan(pan, rain);
    const lpf = v.filter('lowpass', 6800, 0.5, pn.node);
    const hpf = v.filter('highpass', 950, 0.6, lpf);
    v.noise(t, null, hpf, rate, b.pink);
  }
  const drops = v.gain(MIX.drops, v.out);
  for (const [pan, rate] of [
    [-0.45, 1],
    [0.5, 0.91],
  ]) {
    const pn = v.pan(pan, drops);
    const bp = v.filter('bandpass', 3200, 0.45, pn.node);
    v.noise(t, null, bp, rate, b.drops);
  }
  v.send(0.25, drops);

  // Wind: brown noise through a wandering resonant low-pass, slow swells.
  const wind = v.gain(MIX.wind, v.out);
  const wlp = v.filter('lowpass', 380, 3, wind);
  v.osc('sine', 0.053, t, null, v.gain(170, wlp.frequency));
  v.osc('sine', 0.071, t, null, v.gain(MIX.wind * 0.45, wind.gain));
  v.noise(t, null, wlp, 1, b.brown);
  v.send(0.3, wind);

  // Shimmer: faint high sines trembling in and out, mostly heard as reverb.
  const shimmer = v.gain(MIX.shimmer, v.out);
  const partials: [number, number, number][] = [
    [2093, 0.07, -0.5],
    [2637, 0.053, 0.45],
    [3136, 0.041, 0],
  ];
  for (const [f, rate, pan] of partials) {
    const pn = v.pan(pan, shimmer);
    const amp = v.gain(0.004, pn.node);
    v.osc('sine', rate, t, null, v.gain(0.004, amp.gain));
    v.osc('sine', f, t, null, amp, rand(-6, 6));
  }
  v.send(1.1, shimmer);

  return { voice: v, rain, shimmer };
}

/* ── Distant events ────────────────────────────────────────────────────── */

/** A far-off metal hit: inharmonic partials, low-passed by distance, mostly reverb. */
function metalHit(v: Voice): void {
  const { t } = v;
  const pn = v.pan(rand(-0.75, 0.75), v.out);
  const lp = v.filter('lowpass', rand(1500, 2500), 0.7, v.gain(0.4, pn.node));
  const base = randLog(150, 360);
  const strike = (at: number, k: number) => {
    [1, 2.32, 4.25, 6.63, 9.38].forEach((r, i) => {
      tone(v, 'sine', base * r, at, 0.002, (0.05 * k) / (1 + i * 0.7), rand(1.4, 3.0) / (1 + i * 0.35), lp, rand(-8, 8));
    });
    hiss(v, at, 0.001, 0.05 * k, 0.06, 'bandpass', base * 3, 2, lp);
  };
  strike(t, 1);
  if (Math.random() < 0.4) strike(t + rand(0.25, 0.6), rand(0.4, 0.7));
  v.send(1.6 * v.out.gain.value, lp); // pre-out send: scale by the voice level by hand
}

/** A siren wailing somewhere across the city, drifting past. */
function siren(v: Voice): void {
  const { t } = v;
  const dur = rand(6, 9);
  const side = Math.random() < 0.5 ? -1 : 1;
  const pn = v.pan(side * 0.7, v.out);
  if (pn.pan) {
    pn.pan.setValueAtTime(side * 0.7, t);
    pn.pan.linearRampToValueAtTime(-side * 0.3, t + dur);
  }
  const amp = v.gain(0, v.gain(0.45, pn.node));
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.linearRampToValueAtTime(0.03, t + dur * 0.4);
  amp.gain.linearRampToValueAtTime(SILENT, t + dur);
  const bp = v.filter('bandpass', 950, 1.1, amp);
  const o = v.osc('triangle', 760, t, t + dur + 0.05, bp);
  o.frequency.setValueAtTime(rand(720, 820), t);
  o.frequency.linearRampToValueAtTime(rand(630, 690), t + dur); // doppler as it passes
  v.osc('sine', rand(0.22, 0.32), t, t + dur + 0.05, v.gain(150, o.frequency));
  v.send(1.8 * v.out.gain.value, amp);
}

/** Low rumble — thunder far away, or something heavy collapsing. */
function rumble(v: Voice): void {
  const { t } = v;
  const dur = rand(3.5, 6);
  const amp = v.gain(0, v.out);
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.linearRampToValueAtTime(rand(0.22, 0.34), t + dur * 0.3);
  amp.gain.exponentialRampToValueAtTime(SILENT, t + dur);
  const lp = v.filter('lowpass', 150, 0.9, amp);
  v.osc('sine', rand(1.5, 3), t, t + dur, v.gain(50, lp.frequency));
  v.noise(t, t + dur + 0.05, lp, 0.6, beds(v.g).brown);
  v.send(0.6 * v.out.gain.value, amp);
}

/** Distant one-shot events, by name (exported for offline auditioning). */
export const EVENTS = { metalHit, siren, rumble };

/* ── Tension layer ─────────────────────────────────────────────────────── */

/** How long the ambient heartbeat stays out of the way after a foreground `heartbeat` sfx. */
const DUCK_HOLD = 1.3;

class TensionLayer {
  private readonly voice: Voice;
  private readonly beatBus: GainNode;
  private readonly osc: OscillatorNode;
  private readonly amp: GainNode;
  private readonly harm: OscillatorNode;
  private readonly harmAmp: GainNode;
  private nextBeat: number;
  private timer: ReturnType<typeof setInterval> | null;
  private retire: Timer | null = null;

  constructor(g: Graph, out: AudioNode, wet: AudioNode) {
    const t = g.ctx.currentTime;
    const v = new Voice(g, out, wet, t, 1, 1);
    fadeIn(v, 1, XFADE);
    this.voice = v;

    // Heartbeat: persistent oscillators, envelopes scheduled just ahead.
    this.beatBus = v.gain(MIX.heartbeat, v.out);
    this.amp = v.gain(0, this.beatBus);
    this.osc = v.osc('sine', 60, t, null, this.amp);
    const lp = v.filter('lowpass', 360, 0.7, this.beatBus);
    this.harmAmp = v.gain(0, v.shaper(driveCurve(2), lp));
    this.harm = v.osc('triangle', 120, t, null, this.harmAmp);

    // Dissonant high pad: E5 / F5 / A♯5 (semitone + tritone), slowly trembling.
    const pad = v.gain(MIX.pad, v.out);
    const padLp = v.filter('lowpass', 1900, 0.8, pad);
    v.osc('sine', 0.09, t, null, v.gain(500, padLp.frequency));
    const notes: [number, number][] = [
      [659.26, -0.4],
      [698.46, 0.4],
      [932.33, 0],
    ];
    for (const [f, pan] of notes) {
      const pn = v.pan(pan, padLp);
      const amp = v.gain(0.011, pn.node);
      v.osc('sine', rand(0.11, 0.19), t, null, v.gain(0.008, amp.gain));
      v.osc('triangle', f, t, null, amp, -5);
      v.osc('sine', f, t, null, amp, 6);
    }
    v.send(0.8, pad);

    this.nextBeat = t + 0.5;
    this.timer = setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  get alive(): boolean {
    return !this.voice.done;
  }

  private schedule(): void {
    const ctx = this.voice.ctx;
    const now = ctx.currentTime;
    if (this.nextBeat < now) this.nextBeat = now + 0.05;
    while (this.nextBeat < now + 0.6) {
      const tb = this.nextBeat;
      const pair: [number, number][] = [
        [0, 1],
        [0.26, 0.62],
      ];
      for (const [dt, k] of pair) {
        const at = tb + dt;
        this.osc.frequency.setValueAtTime(74, at);
        this.osc.frequency.exponentialRampToValueAtTime(40, at + 0.11);
        this.amp.gain.setValueAtTime(0, at);
        this.amp.gain.linearRampToValueAtTime(0.42 * k, at + 0.006);
        this.amp.gain.setTargetAtTime(0, at + 0.006, 0.055);
        this.harm.frequency.setValueAtTime(148, at);
        this.harm.frequency.exponentialRampToValueAtTime(80, at + 0.09);
        this.harmAmp.gain.setValueAtTime(0, at);
        this.harmAmp.gain.linearRampToValueAtTime(0.1 * k, at + 0.005);
        this.harmAmp.gain.setTargetAtTime(0, at + 0.005, 0.035);
      }
      this.nextBeat += 60 / BPM;
    }
  }

  /** Step the ambient heartbeat back while a foreground heartbeat plays, so two pulses never flam. */
  duck(): void {
    const t = this.voice.ctx.currentTime;
    const gain = this.beatBus.gain;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(gain.value, t);
    gain.setTargetAtTime(0, t, 0.03);
    gain.setTargetAtTime(MIX.heartbeat, t + DUCK_HOLD, 0.4);
  }

  /** Fade out, then release every node — unless revived before the fade ends. */
  fadeOut(fade: number): void {
    if (!this.alive || this.retire !== null) return;
    approach(this.voice.out.gain, this.voice.ctx.currentTime, 0, fade / 5);
    this.retire = setTimeout(() => this.dispose(), (fade + 0.3) * 1000);
  }

  /** Cancel a pending fade-out and come back up: no restart, no second heartbeat. */
  revive(): void {
    if (this.retire !== null) clearTimeout(this.retire);
    this.retire = null;
    approach(this.voice.out.gain, this.voice.ctx.currentTime, 1, XFADE / 3);
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    if (this.retire !== null) clearTimeout(this.retire);
    this.timer = null;
    this.retire = null;
    this.voice.dispose();
  }
}

/* ── Soundscape ────────────────────────────────────────────────────────── */

export class Soundscape {
  kind: Ambience;
  private readonly g: Graph;
  private readonly out: GainNode;
  private readonly wet: GainNode;
  private readonly bed: Bed;
  private tension: TensionLayer | null = null;
  /** The previous tension layer while it fades out (revived if tension returns in time). */
  private leaving: TensionLayer | null = null;
  private readonly events = new Set<Voice>();
  private eventTimer: Timer | null = null;
  private retire: Timer | null = null;
  private stopping = false;
  private disposed = false;

  constructor(g: Graph, kind: Ambience) {
    this.g = g;
    this.kind = kind;
    const ctx = g.ctx;
    const t = ctx.currentTime;
    this.out = ctx.createGain();
    this.wet = ctx.createGain();
    for (const n of [this.out, this.wet]) {
      n.gain.setValueAtTime(SILENT, t);
      n.gain.setTargetAtTime(LEVEL, t, 0.8); // ~2.5 s fade-in
    }
    this.out.connect(g.musicBus);
    this.wet.connect(g.musicWet);
    this.bed = cityBed(new Voice(g, this.out, this.wet, t, 1, 1));
    if (kind === 'tension') this.enterTension();
    this.queueEvent(rand(4, 9));
  }

  /** Playing (not fading out after `stop`). */
  get active(): boolean {
    return !this.stopping;
  }

  /** Layers currently holding nodes — for tests and the dev inspector. */
  get layers(): { tension: boolean; leaving: boolean; events: number } {
    return { tension: this.tension !== null, leaving: this.leaving?.alive ?? false, events: this.events.size };
  }

  setKind(kind: Ambience): void {
    if (this.stopping || kind === this.kind) return;
    this.kind = kind;
    if (kind === 'tension') this.enterTension();
    else this.leaveTension();
  }

  /** Foreground heartbeat sfx is playing: get the ambient one out of its way. */
  duckHeartbeat(): void {
    this.tension?.duck();
  }

  private enterTension(): void {
    if (this.tension) return;
    const prev = this.leaving?.alive ? this.leaving : null;
    this.leaving = null;
    if (prev) prev.revive();
    this.tension = prev ?? new TensionLayer(this.g, this.out, this.wet);
    // Let the heartbeat sit on top: thin the rain, pull the shimmer back.
    const t = this.g.ctx.currentTime;
    approach(this.bed.rain.gain, t, MIX.rain * 0.7, XFADE / 3);
    approach(this.bed.shimmer.gain, t, MIX.shimmer * 0.5, XFADE / 3);
  }

  private leaveTension(): void {
    if (!this.tension) return;
    this.leaving?.dispose();
    this.leaving = this.tension;
    this.tension = null;
    this.leaving.fadeOut(XFADE);
    const t = this.g.ctx.currentTime;
    approach(this.bed.rain.gain, t, MIX.rain, XFADE / 3);
    approach(this.bed.shimmer.gain, t, MIX.shimmer, XFADE / 3);
  }

  private queueEvent(seconds: number): void {
    if (this.eventTimer !== null) clearTimeout(this.eventTimer);
    this.eventTimer = setTimeout(() => this.fireEvent(), seconds * 1000);
  }

  private fireEvent(): void {
    this.eventTimer = null;
    if (this.stopping) return;
    // Skip while suspended (tab hidden) so events never pile up for the return.
    if (this.g.ctx.state === 'running' && this.events.size < 3) {
      const v = new Voice(this.g, this.out, this.wet, this.g.ctx.currentTime + 0.05, 1, MIX.events);
      const r = Math.random();
      try {
        if (r < 0.42) metalHit(v);
        else if (r < 0.7) siren(v);
        else rumble(v);
        this.events.add(v);
        v.onDispose = () => this.events.delete(v);
        v.seal();
      } catch {
        v.dispose();
      }
    }
    this.queueEvent(rand(8, 20));
  }

  /**
   * Fade everything out over ≈ `fade` seconds, then release every node. Until
   * then `revive` can bring the same soundscape back without a restart.
   */
  stop(fade = XFADE): void {
    if (this.stopping) return;
    this.stopping = true;
    if (this.eventTimer !== null) clearTimeout(this.eventTimer);
    this.eventTimer = null;
    const t = this.g.ctx.currentTime;
    approach(this.out.gain, t, 0, fade / 5);
    approach(this.wet.gain, t, 0, fade / 5);
    this.retire = setTimeout(() => this.dispose(), (fade + 0.4) * 1000);
  }

  /** Undo a `stop` that is still fading out. Returns false once the nodes are gone. */
  revive(kind: Ambience): boolean {
    if (this.disposed) return false;
    if (this.stopping) {
      this.stopping = false;
      if (this.retire !== null) clearTimeout(this.retire);
      this.retire = null;
      const t = this.g.ctx.currentTime;
      approach(this.out.gain, t, LEVEL, 0.5);
      approach(this.wet.gain, t, LEVEL, 0.5);
      this.queueEvent(rand(6, 12));
    }
    this.setKind(kind);
    return true;
  }

  /** Release every node now (after a fade, or when the context is going away). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopping = true;
    for (const timer of [this.eventTimer, this.retire]) if (timer !== null) clearTimeout(timer);
    this.eventTimer = null;
    this.retire = null;
    this.tension?.dispose();
    this.leaving?.dispose();
    this.tension = null;
    this.leaving = null;
    this.bed.voice.dispose();
    for (const e of [...this.events]) e.dispose();
    this.out.disconnect();
    this.wet.disconnect();
  }
}
