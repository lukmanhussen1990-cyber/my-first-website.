import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ApplyCamera, ShotContext, type Shot} from '../../../src/shared/three/shot';
import {Post} from '../../../src/shared/three/Post';
import {sunAt, sunDirection} from '../../../src/shared/sun';
import {FPS, sceneAt, sunTime} from './timeline';
import type {SceneDef} from './sceneKit';
import {S01} from './scenes/S01Hook';
import {S02, S03, S04, S05} from './scenes/S02to05Synagogue';
import {S06, S07, S08} from './scenes/S06to08Temple';
import {S09, S10, S11L, S11R, S12} from './scenes/S09to12';

export const SCENES: Record<string, SceneDef> = {S1: S01, S2: S02, S3: S03, S4: S04, S5: S05, S6: S06, S7: S07, S8: S08, S9: S09, S10: S10, S12: S12};
export const EXTRA: Record<string, SceneDef> = {S11L, S11R};

// One 3D view of one scene at global time T (also used for split screens and the grid).
export const SceneView: React.FC<{def: SceneDef; t: number; d: number; T: number; width: number; height: number; sunT?: number; postExtra?: (p: ReturnType<SceneDef['post']>) => ReturnType<SceneDef['post']>}> = ({
	def,
	t,
	d,
	T,
	width,
	height,
	sunT,
	postExtra,
}) => {
	const frame = useCurrentFrame();
	const sun = sunAt(sunT ?? sunTime(T));
	const sunDir = sunDirection(sun.elevationDeg, def.sunAz);
	const cam = def.camera(t, d);
	const shot: Shot = {t, T, frame, cam, sun, sunDir, W: width, H: height};
	const post = postExtra ? postExtra(def.post(t, d, sun)) : def.post(t, d, sun);
	const Content = def.Content;
	return (
		<ThreeCanvas width={width} height={height} shadows flat gl={{antialias: false, powerPreference: 'high-performance'}} camera={{fov: cam.fov, position: cam.pos, near: 0.1, far: 2000}}>
			<ShotContext.Provider value={shot}>
				<ApplyCamera />
				<Content t={t} d={d} />
				<Post settings={post} />
			</ShotContext.Provider>
		</ThreeCanvas>
	);
};

export const SunsetRule: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const T = frame / FPS;
	const span = sceneAt(T);
	const def = SCENES[span.id] ?? S01;
	const t = T - span.start;
	const d = span.end - span.start;
	return useMemo(
		() => (
			<AbsoluteFill style={{backgroundColor: '#14100D'}}>
				<SceneView def={def} t={t} d={d} T={T} width={width} height={height} />
			</AbsoluteFill>
		),
		[def, t, d, T, width, height],
	);
};
