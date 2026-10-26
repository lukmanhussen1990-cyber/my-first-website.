import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {usePreloadTextures} from './lib/textures';
import {CoverTitle} from './overlay/CoverTitle';
import {Overlay} from './overlay/Overlay';
import {Director} from './render/Director';
import type {Inset, ShotDef, Transition} from './render/types';
import {S34} from './shots/Jordan';
import {LOOP, S1, VOID} from './shots/S1Hook';
import {MYTH, mythRect, S5} from './shots/S5Myth';
import {COVER, S6} from './shots/S6Whirlwind';
import {S7} from './shots/S7Cloak';
import {S8} from './shots/S8Mountain';
import {S9} from './shots/S9Promise';
import {S2} from './shots/S2Enoch';
import {B, SCENE} from './lib/timeline';

export const SHOTS: ShotDef[] = [S1, S2, S34, S5, S6, S7, S8, S9, VOID, LOOP, MYTH, COVER];
export const INSETS: Inset[] = [{shot: 'MYTH', rect: mythRect}];
export const TRANSITIONS: Transition[] = [
	{from: 'S1', to: 'S2', at: B.cloakWipe + 0.17, dur: 0.42, kind: 'cloak'},
	{from: 'S2', to: 'S34', at: SCENE.S3.start, dur: 0.8, kind: 'haze'},
	{from: 'S6', to: 'S7', at: SCENE.S7.start + 0.1, dur: 1.0, kind: 'light'},
	{from: 'S7', to: 'S8', at: SCENE.S8.start, dur: 1.0, kind: 'light'},
	{from: 'S8', to: 'S9', at: SCENE.S9.start, dur: 1.0, kind: 'dissolve'},
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
				shadows={lite ? false : {type: THREE.PCFShadowMap}}
				gl={{antialias: !lite, preserveDrawingBuffer: true}}
				camera={{fov: 30, near: 0.1, far: 2000}}
			>
				<Director shots={shots} transitions={TRANSITIONS} insets={INSETS} lite={lite} timeMap={atTime === undefined ? undefined : () => atTime} />
			</ThreeCanvas>
			{cover ? <CoverTitle /> : !noText && <Overlay shots={shots} transitions={TRANSITIONS} />}
			{!muted && !cover && <Audio src={staticFile('audio/final_mix.wav')} />}
		</AbsoluteFill>
	);
};
