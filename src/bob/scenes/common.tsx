// Shared bits for the Bob scenes: crowd layouts, the street set, helpers.
import React from 'react';
import {Stage, Look} from '../../lib/Stage';
import {V3, lerp, lerp3} from '../../lib/anim';
import {hash} from '../../lib/random';
import {BobInst} from '../BobCrowd';
import {BobStreet, BobSky, townLook, ColorField} from '../world';

export const cam = (a: {pos: V3; target: V3; fov: number}, b: {pos: V3; target: V3; fov: number}, k: number) => ({pos: lerp3(a.pos, b.pos, k), target: lerp3(a.target, b.target, k), fov: lerp(a.fov, b.fov, k)});

/** Bobs walking along the street in a grid (rows along z), all facing dir (+1 = toward +z) */
export function walkerGrid(cols: number[], rows: number, z0: number, gap: number, dir: 1 | -1, seed = 0): BobInst[] {
	const out: BobInst[] = [];
	for (let r = 0; r < rows; r++)
		for (const x of cols) out.push({pos: [x, 0.3 * (Math.abs(x) > 5.2 ? 1 : 0), z0 - r * gap * dir], yaw: dir > 0 ? 0 : Math.PI, scale: 0.97 + hash(out.length, seed) * 0.0});
	return out;
}
export const moveAlong = (people: BobInst[], dz: number): BobInst[] => people.map((p) => ({...p, pos: [p.pos[0], p.pos[1], p.pos[2] + dz] as V3}));

export const StreetSet: React.FC<{k?: number; color?: ColorField; zFrom?: number; zTo?: number; focus?: V3; shadow?: number; children?: React.ReactNode; look?: Look; cars?: boolean}> = ({k = 0, color, zFrom = 40, zTo = -150, focus = [0, 0, 0], shadow = 26, children, look, cars = true}) => (
	<Stage look={look ?? townLook(k)} focus={focus} shadowSize={shadow}>
		<BobSky k={k} />
		<BobStreet zFrom={zFrom} zTo={zTo} color={color ?? (() => k)} ground={() => k} cars={cars} />
		{children}
	</Stage>
);
