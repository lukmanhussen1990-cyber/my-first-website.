// Generates (and caches) one audio file + word timestamps per voice line.
//
//  - ELEVENLABS_API_KEY set  -> ElevenLabs /v1/text-to-speech/{voice}/with-timestamps
//                              (eleven_multilingual_v2, stability .4 / similarity .8 / style .3)
//  - otherwise               -> local Kokoro-82M neural TTS (scripts/kokoro_tts.py)
//
// Output per line: audio/vo/<id>.wav (+ .mp3 for ElevenLabs) and audio/vo/<id>.json
//   { engine, key, text, duration, words: [{ text, start, end }] }
// A line is regenerated only when its cache key (engine + voice + settings + text) changes,
// so re-renders never spend credits twice. Run with --force to ignore the cache.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readStory, run } from './lib/util.mjs';
import { voPreviewFilter } from './lib/audiofx.mjs';

const VO_DIR = path.join(ROOT, 'audio/vo');
const story = readStory();
const force = process.argv.includes('--force');
const apiKey = process.env.ELEVENLABS_API_KEY; // never printed
const engine = process.env.VO_ENGINE || (apiKey ? 'elevenlabs' : 'kokoro');

fs.mkdirSync(VO_DIR, { recursive: true });

const sha1 = (obj) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);

function cached(line, key) {
  const jsonPath = path.join(VO_DIR, `${line.id}.json`);
  if (force || !fs.existsSync(jsonPath) || !fs.existsSync(path.join(VO_DIR, `${line.id}.wav`))) return false;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8')).key === key;
  } catch {
    return false;
  }
}

// ---------- ElevenLabs ----------
const EL = 'https://api.elevenlabs.io/v1';

async function elFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'xi-api-key': apiKey, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Score the account's voices against the brief when no voice id is configured/usable.
function pickVoice(voices, role) {
  const want = role === 'whisper'
    ? { gender: 'female', words: ['whisper', 'soft', 'asmr', 'breathy', 'intimate', 'sweet'] }
    : { gender: 'male', words: ['deep', 'calm', 'narrat', 'breathy', 'bass', 'story'] };
  let best = null;
  for (const v of voices) {
    const blob = `${v.name} ${v.description || ''} ${JSON.stringify(v.labels || {})}`.toLowerCase();
    let score = want.words.reduce((s, w) => s + (blob.includes(w) ? 2 : 0), 0);
    if ((v.labels?.gender || '').toLowerCase() === want.gender) score += 3;
    if (!best || score > best.score) best = { id: v.voice_id, name: v.name, score };
  }
  return best;
}

async function resolveElevenVoices() {
  const ids = {};
  let listing;
  for (const [role, cfg] of Object.entries(story.voices)) {
    const fromEnv = process.env[cfg.elevenlabs.envVoiceId];
    if (fromEnv) {
      ids[role] = fromEnv;
      continue;
    }
    try {
      await elFetch(`${EL}/voices/${cfg.elevenlabs.voiceId}`);
      ids[role] = cfg.elevenlabs.voiceId;
    } catch {
      listing ??= (await elFetch(`${EL}/voices`)).voices;
      const pick = pickVoice(listing, role);
      console.log(`  ${role}: configured voice unavailable, picked "${pick.name}" from your voices`);
      ids[role] = pick.id;
    }
  }
  return ids;
}

function wordsFromAlignment(al) {
  const words = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: '', start: al.character_start_times_seconds[i], end: 0 };
    cur.text += ch;
    cur.end = al.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  return words;
}

async function elevenLine(line, voiceId, key) {
  const body = {
    text: line.text,
    model_id: story.elevenlabs.model,
    voice_settings: story.elevenlabs.voiceSettings,
  };
  const data = await elFetch(`${EL}/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const mp3 = path.join(VO_DIR, `${line.id}.mp3`);
  fs.writeFileSync(mp3, Buffer.from(data.audio_base64, 'base64'));
  run('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '44100', path.join(VO_DIR, `${line.id}.wav`)]);
  const words = wordsFromAlignment(data.alignment);
  const duration = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  fs.writeFileSync(path.join(VO_DIR, `${line.id}.json`), JSON.stringify({ engine: 'elevenlabs', key, text: line.text, voice: voiceId, duration, words }, null, 1));
  console.log(`  ${line.id}: ${duration.toFixed(2)}s (ElevenLabs)`);
}

// ---------- main ----------
async function main() {
  console.log(`Voice engine: ${engine}${apiKey ? '' : ' (ELEVENLABS_API_KEY not set)'}`);
  if (engine === 'elevenlabs') {
    if (!apiKey) throw new Error('VO_ENGINE=elevenlabs needs ELEVENLABS_API_KEY');
    const voiceIds = await resolveElevenVoices();
    for (const line of story.lines) {
      const key = sha1({ engine, model: story.elevenlabs.model, settings: story.elevenlabs.voiceSettings, voice: voiceIds[line.voice], text: line.text });
      if (cached(line, key)) {
        console.log(`  ${line.id}: cached`);
        continue;
      }
      await elevenLine(line, voiceIds[line.voice], key);
    }
  } else {
    const jobs = [];
    for (const line of story.lines) {
      const cfg = story.voices[line.voice].kokoro;
      const say = line.say || line.text;
      const key = sha1({ engine, voice: cfg.voice, speed: cfg.speed, say, pause: line.pause || 0 });
      if (cached(line, key)) {
        console.log(`  ${line.id}: cached`);
        continue;
      }
      jobs.push({ id: line.id, text: line.text, say, pause: line.pause || 0, voice: cfg.voice, lang: cfg.lang, speed: cfg.speed, key,
        wav: path.join(VO_DIR, `${line.id}.wav`), json: path.join(VO_DIR, `${line.id}.json`) });
    }
    if (jobs.length) {
      const jobFile = path.join(VO_DIR, '.jobs.json');
      fs.writeFileSync(jobFile, JSON.stringify(jobs));
      run('python3', [path.join(ROOT, 'scripts/kokoro_tts.py'), jobFile]);
      fs.unlinkSync(jobFile);
    }
  }
  writePreview();
}

// One MP3 with every line in story order (processed like the final mix) for a quick listen.
function writePreview() {
  const inputs = [];
  const parts = [];
  story.lines.forEach((line, i) => {
    inputs.push('-i', path.join(VO_DIR, `${line.id}.wav`));
    parts.push(`[${i}:a]${voPreviewFilter(line.voice)},apad=pad_dur=0.7[a${i}]`);
  });
  const concat = story.lines.map((_, i) => `[a${i}]`).join('') + `concat=n=${story.lines.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5,aresample=44100,asetpts=N/SR/TB[out]`;
  const out = path.join(VO_DIR, 'preview_all_lines.mp3');
  run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', parts.join(';') + ';' + concat, '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', out]);
  console.log(`Preview: ${path.relative(ROOT, out)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
