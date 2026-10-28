import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Audio, staticFile, useVideoConfig} from 'remotion';
import {B} from './lib/timeline';
import {usePreloadTextures} from './lib/textures';
import {Director} from './render/Director';
import type {ShotDef, Transition} from './render/types';
import {COVER, ENEMY, LOOP, OPEN} from './shots/Night';

export const SHOTS: ShotDef[] = [OPEN, ENEMY, LOOP, COVER];

export const TRANSITIONS: Transition[] = [{from: 'OPEN', to: 'ENEMY', at: B.s4, dur: 0, kind: 'cut'}];

export type ReelProps = {lite: boolean; only?: string; noText?: boolean; muted?: boolean; atTime?: number; cover?: boolean};

export const Reel: React.FC<ReelProps> = ({lite, only, noText, muted, atTime, cover}) => {
	const {width, height} = useVideoConfig();
	const ready = usePreloadTextures();
	const shots = only ? SHOTS.filter((s) => only.split(',').includes(s.id)) : SHOTS;
	if (!ready) return null;
	void noText;
	return (
		<AbsoluteFill style={{backgroundColor: '#0d0b10'}}>
			<ThreeCanvas width={width} height={height} flat shadows={!lite} dpr={1} gl={{antialias: !lite, preserveDrawingBuffer: true}} camera={{fov: 30, near: 0.05, far: 2000}}>
				<Director shots={shots} transitions={TRANSITIONS} lite={lite} timeMap={atTime === undefined ? undefined : () => atTime} />
			</ThreeCanvas>
			{!muted && !cover && <Audio src={staticFile('audio/final_mix.wav')} />}
		</AbsoluteFill>
	);
};
