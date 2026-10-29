// Voice tools: align a transcript (word timings) to the script, cut the read
// into sentence clips, and re-join them with designed pauses.
import {SR, Stereo} from './dsp.ts';

export interface StWord {
  text: string;
  start: number;
  end: number;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');

/**
 * Align script tokens to transcript words with an edit-distance DP. Returns,
 * for each script token, the index of the matching transcript word (or -1).
 */
export const align = (script: string[], heard: string[]) => {
  const a = script.map(norm);
  const b = heard.map(norm);
  const n = a.length;
  const m = b.length;
  const D = Array.from({length: n + 1}, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  const sub = (x: string, y: string) => (x === y ? 0 : x.replace(/'/g, '') === y.replace(/'/g, '') ? 0 : 1);
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + sub(a[i - 1], b[j - 1]));
  const map = new Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (D[i][j] === D[i - 1][j - 1] + sub(a[i - 1], b[j - 1])) {
      map[i - 1] = j - 1;
      i--;
      j--;
    } else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  return map;
};

/** Fill unmatched script tokens by interpolating between matched neighbours. */
export const fillTimes = (map: number[], heard: StWord[]): {start: number; end: number}[] => {
  const out = map.map((k) => (k >= 0 ? {start: heard[k].start, end: heard[k].end} : null));
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let p = i - 1;
    while (p >= 0 && !out[p]) p--;
    let q = i + 1;
    while (q < out.length && !out[q]) q++;
    const t0 = p >= 0 ? out[p]!.end : q < out.length ? out[q]!.start - 0.3 : 0;
    const t1 = q < out.length ? out[q]!.start : t0 + 0.3;
    const span = (t1 - t0) / (q - p);
    out[i] = {start: t0 + span * (i - p - 0.9), end: t0 + span * (i - p)};
  }
  return out as {start: number; end: number}[];
};

/** Find the quietest 10 ms point within ±win seconds of t. */
export const quietPoint = (x: Float32Array, t: number, win = 0.08) => {
  const hop = Math.round(0.005 * SR);
  const w = Math.round(0.01 * SR);
  let best = Math.round(t * SR);
  let bestE = Infinity;
  for (let c = Math.round((t - win) * SR); c <= Math.round((t + win) * SR); c += hop) {
    let e = 0;
    for (let k = c - w; k < c + w; k++) if (k >= 0 && k < x.length) e += x[k] * x[k];
    if (e < bestE) {
      bestE = e;
      best = c;
    }
  }
  return best / SR;
};

/** Copy [t0, t1) of a mono signal with short fades into `dst` at time `at`. */
export const placeClip = (src: Float32Array, t0: number, t1: number, dst: Stereo, at: number, fade = 0.008) => {
  const a = Math.max(0, Math.round(t0 * SR));
  const b = Math.min(src.length, Math.round(t1 * SR));
  const o = Math.round(at * SR);
  const f = Math.round(fade * SR);
  for (let i = a; i < b; i++) {
    const k = i - a;
    const g = Math.min(1, k / f, (b - i) / f);
    const j = o + k;
    if (j < 0 || j >= dst.length) continue;
    dst.L[j] += src[i] * g;
    dst.R[j] += src[i] * g;
  }
};
