import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import {B} from './lib/timeline';
import {usePreloadTextures} from './lib/textures';
import {Director} from './render/Director';
import {CoverTitle} from './overlay/CoverTitle';
import {Overlay} from './overlay/Overlay';
import type {ShotDef, Transition} from './render/types';
import {COVER, ENEMY, LOOP, OPEN} from './shots/Night';
import {CTA, GROW, HARVEST, HOURGLASS, PULL, SOW, SPOTS, TALK, TOGETHER} from './shots/Day';

export const SHOTS: ShotDef[] = [OPEN, SOW, ENEMY, GROW, TALK, PULL, TOGETHER, SPOTS, HOURGLASS, HARVEST, CTA, LOOP, COVER];

export const TRANSITIONS: Transition[] = [
	{from: 'OPEN', to: 'SHORE', at: B.s2, dur: 0.4, kind: 'dissolve'},
	{from: 'SHORE', to: 'SOW', at: B.s3, dur: 0, kind: 'cut'},
	// day into night: a dip through dark
	{from: 'SOW', to: 'ENEMY', at: B.s4, dur: 0.5, kind: 'fade'},
	{from: 'ENEMY', to: 'GROW', at: B.s5, dur: 0.5, kind: 'dissolve'},
	{from: 'GROW', to: 'TALK', at: B.s6, dur: 0, kind: 'cut'},
	{from: 'TALK', to: 'PULL', at: B.s7, dur: 0, kind: 'cut'},
	{from: 'PULL', to: 'ROOTS', at: B.underground, dur: 0.3, kind: 'dissolve'},
	{from: 'ROOTS', to: 'TOGETHER', at: B.s8, dur: 0.5, kind: 'dissolve'},
	{from: 'TOGETHER', to: 'SPOTS', at: B.s9, dur: 0.5, kind: 'dissolve'},
	{from: 'SPOTS', to: 'HOURGLASS', at: B.s10, dur: 0.6, kind: 'dissolve'},
	{from: 'HOURGLASS', to: 'ROAD', at: B.s11, dur: 0.3, kind: 'whip'},
	{from: 'ROAD', to: 'PAUL', at: B.paulCut, dur: 0.8, kind: 'light'},
	{from: 'PAUL', to: 'HARVEST', at: B.s12, dur: 0.5, kind: 'dissolve'},
	{from: 'HARVEST', to: 'CTA', at: B.s13, dur: 0.7, kind: 'haze'},
	{from: 'CTA', to: 'LOOP', at: B.loopOut, dur: 0.6, kind: 'dissolve'},
];

export type ReelProps = {lite: boolean; only?: string; noText?: boolean; muted?: boolean; atTime?: number; cover?: boolean};

export const Reel: React.FC<ReelProps> = ({lite, only, noText, muted, atTime, cover}) => {
	const {width, height} = useVideoConfig();
	const ready = usePreloadTextures();
	const shots = only ? SHOTS.filter((s) => only.split(',').includes(s.id)) : SHOTS;
	if (!ready) return null;
	return (
		<AbsoluteFill style={{backgroundColor: '#0d0b10'}}>
			<ThreeCanvas width={width} height={height} flat shadows={!lite} dpr={1} gl={{antialias: !lite, preserveDrawingBuffer: true}} camera={{fov: 30, near: 0.05, far: 2000}}>
				<Director shots={shots} transitions={TRANSITIONS} lite={lite} timeMap={atTime === undefined ? undefined : () => atTime} />
			</ThreeCanvas>
			{cover ? <CoverTitle /> : !noText && <Overlay shots={shots} transitions={TRANSITIONS} />}
			{!muted && !cover && <Audio src={staticFile('audio/final_mix.wav')} />}
		</AbsoluteFill>
	);
};
