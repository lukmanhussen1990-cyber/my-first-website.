import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, blob, box, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {rng} from '../../../../src/shared/math';

// A modern living room at night (S2, S3, S8). The sofa faces +X; a window in the back wall
// (z = -2.4) shows the city at night. The phone is the brightest thing in the room.

export const SOFA = {x: 0, z: -1.2, seatY: 0.46};
const WALL = '#6E6A78';

const roomGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const r = rng(3);
	// back wall with a window, side wall, floor boards
	const wx0 = 1.6;
	const wx1 = 3.6;
	p.push(facet(at(box(wx0 + 5, 3, 0.2), (wx0 - 5) / 2, 1.5, -2.5), WALL, 0.03, 1));
	p.push(facet(at(box(6 - wx1, 3, 0.2), (wx1 + 6) / 2, 1.5, -2.5), WALL, 0.03, 2));
	p.push(facet(at(box(wx1 - wx0, 0.8, 0.2), (wx0 + wx1) / 2, 0.4, -2.5), WALL, 0.03, 3));
	p.push(facet(at(box(wx1 - wx0, 0.5, 0.2), (wx0 + wx1) / 2, 2.75, -2.5), WALL, 0.03, 4));
	p.push(facet(at(box(wx1 - wx0 + 0.12, 0.08, 0.28), (wx0 + wx1) / 2, 0.8, -2.42), '#3E3A44', 0.03, 5));
	p.push(facet(at(box(0.06, 1.7, 0.16), (wx0 + wx1) / 2, 1.65, -2.45), '#3E3A44', 0.03, 6));
	p.push(facet(at(box(0.2, 3, 8), -4.8, 1.5, 1.4), '#63606E', 0.03, 7));
	for (let i = 0; i < 18; i++) p.push(facet(at(box(0.58, 0.05, 8), -4.6 + i * 0.6, -0.025, 1.4), r() > 0.5 ? '#5A4636' : '#644E3C', 0.03, 10 + i));
	p.push(facet(at(box(3.4, 0.02, 2.2), 0.8, 0.01, -0.6), '#4E5A6A', 0.04, 30));
	// sofa: base, seat cushions, back cushions, arms
	const S = '#45403E';
	const S2 = '#504A47';
	p.push(facet(at(box(2.4, 0.3, 0.95, 0.03), SOFA.x, 0.2, SOFA.z), S, 0.04, 40));
	for (let i = 0; i < 2; i++) p.push(facet(at(box(1.08, 0.16, 0.86, 0.05), SOFA.x - 0.56 + i * 1.12, SOFA.seatY - 0.04, SOFA.z + 0.04), S2, 0.05, 41 + i));
	p.push(facet(at(box(2.4, 0.62, 0.26, 0.04), SOFA.x, 0.66, SOFA.z - 0.42), S, 0.04, 44));
	for (let i = 0; i < 2; i++) p.push(facet(at(box(1.06, 0.48, 0.2, 0.06), SOFA.x - 0.56 + i * 1.12, 0.76, SOFA.z - 0.26, 0, -0.18), S2, 0.05, 45 + i));
	for (const sx of [-1, 1]) p.push(facet(at(box(0.24, 0.52, 0.95, 0.05), SOFA.x + sx * 1.2, 0.42, SOFA.z), S, 0.04, 48));
	p.push(facet(at(blob(0.22, 4, 0.12, 1, 0.5), SOFA.x - 0.95, 0.62, SOFA.z - 0.1), '#B5763A', 0.05, 50));
	// coffee table with a mug, a lamp that is off, a plant, a shelf
	p.push(facet(at(box(1.1, 0.06, 0.6), 1.9, 0.42, -0.6), '#6E5240', 0.04, 60));
	for (const [lx, lz] of [[1.42, -0.36], [2.38, -0.36], [1.42, -0.84], [2.38, -0.84]]) p.push(facet(at(box(0.05, 0.4, 0.05), lx, 0.2, lz), '#4A3828', 0.04, 61));
	p.push(facet(at(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 9), 1.7, 0.51, -0.5), '#D8D2C8', 0.04, 65));
	p.push(facet(at(new THREE.CylinderGeometry(0.04, 0.07, 1.4, 7), -1.7, 0.7, -2.0), '#2E2A30', 0.04, 70));
	p.push(facet(at(new THREE.ConeGeometry(0.26, 0.3, 9, 1, true), -1.7, 1.48, -2.0), '#8E8676', 0.04, 71));
	p.push(facet(at(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 8), 4.2, 0.2, -1.8), '#6E4A3A', 0.05, 72));
	for (let i = 0; i < 6; i++) p.push(facet(at(blob(0.24, 80 + i, 0.25, 0), 4.2 + Math.cos(i) * 0.2, 0.62 + (i % 3) * 0.2, -1.8 + Math.sin(i) * 0.2), '#3E5638', 0.06, 80 + i));
	p.push(facet(at(box(1.6, 0.05, 0.3), -3.4, 1.6, -2.3), '#4A3B30', 0.04, 90));
	for (let i = 0; i < 5; i++) p.push(facet(at(box(0.08, 0.3 + r() * 0.1, 0.22), -3.95 + i * 0.13, 1.78, -2.3), ['#7A4A3A', '#3F5A6E', '#A08A5A'][i % 3], 0.05, 91 + i));
	return merge(p);
};

// the city at night through the window: dark blocks + lit windows
const cityGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const lit: THREE.BufferGeometry[] = [];
	const r = rng(17);
	for (let i = 0; i < 40; i++) {
		const x = -30 + i * 2.2 + r() * 1.2;
		const h = 6 + r() * 26;
		const z = -26 - r() * 30;
		p.push(facet(at(box(2.4 + r() * 1.6, h, 3), x, h / 2 - 8, z), '#23263A', 0.05, i));
		for (let k = 0; k < 6; k++) if (r() > 0.45) lit.push(at(box(0.4, 0.5, 0.05), x + (r() - 0.5) * 1.6, -8 + r() * h, z + 1.55));
	}
	return {dark: merge(p), lit: merge(lit)};
};

export const Living: React.FC = () => {
	const geo = useMemo(() => ({room: roomGeo(), city: cityGeo()}), []);
	useLayoutEffect(() => () => [geo.room, geo.city.dark, geo.city.lit].forEach((g) => g.dispose()), [geo]);
	const mat = lambert();
	return (
		<group>
			<mesh geometry={geo.room} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.city.dark} material={mat} />
			<mesh geometry={geo.city.lit}>
				<meshBasicMaterial color="#FFD9A0" fog={false} />
			</mesh>
		</group>
	);
};
