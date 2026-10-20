// Generates (and caches) one voice file per scene line with ElevenLabs
// text-to-speech "with-timestamps", so scene lengths and caption cues come
// from the real audio.
//
//   node scripts/voice.js            generate missing lines (cached lines are skipped)
//   node scripts/voice.js --force    regenerate every line (spends credits)
//   node scripts/voice.js --list     list voices and show how the narrator / whisper were picked
//
// The API key is read from ELEVENLABS_API_KEY and never printed. Voice ids come
// from ELEVENLABS_VOICE_ID / ELEVENLABS_WHISPER_ID, else from the voice library
// pick, else from the defaults in src/story.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadStory, voCachePaths, readJSON, writeJSON, wordsFromAlignment, probeDuration } from './lib.js';

// Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(r.status ?? 1);
}

const API = 'https://api.elevenlabs.io';
const KEY = process.env.ELEVENLABS_API_KEY;
const args = new Set(process.argv.slice(2));
const story = loadStory();

async function api(pathname, init = {}) {
  const res = await fetch(API + pathname, {
    ...init,
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    throw new Error(`ElevenLabs ${init.method || 'GET'} ${pathname} -> ${res.status}: ${body}`);
  }
  return res.json();
}

function scoreVoice(v, want) {
  const text = `${v.name} ${v.description || ''} ${Object.values(v.labels || {}).join(' ')}`.toLowerCase();
  let score = 0;
  for (const d of want.descriptives) if (text.includes(d)) score += 2;
  const gender = (v.labels?.gender || v.gender || '').toLowerCase();
  if (gender === want.gender) score += 3;
  else if (gender) score -= 6;
  if ((v.labels?.language || v.language || 'en').startsWith('en')) score += 1;
  return score;
}

async function pickVoices() {
  // Own + library voices; the library search covers the "horror narrator" / "whisper" niche.
  const own = (await api('/v2/voices?page_size=100')).voices || [];
  const lib = [];
  for (const q of ['horror narrator', 'deep calm narrator', 'whisper', 'eerie whisper']) {
    const r = await api(`/v1/shared-voices?page_size=30&language=en&search=${encodeURIComponent(q)}`);
    lib.push(...(r.voices || []).map((v) => ({ ...v, labels: { gender: v.gender, accent: v.accent, language: v.language, ...(v.labels || {}) } })));
  }
  const all = [...own, ...lib];
  const picks = {};
  for (const [role, cfg] of Object.entries(story.voices)) {
    const ranked = all.map((v) => ({ v, s: scoreVoice(v, cfg.want) })).sort((a, b) => b.s - a.s);
    picks[role] = ranked.slice(0, 5).map(({ v, s }) => ({ voice_id: v.voice_id, name: v.name, score: s }));
  }
  return picks;
}

async function resolveVoiceIds() {
  const ids = {};
  for (const [role, cfg] of Object.entries(story.voices)) ids[role] = process.env[cfg.env] || cfg.default_id;
  return ids;
}

async function synthesize(scene, voiceId) {
  const { tts } = story;
  const q = new URLSearchParams({ output_format: tts.output_format });
  const data = await api(`/v1/text-to-speech/${voiceId}/with-timestamps?${q}`, {
    method: 'POST',
    body: JSON.stringify({ text: scene.text, model_id: tts.model_id, voice_settings: tts.voice_settings }),
  });
  const { mp3, json } = voCachePaths(scene.id);
  fs.writeFileSync(mp3, Buffer.from(data.audio_base64, 'base64'));
  const alignment = data.alignment || data.normalized_alignment;
  const meta = {
    id: scene.id,
    text: scene.text,
    voice_id: voiceId,
    model_id: tts.model_id,
    voice_settings: tts.voice_settings,
    source: 'elevenlabs-rest/with-timestamps',
    duration: probeDuration(mp3),
    words: wordsFromAlignment(alignment),
    alignment,
  };
  writeJSON(json, meta);
  return meta;
}

async function main() {
  if (args.has('--list')) {
    if (!KEY) throw new Error('Set ELEVENLABS_API_KEY to list voices.');
    const picks = await pickVoices();
    writeJSON(path.join(ROOT, 'audio/vo/voice_candidates.json'), picks);
    console.log(JSON.stringify(picks, null, 2));
    return;
  }
  const ids = await resolveVoiceIds();
  const force = args.has('--force');
  let generated = 0;
  const needPlaceholder = [];
  for (const scene of story.scenes) {
    if (!scene.voice) continue;
    const voiceId = ids[scene.voice];
    const { mp3, json } = voCachePaths(scene.id);
    const cached = fs.existsSync(mp3) && fs.existsSync(json) ? readJSON(json) : null;
    const placeholder = cached?.source?.startsWith('offline-placeholder');
    const reusable = cached && cached.text === scene.text &&
      (placeholder ? !KEY : cached.voice_id === voiceId && cached.model_id === story.tts.model_id);
    if (reusable && !(force && KEY)) {
      const note = placeholder ? '  << PLACEHOLDER voice, set ELEVENLABS_API_KEY to replace'
        : JSON.stringify(cached.voice_settings) === JSON.stringify(story.tts.voice_settings) ? '' : ' (made with different voice settings; --force to redo)';
      console.log(`[cache] ${scene.id} ${cached.duration.toFixed(2)}s${note}`);
      continue;
    }
    if (!KEY) {
      needPlaceholder.push(scene.id);
      continue;
    }
    try {
      const meta = await synthesize(scene, voiceId);
      generated++;
      console.log(`[tts]   ${scene.id} ${meta.duration.toFixed(2)}s  "${scene.text}"`);
    } catch (e) {
      // Out of credits / quota: keep whatever take exists rather than failing the build.
      if (cached) {
        console.warn(`[keep]  ${scene.id}: ${e.message.split('\n')[0]}`);
        continue;
      }
      if (/quota|credits|401|402/.test(e.message)) {
        needPlaceholder.push(scene.id);
        console.warn(`[quota] ${scene.id}: ${e.message.split('\n')[0]}`);
        continue;
      }
      throw e;
    }
  }
  if (needPlaceholder.length) {
    console.warn(`\n!! No ElevenLabs take for ${needPlaceholder.join(', ')}: generating OFFLINE PLACEHOLDER voice (Piper).`);
    console.warn('!! Set ELEVENLABS_API_KEY (with credits) and re-run to replace it with ElevenLabs.\n');
    const py = fs.existsSync(path.join(ROOT, '.venv/bin/python')) ? path.join(ROOT, '.venv/bin/python') : 'python3';
    const r = spawnSync(py, [path.join(ROOT, 'scripts/placeholder_voice.py'), ...needPlaceholder], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('placeholder voice generation failed');
  }
  console.log(generated ? `Generated ${generated} line(s) with ElevenLabs.` : 'Voice lines ready.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
