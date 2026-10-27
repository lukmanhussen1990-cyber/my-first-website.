import type React from 'react';
import type {Cam} from '../../../src/shared/three/shot';
import type {PostSettings} from '../../../src/shared/three/Post';
import type {SunState} from '../../../src/shared/sun';

// A scene = a 3D set + a camera move + post settings, all pure functions of scene time t
// (seconds since the scene's cut) and the scene's duration d.
export type SceneDef = {
	id: string;
	sunAz: number; // where the sun sits in this set's coordinates (deg from +Z toward +X)
	camera: (t: number, d: number) => Cam;
	post: (t: number, d: number, sun: SunState) => PostSettings;
	Content: React.FC<{t: number; d: number}>;
	// world-space anchors for labels/tags that must stick to things
	anchors?: (t: number, d: number) => Record<string, [number, number, number]>;
};

export const gradeFromSun = (sun: SunState, extra: Partial<NonNullable<PostSettings['grade']>> = {}) => ({
	warmth: sun.warmth,
	saturation: sun.saturation,
	exposure: sun.exposure,
	contrast: 1.04,
	...extra,
});
