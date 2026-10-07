/*
 * A Voice owns every node of one sound (or one ambience layer). Nodes are
 * created "upstream": each builder connects the new node into the destination
 * you pass, so a chain reads from output to input.
 *
 *   const amp = v.gain(0, v.out);
 *   const bp = v.filter('bandpass', 2000, 1, amp);
 *   v.noise(t, t + 0.2, bp);
 *
 * When the last scheduled source ends, the voice disconnects everything.
 */
import { SILENT, approach } from './dsp';
import type { Graph } from './graph';

export type Dest = AudioNode | AudioParam;

function link(node: AudioNode, dest: Dest): void {
  if (dest instanceof AudioParam) node.connect(dest);
  else node.connect(dest);
}

export class Voice {
  readonly g: Graph;
  readonly ctx: BaseAudioContext;
  /** Voice output — every chain ends here. */
  readonly out: GainNode;
  /** Start time and pitch multiplier for the design. */
  readonly t: number;
  readonly p: number;
  /** Latest scheduled stop time of any source. */
  end: number;
  /** Called once, after the voice has released its nodes. */
  onDispose: (() => void) | null = null;

  private readonly wetDest: AudioNode;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private live = 0;
  private disposed = false;

  constructor(g: Graph, dest: AudioNode, wetDest: AudioNode, t: number, pitch: number, level: number) {
    this.g = g;
    this.ctx = g.ctx;
    this.t = t;
    this.p = pitch;
    this.end = t;
    this.wetDest = wetDest;
    this.out = g.ctx.createGain();
    this.out.gain.value = level;
    this.out.connect(dest);
    this.nodes.push(this.out);
  }

  get done(): boolean {
    return this.disposed;
  }

  private own<T extends AudioNode>(node: T, dest?: Dest): T {
    this.nodes.push(node);
    if (dest) link(node, dest);
    return node;
  }

  gain(value: number, dest?: Dest): GainNode {
    const n = this.ctx.createGain();
    n.gain.value = value;
    return this.own(n, dest);
  }

  filter(type: BiquadFilterType, freq: number, q: number, dest?: Dest): BiquadFilterNode {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = freq;
    n.Q.value = q;
    return this.own(n, dest);
  }

  shaper(curve: Float32Array<ArrayBuffer>, dest?: Dest, oversample: OverSampleType = '2x'): WaveShaperNode {
    const n = this.ctx.createWaveShaper();
    n.curve = curve;
    n.oversample = oversample;
    return this.own(n, dest);
  }

  /** Stereo placement; `pan` is null on browsers without StereoPannerNode. */
  pan(value: number, dest?: Dest): { node: AudioNode; pan: AudioParam | null } {
    if (typeof this.ctx.createStereoPanner !== 'function') return { node: this.gain(1, dest), pan: null };
    const n = this.ctx.createStereoPanner();
    n.pan.value = value;
    return { node: this.own(n, dest), pan: n.pan };
  }

  /** Post-fader reverb send. */
  send(amount: number, from: AudioNode = this.out): GainNode {
    const s = this.gain(amount, this.wetDest);
    from.connect(s);
    return s;
  }

  /** Post-fader send into the shared feedback delay. */
  echo(amount: number, from: AudioNode = this.out): GainNode {
    const s = this.gain(amount, this.g.echo);
    from.connect(s);
    return s;
  }

  /** Oscillator from t0 to t1 (omit t1 for a free-running layer). */
  osc(type: OscillatorType, freq: number, t0: number, t1: number | null, dest: Dest, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    this.own(o, dest);
    this.schedule(o, t0, t1);
    return o;
  }

  /** Looping noise from a random point of `buffer` (white by default). */
  noise(t0: number, t1: number | null, dest: Dest, rate = 1, buffer: AudioBuffer = this.g.white): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.playbackRate.value = rate;
    this.own(s, dest);
    this.schedule(s, t0, t1, Math.random() * buffer.duration);
    return s;
  }

  private schedule(src: AudioScheduledSourceNode, t0: number, t1: number | null, offset?: number): void {
    this.sources.push(src);
    this.live++;
    src.onended = () => {
      this.live--;
      if (this.live <= 0) this.dispose();
    };
    if (offset !== undefined && src instanceof AudioBufferSourceNode) src.start(t0, offset);
    else src.start(t0);
    if (t1 !== null) {
      src.stop(t1);
      this.end = Math.max(this.end, t1);
    } else {
      this.end = Infinity;
    }
  }

  /** Fade the whole voice out and stop every source after the fade. */
  release(fade: number, at = this.ctx.currentTime): void {
    if (this.disposed) return;
    approach(this.out.gain, at, 0, Math.max(0.005, fade / 4));
    const stopAt = at + fade + 0.02;
    for (const s of this.sources) {
      try {
        s.stop(stopAt);
      } catch {
        /* already stopped */
      }
    }
    this.end = Math.min(this.end, stopAt);
  }

  /** Called after building: a design that scheduled nothing is freed at once. */
  seal(): void {
    if (this.live <= 0) this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* not started / already stopped */
      }
    }
    for (const n of this.nodes) n.disconnect();
    this.nodes.length = 0;
    this.sources.length = 0;
    this.onDispose?.();
    this.onDispose = null;
  }
}

/** Convenience: start the out-gain at silence for a fade-in to `level`. */
export function fadeIn(v: Voice, level: number, seconds: number): void {
  const t = v.ctx.currentTime;
  v.out.gain.cancelScheduledValues(t);
  v.out.gain.setValueAtTime(SILENT, t);
  v.out.gain.setTargetAtTime(level, t, seconds / 3);
}
