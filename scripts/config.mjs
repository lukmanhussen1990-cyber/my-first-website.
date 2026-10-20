// Pipeline configuration (Node only). Secrets come from the environment and are never logged.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const P = (...p) => path.join(ROOT, ...p);

export const ELEVEN = {
  base: 'https://api.elevenlabs.io',
  model: 'eleven_multilingual_v2',
  settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
  outputFormat: 'mp3_44100_192',
};

// Default voices were picked from the ElevenLabs voice library listing (see `npm run voice -- --list`):
//   narrator: "Mike – Deep Calm Narration" (deep, calm, made for horror / mystery narration)
//   mom:      "Tammy" (warm, pleasant, motherly, calm) — used for BOTH kitchen-Mom and door-Mom.
export const VOICES = {
  narrator: process.env.ELEVENLABS_VOICE_ID || 'PovLkSo8643uWB3D1H0S',
  mom: process.env.ELEVENLABS_MOM_ID || 'TDdaEMZGTCMRB4x8bVQ2',
};

export function apiKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  return k && k.trim() ? k.trim() : null;
}
