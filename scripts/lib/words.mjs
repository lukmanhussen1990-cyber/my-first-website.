// Word-timing helpers: ElevenLabs character alignment -> words, and script <-> transcript alignment.

export const norm = (w) => w.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']/g, '');

export function scriptWords(text) {
  return text.replace(/\.\.\./g, '... ').split(/\s+/).filter((w) => norm(w).length > 0);
}

// alignment = { characters[], character_start_times_seconds[], character_end_times_seconds[] }
export function wordsFromAlignment(al, offset = 0) {
  const out = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    const s = al.character_start_times_seconds[i] - offset;
    const e = al.character_end_times_seconds[i] - offset;
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { word: '', start: s, end: e };
    cur.word += ch;
    cur.end = e;
  });
  if (cur) out.push(cur);
  return out
    .filter((w) => norm(w.word).length > 0)
    .map((w) => ({ word: w.word, start: +Math.max(0, w.start).toFixed(3), end: +Math.max(0, w.end).toFixed(3) }));
}

// Map every script word onto timed transcript words (Levenshtein alignment on normalized tokens).
// Unmatched script words get times interpolated from their neighbours.
export function alignTranscript(text, timed) {
  const sw = scriptWords(text);
  const a = sw.map(norm);
  const b = timed.map((t) => norm(t.word));
  const n = a.length, m = b.length;
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const match = new Array(n).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (D[i][j] === D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) { match[i - 1] = j - 1; i--; j--; }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  const out = sw.map((w, k) => (match[k] >= 0 ? { word: w, start: timed[match[k]].start, end: timed[match[k]].end } : { word: w, start: null, end: null }));
  for (let k = 0; k < out.length; k++) {
    if (out[k].start !== null) continue;
    const prev = out.slice(0, k).reverse().find((w) => w.end !== null);
    const next = out.slice(k + 1).find((w) => w.start !== null);
    const s = prev ? prev.end : 0;
    const e = next ? next.start : (prev ? prev.end + 0.3 : 0.3);
    out[k].start = +s.toFixed(3);
    out[k].end = +Math.max(s, e).toFixed(3);
  }
  return out;
}
