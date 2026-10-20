import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const readJSON = (p) => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), 'utf8'));
export const readStory = () => readJSON('src/story.json');

export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
}

export function probeDuration(file) {
  return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
}
