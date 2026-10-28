import type * as THREE from 'three';

export type Vec3 = [number, number, number];

export type CamState = {pos: Vec3; target: Vec3; fov: number; roll?: number; shake?: number; drift?: number};

export type Grade = {
	exposure: number;
	contrast: number;
	saturation: number;
	gain: Vec3; // per-channel multiplier (warm/cool tint)
	lift: Vec3; // added to shadows
	vignette: number;
	bloom: number;
	bloomThreshold: number;
	grain: number;
	flash: number;
	flashColor: Vec3;
	desat: number;
	shimmer: number;
	shimmerRect: [number, number, number, number]; // uv x0, y0, x1, y1
	rewind: number;
};

export const DEFAULT_GRADE: Grade = {
	exposure: 1,
	contrast: 1,
	saturation: 1,
	gain: [1, 1, 1],
	lift: [0, 0, 0],
	vignette: 0.35,
	bloom: 0.35,
	bloomThreshold: 0.85,
	grain: 0.018,
	flash: 0,
	flashColor: [1, 0.93, 0.78],
	desat: 0,
	shimmer: 0,
	shimmerRect: [0, 0, 1, 1],
	rewind: 0,
};

export type FogState = {color: THREE.ColorRepresentation; near: number; far: number};

export type ShotProps = {t: number; lite: boolean};

export type ShotDef = {
	id: string;
	start: number;
	end: number;
	Content: React.FC<ShotProps>;
	camera: (t: number) => CamState;
	grade?: (t: number) => Partial<Grade>;
	fog?: (t: number) => FogState | null;
	anchors?: (t: number) => Record<string, Vec3>;
	// screen-space god rays streaming from a bright point in the world (the opening in the clouds, the sun)
	rays?: (t: number) => {at: Vec3; strength: number; color?: Vec3} | null;
	// depth of field: sharp from focus - range to focus + range (metres from the camera), blur grows outside
	// it up to `max` px (1080 wide); `aperture` is the blur in px of something infinitely far away
	dof?: (t: number) => Dof | null;
};

export type Dof = {focus: number; range?: number; aperture: number; max?: number};

export type TransitionKind = 'cut' | 'dissolve' | 'haze' | 'cloak' | 'light' | 'whip' | 'fade' | 'swirl' | 'split' | 'streak';
// A blend between two shots centred on `at`. For 'split' the two shots share the screen for the whole
// window and `divider(t)` is the x position (0..1) of the dividing line; `slant` tilts it.
export type Transition = {from: string; to: string; at: number; dur: number; kind: TransitionKind; divider?: (t: number) => number; slant?: number};

// A second shot shown inside a framed rectangle over the picture (layout pixels, 1080x1920, rot in CSS degrees).
export type InsetRect = {cx: number; cy: number; w: number; h: number; rot: number; opacity: number; age: number};
export type Inset = {shot: string; rect: (t: number) => InsetRect | null};
