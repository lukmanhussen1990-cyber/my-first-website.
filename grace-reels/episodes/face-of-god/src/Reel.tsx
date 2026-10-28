import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import {B} from './lib/timeline';
import {usePreloadTextures} from './lib/textures';
import {CoverTitle} from './overlay/CoverTitle';
import {Overlay} from './overlay/Overlay';
import {Director} from './render/Director';
import type {ShotDef, Transition} from './render/types';
import {BACK, CLIFT, INSIDE} from './shots/Cleft';
import {CAMP, DOWN, FACECU, VEIL} from './shots/Down';
import {BUSH, PLAGUES, SEA} from './shots/Montage';
import {ANSWER, ASK, DARK, DIE, HOOK} from './shots/Summit';

export const SHOTS: ShotDef[] = [HOOK, DIE, DARK, BUSH, PLAGUES, SEA, ASK, ANSWER, CLIFT, INSIDE, BACK, DOWN, FACECU, CAMP, VEIL];

export const TRANSITIONS: Transition[] = [
	{from: 'HOOK', to: 'DIE', at: B.s2, dur: 0, kind: 'cut'},
	// the hard cut on "die": from the blinding light to stillness
	{from: 'DIE', to: 'DARK', at: B.hardCut, dur: 0, kind: 'cut'},
	// the montage of what Moses had already seen: whip cuts
	{from: 'DARK', to: 'BUSH', at: B.s3 + 0.02, dur: 0.24, kind: 'whip'},
	{from: 'BUSH', to: 'PLAGUES', at: B.whipPlagues, dur: 0.22, kind: 'whip'},
	{from: 'PLAGUES', to: 'SEA', at: B.whipSea, dur: 0.22, kind: 'whip'},
	{from: 'SEA', to: 'ASK', at: B.s4, dur: 0.24, kind: 'whip'},
	{from: 'ASK', to: 'ANSWER', at: B.s5, dur: 0, kind: 'cut'},
	{from: 'ANSWER', to: 'CLIFT', at: B.s6, dur: 0.5, kind: 'dissolve'},
	{from: 'CLIFT', to: 'INSIDE', at: B.inside, dur: 0, kind: 'cut'},
	{from: 'INSIDE', to: 'BACK', at: B.s7, dur: 0.4, kind: 'dissolve'},
	// the night lifts into morning
	{from: 'BACK', to: 'DOWN', at: B.dawn, dur: 0.6, kind: 'light'},
	{from: 'DOWN', to: 'FACECU', at: B.faceCU, dur: 0, kind: 'cut'},
	{from: 'FACECU', to: 'CAMP', at: B.s9, dur: 0.3, kind: 'dissolve'},
	{from: 'CAMP', to: 'VEIL', at: B.s10, dur: 0, kind: 'cut'},
];

export type ReelProps = {lite: boolean; only?: string; noText?: boolean; muted?: boolean; atTime?: number; cover?: boolean};

export const Reel: React.FC<ReelProps> = ({lite, only, noText, muted, atTime, cover}) => {
	const {width, height} = useVideoConfig();
	const ready = usePreloadTextures();
	const shots = only ? SHOTS.filter((s) => s.id === only) : SHOTS;
	if (!ready) return null;
	return (
		<AbsoluteFill style={{backgroundColor: '#0d0b10'}}>
			<ThreeCanvas
				width={width}
				height={height}
				flat
				dpr={1}
				gl={{antialias: !lite, preserveDrawingBuffer: true}}
				camera={{fov: 30, near: 0.05, far: 2000}}
			>
				<Director shots={shots} transitions={TRANSITIONS} lite={lite} timeMap={atTime === undefined ? undefined : () => atTime} />
			</ThreeCanvas>
			{cover ? <CoverTitle /> : !noText && <Overlay shots={shots} transitions={TRANSITIONS} />}
			{!muted && !cover && <Audio src={staticFile('audio/final_mix.wav')} />}
		</AbsoluteFill>
	);
};
