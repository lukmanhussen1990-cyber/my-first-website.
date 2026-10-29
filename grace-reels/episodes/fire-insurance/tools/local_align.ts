// Offline word timings when no transcription service is available: find the
// pauses in the read, match sentence boundaries to them (DP on syllable-based
// expected lengths), then spread each sentence's words over its voiced time.
// Usage: node tools/local_align.ts <raw audio> > audio/clips/words.json
import {execFileSync} from 'node:child_process';
import {SENTENCES, sentenceWords} from '../src/script.ts';

const raw = process.argv[2];
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', raw, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], {maxBuffer: 1 << 28});
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
const HOP = 160; // 10 ms
const nF = Math.floor(x.length / HOP);
const db = new Float32Array(nF);
for (let i = 0; i < nF; i++) {
  let e = 0;
  for (let k = 0; k < HOP; k++) e += x[i * HOP + k] ** 2;
  db[i] = 10 * Math.log10(e / HOP + 1e-10);
}
const sorted = Array.from(db).sort((a, b) => a - b);
const loud = sorted[Math.floor(sorted.length * 0.95)];
const thr = loud - 38;
const voiced = Array.from(db, (v) => v > thr);
// gaps of ≥ 120 ms
const gaps: {a: number; b: number}[] = [];
let s = -1;
for (let i = 0; i < nF; i++) {
  if (!voiced[i] && s < 0) s = i;
  if (voiced[i] && s >= 0) {
    if (i - s >= 12) gaps.push({a: s, b: i});
    s = -1;
  }
}
const first = voiced.indexOf(true);
const last = nF - 1 - voiced.slice().reverse().indexOf(true);
const inner = gaps.filter((g) => g.a > first && g.b < last);

const syl = (w: string) => Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '').match(/[aeiouy]+/g) ?? []).length);
const sents = SENTENCES.map((st) => {
  const ws = sentenceWords(st);
  const sy = ws.reduce((a, w) => a + syl(w.text), 0);
  const punct = ws.slice(0, -1).reduce((a, w) => a + (/[.?!…:;]["”]?$/.test(w.text) ? 0.35 : /,["”]?$/.test(w.text) ? 0.15 : 0), 0);
  return {ws, sy, punct};
});
const totSy = sents.reduce((a, q) => a + q.sy, 0);
const totPunct = sents.reduce((a, q) => a + q.punct, 0);
const span = (last - first) / 100;
const rate = (span - 19 * 0.45 - totPunct) / totSy;
const E = sents.map((q) => q.sy * rate + q.punct);

// DP: choose 19 gaps (in order) as sentence boundaries
const G = inner.length;
const K = SENTENCES.length;
const cost = (k: number, startF: number, endF: number) => {
  const d = (endF - startF) / 100;
  return 6 * Math.log(Math.max(0.05, d) / E[k]) ** 2;
};
const INF = 1e18;
const dp = Array.from({length: K}, () => new Float64Array(G).fill(INF));
const back = Array.from({length: K}, () => new Int32Array(G).fill(-1));
const bonus = (g: number) => -0.9 * Math.min(1.2, (inner[g].b - inner[g].a) / 100);
for (let g = 0; g < G; g++) dp[0][g] = cost(0, first, inner[g].a) + bonus(g);
for (let k = 1; k < K - 1; k++)
  for (let g = k; g < G; g++)
    for (let h = k - 1; h < g; h++) {
      if (dp[k - 1][h] >= INF) continue;
      const c = dp[k - 1][h] + cost(k, inner[h].b, inner[g].a) + bonus(g);
      if (c < dp[k][g]) {
        dp[k][g] = c;
        back[k][g] = h;
      }
    }
let best = -1;
let bc = INF;
for (let g = K - 2; g < G; g++) {
  const c = dp[K - 2][g] + cost(K - 1, inner[g].b, last);
  if (c < bc) {
    bc = c;
    best = g;
  }
}
const bounds: number[] = new Array(K - 1);
for (let k = K - 2, g = best; k >= 0; k--) {
  bounds[k] = g;
  g = back[k][g];
}

// spread words over voiced frames inside each sentence
const out: {text: string; start: number; end: number}[] = [];
for (let k = 0; k < K; k++) {
  const a = k === 0 ? first : inner[bounds[k - 1]].b;
  const b = k === K - 1 ? last + 1 : inner[bounds[k]].a;
  const vf: number[] = [];
  for (let i = a; i < b; i++) if (voiced[i]) vf.push(i);
  const ws = sents[k].ws;
  const weights = ws.map((w) => syl(w.text) + 0.6);
  const tot = weights.reduce((p, q) => p + q, 0);
  let acc = 0;
  ws.forEach((w, i) => {
    const i0 = vf[Math.min(vf.length - 1, Math.floor((acc / tot) * vf.length))];
    acc += weights[i];
    const i1 = vf[Math.min(vf.length - 1, Math.ceil((acc / tot) * vf.length) - 1)];
    out.push({text: w.text, start: i0 / 100, end: (i1 + 1) / 100});
  });
}
console.error(`speech ${first / 100}–${last / 100}s, ${inner.length} pauses, sentence cuts at: ${bounds.map((g) => (inner[g].a / 100).toFixed(2)).join(' ')}`);
console.log(JSON.stringify(out));
