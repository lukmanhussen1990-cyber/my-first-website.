// Generate + cache every voice line with ElevenLabs "text-to-speech with-timestamps".
//
//   node scripts/voice.mjs            generate missing lines (cached lines cost nothing)
//   node scripts/voice.mjs --list     list your voices and suggest narrator / mom picks
//   node scripts/voice.mjs --refresh  ignore pinned takes and re-generate through the API
//
// Cache layout (audio/vo):
//   raw/<id>.mp3   exactly what ElevenLabs returned (the part that costs credits)
//   <id>.wav       silence-trimmed take used by the mix
//   <id>.json      text, voice, model, settings, cache key, duration, per-word timings
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { LINES } from '../src/story.js';
import { ELEVEN, VOICES, apiKey, P } from './config.mjs';
import { wordsFromAlignment } from './lib/words.mjs';

const args = new Set(process.argv.slice(2));
const VO = P('audio', 'vo');
fs.mkdirSync(P('audio', 'vo', 'raw'), { recursive: true });

export function lineKey(line) {
  const voiceId = VOICES[line.speaker];
  const blob = JSON.stringify({ text: line.text, voiceId, model: ELEVEN.model, settings: ELEVEN.settings });
  return crypto.createHash('sha1').update(blob).digest('hex').slice(0, 16);
}

async function api(pathname, init = {}) {
  const key = apiKey();
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  const res = await fetch(ELEVEN.base + pathname, {
    ...init,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    const err = new Error(`ElevenLabs ${res.status} on ${pathname}: ${body}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

async function withRetry(fn, tries = 5) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (i >= tries - 1 || ![429, 500, 502, 503].includes(e.status)) throw e;
      const wait = 2000 * 2 ** i;
      console.log(`  rate limited / busy, retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function listVoices() {
  const res = await api('/v1/voices');
  const { voices } = await res.json();
  const score = (v, want) => {
    const s = `${v.name} ${v.description || ''} ${Object.values(v.labels || {}).join(' ')}`.toLowerCase();
    return want.reduce((acc, [w, pts]) => acc + (s.includes(w) ? pts : 0), 0);
  };
  const narr = [['male', 3], ['deep', 3], ['calm', 2], ['narrat', 2], ['breath', 1], ['horror', 2], ['story', 1]];
  const mom = [['female', 3], ['warm', 3], ['gentle', 2], ['mother', 3], ['motherly', 2], ['soft', 1], ['calm', 1]];
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  ${JSON.stringify(v.labels || {})}`);
  const best = (w) => [...voices].sort((a, b) => score(b, w) - score(a, w))[0];
  console.log('\nSuggested narrator:', best(narr)?.name, best(narr)?.voice_id);
  console.log('Suggested mom:     ', best(mom)?.name, best(mom)?.voice_id);
  console.log('Set ELEVENLABS_VOICE_ID / ELEVENLABS_MOM_ID to override the defaults in scripts/config.mjs');
}

function trimTake(rawPath, wavPath) {
  const out = execFileSync('python3', [P('scripts', 'audio_util.py'), 'trim', rawPath, wavPath]).toString();
  return JSON.parse(out);
}

async function generate(id, line, key) {
  const voiceId = VOICES[line.speaker];
  console.log(`  ${id}: generating via API (${line.speaker})`);
  const res = await withRetry(() => api(`/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${ELEVEN.outputFormat}`, {
    method: 'POST',
    body: JSON.stringify({ text: line.text, model_id: ELEVEN.model, voice_settings: ELEVEN.settings }),
  }));
  const data = await res.json();
  const raw = P('audio', 'vo', 'raw', `${id}.mp3`);
  fs.writeFileSync(raw, Buffer.from(data.audio_base64, 'base64'));
  const { offset, duration } = trimTake(raw, P('audio', 'vo', `${id}.wav`));
  const words = wordsFromAlignment(data.alignment || data.normalized_alignment, offset);
  return {
    id, text: line.text, speaker: line.speaker, voiceId, model: ELEVEN.model, settings: ELEVEN.settings,
    key, source: 'api:text-to-speech/with-timestamps', trimOffset: offset, duration, words,
  };
}

function buildFallback(id, line) {
  const fb = line.fallback;
  const wav = P('audio', 'vo', `${id}.wav`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', P('audio', 'vo', `${fb.line}.wav`), '-af',
    `atrim=${fb.from}:${fb.to},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${(fb.to - fb.from - 0.04).toFixed(3)}:d=0.04`, wav]);
  const duration = +(fb.to - fb.from).toFixed(3);
  fs.writeFileSync(P('audio', 'vo', `${id}.json`), JSON.stringify({
    id, text: line.text, speaker: line.speaker, fallback: true, displayText: fb.text, source: `fallback: cut from ${fb.line}`,
    duration, words: [{ word: fb.text, start: 0.02, end: duration - 0.05 }],
  }, null, 2));
}

export async function ensureVoice({ refresh = false } = {}) {
  const missing = [];
  for (const [id, line] of Object.entries(LINES)) {
    const key = lineKey(line);
    const metaPath = P('audio', 'vo', `${id}.json`);
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
    const wavOk = fs.existsSync(P('audio', 'vo', `${id}.wav`));
    if (meta && wavOk && meta.key === key) { console.log(`  ${id}: cached`); continue; }
    if (meta && wavOk && !refresh && meta.pinned && meta.text === line.text && meta.voiceId === VOICES[line.speaker]) {
      console.log(`  ${id}: cached (pinned take from ${meta.source})`);
      continue;
    }
    if (!apiKey()) {
      if (line.fallback && fs.existsSync(P('audio', 'vo', `${line.fallback.line}.wav`))) {
        buildFallback(id, line);
        console.log(`  ${id}: NOT GENERATED (no API key/credits) -> fallback "${line.fallback.text}" cut from ${line.fallback.line}`);
        continue;
      }
      missing.push(id);
      continue;
    }
    const fresh = await generate(id, line, key);
    fs.writeFileSync(metaPath, JSON.stringify(fresh, null, 2));
  }
  if (missing.length) {
    throw new Error(`Voice lines not cached and ELEVENLABS_API_KEY is not set: ${missing.join(', ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (args.has('--list')) await listVoices();
    else { console.log('Voice lines:'); await ensureVoice({ refresh: args.has('--refresh') }); }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
