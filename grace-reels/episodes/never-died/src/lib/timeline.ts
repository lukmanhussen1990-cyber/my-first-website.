import timelineJson from '../../timeline.json';
// @ts-expect-error plain JS module shared with the Node audio synth
import {computeBeats, WALKS} from '../beats.mjs';

export type Word = {
	i: number;
	text: string;
	keyword: boolean;
	start: number;
	end: number;
	part: number;
	sentence: number;
	scene: string;
};
export type Scene = {id: string; name: string; start: number; end: number};
export type Timeline = {
	fps: number;
	durationInSeconds: number;
	durationInFrames: number;
	parts: {id: number; scene: string; text: string; start: number; end: number}[];
	sentences: {id: number; part: number; scene: string; words: number[]; text: string; start: number; end: number}[];
	words: Word[];
	scenes: Scene[];
	cues: Record<string, number>;
};

export const TL = timelineJson as unknown as Timeline;
export const FPS = TL.fps;
export const DURATION_FRAMES = TL.durationInFrames;

export type Beats = Record<string, number> & {
	steps: {enoch: number[]; elijah: number[]; elisha: number[]};
	commentText: string;
};
export const B: Beats = computeBeats(TL);
export const WALK: Record<'enoch' | 'elijah' | 'elisha', {period: number; phase: number}> = WALKS;

export const SCENE = Object.fromEntries(TL.scenes.map((s) => [s.id, s])) as Record<string, Scene>;
