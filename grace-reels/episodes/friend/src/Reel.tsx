import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import {B} from './lib/timeline';
import {usePreloadTextures} from './lib/textures';
import {CoverTitle} from './overlay/CoverTitle';
import {Overlay} from './overlay/Overlay';
import {Director} from './render/Director';
import type {ShotDef, Transition} from './render/types';
import {COINSPIN, DEAL, SCALE} from './shots/Deal';
import {CTA, FEAST, SAMENIGHT} from './shots/Feast';
import {GARDEN2, S10, S9} from './shots/Garden';
import {CU_IN, LOOP, S1, S11} from './shots/Kiss';
import {COVER, JUDAS_SHOT, POUR, ROOM, TWELVE, WASH} from './shots/Room';
import {divider, SPLIT_IN, SPLIT_OUT} from './shots/split';

export const SHOTS: ShotDef[] = [S1, ROOM, POUR, WASH, TWELVE, JUDAS_SHOT, DEAL, SCALE, COINSPIN, S9, S10, S11, GARDEN2, SAMENIGHT, FEAST, CTA, LOOP, COVER];

export const TRANSITIONS: Transition[] = [
	// the rewind: the kiss runs backwards and twists into the upper room
	{from: 'S1', to: 'ROOM', at: B.rewindPeak, dur: 1.0, kind: 'swirl'},
	{from: 'ROOM', to: 'POUR', at: B.pourStart, dur: 0, kind: 'cut'},
	{from: 'POUR', to: 'WASH', at: B.washStart, dur: 0, kind: 'cut'},
	{from: 'WASH', to: 'TWELVE', at: B.s4, dur: 0, kind: 'cut'},
	{from: 'TWELVE', to: 'JUDAS', at: B.s5, dur: 0, kind: 'cut'},
	// into the flashback, a whip to the scale, a cut to the coin, a dip to black into the garden
	{from: 'JUDAS', to: 'DEAL', at: B.s6, dur: 0.6, kind: 'haze'},
	{from: 'DEAL', to: 'SCALE', at: B.s7 + 0.05, dur: 0.36, kind: 'whip'},
	{from: 'SCALE', to: 'COINSPIN', at: B.s8, dur: 0, kind: 'cut'},
	{from: 'COINSPIN', to: 'S9', at: B.s9 + 0.05, dur: 0.7, kind: 'fade'},
	{from: 'S9', to: 'S10', at: B.s10, dur: 0, kind: 'cut'},
	{from: 'S10', to: 'S11', at: CU_IN, dur: 0, kind: 'cut'},
	{from: 'S11', to: 'GARDEN2', at: SPLIT_IN - 0.25, dur: 0.5, kind: 'dissolve'},
	{from: 'SAMENIGHT', to: 'GARDEN2', at: (SPLIT_IN + SPLIT_OUT) / 2, dur: SPLIT_OUT - SPLIT_IN, kind: 'split', divider, slant: 0.05},
	{from: 'SAMENIGHT', to: 'GARDEN2', at: B.s13, dur: 0.6, kind: 'light'},
	{from: 'GARDEN2', to: 'FEAST', at: B.s14, dur: 0.6, kind: 'dissolve'},
	{from: 'FEAST', to: 'CTA', at: B.s15, dur: 0.7, kind: 'haze'},
	{from: 'CTA', to: 'LOOP', at: B.loopOut, dur: 0, kind: 'cut'},
];

export type ReelProps = {lite: boolean; only?: string; noText?: boolean; muted?: boolean; atTime?: number; cover?: boolean};

export const Reel: React.FC<ReelProps> = ({lite, only, noText, muted, atTime, cover}) => {
	const {width, height} = useVideoConfig();
	const ready = usePreloadTextures();
	const shots = only ? SHOTS.filter((s) => s.id === only) : SHOTS;
	if (!ready) return null;
	return (
		<AbsoluteFill style={{backgroundColor: '#14100d'}}>
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
