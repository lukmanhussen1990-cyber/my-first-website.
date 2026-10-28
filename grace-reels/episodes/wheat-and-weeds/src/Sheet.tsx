// The character sheet: every character drawn in code, in its side, three-quarter and back views, through
// the reel's own renderer (screen-space outline, cel shading from a light at the upper left, the grade).
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {usePreloadTextures} from './lib/textures';
import {CharId, Person, RIGS, View} from './characters/Puppet';
import {Director} from './render/Director';
import type {ShotDef} from './render/types';

const ROWS: [CharId, View[]][][] = [
	[['farmer', ['side', 'tq', 'back']], ['jesus', ['side', 'tq', 'back']], ['enemy', ['side', 'tq', 'back']]],
	[['servantA', ['side', 'tq', 'back']], ['servantB', ['side', 'tq', 'back']], ['servantC', ['side', 'tq', 'back']]],
	[['saul', ['side', 'tq', 'back']], ['paul', ['side', 'tq', 'back']], ['soldier', ['side', 'tq']], ['reaper', ['side', 'tq']]],
];
const GAP = 1.0;

const Lineup: React.FC<{t: number}> = ({t}) => {
	const items: React.ReactNode[] = [];
	ROWS.forEach((row, r) => {
		let x = -5.4;
		row.forEach(([id, views]) => {
			views.forEach((v) => {
				if (!RIGS[id][v]) return;
				items.push(<Person key={`${id}${v}`} id={id} view={v} position={[x, -r * 2.45, -r * 0.01]} pose={{}} t={t} blinkSeed={null} look={{lightDir: [-0.65, 0.76]}} shadow={{w: 0.7, d: 0.25, opacity: 0.35}} />);
				x += GAP;
			});
			x += 0.3;
		});
	});
	return (
		<>
			<mesh position={[0, -1.6, -3]}>
				<planeGeometry args={[40, 20]} />
				<meshBasicMaterial color="#8a8794" />
			</mesh>
			{items}
		</>
	);
};

const CLOSE: [CharId, View][] = [['farmer', 'tq'], ['jesus', 'tq'], ['servantB', 'tq'], ['saul', 'side'], ['paul', 'tq']];
const Close: React.FC<{t: number}> = ({t}) => (
	<>
		<mesh position={[0, 1, -3]}>
			<planeGeometry args={[40, 20]} />
			<meshBasicMaterial color="#8a8794" />
		</mesh>
		{CLOSE.map(([id, v], i) => (
			<Person key={i} id={id} view={v} position={[-2.4 + i * 1.2, 0, 0]} pose={{}} t={t} blinkSeed={null} look={{lightDir: [-0.65, 0.76]}} shadow={null} />
		))}
	</>
);

const SHEET: ShotDef = {
	id: 'SHEET',
	start: -1,
	end: 10,
	Content: ({t}) => <Lineup t={t} />,
	camera: () => ({pos: [0, -1.55, 140], target: [0, -1.55, 0], fov: 3.15, drift: 0}),
	grade: () => ({exposure: 1, contrast: 1, saturation: 1, vignette: 0, bloom: 0, grain: 0}),
};

const CLOSEUP: ShotDef = {
	id: 'CLOSEUP',
	start: -1,
	end: 10,
	Content: ({t}) => <Close t={t} />,
	camera: () => ({pos: [0, 1.3, 60], target: [0, 1.3, 0], fov: 1.45, drift: 0}),
	grade: () => ({exposure: 1, contrast: 1, saturation: 1, vignette: 0, bloom: 0, grain: 0}),
};

export const Sheet: React.FC<{close?: boolean}> = ({close}) => {
	const {width, height} = useVideoConfig();
	const ready = usePreloadTextures();
	if (!ready) return null;
	return (
		<AbsoluteFill style={{backgroundColor: '#8a8794'}}>
			<ThreeCanvas width={width} height={height} flat dpr={1} gl={{antialias: true, preserveDrawingBuffer: true}} camera={{fov: 30, near: 0.05, far: 2000}}>
				<Director shots={[close ? CLOSEUP : SHEET]} transitions={[]} lite={false} />
			</ThreeCanvas>
		</AbsoluteFill>
	);
};
