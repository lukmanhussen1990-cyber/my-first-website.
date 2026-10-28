import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, blob, box, facet, lambert, merge, terrain} from '../../../../src/shared/three/lowpoly';
import {jarGeo, palmGeo} from '../../../../src/shared/three/props';
import {fbm2, rng} from '../../../../src/shared/math';
import {useShot} from '../../../../src/shared/three/shot';

// Daniel's upper room in Babylon, "his windows being open in his chamber toward Jerusalem"
// (Daniel 6:10). The window looks toward -Z: over the street and the city's flat roofs to a
// faraway Jerusalem on the horizon. The room floor is y = 0, the street is 3.5 m below.

export const WIN = {x: 0.4, sill: 0.5, w: 1.4, rectTop: 1.85, z: -2.6, depth: 0.45};
export const STREET_Y = -3.5;
const PLASTER = '#D8BF95';
const PLASTER2 = '#CDB287';
const WOOD = '#7A5232';
const WOOD2 = '#8C603A';

// back wall: one extruded slab with the arched window cut out
const backWall = () => {
	const s = new THREE.Shape();
	s.moveTo(-6, STREET_Y);
	s.lineTo(6, STREET_Y);
	s.lineTo(6, 3.4);
	s.lineTo(-6, 3.4);
	s.closePath();
	const R = WIN.w / 2;
	const hole = new THREE.Path();
	hole.moveTo(WIN.x - R, WIN.sill);
	hole.lineTo(WIN.x + R, WIN.sill);
	hole.lineTo(WIN.x + R, WIN.rectTop);
	hole.absarc(WIN.x, WIN.rectTop, R, 0, Math.PI, false);
	hole.lineTo(WIN.x - R, WIN.sill);
	s.holes.push(hole);
	// the street door on the ground floor
	const door = new THREE.Path();
	door.moveTo(-2.4, STREET_Y);
	door.lineTo(-1.3, STREET_Y);
	door.lineTo(-1.3, STREET_Y + 2.1);
	door.absarc(-1.85, STREET_Y + 2.1, 0.55, 0, Math.PI, false);
	door.lineTo(-2.4, STREET_Y);
	s.holes.push(door);
	const g = new THREE.ExtrudeGeometry(s, {depth: WIN.depth, bevelEnabled: false, curveSegments: 18});
	g.translate(0, 0, WIN.z - WIN.depth);
	return facet(g, PLASTER, 0.035, 3);
};

// lattice in the arch: diagonal bars clipped to the half disc
const latticeGeo = () => {
	const R = WIN.w / 2 - 0.03;
	const parts: THREE.BufferGeometry[] = [];
	const step = 0.16;
	for (const dir of [1, -1]) {
		for (let c = -R * 1.5; c <= R * 1.5; c += step) {
			// line y = dir * x + c, inside x^2 + y^2 <= R^2, y >= 0
			const pts: [number, number][] = [];
			const a = 2;
			const b = 2 * dir * c;
			const cc = c * c - R * R;
			const disc = b * b - 4 * a * cc;
			if (disc <= 0) continue;
			for (const sgn of [-1, 1]) {
				const x = (-b + sgn * Math.sqrt(disc)) / (2 * a);
				pts.push([x, dir * x + c]);
			}
			// clip to y >= 0
			let [p0, p1] = pts;
			if (p0[1] < 0 && p1[1] < 0) continue;
			const cut = (p: [number, number], q: [number, number]): [number, number] => {
				const k = p[1] / (p[1] - q[1]);
				return [p[0] + (q[0] - p[0]) * k, 0];
			};
			if (p0[1] < 0) p0 = cut(p0, p1);
			if (p1[1] < 0) p1 = cut(p1, p0);
			const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
			if (len < 0.05) continue;
			const mx = (p0[0] + p1[0]) / 2;
			const my = (p0[1] + p1[1]) / 2;
			const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
			parts.push(facet(at(box(len, 0.035, 0.05), WIN.x + mx, WIN.rectTop + my, WIN.z - WIN.depth / 2, 0, 0, ang), WOOD, 0.04, parts.length));
		}
	}
	// the sill bar under the arch
	parts.push(facet(at(box(WIN.w, 0.06, 0.08), WIN.x, WIN.rectTop + 0.02, WIN.z - WIN.depth / 2), WOOD, 0.04, 90));
	return merge(parts);
};

// one shutter leaf (0.7 x 1.5 m): frame + horizontal slats, hinge at local x = 0
const leafGeo = (side: 1 | -1) => {
	const w = WIN.w / 2;
	const h = WIN.rectTop - WIN.sill;
	const parts: THREE.BufferGeometry[] = [];
	const cx = (side * w) / 2;
	parts.push(facet(at(box(w, 0.07, 0.05), cx, h - 0.035, 0), WOOD, 0.04, 1));
	parts.push(facet(at(box(w, 0.07, 0.05), cx, 0.035, 0), WOOD, 0.04, 2));
	parts.push(facet(at(box(0.07, h, 0.05), side * 0.035, h / 2, 0), WOOD, 0.04, 3));
	parts.push(facet(at(box(0.07, h, 0.05), side * (w - 0.035), h / 2, 0), WOOD, 0.04, 4));
	for (let i = 0; i < 13; i++) parts.push(facet(at(box(w - 0.1, 0.075, 0.025), cx, 0.12 + i * 0.105, 0, 0, -0.35), i % 2 ? WOOD2 : WOOD, 0.05, 10 + i));
	return merge(parts);
};

const interiorGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const r = rng(11);
	// floor of worn square tiles
	for (let ix = -6; ix < 6; ix++) {
		for (let iz = -1; iz < 14; iz++) {
			p.push(facet(at(box(0.58, 0.06, 0.58), ix * 0.6 + 0.3, -0.03, WIN.z + 0.3 + iz * 0.6 + 0.3), r() > 0.5 ? '#B98E62' : '#A87E56', 0.04, 100 + p.length));
		}
	}
	// side walls and ceiling beams
	p.push(facet(at(box(0.3, 3.4, 10), -3.2, 1.7, 2.4), PLASTER2, 0.03, 200));
	p.push(facet(at(box(0.3, 3.4, 10), 3.6, 1.7, 2.4), PLASTER2, 0.03, 201));
	for (let i = 0; i < 8; i++) p.push(facet(at(box(7, 0.18, 0.2), 0.2, 3.3, WIN.z + 0.4 + i * 1.1), '#6B4A30', 0.05, 210 + i));
	// window ledge inside
	p.push(facet(at(box(WIN.w + 0.3, 0.08, 0.3), WIN.x, WIN.sill - 0.04, WIN.z + 0.1), '#E2CBA0', 0.03, 220));
	// a woven rug where he kneels, a cushion, a low table with a lamp and a scroll
	const rugC = ['#8E3B2E', '#B0703A', '#2F4F6E', '#C9A04E'];
	for (let i = 0; i < 9; i++) p.push(facet(at(box(1.5 - (i % 3 === 1 ? 0.1 : 0), 0.015, 0.2), WIN.x + 0.05, 0.008 + i * 0.0003, -1.95 + i * 0.2), rugC[i % 4], 0.05, 230 + i));
	p.push(facet(at(blob(0.24, 7, 0.15, 1, 0.45), 1.95, 0.12, -1.1), '#9A4C3A', 0.05, 240));
	p.push(facet(at(box(0.8, 0.34, 0.5, 0.03), 2.4, 0.17, -2.0), WOOD, 0.05, 241));
	p.push(facet(at(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), 2.35, 0.39, -2.02, 0, 0, Math.PI / 2), '#EADFC6', 0.04, 242));
	p.push(facet(at(new THREE.SphereGeometry(0.07, 8, 5), 2.62, 0.4, -1.95, 0, 0, 0, [1.6, 0.6, 1]), '#A6623A', 0.05, 243));
	// a shelf niche with jars and scrolls on the left wall
	p.push(facet(at(box(0.3, 0.06, 1.2), -3.0, 1.5, -1.2), WOOD, 0.04, 250));
	for (let i = 0; i < 4; i++) p.push(facet(at(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), -2.98, 1.54, -1.65 + i * 0.28, 0, Math.PI / 2, 0), '#E6D9BE', 0.04, 251 + i));
	p.push(at(jarGeo(5, 0.55, '#B8643A'), -2.6, 0, -2.0));
	p.push(at(jarGeo(6, 0.4, '#C9874A'), -2.3, 0, -2.25));
	return merge(p);
};

