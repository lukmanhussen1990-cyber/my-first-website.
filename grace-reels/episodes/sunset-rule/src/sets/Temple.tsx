import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, box, column, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {awningGeo, cageGeo, jarGeo, sackGeo, tableGeo, Ox, Sheep} from '../../../../src/shared/three/props';
import {rng} from '../../../../src/shared/math';

// The temple courtyard market (Court of the Gentiles), as a warm low-poly diorama.
// Layout: courtyard centre at the origin, temple front at z = -24, porticoes at x = +/-15.

const STONE = '#EBD5AC';
const STONE2 = '#DCC096';
const GOLD = '#D8A64A';

const paving = (seed = 2) => {
	const r = rng(seed);
	const tile = new THREE.BoxGeometry(1.16, 0.12, 1.16);
	const n = 46;
	const inst = new THREE.InstancedMesh(tile, new THREE.MeshLambertMaterial({flatShading: true}), n * n);
	const m = new THREE.Matrix4();
	const c = new THREE.Color();
	let i = 0;
	for (let ix = 0; ix < n; ix++) {
		for (let iz = 0; iz < n; iz++) {
			const x = (ix - n / 2) * 1.22 + (iz % 2) * 0.3;
			const z = (iz - n / 2) * 1.22 + 2;
			m.compose(new THREE.Vector3(x, -0.04 + r() * 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.04, 0)), new THREE.Vector3(1, 1, 1));
			inst.setMatrixAt(i, m);
			const l = 0.8 + r() * 0.08;
			c.setHSL(0.09 + r() * 0.02, 0.46 + r() * 0.1, l - 0.2);
			inst.setColorAt(i, c);
			i++;
		}
	}
	inst.receiveShadow = true;
	return inst;
};

const templeGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	// stepped platform
	for (let s = 0; s < 4; s++) p.push(facet(at(box(36 - s * 1.2, 0.36, 5 - s * 0.7), 0, 0.18 + s * 0.36, -21 - s * 0.6), s % 2 ? STONE : STONE2, 0.04, 10 + s));
	// main house + upper storey
	p.push(facet(at(box(22, 13, 12), 0, 1.44 + 6.5, -30.5), STONE, 0.05, 20));
	p.push(facet(at(box(15, 5, 9), 0, 1.44 + 13 + 2.5, -31), STONE2, 0.05, 21));
	// portico columns + beam
	for (let i = 0; i < 8; i++) p.push(facet(at(column(0.55, 9, 10), -9.6 + i * 2.75, 1.44, -24.2), STONE, 0.04, 30 + i));
	p.push(facet(at(box(23, 1.3, 2.4), 0, 1.44 + 9.65, -24.4), STONE2, 0.05, 40));
	// golden trim and the great doorway
	p.push(facet(at(box(23.2, 0.3, 2.6), 0, 1.44 + 10.45, -24.4), GOLD, 0.05, 41));
	p.push(facet(at(box(22.2, 0.35, 12.2), 0, 1.44 + 13.1, -30.5), GOLD, 0.05, 42));
	p.push(facet(at(box(15.2, 0.3, 9.2), 0, 1.44 + 18.1, -31), GOLD, 0.05, 43));
	p.push(facet(at(box(4.6, 8.4, 0.4), 0, 1.44 + 4.2, -24.35), '#4A3828', 0.06, 44));
	p.push(facet(at(box(5.4, 0.5, 0.6), 0, 1.44 + 8.6, -24.3), GOLD, 0.05, 45));
	// cornices, a row of small windows and the gilded spikes along the roof
	p.push(facet(at(box(22.8, 0.5, 12.6), 0, 1.44 + 12.2, -30.5), STONE2, 0.04, 46));
	for (let i = 0; i < 9; i++) p.push(facet(at(box(0.9, 1.5, 0.3), -8.8 + i * 2.2, 1.44 + 15.3, -26.45), '#5A4430', 0.06, 50 + i));
	for (let i = 0; i < 26; i++) p.push(facet(at(new THREE.ConeGeometry(0.12, 0.9, 4), -7.2 + i * 0.58, 1.44 + 18.7, -26.6), GOLD, 0.05, 60 + i));
	for (let i = 0; i < 12; i++) p.push(facet(at(box(1.0, 0.7, 0.5), -10.4 + i * 1.9, 1.44 + 13.6, -24.6), STONE, 0.05, 90 + i));
	return merge(p);
};

const porticoGeo = (side: 1 | -1) => {
	const p: THREE.BufferGeometry[] = [];
	const x = side * 15;
	for (let i = 0; i < 12; i++) p.push(facet(at(column(0.36, 5.2, 8), x, 0, -19 + i * 3.1), STONE, 0.04, 100 + i + (side > 0 ? 50 : 0)));
	p.push(facet(at(box(1.2, 0.7, 37.5), x, 5.55, -1.9), STONE2, 0.04, 120 + side));
	p.push(facet(at(box(6, 0.4, 38), x + side * 2.6, 6.0, -1.9, 0, 0, side * 0.12), '#C9A27A', 0.05, 122 + side));
	p.push(facet(at(box(0.6, 7.2, 38), x + side * 5.2, 3.6, -1.9), STONE2, 0.04, 124 + side));
	return merge(p);
};

