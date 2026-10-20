// Shared helpers for the pipeline scripts.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJSON = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
};

export const loadStory = () => readJSON(path.join(ROOT, 'src/story.json'));
export const loadTimeline = () => readJSON(path.join(ROOT, 'src/timeline.json'));

export const voCachePaths = (id) => ({
  mp3: path.join(ROOT, 'audio/vo', `${id}.mp3`),
  json: path.join(ROOT, 'audio/vo', `${id}.json`),
});

export function probeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(out.toString());
}

// ElevenLabs alignment (per character) -> [{ text, start, end }] per word.
export function wordsFromAlignment(al) {
  const words = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    const s = al.character_start_times_seconds[i];
    const e = al.character_end_times_seconds[i];
    if (!cur) cur = { text: ch, start: s, end: e };
    else {
      cur.text += ch;
      cur.end = e;
    }
  });
  if (cur) words.push(cur);
  return words;
}

export const normWord = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');

// Start/end time of the first occurrence of `phrase` (word sequence) in `words`.
export function findPhrase(words, phrase) {
  const target = phrase.split(/\s+/).map(normWord).filter(Boolean);
  const ws = words.map((w) => normWord(w.text));
  for (let i = 0; i + target.length <= ws.length; i++) {
    if (target.every((t, k) => ws[i + k] === t)) {
      return { start: words[i].start, end: words[i + target.length - 1].end, index: i };
    }
  }
  return null;
}
