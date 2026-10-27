import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, blob, box, facet, lambert, merge, terrain} from '../../../../src/shared/three/lowpoly';
import {oliveGeo} from '../../../../src/shared/three/props';
import {fbm2, rng, smoothstep} from '../../../../src/shared/math';

// One landscape for S10 (the cross on a far hill) and S12 (the pull-back at sunset).
// The sun sits at azimuth 180 (toward -Z): behind the hill, over the far ridge.

export const HILL: [number, number, number] = [0, 0, -60];
export const HILL_TOP = 12.5;

const hillH = (x: number, z: number) => {
	const dx = x - HILL[0];
	const dz = z - HILL[2];
	return HILL_TOP * Math.exp(-(dx * dx + dz * dz) / (2 * 15 * 15));
};
// rolling country, a valley in front, ridges far away (the horizon line the sun touches)
export const landH = (x: number, z: number) => {
	const near = fbm2(x / 90, z / 90, 3, 4) * 7 + fbm2(x / 30, z / 30, 9, 3) * 1.6;
	const far = smoothstep(-300, -1500, z) * (150 + fbm2(x / 300, 1, 4, 3) * 45);
	const valley = -6 * Math.exp(-((z + 10) * (z + 10)) / (2 * 40 * 40));
	return hillH(x, z) + near * (1 - smoothstep(-200, -700, z) * 0.6) + far + valley;
};
// ground height at the hilltop, where the cross stands
export const HILL_GROUND = landH(HILL[0], HILL[2]);

const grass = (x: number, z: number, y: number) => {
	const f = fbm2(x / 40, z / 40, 17, 3);
	const field = Math.floor(x / 26) * 7 + Math.floor(z / 22) * 13;
	const patch = ((field % 5) + 5) % 5;
	const fields = ['#C9A35C', '#B4A15E', '#A38F52', '#D2B06A', '#9C9A5A'];
	if (z < -300) return y > 40 ? '#9E8A6E' : '#A8946A';
	if (Math.abs(x - HILL[0]) < 22 && Math.abs(z - HILL[2]) < 22) return y > HILL_TOP * 0.7 ? '#B59C72' : '#C2A66E';
	return f > 0.15 ? fields[patch] : f < -0.2 ? '#A6965E' : '#BFA166';
};

const cityGeo = () => {
	const r = rng(41);
	const p: THREE.BufferGeometry[] = [];
	const cx = -36;
	const cz = -52;
	// wall ring with towers
	const R = 20;
	for (let i = 0; i < 28; i++) {
		const a = (i / 28) * Math.PI * 2;
		const x = cx + Math.cos(a) * R;
		const z = cz + Math.sin(a) * R * 0.8;
		const y = landH(x, z) - 0.5;
		p.push(facet(at(box(4.8, 5.2, 1.2), x, y + 2.6, z, -a + Math.PI / 2), '#D9C298', 0.05, 300 + i));
		if (i % 4 === 0) p.push(facet(at(box(2.6, 7.4, 2.6), x, y + 3.7, z), '#E0CA9E', 0.05, 340 + i));
	}
	// houses: cubes with flat roofs, packed inside
	for (let i = 0; i < 70; i++) {
		const a = r() * Math.PI * 2;
		const d = Math.sqrt(r()) * (R - 3);
		const x = cx + Math.cos(a) * d;
		const z = cz + Math.sin(a) * d * 0.8;
		const y = landH(x, z) - 0.3;
		const w = 2 + r() * 2.5;
		const h = 2.2 + r() * 3.2;
		p.push(facet(at(box(w, h, 2 + r() * 2.2), x, y + h / 2, z, r() * 0.4), r() > 0.5 ? '#E6D2AA' : '#D6BC8E', 0.05, 400 + i));
	}
	// a tall building in the city (the temple, far away)
	p.push(facet(at(box(9, 9, 7), cx + 4, landH(cx + 4, cz - 4) + 4.5, cz - 4), '#EADBB8', 0.04, 480));
	p.push(facet(at(box(9.2, 0.6, 7.2), cx + 4, landH(cx + 4, cz - 4) + 9.2, cz - 4), '#D8A64A', 0.04, 481));
	return merge(p);
};

const grovesGeo = (seed = 5) => {
	const r = rng(seed);
	const p: THREE.BufferGeometry[] = [];
	const base = oliveGeo(seed, 1);
	for (let i = 0; i < 90; i++) {
		const x = (r() - 0.5) * 260;
		const z = 30 - r() * 260;
		if (Math.abs(x - HILL[0]) < 12 && Math.abs(z - HILL[2]) < 12) continue;
		if (Math.hypot(x + 36, (z + 52) / 0.8) < 24) continue;
		const s = 1.4 + r() * 1.2;
		p.push(at(base, x, landH(x, z) - 0.2, z, r() * 6, 0, 0, s));
	}
	// rocks on the hill
	for (let i = 0; i < 7; i++) {
		const a = r() * Math.PI * 2;
		const d = 5 + r() * 12;
		const x = HILL[0] + Math.cos(a) * d;
		const z = HILL[2] + Math.sin(a) * d;
		const rad = 0.45 + r() * 0.7;
		p.push(facet(at(blob(rad, i + 7, 0.3, 0, 0.6), x, landH(x, z) - rad * 0.7, z), '#BCA37E', 0.08, 600 + i));
	}
	return merge(p);
};

// road winding from the foreground up toward the city gate
const roadGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	for (let i = 0; i < 60; i++) {
		const z = 60 - i * 2.2;
		const x = -10 + Math.sin(i * 0.12) * 8 - i * 0.35;
		p.push(facet(at(box(3.2, 0.1, 2.4), x, landH(x, z) + 0.12, z, Math.sin(i * 0.12) * 0.3), '#D9C49A', 0.04, 700 + i));
	}
	return merge(p);
};

export const Land: React.FC<{cross?: boolean; detail?: boolean}> = ({cross = true}) => {
	const geo = useMemo(() => {
		// sample where the vertices end up (the patch is moved to z = -60), so the hill sits
		// under the cross and the groves, rocks and cameras stand on the ground they were placed on
		const near = terrain(420, 420, 140, 140, (x, z) => landH(x, z - 60), (x, z, y) => grass(x, z - 60, y), 3, 0.05);
		near.translate(0, 0, -60);
		// the far patch keeps its local sampling: the horizon the sun sets behind was timed against it
		const far = terrain(3600, 1800, 90, 45, landH, grass, 4, 0.04);
		far.translate(0, 0, -1100);
		return {near, far, city: cityGeo(), groves: grovesGeo(), road: roadGeo()};
	}, []);
	useLayoutEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
	const crossGeo = useMemo(() => merge([facet(at(box(0.3, 4.4, 0.3), 0, 2.2, 0), '#3E2A1C', 0.04, 1), facet(at(box(2.3, 0.26, 0.3), 0, 3.25, 0), '#3E2A1C', 0.04, 2)]), []);
	const mat = lambert();
	return (
		<group>
			<mesh geometry={geo.near} material={mat} receiveShadow castShadow />
			<mesh geometry={geo.far} material={mat} receiveShadow />
			<mesh geometry={geo.city} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.groves} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.road} material={mat} receiveShadow />
			{cross ? <mesh geometry={crossGeo} material={mat} position={[HILL[0], HILL_GROUND - 0.2, HILL[2]]} castShadow /> : null}
		</group>
	);
};
