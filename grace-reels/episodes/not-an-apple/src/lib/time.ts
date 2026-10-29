import timelineJson from '../data/timeline.json';
import cuesJson from '../data/cues.json';

export const FPS = 30;
export const W = 1080;
export const H = 1920;

export type Word = {
  i: number; text: string; kw: boolean; start: number; end: number;
  seg: number; line: number; block: string; scene: string;
};
export type Block = {id: string; first: number; last: number; start: number; end: number};
export type Scene = {id: string; start: number; end: number};

export const timeline = timelineJson as unknown as {
  fps: number; durationSec: number; durationInFrames: number;
  scenes: Scene[]; blocks: Block[]; words: Word[];
  segments: {id: number; line: number; scene: string; block: string; start: number; end: number; display: string}[];
};
export const cues = cuesJson as Record<string, number>;
export const scene = (id: string) => timeline.scenes.find((s) => s.id === id)!;
export const seg = (id: number) => timeline.segments.find((s) => s.id === id)!;
export const segWords = (id: number) => timeline.words.filter((w) => w.seg === id);
export const toFrame = (sec: number) => Math.round(sec * FPS);
