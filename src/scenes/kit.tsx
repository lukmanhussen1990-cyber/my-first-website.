// Shared helpers for scenes.
import React from 'react';
import ampJson from '../data/amp.json';
import {PostProps} from '../lib/Post';
import {SCENES, wf} from '../timing';

export const AMP = ampJson as number[];
/** voice loudness (0..1) at a global frame: drives lip flap */
export const amp = (g: number) => AMP[Math.max(0, Math.min(AMP.length - 1, Math.round(g)))] ?? 0;

export type SceneProps = {f: number; dur: number; g: number};
export type SceneDef = {
	Comp: React.FC<SceneProps>;
	post?: (f: number) => PostProps;
	overlay?: (f: number, dur: number) => React.ReactNode;
};

/** which shot is active, given the frames where each new shot starts */
export const shotIndex = (f: number, cuts: number[]) => {
	let i = 0;
	while (i < cuts.length && f >= cuts[i]) i++;
	return i;
};

/** frame of word i relative to the start of scene n (1-based) */
export const W = (n: number, i: number) => wf(i) - SCENES[n - 1].from;
