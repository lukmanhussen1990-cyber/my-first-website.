import timelineJson from '../../public/timeline.json';
import {buildCues} from '../cues.mjs';

export type Word = {
  i: number;
  text: string;
  norm: string;
  keyword: boolean;
  start: number;
  end: number;
  segment: number;
  line: number;
  page: number;
  scene: string;
};
export type Page = {id: number; wordStart: number; wordEnd: number; start: number; end: number};
export type Timeline = {
  fps: number;
  durationInFrames: number;
  duration: number;
  words: Word[];
  pages: Page[];
  scenes: {id: string; start: number; end: number}[];
  segments: {index: number; start: number; end: number}[];
};

export const TL = timelineJson as unknown as Timeline;
export const FPS = TL.fps;
const cues = buildCues(TL);
export const SC: Record<string, {start: number; end: number}> = cues.scenes;
export const E: any = cues.e;
export const wordAt = cues.word as (seg: number, text: string, nth?: number) => number;

/** Words of the given voice clips (segments), in order. */
export const wordsOfSegments = (segs: number[]) => TL.words.filter((w) => segs.includes(w.segment));
