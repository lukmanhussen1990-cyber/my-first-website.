// Voiceover loudness envelope (per 60fps frame) for mouth sync.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/envelope.json'), 'utf8'));
export function vo(t) {
  const f = t * 60, i = Math.floor(f), u = f - i;
  const a = ENV[Math.max(0, Math.min(ENV.length - 1, i))] || 0, b = ENV[Math.max(0, Math.min(ENV.length - 1, i + 1))] || 0;
  return a + (b - a) * u;
}
