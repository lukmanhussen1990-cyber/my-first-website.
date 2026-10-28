import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, blob, box, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {rng} from '../../../../src/shared/math';
import {WIN} from './UpperRoom';

// A small quiet room in a modern flat (S9, S10, S12). Built in the same frame as Daniel's
// upper room: its window sits exactly where his does (WIN), so S10 can match-cut to S1.
// The door is in the right wall; a small table stands by the window.

export const DOOR = {x: 3.45, z: -0.2, w: 0.9, h: 2.1};
export const TABLE_AT: [number, number, number] = [1.75, 0, -1.95];
const WALL = '#BDAE9C';
const WALL2 = '#B3A390';

const roomGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const r = rng(5);
	// back wall with a modern window cut out (same opening as Daniel's, squared off)
	const s = new THREE.Shape();
	s.moveTo(-3.4, 0);
	s.lineTo(3.7, 0);
	s.lineTo(3.7, 3.2);
	s.lineTo(-3.4, 3.2);
	s.closePath();
	const top = WIN.rectTop + WIN.w / 2;
	const hole = new THREE.Path();
	hole.moveTo(WIN.x - WIN.w / 2, WIN.sill);
	hole.lineTo(WIN.x + WIN.w / 2, WIN.sill);
	hole.lineTo(WIN.x + WIN.w / 2, top);
	hole.lineTo(WIN.x - WIN.w / 2, top);
	hole.lineTo(WIN.x - WIN.w / 2, WIN.sill);
	s.holes.push(hole);
	const g = new THREE.ExtrudeGeometry(s, {depth: 0.25, bevelEnabled: false});
	g.translate(0, 0, WIN.z - 0.25);
	p.push(facet(g, WALL, 0.03, 1));
	// window frame, a mullion and a transom, a sill
	const fr = '#ECE6DC';
	p.push(facet(at(box(WIN.w + 0.12, 0.08, 0.3), WIN.x, WIN.sill, WIN.z - 0.08), fr, 0.03, 2));
	p.push(facet(at(box(WIN.w + 0.12, 0.08, 0.2), WIN.x, top, WIN.z - 0.12), fr, 0.03, 3));
	p.push(facet(at(box(0.08, top - WIN.sill, 0.2), WIN.x - WIN.w / 2, (top + WIN.sill) / 2, WIN.z - 0.12), fr, 0.03, 4));
	p.push(facet(at(box(0.08, top - WIN.sill, 0.2), WIN.x + WIN.w / 2, (top + WIN.sill) / 2, WIN.z - 0.12), fr, 0.03, 5));
	p.push(facet(at(box(0.05, top - WIN.sill, 0.12), WIN.x, (top + WIN.sill) / 2, WIN.z - 0.12), fr, 0.03, 6));
	p.push(facet(at(box(WIN.w, 0.05, 0.12), WIN.x, WIN.rectTop, WIN.z - 0.12), fr, 0.03, 7));
	// side walls: the right one with the door opening
	p.push(facet(at(box(0.25, 3.2, 8), -3.3, 1.6, 1.4), WALL2, 0.03, 8));
	const dz0 = DOOR.z - DOOR.w / 2;
	const dz1 = DOOR.z + DOOR.w / 2;
	p.push(facet(at(box(0.25, 3.2, dz0 - WIN.z), 3.6, 1.6, (WIN.z + dz0) / 2), WALL2, 0.03, 9));
	p.push(facet(at(box(0.25, 3.2, 5.4 - dz1), 3.6, 1.6, (dz1 + 5.4) / 2), WALL2, 0.03, 10));
	p.push(facet(at(box(0.25, 3.2 - DOOR.h, DOOR.w), 3.6, (3.2 + DOOR.h) / 2, DOOR.z), WALL2, 0.03, 11));
	p.push(facet(at(box(0.3, 0.08, DOOR.w + 0.16), 3.5, DOOR.h + 0.04, DOOR.z), '#E2DACB', 0.03, 12));
	// a landing beyond the door so the doorway is not a hole into nothing
	p.push(facet(at(box(2.6, 3.2, 0.2), 4.9, 1.6, DOOR.z - 0.9), '#8E8478', 0.03, 13));
	p.push(facet(at(box(2.6, 3.2, 0.2), 4.9, 1.6, DOOR.z + 0.9), '#8E8478', 0.03, 14));
	p.push(facet(at(box(0.2, 3.2, 2.0), 6.2, 1.6, DOOR.z), '#9A9084', 0.03, 15));
	// floor boards, a soft rug where they kneel
	for (let i = 0; i < 12; i++) p.push(facet(at(box(0.58, 0.05, 9), -3.1 + i * 0.6, -0.025, 1.4), r() > 0.5 ? '#8A6A4E' : '#94745A', 0.03, 20 + i));
	p.push(facet(at(box(1.5, 0.02, 1.7), WIN.x + 0.1, 0.012, -1.6), '#C9B8A0', 0.04, 40));
	p.push(facet(at(box(5.2, 0.05, 2), 1.5, -0.02, DOOR.z + 0.1), '#8A6A4E', 0.03, 41));
	// the small table by the window, a lamp on it, a plant, a cushion
	const [tx, , tz] = TABLE_AT;
	p.push(facet(at(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), tx, 0.62, tz), '#7A5A40', 0.04, 50));
	p.push(facet(at(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), tx, 0.3, tz), '#4A3828', 0.04, 51));
	p.push(facet(at(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 12), tx, 0.015, tz), '#4A3828', 0.04, 52));
	p.push(facet(at(new THREE.CylinderGeometry(0.04, 0.06, 0.32, 8), tx + 0.18, 0.8, tz - 0.2), '#3A3230', 0.04, 53));
	p.push(facet(at(new THREE.ConeGeometry(0.15, 0.17, 10, 1, true), tx + 0.18, 1.02, tz - 0.2), '#EADFC8', 0.04, 54));
	p.push(facet(at(new THREE.CylinderGeometry(0.18, 0.14, 0.34, 8), -2.6, 0.17, -2.1), '#A2603E', 0.05, 55));
	for (let i = 0; i < 5; i++) p.push(facet(at(blob(0.2, 60 + i, 0.25, 0), -2.6 + Math.cos(i) * 0.15, 0.5 + (i % 3) * 0.16, -2.1 + Math.sin(i) * 0.15), '#5E7A4A', 0.06, 60 + i));
	p.push(facet(at(blob(0.26, 9, 0.12, 1, 0.45), -1.6, 0.12, -1.2), '#7E5E8A', 0.05, 70));
	// a frame on the left wall (no text)
	p.push(facet(at(box(0.05, 0.6, 0.8), -3.15, 1.7, -0.8), '#5B4636', 0.03, 80));
	p.push(facet(at(box(0.04, 0.48, 0.68), -3.13, 1.7, -0.8), '#C8A46A', 0.06, 81));
	return merge(p);
};

