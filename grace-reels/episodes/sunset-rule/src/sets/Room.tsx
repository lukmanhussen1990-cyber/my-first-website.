import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, blob, box, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {rng} from '../../../../src/shared/math';

// A modern room at dusk (S14), same flat low-poly style. A big window in the back wall
// (z = -2.5) looks west over a city skyline; the sun sets right behind it.

export const WINDOW = {x0: -1.9, x1: 1.1, y0: 0.85, y1: 2.65, z: -2.5};

const roomGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const wall = '#C9B49A';
	const {x0, x1, y0, y1, z} = WINDOW;
	// back wall with a window hole
	p.push(facet(at(box(x0 + 4, 3.2, 0.2), (x0 - 4) / 2, 1.6, z), wall, 0.03, 1));
	p.push(facet(at(box(5 - x1, 3.2, 0.2), (x1 + 5) / 2, 1.6, z), wall, 0.03, 2));
	p.push(facet(at(box(x1 - x0, y0, 0.2), (x0 + x1) / 2, y0 / 2, z), wall, 0.03, 3));
	p.push(facet(at(box(x1 - x0, 3.2 - y1, 0.2), (x0 + x1) / 2, (3.2 + y1) / 2, z), wall, 0.03, 4));
	// window frame + cross bars
	const fr = '#5B4636';
	p.push(facet(at(box(x1 - x0 + 0.16, 0.1, 0.3), (x0 + x1) / 2, y0, z + 0.05), fr, 0.04, 5));
	p.push(facet(at(box(x1 - x0 + 0.16, 0.1, 0.24), (x0 + x1) / 2, y1, z), fr, 0.04, 6));
	p.push(facet(at(box(0.1, y1 - y0, 0.24), x0, (y0 + y1) / 2, z), fr, 0.04, 7));
	p.push(facet(at(box(0.1, y1 - y0, 0.24), x1, (y0 + y1) / 2, z), fr, 0.04, 8));
	p.push(facet(at(box(0.06, y1 - y0, 0.16), (x0 + x1) / 2, (y0 + y1) / 2, z), fr, 0.04, 9));
	// side wall, floor boards
	p.push(facet(at(box(0.2, 3.2, 7), -4, 1.6, 1.0), '#BFA88E', 0.03, 10));
	const r = rng(5);
	for (let i = 0; i < 14; i++) p.push(facet(at(box(0.6, 0.06, 7), -3.7 + i * 0.62, -0.03, 1.0), r() > 0.5 ? '#8E6A4A' : '#9A7452', 0.03, 20 + i));
	// bed, blanket, pillow
	p.push(facet(at(box(1.7, 0.42, 2.3, 0.04), 2.6, 0.21, -1.2), '#6E5A4A', 0.04, 40));
	p.push(facet(at(box(1.74, 0.16, 2.0, 0.06), 2.6, 0.5, -1.05), '#4F6E86', 0.05, 41));
	p.push(facet(at(box(1.2, 0.16, 0.45, 0.06), 2.6, 0.55, -2.15), '#E8E0D2', 0.04, 42));
	// side table + lamp, plant, rug, stool
	p.push(facet(at(box(0.55, 0.55, 0.45), 1.45, 0.275, -2.1), '#7A5A40', 0.05, 50));
	p.push(facet(at(new THREE.CylinderGeometry(0.06, 0.1, 0.32, 8), 1.45, 0.71, -2.1), '#3A3230', 0.04, 51));
	p.push(facet(at(new THREE.ConeGeometry(0.2, 0.22, 8, 1, true), 1.45, 0.96, -2.1), '#EADFC8', 0.04, 52));
	p.push(facet(at(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 8), -3.3, 0.18, -2.0), '#B86A40', 0.05, 53));
	for (let i = 0; i < 6; i++) p.push(facet(at(blob(0.22, 60 + i, 0.25, 0), -3.3 + Math.cos(i) * 0.18, 0.55 + (i % 3) * 0.18, -2.0 + Math.sin(i) * 0.18), '#5E7A4A', 0.06, 60 + i));
	p.push(facet(at(box(2.6, 0.02, 1.8), -0.4, 0.01, -0.6), '#B9876A', 0.04, 70));
	p.push(facet(at(new THREE.CylinderGeometry(0.22, 0.2, 0.46, 10), -0.7, 0.23, -1.05), '#7E5E44', 0.04, 71));
	// a picture frame on the side wall (no text)
	p.push(facet(at(box(0.05, 0.7, 0.9), -3.88, 1.8, -0.6), '#5B4636', 0.03, 80));
	p.push(facet(at(box(0.04, 0.56, 0.76), -3.86, 1.8, -0.6), '#D59E38', 0.06, 81));
	return merge(p);
};

const skylineGeo = () => {
	const r = rng(8);
	const p: THREE.BufferGeometry[] = [];
	for (let i = 0; i < 46; i++) {
		const x = -70 + i * 3.2 + r() * 1.5;
		const h = 3 + r() * 14;
		p.push(facet(at(box(2.4 + r() * 2, h, 3), x, h / 2 - 4, -70 - r() * 20), '#3A3550', 0.06, i));
	}
	return merge(p);
};

export const Room: React.FC = () => {
	const geo = useMemo(() => ({room: roomGeo(), sky: skylineGeo()}), []);
	useLayoutEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
	const mat = lambert();
	return (
		<group>
			<mesh geometry={geo.room} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.sky} material={mat} />
		</group>
	);
};
