import timeline from '../../../episodes/adam-silent/public/timeline.json';
import cueFile from '../../../episodes/adam-silent/public/cues.json';
import type { CharacterSpec } from '../../kit-storybook/gl/Character';

export const FPS = 30;
export const cues = cueFile.cues as Record<string, number>;
export const F = (name: keyof typeof cueFile.cues | string) => {
  const v = cues[name];
  if (v === undefined) throw new Error(`unknown cue ${name}`);
  return Math.round(v * FPS);
};
export const TOTAL = Math.ceil(cues.total * FPS);
export const tl = timeline;

// frame at which a word of a line is spoken (nth occurrence, 1-based)
export function wordAt(line: number, word: string, nth = 1) {
  const hits = timeline.words.filter((w) => w.line === line && w.w === word);
  const w = hits[nth - 1];
  if (!w) throw new Error(`word ${word} not in line ${line}`);
  return Math.round(w.start * FPS);
}
// all word start frames of a line, in order
export const lineWords = (line: number) => timeline.words.filter((w) => w.line === line).map((w) => ({ w: w.w, at: Math.round(w.start * FPS) }));

// where an image point lands in world px for a Character placed at (x, y, h, anchor)
export function imgToWorld(spec: CharacterSpec, place: { x: number; y: number; h: number; anchor?: [number, number] }, p: [number, number]): [number, number] {
  const [iw, ih] = spec.size;
  const s = place.h / ih;
  const [ax, ay] = place.anchor ?? [0.5, 1];
  return [place.x + (p[0] - ax * iw) * s, place.y + (p[1] - ay * ih) * s];
}