// outside the window: night city, low blocks with lit windows
const outsideGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const lit: THREE.BufferGeometry[] = [];
	const r = rng(29);
	for (let i = 0; i < 36; i++) {
		const x = -40 + i * 2.6 + r() * 1.4;
		const h = 5 + r() * 18;
		const z = -18 - r() * 30;
		p.push(facet(at(box(2.4 + r() * 2, h, 3), x, h / 2 - 6, z), '#262A40', 0.05, i));
		for (let k = 0; k < 5; k++) if (r() > 0.5) lit.push(at(box(0.4, 0.5, 0.05), x + (r() - 0.5) * 1.6, -6 + r() * h, z + 1.55));
	}
	return {dark: merge(p), lit: merge(lit)};
};

// the door leaf, hinged at its near edge; angle 0 = shut
const doorGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	p.push(facet(at(box(0.05, DOOR.h - 0.02, DOOR.w - 0.04), 0, DOOR.h / 2, -(DOOR.w - 0.04) / 2), '#8C6A4A', 0.04, 1));
	for (const y of [0.55, 1.45]) p.push(facet(at(box(0.06, 0.6, DOOR.w - 0.3), -0.01, y, -(DOOR.w - 0.04) / 2), '#7A5A3E', 0.04, 2));
	p.push(facet(at(new THREE.SphereGeometry(0.035, 8, 6), -0.06, 1.02, -(DOOR.w - 0.16)), '#D8C9A8', 0.03, 3));
	return merge(p);
};

export const QuietRoom: React.FC<{door?: number; lamp?: number}> = ({door = 0, lamp = 0}) => {
	const geo = useMemo(() => ({room: roomGeo(), out: outsideGeo(), door: doorGeo()}), []);
	useLayoutEffect(() => () => [geo.room, geo.out.dark, geo.out.lit, geo.door].forEach((g) => g.dispose()), [geo]);
	const mat = lambert();
	const [tx, , tz] = TABLE_AT;
	return (
		<group>
			<mesh geometry={geo.room} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.out.dark} material={mat} />
			<mesh geometry={geo.out.lit}>
				<meshBasicMaterial color="#FFD9A0" fog={false} />
			</mesh>
			{/* hinge at the door's front edge (toward the window); opens into the room */}
			<group position={[3.5, 0, DOOR.z + DOOR.w / 2 - 0.02]} rotation={[0, door * 1.6, 0]}>
				<mesh geometry={geo.door} material={mat} castShadow receiveShadow />
			</group>
			{lamp > 0 ? <pointLight position={[tx + 0.16, 1.0, tz - 0.12]} color="#FFC27A" intensity={6 * lamp} distance={6} decay={1.4} /> : null}
		</group>
	);
};
