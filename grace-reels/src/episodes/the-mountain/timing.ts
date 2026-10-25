import timeline from "../../../episodes/the-mountain/timeline.json";
import script from "../../../episodes/the-mountain/script.json";
import { buildCues } from "./cues.js";

export type Word = { i: number; text: string; keyword: boolean; kwGroup: string | null; start: number; end: number; beat: string; scene: string };
export type Beat = { id: string; scene: string; text: string; start: number; end: number; wordStart: number; wordEnd: number };
export type Timeline = {
  episode: string;
  slug: string;
  fps: number;
  voiceSeconds: number;
  durationSeconds: number;
  durationInFrames: number;
  endCardStart: number;
  beats: Beat[];
  words: Word[];
};

export const TIMELINE = timeline as Timeline;
export const SCRIPT = script as { episode: string; title: string; hookTitle: string };
export const CUES = buildCues(TIMELINE);
export type Cues = typeof CUES;
