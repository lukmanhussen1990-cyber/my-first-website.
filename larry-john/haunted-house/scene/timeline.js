// Timeline: beat and word times from build/timing.json (made by tools/align_voice.py).
export const LEAD = 0.1;   // cuts land this many seconds before the word they belong to

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9$']/g, '');

export class Timeline {
  constructor(timing, fps = 30) {
    this.timing = timing;
    this.fps = fps;
    this.duration = timing.duration;
    this.frames = Math.round(timing.duration * fps);
  }
  beat(n) {
    const b = this.timing.beats.find((x) => x.n === n);
    if (!b) throw new Error('no beat ' + n);
    return b;
  }
  // k-th occurrence (1-based) of a word inside a beat
  word(n, text, k = 1) {
    const ws = this.timing.words.filter((w) => w.beat === n && norm(w.text) === norm(text));
    if (!ws.length) throw new Error(`word "${text}" not found in beat ${n}`);
    return ws[Math.min(k, ws.length) - 1];
  }
  // start of a word, minus the cut lead
  cut(n, text, k = 1) { return Math.max(0, this.word(n, text, k).s - LEAD); }
  beatCut(n) { return n === 1 ? 0 : Math.max(0, this.beat(n).start - LEAD); }
  shout(n) { return this.timing.shouts.find((s) => s.beat === n); }
}
