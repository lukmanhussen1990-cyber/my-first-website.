import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {usePreloadTextures} from './lib/textures';
import {Overlay} from './overlay/Overlay';
import {Director} from './render/Director';
import type {Inset, ShotDef, Transition} from './render/types';
import {S34} from './shots/Jordan';
import {MYTH, mythRect, S5} from './shots/S5Myth';
import {S6} from './shots/S6Whirlwind';
import {S7} from './shots/S7Cloak';
import {S2} from './shots/S2Enoch';
import {SCENE} from './lib/timeline';

export const SHOTS: ShotDef[] = [S2, S34, S5, S6, S7, MYTH];
export const INSETS: Inset[] = [{shot: 'MYTH', rect: mythRect}];
export const TRANSITIONS: Transition[] = [
	{from: 'S2', to: 'S34', at: SCENE.S3.start, dur: 0.8, kind: 'haze'},
	{from: 'S6', to: 'S7', at: SCENE.S7.start + 0.1, dur: 1.0, kind: 'light'},
];

export type ReelProps = {lite: boolean; only?: string; noText?: boolean; muted?: boolean};

export const Reel: React.FC<ReelProps> = ({lite, only, noText, muted}) => {
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
				<Director shots={shots} transitions={TRANSITIONS} insets={INSETS} lite={lite} />
			</ThreeCanvas>
			{!noText && <Overlay shots={shots} transitions={TRANSITIONS} />}
			{!muted && <Audio src={staticFile('audio/final_mix.wav')} />}
		</AbsoluteFill>
	);
};