// stalls along the porticoes: tables, striped awnings, cages, jars, sacks
const stallsGeo = (seed = 7) => {
	const r = rng(seed);
	const p: THREE.BufferGeometry[] = [];
	const awn = [
		['#B5543A', '#E8D9B8'],
		['#C89A3A', '#EFE2C2'],
		['#3F7F7A', '#E5DAC0'],
	];
	for (const side of [-1, 1] as const) {
		for (let i = 0; i < 5; i++) {
			const z = -15 + i * 5.2 + (r() - 0.5) * 0.6;
			const x = side * (10.6 + r() * 0.4);
			p.push(at(tableGeo(seed + i * 3 + (side > 0 ? 40 : 0), 2.0, 0.9, 0.82), x, 0, z, Math.PI / 2));
			const [a, b] = awn[(i + (side > 0 ? 1 : 0)) % 3];
			p.push(at(awningGeo(2.9, 2.3, a, b, seed + i), x + side * 0.4, 2.45, z, Math.PI / 2, 0, -side * 0.22));
			for (const dz of [-1.25, 1.25]) p.push(facet(at(box(0.07, 2.5, 0.07), x - side * 0.65, 1.2, z + dz), '#6E4426', 0.05, seed + i * 9));
			if (i % 2 === 0) {
				p.push(at(cageGeo(seed + i), x + side * 1.3, 0, z - 0.6, 0.2));
				p.push(at(cageGeo(seed + i + 1), x + side * 1.3, 0.47, z - 0.6, -0.1));
				p.push(at(cageGeo(seed + i + 2), x + side * 1.3, 0, z + 0.1, 0.4));
			} else {
				p.push(at(jarGeo(seed + i, 0.8), x + side * 1.2, 0, z - 0.7));
				p.push(at(jarGeo(seed + i + 1, 0.6, '#A65A36'), x + side * 1.5, 0, z + 0.1));
				p.push(at(sackGeo(seed + i), x + side * 1.1, 0, z + 0.9));
			}
		}
	}
	return merge(p);
};

const midStallsGeo = (seed = 31) => {
	const p: THREE.BufferGeometry[] = [];
	const spots: [number, number, number, string, string][] = [
		[-4.2, -7.5, 0.25, '#B5543A', '#EAD9B6'],
		[4.6, -8.2, -0.3, '#3F7F7A', '#E6DAC0'],
		[-0.6, -11, 0.05, '#C89A3A', '#EFE2C2'],
	];
	spots.forEach(([x, z, ry, a, b], i) => {
		p.push(at(tableGeo(seed + i, 2.0, 0.9, 0.82), x, 0, z, ry));
		p.push(at(awningGeo(3.0, 2.2, a, b, seed + i), x, 2.4, z - 0.3, ry, -0.2));
		for (const dx of [-1.3, 1.3]) p.push(facet(at(box(0.07, 2.45, 0.07), x + dx, 1.2, z - 1.1), '#6E4426', 0.05, seed + i * 5));
		p.push(at(cageGeo(seed + i), x + 1.6, 0, z + 0.3, 0.3));
		p.push(at(cageGeo(seed + i + 4), x + 1.6, 0.47, z + 0.3, -0.2));
		p.push(at(jarGeo(seed + i, 0.75), x - 1.6, 0, z + 0.2));
	});
	return merge(p);
};

const penGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	for (let i = 0; i < 9; i++) p.push(facet(at(box(0.1, 0.9, 0.1), -7 - (i % 3) * 0, 0.45, -6 + i * 0.7), '#7A5232', 0.06, 200 + i));
	p.push(facet(at(box(0.08, 0.08, 5.8), -7, 0.75, -3.2), '#8A6040', 0.05, 220));
	p.push(facet(at(box(0.08, 0.08, 5.8), -7, 0.35, -3.2), '#8A6040', 0.05, 221));
	return merge(p);
};

export const TempleCourt: React.FC<{stalls?: boolean; animals?: 'calm' | 'none'; templeZ?: number; templeX?: number}> = ({stalls = true, animals = 'calm', templeZ = -12, templeX = 0}) => {
	const tiles = useMemo(() => paving(), []);
	const geo = useMemo(() => ({temple: templeGeo(), left: porticoGeo(-1), right: porticoGeo(1), stalls: stallsGeo(), mid: midStallsGeo(), pen: penGeo()}), []);
	useLayoutEffect(() => () => {
		tiles.geometry.dispose();
		Object.values(geo).forEach((g) => g.dispose());
	}, [tiles, geo]);
	const mat = lambert();
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
				<planeGeometry args={[400, 400]} />
				<meshLambertMaterial color="#C9A577" />
			</mesh>
			<primitive object={tiles} />
			<mesh geometry={geo.temple} material={mat} castShadow receiveShadow position={[templeX, 0, templeZ]} />
			<mesh geometry={geo.left} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.right} material={mat} castShadow receiveShadow />
			{stalls ? <mesh geometry={geo.stalls} material={mat} castShadow receiveShadow /> : null}
			{stalls ? <mesh geometry={geo.mid} material={mat} castShadow receiveShadow /> : null}
			<mesh geometry={geo.pen} material={mat} castShadow receiveShadow />
			{animals === 'calm' ? (
				<>
					{[
						[-8.2, -5.2, 0.4],
						[-8.8, -4.0, 2.2],
						[-8.0, -2.6, 1.1],
						[-9.1, -1.6, -0.4],
						[-8.4, -0.4, 2.8],
					].map(([x, z, ry], i) => (
						<Sheep key={i} seed={i + 1} position={[x, 0, z]} rotation={[0, ry, 0]} />
					))}
					<Ox seed={3} position={[8.6, 0, -3.5]} rotation={[0, 2.6, 0]} />
					<Ox seed={4} position={[9.4, 0, -0.8]} rotation={[0, 3.4, 0]} />
				</>
			) : null}
		</group>
	);
};
