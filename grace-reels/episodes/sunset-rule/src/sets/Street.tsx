import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, box, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {jarGeo, oliveGeo, palmGeo} from '../../../../src/shared/three/props';
import {rng} from '../../../../src/shared/math';

// A stone street between flat-roofed houses (S9). It runs along Z; the low golden sun sits
// at the far end (azimuth ~200), so long shadows fall toward the camera.

const houseRow = (side: 1 | -1, seed: number) => {
	const r = rng(seed);
	const p: THREE.BufferGeometry[] = [];
	let z = 6;
	while (z > -40) {
		const d = 3 + r() * 3;
		const h = 3.4 + r() * 3.6;
		const w = 4 + r() * 2;
		const x = side * (4.2 + w / 2);
		const col = ['#E2C99A', '#D8B886', '#E8D2A6', '#CFAE7C'][Math.floor(r() * 4)];
		p.push(facet(at(box(w, h, d), x, h / 2, z - d / 2), col, 0.05, seed + p.length));
		// roof lip, door, window, protruding beams
		p.push(facet(at(box(w + 0.2, 0.25, d + 0.2), x, h + 0.12, z - d / 2), '#C7A676', 0.04, seed + p.length));
		p.push(facet(at(box(0.08, 1.9, 1.1), x - side * (w / 2 + 0.02), 0.95, z - d / 2), '#5C4330', 0.05, seed + p.length));
		if (r() > 0.4) p.push(facet(at(box(0.08, 0.6, 0.6), x - side * (w / 2 + 0.02), h * 0.68, z - d * 0.25), '#4E3A2A', 0.05, seed + p.length));
		for (let b = 0; b < 3; b++) p.push(facet(at(box(0.5, 0.14, 0.14), x - side * (w / 2 + 0.2), h - 0.35, z - 0.5 - b * (d / 3)), '#7A5434', 0.05, seed + p.length));
		if (r() > 0.6) p.push(at(jarGeo(seed + p.length, 0.7), x - side * (w / 2 + 0.5), 0, z - d * 0.7));
		z -= d + 0.05;
	}
	return merge(p);
};

const paving = () => {
	const r = rng(77);
	const p: THREE.BufferGeometry[] = [];
	for (let iz = 0; iz < 46; iz++) {
		for (let ix = 0; ix < 8; ix++) {
			const c = new THREE.Color().setHSL(0.085 + r() * 0.02, 0.36 + r() * 0.08, 0.6 + r() * 0.07);
			p.push(facet(at(box(1.02, 0.12, 0.98), -3.6 + ix * 1.04 + (iz % 2) * 0.5, -0.05, 6 - iz * 1.0), '#' + c.getHexString(), 0.02, ix * 50 + iz));
		}
	}
	return merge(p);
};

export const Street: React.FC = () => {
	const geo = useMemo(
		() => ({
			left: houseRow(-1, 11),
			right: houseRow(1, 29),
			floor: paving(),
			trees: merge([at(oliveGeo(3, 1.2), -3.6, 0, -6), at(palmGeo(4, 5.5), 3.9, 0, -14), at(oliveGeo(8, 1.0), 3.4, 0, 2.6), at(palmGeo(9, 6), -3.8, 0, -24)]),
		}),
		[],
	);
	useLayoutEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
	const mat = lambert();
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, -20]} receiveShadow>
				<planeGeometry args={[80, 120]} />
				<meshLambertMaterial color="#C4A274" />
			</mesh>
			<mesh geometry={geo.floor} material={mat} receiveShadow />
			<mesh geometry={geo.left} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.right} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.trees} material={mat} castShadow receiveShadow />
		</group>
	);
};