// outside: the street below, the city's flat roofs, palms, the ziggurat, and far hills with
// Jerusalem as a small walled city catching the light on the horizon
const exteriorGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const r = rng(23);
	p.push(facet(at(box(40, 0.2, 14), 0, STREET_Y - 0.1, -10), '#C2A27A', 0.03, 300));
	// houses across the street: one storey, roofs well below the window
	for (let i = 0; i < 7; i++) {
		const w = 2.6 + r() * 1.8;
		const h = 2.0 + r() * 0.6;
		p.push(facet(at(box(w, h, 3), -8 + i * 3.1, STREET_Y + h / 2, -12.5), r() > 0.5 ? '#D9C39A' : '#CBB088', 0.04, 310 + i));
		p.push(facet(at(box(w + 0.2, 0.18, 3.2), -8 + i * 3.1, STREET_Y + h + 0.09, -12.5), '#B89A70', 0.04, 330 + i));
	}
	// the city: rows of flat-roofed blocks falling away
	for (let i = 0; i < 160; i++) {
		const x = (r() - 0.5) * 160;
		const z = -20 - r() * 130;
		const w = 3 + r() * 6;
		const h = 2.5 + r() * 6;
		p.push(facet(at(box(w, h, 3 + r() * 5), x, STREET_Y - 1 + h / 2, z, r() * 0.3), r() > 0.5 ? '#D6BE94' : '#C8AC82', 0.05, 400 + i));
	}
	for (let i = 0; i < 18; i++) p.push(at(palmGeo(i + 3, 5 + r() * 3), (r() - 0.5) * 120, STREET_Y - 0.5, -18 - r() * 90));
	// the ziggurat, far to the right
	for (let k = 0; k < 6; k++) p.push(facet(at(box(46 - k * 7, 7, 46 - k * 7), 70, STREET_Y + 3.5 + k * 7, -190), k % 2 ? '#C9A97A' : '#BE9C6C', 0.03, 600 + k));
	// far hills and Jerusalem on one of them
	const hillsG = terrain(1800, 500, 60, 18, (x, z) => 18 + fbm2(x / 240, z / 240, 4, 3) * 26 + Math.exp(-((x - 40) ** 2 + (z + 20) ** 2) / (2 * 90 * 90)) * 50, () => '#B79C7A', 6, 0.03);
	hillsG.translate(0, STREET_Y, -650);
	p.push(hillsG);
	const jx = 40;
	const jz = -650 - 20;
	const jy = STREET_Y + 18 + 50 + 4;
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2;
		p.push(facet(at(box(9, 7, 3), jx + Math.cos(a) * 30, jy + 2, jz + Math.sin(a) * 18, -a), '#E8D3A6', 0.04, 700 + i));
	}
	p.push(facet(at(box(16, 12, 10), jx + 2, jy + 7, jz - 4), '#F0DDB0', 0.04, 730));
	p.push(facet(at(box(17, 1.4, 11), jx + 2, jy + 13.6, jz - 4), '#D8A64A', 0.04, 731));
	for (let i = 0; i < 12; i++) p.push(facet(at(box(5 + r() * 4, 4 + r() * 5, 5), jx + (r() - 0.5) * 44, jy + 3, jz + (r() - 0.5) * 24), '#E2CB9C', 0.05, 740 + i));
	return merge(p);
};

// the tree just outside the window; its crown changes with the seasons (S7)
const SEASONS = ['#F0B3C4', '#5F8C3F', '#D98A2E', '#B9B2A8'];
const treeGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	p.push(facet(at(new THREE.CylinderGeometry(0.16, 0.26, 4.5, 7), -4.4, STREET_Y + 2.25, -7.6, 0, 0, -0.08), '#6A4A32', 0.06, 1));
	p.push(facet(at(new THREE.CylinderGeometry(0.06, 0.1, 2.0, 6), -3.7, STREET_Y + 4.6, -7.5, 0, 0, -0.7), '#6A4A32', 0.06, 2));
	return merge(p);
};
const crownGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const r = rng(9);
	for (let i = 0; i < 9; i++) p.push(at(blob(0.9 + r() * 0.5, 30 + i, 0.25, 1), -3.8 + (r() - 0.5) * 2.4, STREET_Y + 4.8 + (r() - 0.5) * 1.4, -7.4 + (r() - 0.5) * 1.6));
	return merge(p);
};

export const UpperRoom: React.FC<{open?: number; season?: number; exterior?: boolean}> = ({open = 1, season = 1, exterior = true}) => {
	const shot = useShot();
	const geo = useMemo(() => ({wall: backWall(), lattice: latticeGeo(), leafL: leafGeo(-1), leafR: leafGeo(1), inside: interiorGeo(), outside: exteriorGeo(), tree: treeGeo(), crown: crownGeo()}), []);
	useLayoutEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
	const mat = lambert();
	const crownMat = useMemo(() => new THREE.MeshLambertMaterial({flatShading: true}), []);
	useLayoutEffect(() => () => crownMat.dispose(), [crownMat]);
	// season 0 spring .. 3 winter, continuous
	const sIdx = ((season % 4) + 4) % 4;
	const s0 = Math.floor(sIdx);
	const crownCol = new THREE.Color(SEASONS[s0]).lerp(new THREE.Color(SEASONS[(s0 + 1) % 4]), sIdx - s0);
	useLayoutEffect(() => {
		crownMat.color.copy(crownCol);
	});
	const bare = Math.max(0, 1 - Math.abs(sIdx - 3) * 2);
	const swing = Math.min(1, Math.max(0, open)) * 1.75;
	void shot;
	return (
		<group>
			<mesh geometry={geo.wall} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.lattice} material={mat} castShadow />
			<mesh geometry={geo.inside} material={mat} castShadow receiveShadow />
			{/* shutters hinged at the window sides, swinging into the room */}
			<group position={[WIN.x - WIN.w / 2, WIN.sill, WIN.z + 0.05]} rotation={[0, -swing, 0]}>
				<mesh geometry={geo.leafR} material={mat} castShadow />
			</group>
			<group position={[WIN.x + WIN.w / 2, WIN.sill, WIN.z + 0.05]} rotation={[0, swing, 0]}>
				<mesh geometry={geo.leafL} material={mat} castShadow />
			</group>
			{exterior ? (
				<>
					<mesh geometry={geo.outside} material={mat} receiveShadow />
					<mesh geometry={geo.tree} material={mat} castShadow />
					<mesh geometry={geo.crown} material={crownMat} castShadow scale={[1, 1 - bare * 0.65, 1]} position={[0, bare * -0.4, 0]} />
				</>
			) : null}
		</group>
	);
};
