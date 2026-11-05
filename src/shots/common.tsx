import React from 'react';
import {townsperson} from '../characters/cast';
import {Expr} from '../characters/faces';
import {Look, Person, Pose} from '../characters/Person';
import {V3, rnd} from '../lib/anim';
import {FX} from '../three/Stage3D';
import {Clouds, LightPreset, Lights, Sky, SkyPreset} from '../three/prims';
import {zTex} from '../three/textures';
import {TimeOfDay, Town} from '../sets/Town';

/** Props every shot receives: local time t (s), duration d, progress p (0..1), global time gt. */
export type SP = {t: number; d: number; p: number; gt: number};

export type ShotDef = {
	id: string;
	start: number;
	end: number;
	C: React.FC<SP>;
	fx?: FX;
	whipIn?: boolean;
	flash?: (sp: SP) => number; // white flash overlay 0..1
	overlay?: React.FC<SP>; // HTML overlay
};

export const DAY_FX: FX = {bg: '#8fd3ff', bloom: 0.45, env: 0.42, contrast: 0.1, saturation: 0.16};
export const MORNING_FX: FX = {bg: '#ffd9b0', bloom: 0.7, env: 0.55, saturation: 0.15};
export const NIGHT_FX: FX = {bg: '#0b1030', bloom: 1.25, bloomThreshold: 0.55, env: 0.18, vignette: 0.55, saturation: 0.1};
export const FOREST_FX: FX = {bg: '#060a1c', bloom: 1.1, bloomThreshold: 0.6, env: 0.16, vignette: 0.5, exposure: 1.12, fog: {color: '#141c3c', density: 0.018}};
export const OFFICE_FX: FX = {bg: '#f4e4c8', bloom: 0.45, env: 0.6};
export const DARK_FX: FX = {bg: '#0a0812', bloom: 1.0, bloomThreshold: 0.6, env: 0.1, vignette: 0.7, contrast: 0.12};

/** Outdoor town set with sky + lighting for a time of day. */
export const TownKit: React.FC<{t: number; time?: TimeOfDay; center?: V3; size?: number; clock?: [number, number]; sunDir?: V3; houses?: boolean; fountain?: boolean; children?: React.ReactNode}> = ({t, time = 'day', center = [0, 0, 10], size = 40, clock, sunDir, houses, fountain, children}) => {
	const sky: SkyPreset = time === 'night' ? 'night' : time === 'sunrise' || time === 'morning' ? 'sunrise' : 'day';
	const light: LightPreset = time === 'night' ? 'night' : time === 'sunrise' || time === 'morning' ? 'morning' : 'day';
	return (
		<>
			<Sky preset={sky} stars={time === 'night'} moon={time === 'night' ? [-260, 330, -600] : undefined} sun={time === 'sunrise' ? [-120, 70, -700] : undefined} />
			{time !== 'night' ? <Clouds n={14} radius={420} y={140} color={time === 'day' ? '#ffffff' : '#ffd6c0'} /> : null}
			<Lights preset={light} center={center} size={size} sunDir={sunDir} />
			<Town time={time} t={t} clock={clock} houses={houses} fountain={fountain}>
				{children}
			</Town>
		</>
	);
};

export type CrowdSpec = {
	n: number;
	seed: number;
	origin: V3;
	cols?: number;
	spacing?: [number, number];
	yaw?: number;
	expr?: Expr | ((i: number) => Expr);
	pose?: (i: number) => Pose | undefined;
	talking?: boolean;
	jitter?: number;
	scale?: number;
	looks?: (i: number) => Look;
};

/** Rows of townspeople with mixed looks, seeded. */
export const Crowd: React.FC<CrowdSpec & {t: number}> = ({t, n, seed, origin, cols = 6, spacing = [2.8, 3.2], yaw = 0, expr = 'happy', pose, talking, jitter = 0.6, scale = 1, looks}) => (
	<group position={origin} rotation={[0, yaw, 0]}>
		{Array.from({length: n}).map((_, i) => {
			const r = Math.floor(i / cols);
			const c = i % cols;
			const rowCount = Math.min(cols, n - r * cols);
			const x = (c - (rowCount - 1) / 2) * spacing[0] + (r % 2) * spacing[0] * 0.5 + (rnd(`cx${seed}${i}`) - 0.5) * jitter;
			const z = r * spacing[1] + (rnd(`cz${seed}${i}`) - 0.5) * jitter;
			const e = typeof expr === 'function' ? expr(i) : expr;
			return (
				<Person
					key={i}
					look={looks ? looks(i) : townsperson(seed * 100 + i)}
					t={t + rnd(`ct${seed}${i}`) * 3}
					seed={seed * 100 + i}
					expr={e}
					talking={talking}
					pose={pose ? pose(i) : undefined}
					position={[x, 0, z]}
					yaw={(rnd(`cy${seed}${i}`) - 0.5) * 0.4}
					scale={scale * (0.94 + rnd(`cs${seed}${i}`) * 0.1)}
				/>
			);
		})}
	</group>
);

/** Floating "z z z" for sleepers. */
export const Zzz: React.FC<{position: V3; t: number; s?: number}> = ({position, t, s = 1}) => (
	<group position={position}>
		{[0, 1, 2].map((i) => {
			const ph = (t * 0.45 + i / 3) % 1;
			return (
				<sprite key={i} position={[ph * 1.2 * s, ph * 2.4 * s, 0]} scale={[(0.35 + ph * 0.5) * s, (0.35 + ph * 0.5) * s, 1]}>
					<spriteMaterial map={zTex()} transparent opacity={Math.min(1, ph * 5) * Math.min(1, (1 - ph) * 3)} depthWrite={false} />
				</sprite>
			);
		})}
	</group>
);

/** Cheering arm pose. */
export const cheer = (t: number, i: number): Pose => ({
	armL: [0, 0, 2.6 + Math.sin(t * 9 + i) * 0.25],
	armR: [0, 0, -2.6 - Math.sin(t * 9 + i + 1) * 0.25],
	bob: Math.abs(Math.sin(t * 7 + i)) * 0.35,
});

/** Clapping pose. */
export const clap = (t: number, i: number): Pose => {
	const c = Math.sin(t * 16 + i) * 0.25;
	return {armL: [-1.25, 0, -0.45 - c], armR: [-1.25, 0, 0.45 + c]};
};

export const laughPose = (t: number, i: number): Pose => ({
	armL: [-0.5, 0, 0.5],
	armR: [-0.5, 0, -0.5],
	lean: -0.08 + Math.sin(t * 12 + i) * 0.06,
	bob: Math.abs(Math.sin(t * 12 + i)) * 0.15,
	headPitch: -0.15,
});

export const sleepStand = (t: number, i: number): Pose => ({
	headTilt: 0.35 * (i % 2 ? 1 : -1),
	headPitch: 0.3,
	lean: Math.sin(t * 0.8 + i) * 0.05,
	armL: [0, 0, 0.1],
	armR: [0, 0, -0.1],
});
