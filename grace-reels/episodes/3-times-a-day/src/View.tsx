import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ApplyCamera, ShotContext, type Shot} from '../../../src/shared/three/shot';
import {Post, type PostSettings} from '../../../src/shared/three/Post';
import {sunDirection, type SunState} from '../../../src/shared/sun';
import type {SceneDef} from './sceneKit';

export const W = 1080;
export const H = 1920;

// One 3D view of a scene (also used for the split screen and the loop).
export const SceneView: React.FC<{def: SceneDef; t: number; d: number; T: number; width?: number; height?: number; sun?: SunState; post?: (p: PostSettings) => PostSettings}> = ({def, t, d, T, width = W, height = H, sun: sunOverride, post}) => {
	const frame = useCurrentFrame();
	const sun = sunOverride ?? def.mood(t, d);
	const sunDir = sunDirection(sun.elevationDeg, typeof def.sunAz === 'function' ? def.sunAz(t, d) : def.sunAz);
	const cam = def.camera(t, d);
	const shot: Shot = {t, T, frame, cam, sun, sunDir, W: width, H: height};
	const p = def.post(t, d, sun);
	const Content = def.Content;
	return (
		<ThreeCanvas
			width={width}
			height={height}
			shadows
			flat
			dpr={typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
			gl={{antialias: false, powerPreference: 'high-performance'}}
			camera={{fov: cam.fov, position: cam.pos, near: 0.1, far: 2000}}
		>
			<ShotContext.Provider value={shot}>
				<ApplyCamera />
				<Content t={t} d={d} />
				<Post settings={post ? post(p) : p} />
			</ShotContext.Provider>
		</ThreeCanvas>
	);
};
