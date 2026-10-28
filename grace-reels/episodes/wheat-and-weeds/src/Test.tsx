// Look-dev compositions: the field and the characters in it.
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {usePreloadTextures} from './lib/textures';
import {Person} from './characters/Puppet';
import {Director} from './render/Director';
import type {ShotDef} from './render/types';
import {FarmWorld} from './world/Field';
import {FIELD_GOLDEN, FIELD_NIGHT} from './world/mood';

const FIELD_TEST: ShotDef = {
	id: 'FIELD',
	start: -1,
	end: 100,
	Content: ({t, lite}) => (
		<>
			<FarmWorld t={t} mood={FIELD_GOLDEN} lite={lite} wheat={{time: t, wind: 1, grow: 1, ripe: 1, tareDark: 1, tareShow: 1, spots: 0, glow: 0.1}} />
			<Person id="farmer" view="tq" position={[0.6, 0, 1.8]} pose={{}} t={t} yaw={0.12} look={{tint: FIELD_GOLDEN.tint, lightDir: [-0.8, 0.5]}} />
		</>
	),
	camera: () => ({pos: [1.6, 1.5, 6.5], target: [0.4, 1.0, 0], fov: 40, drift: 0}),
	grade: () => ({exposure: 1.02, contrast: 1.06, saturation: 1.04, gain: [1.04, 1.0, 0.94], vignette: 0.4, bloom: 0.45, bloomThreshold: 0.8, grain: 0.015}),
	fog: () => ({color: FIELD_GOLDEN.fog, near: FIELD_GOLDEN.fogNear, far: FIELD_GOLDEN.fogFar}),
};
const NIGHT_TEST: ShotDef = {
	...FIELD_TEST,
	id: 'NIGHT',
	Content: ({t, lite}) => (
		<>
			<FarmWorld t={t} mood={FIELD_NIGHT} lite={lite} wheat={{time: t, wind: 1, grow: 1, ripe: 1, tareDark: 1, tareShow: 1, spots: 0, glow: 0.22}} wheatColors={{headGold: '#d9c48a', stemGold: '#9c8a62', glow: '#dfe6ff'}} />
			<Person id="enemy" view="side" position={[0.6, 0, 1.8]} pose={{}} t={t} yaw={0.12} look={{tint: FIELD_NIGHT.tint, lightDir: [0.5, 0.6]}} />
		</>
	),
	fog: () => ({color: FIELD_NIGHT.fog, near: FIELD_NIGHT.fogNear, far: FIELD_NIGHT.fogFar}),
};

const NOWHEAT: ShotDef = {
	...FIELD_TEST,
	id: 'NOWHEAT',
	Content: ({t, lite}) => (
		<>
			<FarmWorld t={t} mood={FIELD_GOLDEN} lite={lite} />
			<Person id="farmer" view="tq" position={[0.6, 0, 1.8]} pose={{}} t={t} yaw={0.12} look={{tint: FIELD_GOLDEN.tint, lightDir: [-0.8, 0.5]}} />
		</>
	),
};

export const Test: React.FC<{which?: string}> = ({which = 'FIELD'}) => {
	const {width, height} = useVideoConfig();
	const ready = usePreloadTextures();
	if (!ready) return null;
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<ThreeCanvas width={width} height={height} flat dpr={1} gl={{antialias: true, preserveDrawingBuffer: true}} camera={{fov: 30, near: 0.05, far: 2000}}>
				<Director shots={[which === 'NIGHT' ? NIGHT_TEST : which === 'NOWHEAT' ? NOWHEAT : FIELD_TEST]} transitions={[]} lite={false} />
			</ThreeCanvas>
		</AbsoluteFill>
	);
};
