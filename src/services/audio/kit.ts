/*
 * Reusable instrument fragments. Each schedules a few nodes on a Voice and
 * returns the handles a design may want to automate further.
 */
import { ad, ahr, glide } from './dsp';
import type { Dest, Voice } from './voice';

/** One oscillator partial with its own attack/decay envelope. */
export function tone(
  v: Voice,
  type: OscillatorType,
  freq: number,
  t: number,
  attack: number,
  peak: number,
  decay: number,
  dest: Dest = v.out,
  detune = 0,
): OscillatorNode {
  const amp = v.gain(0, dest);
  ad(amp.gain, t, attack, peak, decay);
  return v.osc(type, freq, t, t + attack + decay + 0.02, amp, detune);
}

/** Filtered white-noise burst with an attack/decay envelope. */
export function hiss(
  v: Voice,
  t: number,
  attack: number,
  peak: number,
  decay: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  dest: Dest = v.out,
  rate = 1,
): { amp: GainNode; filter: BiquadFilterNode; src: AudioBufferSourceNode } {
  const amp = v.gain(0, dest);
  ad(amp.gain, t, attack, peak, decay);
  const filter = v.filter(type, freq, q, amp);
  const src = v.noise(t, t + attack + decay + 0.02, filter, rate);
  return { amp, filter, src };
}

/** Sine with a falling pitch envelope — kicks, booms, heartbeats, button bodies. */
export function thump(
  v: Voice,
  t: number,
  from: number,
  to: number,
  sweep: number,
  peak: number,
  decay: number,
  dest: Dest = v.out,
): OscillatorNode {
  const o = tone(v, 'sine', from, t, 0.002, peak, decay, dest);
  glide(o.frequency, t, from, to, sweep);
  return o;
}

/** Glassy chime: sine fundamental, soft octave, an inharmonic glint and a warm sub-octave. */
export function chime(v: Voice, freq: number, t: number, peak: number, decay: number, dest: Dest = v.out): void {
  tone(v, 'sine', freq, t, 0.003, peak, decay, dest);
  tone(v, 'sine', freq * 2, t, 0.002, peak * 0.3, decay * 0.55, dest, 3);
  tone(v, 'sine', freq * 3.01, t, 0.001, peak * 0.1, decay * 0.3, dest);
  tone(v, 'triangle', freq * 0.5, t, 0.006, peak * 0.16, decay * 0.7, dest);
}

/**
 * Warm detuned-saw note through a low-pass that blooms open then settles —
 * brass stabs and pads. `cutoff` = [start, bloom, settle] in Hz.
 */
export function saws(
  v: Voice,
  freq: number,
  t: number,
  attack: number,
  peak: number,
  hold: number,
  release: number,
  cutoff: readonly [number, number, number],
  dest: Dest = v.out,
  spread = 9,
): BiquadFilterNode {
  const amp = v.gain(0, dest);
  ahr(amp.gain, t, attack, peak, hold, release);
  const lp = v.filter('lowpass', cutoff[0], 1.1, amp);
  lp.frequency.setValueAtTime(cutoff[0], t);
  lp.frequency.exponentialRampToValueAtTime(cutoff[1], t + attack + 0.05);
  lp.frequency.exponentialRampToValueAtTime(cutoff[2], t + attack + hold + release * 0.6);
  const end = t + attack + hold + release + 0.02;
  v.osc('sawtooth', freq, t, end, lp, -spread);
  v.osc('sawtooth', freq, t, end, lp, spread);
  return lp;
}
