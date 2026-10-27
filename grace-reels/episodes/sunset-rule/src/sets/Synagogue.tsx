import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, box, column, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {Glow, LightShaft} from '../../../../src/shared/three/fx';
import {jarGeo} from '../../../../src/shared/three/props';
import {rng} from '../../../../src/shared/math';
import {useShot, type Vec3} from '../../../../src/shared/three/shot';

// A small ancient stone synagogue, cut away at the front like a diorama. The roof only
// casts shadow (invisible to the camera), so sunlight reaches the floor only through the
// high windows in the back wall -> real light patches + beams.

const SAND = '#D8BC8E';
const SAND2 = '#C9A97A';
export const WINDOWS_X = [-4.8, -1.6, 1.6, 4.8];
const WIN_Y0 = 4.15;
const WIN_Y1 = 5.35;
const BACK_Z = -5;

const blockWall = (x0: number, x1: number, y1: number, z: number, seed: number, holes: (x: number, y: number) => boolean, depth = 0.7, alongZ = false) => {
	const r = rng(seed);
	const parts: THREE.BufferGeometry[] = [];
	const bh = 0.46;
	for (let row = 0; row * bh < y1; row++) {
		const y = row * bh + bh / 2;
		let x = x0 - (row % 2) * 0.45;
		while (x < x1) {
			const w = 0.75 + r() * 0.5;
			const cx = Math.min(x + w / 2, x1 - 0.05);
			const ww = Math.min(w, x1 - x) - 0.04;
			if (ww > 0.15 && !holes(cx, y)) {
				const g = box(ww, bh - 0.04, depth + (r() - 0.5) * 0.06);
				parts.push(facet(alongZ ? at(g, z, y, cx, Math.PI / 2) : at(g, cx, y, z), r() > 0.5 ? SAND : SAND2, 0.05, seed + parts.length));
			}
			x += w;
		}
	}
	return merge(parts);
};

const synagogueGeo = () => {
	const parts: THREE.BufferGeometry[] = [];
	const inWindow = (x: number, y: number) => y > WIN_Y0 && y < WIN_Y1 && WINDOWS_X.some((wx) => Math.abs(x - wx) < 0.55);
	parts.push(blockWall(-7.5, 7.5, 6.4, BACK_Z, 3, inWindow));
	parts.push(blockWall(-5, 6, 6.4, -7.6, 9, () => false, 0.7, true));
	parts.push(blockWall(-5, 2.2, 1.4, 7.6, 13, () => false, 0.7, true));
	// two tiers of stone benches along the back and left walls
	for (let tier = 0; tier < 2; tier++) {
		parts.push(facet(at(box(14.4, 0.46, 0.62), 0, 0.23 + tier * 0.46, BACK_Z + 0.75 - tier * 0.42), tier ? SAND2 : '#E2C99D', 0.04, 40 + tier));
		parts.push(facet(at(box(0.62, 0.46, 9.4), -7.1 + 0.75 - tier * 0.42 + 0.45, 0.23 + tier * 0.46, -0.4), tier ? SAND2 : '#E2C99D', 0.04, 44 + tier));
	}
	// columns + architraves
	for (const x of [-3.4, 3.4]) {
		for (let i = 0; i < 3; i++) parts.push(facet(at(column(0.3, 5.4, 10), x, 0, -2.6 + i * 2.9), '#E6D2AC', 0.04, 60 + i + (x > 0 ? 10 : 0)));
		parts.push(facet(at(box(0.7, 0.55, 9.2), x, 5.82, 0.3), SAND2, 0.04, 80 + (x > 0 ? 1 : 0)));
	}
	// window ledges + a reading table at the far end
	for (const wx of WINDOWS_X) parts.push(facet(at(box(1.3, 0.12, 0.9), wx, WIN_Y0 - 0.06, BACK_Z + 0.2), '#E8D4AE', 0.03, 90));
	parts.push(facet(at(box(1.4, 0.95, 0.8, 0.03), 4.6, 0.475, -3.2), '#8E6340', 0.06, 95));
	parts.push(facet(at(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), 4.6, 1.02, -3.2, 0, 0, Math.PI / 2), '#E9DFC6', 0.04, 96));
	parts.push(at(jarGeo(4, 0.6, '#A85E38'), -6.2, 0.92, -3.6));
	parts.push(at(jarGeo(5, 0.45, '#B86A40'), 6.4, 0, 3.0));
	return merge(parts);
};

const floorGeo = () => {
	const r = rng(21);
	const parts: THREE.BufferGeometry[] = [];
	for (let ix = 0; ix < 15; ix++) {
		for (let iz = 0; iz < 12; iz++) {
			const c = new THREE.Color().setHSL(0.09 + r() * 0.015, 0.36 + r() * 0.08, 0.62 + r() * 0.06);
			parts.push(facet(at(box(0.98, 0.1, 0.98), -7 + ix + (iz % 2) * 0.2, -0.05, -4.6 + iz), '#' + c.getHexString(), 0.02, ix * 20 + iz));
		}
	}
	return merge(parts);
};

export const sunPatch = (wx: number, sunDir: THREE.Vector3): Vec3 => {
	// where the light through a window lands on the floor
	const y = (WIN_Y0 + WIN_Y1) / 2;
	const k = y / Math.max(sunDir.y, 0.05);
	return [wx - sunDir.x * k, 0.02, BACK_Z - sunDir.z * k];
};

export const Synagogue: React.FC<{beams?: number; lamps?: boolean}> = ({beams = 1, lamps = true}) => {
	const shot = useShot();
	const geo = useMemo(() => ({walls: synagogueGeo(), floor: floorGeo()}), []);
	const roofMat = useMemo(() => new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false}), []);
	useLayoutEffect(() => () => {
		geo.walls.dispose();
		geo.floor.dispose();
		roofMat.dispose();
	}, [geo, roofMat]);
	const mat = lambert();
	const sd = shot.sunDir;
	return (
		<group>
			<mesh geometry={geo.floor} material={mat} receiveShadow />
			<mesh geometry={geo.walls} material={mat} castShadow receiveShadow />
			{/* shadow-only roof and front wall */}
			<mesh material={roofMat} position={[0, 6.6, 1.2]} castShadow>
				<boxGeometry args={[16, 0.4, 13]} />
			</mesh>
			<mesh material={roofMat} position={[0, 3.2, 7.4]} castShadow>
				<boxGeometry args={[16, 6.6, 0.4]} />
			</mesh>
			{WINDOWS_X.map((wx) => {
				const p = sunPatch(wx, sd);
				return (
					<group key={wx}>
						<LightShaft from={[wx, (WIN_Y0 + WIN_Y1) / 2, BACK_Z + 0.3]} to={p} r0={0.42} r1={0.85} opacity={0.2 * beams} />
						<Glow at={[wx, (WIN_Y0 + WIN_Y1) / 2, BACK_Z + 0.1]} size={1.6} color={shot.sun.sunColor} opacity={0.55 * beams} />
					</group>
				);
			})}
			{lamps
				? ([[-6.2, 1.55, -3.6], [6.6, 0.7, 3.0], [-6.6, 1.0, 2.4]] as Vec3[]).map((p, i) => (
						<Glow key={i} at={p} size={0.5} color="#FFB45A" opacity={0.8} />
					))
				: null}
		</group>
	);
};
