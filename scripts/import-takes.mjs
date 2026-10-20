// Import takes that were generated outside the API path (e.g. the ElevenLabs connector / web app)
// into the voice cache as "pinned" entries, so the pipeline uses them without spending credits.
//   node scripts/import-takes.mjs            (reads audio/vo/takes/manifest.json)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LINES } from '../src/story.js';
import { ELEVEN, VOICES, P } from './config.mjs';

const manifest = JSON.parse(fs.readFileSync(P('audio', 'vo', 'takes', 'manifest.json'), 'utf8'));
fs.mkdirSync(P('audio', 'vo', 'raw'), { recursive: true });
const py = (...a) => execFileSync('python3', a).toString();

for (const [id, entry] of Object.entries(manifest)) {
  if (id.startsWith('_')) continue;
  const line = LINES[id];
  if (!line) { console.log(`  ${id}: not in story, skipped`); continue; }
  const raw = P('audio', 'vo', 'raw', `${id}.mp3`);
  fs.copyFileSync(P('audio', 'vo', 'takes', entry.file), raw);
  const wav = P('audio', 'vo', `${id}.wav`);
  const { offset, duration } = JSON.parse(py(P('scripts', 'audio_util.py'), 'trim', raw, wav));
  const words = JSON.parse(py(P('scripts', 'align_local.py'), wav, line.text));
  const meta = {
    id, text: line.text, speaker: line.speaker, voiceId: VOICES[line.speaker], model: ELEVEN.model,
    settings: 'voice defaults (connector does not expose stability/similarity/style)',
    pinned: true, source: 'elevenlabs-connector', generationId: entry.generation_id,
    timing: 'local phrase alignment (scripts/align_local.py)', trimOffset: offset, duration, words,
  };
  fs.writeFileSync(P('audio', 'vo', `${id}.json`), JSON.stringify(meta, null, 2));
  console.log(`  ${id}: ${duration.toFixed(2)}s  ${words.map((w) => `${w.word}@${w.start}`).join(' ')}`);
}
