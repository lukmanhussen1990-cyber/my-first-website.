// Turn timeline.json + a cue spec into cues.json (named times in seconds).
// A cue is either {line, word, nth?, at: 'start'|'end', offset?} or {after: 'cueName', offset}.
// Both the audio score and the Remotion scenes read cues.json, so hits line up.
// Usage: node make_cues.mjs timeline.json cue_spec.json out.json
import fs from 'node:fs';

const [timelinePath, specPath, outPath] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const cues = {};
const lineById = Object.fromEntries(tl.lines.map((l) => [l.id, l]));
for (const [name, c] of Object.entries(spec.cues)) {
  if (c.after !== undefined) {
    if (!(c.after in cues)) throw new Error(`cue ${name}: unknown ${c.after}`);
    cues[name] = +(cues[c.after] + (c.offset ?? 0)).toFixed(3);
    continue;
  }
  if (c.word === undefined) {
    const l = lineById[c.line];
    cues[name] = +((c.at === 'end' ? l.end : l.start) + (c.offset ?? 0)).toFixed(3);
    continue;
  }
  const hits = tl.words.filter((w) => w.line === c.line && w.w === c.word);
  const w = hits[(c.nth ?? 1) - 1];
  if (!w) throw new Error(`cue ${name}: word "${c.word}" #${c.nth ?? 1} not in line ${c.line}`);
  cues[name] = +((c.at === 'end' ? w.end : w.start) + (c.offset ?? 0)).toFixed(3);
}
fs.writeFileSync(outPath, JSON.stringify({ fps: tl.fps, cues }, null, 1));
console.log(`${Object.keys(cues).length} cues, total ${cues.total}s`);
