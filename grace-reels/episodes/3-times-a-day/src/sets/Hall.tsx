import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, box, column, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {Glow, LightShaft} from '../../../../src/shared/three/fx';
import {rng} from '../../../../src/shared/math';
import {useShot, type Vec3} from '../../../../src/shared/three/shot';

// King Darius's throne hall in Babylon: glazed blue brick with gold lion friezes, two rows of
// tall columns, light from high windows in the left wall, and steps up to the throne.
// The aisle runs along -Z; the throne platform is at z < -21, y = PLATFORM.

export const PLATFORM = 1.12;
export const THRONE: Vec3 = [0, PLATFORM, -22.6];
export const STEP_Z = -21.2; // front edge of the top step, where the three leaders stand
export const COL_X = 4.6;
export const COL_Z = [6, 2, -2, -6, -10, -14];
export const HIGH_WIN_Z = [4, 0, -4, -8, -12, -16];
const BLUE = '#2C5896';
const BLUE2 = '#244C86';
const GOLD = '#D8A64A';
const STONE = '#E6D6B2';

const lionTexture = () => {
	const c = document.createElement('canvas');
	c.width = 512;
	c.height = 128;
	const g = c.getContext('2d')!;
	g.fillStyle = '#2A5592';
	g.fillRect(0, 0, 512, 128);
	// glazed brick courses
	g.strokeStyle = 'rgba(10,20,50,0.35)';
	g.lineWidth = 2;
	for (let y = 0; y < 128; y += 16) {
		g.beginPath();
		g.moveTo(0, y);
		g.lineTo(512, y);
		g.stroke();
		for (let x = (y / 16) % 2 ? 0 : 16; x < 512; x += 32) {
			g.beginPath();
			g.moveTo(x, y);
			g.lineTo(x, y + 16);
			g.stroke();
		}
	}
	// border bands with rosettes
	g.fillStyle = '#E8C46A';
	g.fillRect(0, 4, 512, 8);
	g.fillRect(0, 116, 512, 8);
	// one walking lion (Ishtar-gate style), flat gold with an orange mane, facing right
	const lion = (x: number) => {
		const gold = '#E9C25C';
		const mane = '#C8792E';
		g.fillStyle = gold;
		// legs in mid-stride
		for (const [lx, ang] of [[70, 0.25], [96, -0.2], [168, 0.22], [192, -0.25]] as [number, number][]) {
			g.save();
			g.translate(x + lx, 74);
			g.rotate(ang);
			g.fillRect(-7, 0, 14, 38);
			g.restore();
		}
		// body
		g.beginPath();
		g.ellipse(x + 132, 70, 74, 21, 0, 0, Math.PI * 2);
		g.fill();
		// tail up with a tuft
		g.strokeStyle = gold;
		g.lineWidth = 7;
		g.beginPath();
		g.moveTo(x + 62, 64);
		g.quadraticCurveTo(x + 30, 60, x + 34, 30);
		g.stroke();
		g.fillStyle = mane;
		g.beginPath();
		g.ellipse(x + 34, 28, 9, 11, 0, 0, Math.PI * 2);
		g.fill();
		// big mane ring around the head
		g.beginPath();
		for (let i = 0; i < 18; i++) {
			const a = (i / 18) * Math.PI * 2;
			const rr = i % 2 ? 30 : 40;
			g.lineTo(x + 196 + Math.cos(a) * rr, 60 + Math.sin(a) * rr * 0.95);
		}
		g.closePath();
		g.fill();
		// head with a muzzle, ear, eye and open mouth
		g.fillStyle = gold;
		g.beginPath();
		g.ellipse(x + 204, 60, 20, 18, 0, 0, Math.PI * 2);
		g.fill();
		g.beginPath();
		g.ellipse(x + 224, 66, 14, 10, 0.2, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#7A3A1A';
		g.fillRect(x + 222, 72, 14, 4);
		g.beginPath();
		g.arc(x + 208, 54, 3, 0, Math.PI * 2);
		g.fill();
	};
	lion(10);
	lion(266);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.wrapS = THREE.RepeatWrapping;
	t.anisotropy = 4;
	return t;
};

const hallGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	const r = rng(13);
	// floor: checker of cream stone and blue-grey slate
	for (let ix = -6; ix < 6; ix++) {
		for (let iz = -27; iz < 8; iz++) {
			const dark = (ix + iz) % 2 === 0;
			p.push(facet(at(box(1.18, 0.1, 1.18), ix * 1.2 + 0.6, -0.05, iz * 1.2 + 0.6), dark ? '#7A879A' : STONE, 0.025, 1000 + p.length));
		}
	}
	// side walls of glazed blue brick, with high window gaps in the left wall
	for (const side of [-1, 1]) {
		const x = side * 8;
		for (let iz = -27; iz < 9; iz += 2) {
			const z = iz + 1;
			const isWin = side < 0 && HIGH_WIN_Z.some((wz) => Math.abs(z - wz) < 0.9);
			p.push(facet(at(box(0.5, isWin ? 7.0 : 10.4, 2), x, isWin ? 3.5 : 5.2, z), r() > 0.5 ? BLUE : BLUE2, 0.03, 2000 + p.length));
			if (isWin) p.push(facet(at(box(0.5, 1.6, 2), x, 9.6, z), BLUE2, 0.03, 2100 + p.length));
		}
		// a gold cornice
		p.push(facet(at(box(0.7, 0.3, 36), x - side * 0.1, 6.6, -9.5), GOLD, 0.04, 2200 + side));
	}
	// back wall behind the throne, with a great gold disc
	p.push(facet(at(box(16.5, 10.4, 0.5), 0, 5.2, -27.2), BLUE, 0.03, 2300));
	p.push(facet(at(new THREE.CylinderGeometry(1.1, 1.1, 0.14, 24), 0, 5.9, -26.9, Math.PI / 2, Math.PI / 2, 0), '#B88A3C', 0.04, 2301));
	p.push(facet(at(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 24), 0, 5.9, -26.85, Math.PI / 2, Math.PI / 2, 0), '#C99A44', 0.04, 2302));
	// the steps and the platform
	for (let s = 0; s < 4; s++) p.push(facet(at(box(10 - s * 0.6, 0.28, 1.0), 0, 0.14 + s * 0.28, -17.7 - s * 1.0), s % 2 ? STONE : '#DCCAA2', 0.03, 2400 + s));
	p.push(facet(at(box(10, PLATFORM, 6), 0, PLATFORM / 2, -24.2), STONE, 0.03, 2410));
	p.push(facet(at(box(10.2, 0.08, 0.3), 0, PLATFORM + 0.04, STEP_Z + 0.1), GOLD, 0.04, 2411));
	// the throne: gold seat, high back, arms, footstool
	const [tx, ty, tz] = THRONE;
	p.push(facet(at(box(1.2, 0.46, 0.9), tx, ty + 0.23, tz), GOLD, 0.04, 2500));
	p.push(facet(at(box(1.3, 2.3, 0.22), tx, ty + 1.15, tz - 0.5), '#C8953E', 0.04, 2501));
	p.push(facet(at(box(1.0, 0.5, 0.06), tx, ty + 2.05, tz - 0.38), '#7A2E3A', 0.04, 2502));
	for (const sx of [-1, 1]) p.push(facet(at(box(0.16, 0.36, 0.86), tx + sx * 0.62, ty + 0.62, tz), GOLD, 0.04, 2503));
	p.push(facet(at(box(0.9, 0.16, 0.5), tx + 0.1, ty + 0.08, tz + 0.65), '#C8953E', 0.04, 2504));
	// columns with stepped bases and wide capitals
	for (const side of [-1, 1]) {
		for (const z of COL_Z) {
			const x = side * COL_X;
			p.push(facet(at(box(1.3, 0.5, 1.3), x, 0.25, z), STONE, 0.03, 2600 + p.length));
			p.push(facet(at(column(0.42, 8.0, 12), x, 0.5, z), '#E9DCBF', 0.03, 2700 + p.length));
			p.push(facet(at(box(1.5, 0.6, 1.0), x, 8.8, z), GOLD, 0.04, 2800 + p.length));
			p.push(facet(at(box(2.1, 0.4, 0.8), x, 9.3, z), '#C8953E', 0.04, 2900 + p.length));
		}
	}
	// braziers at the foot of the steps
	for (const sx of [-1, 1]) {
		p.push(facet(at(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 6), sx * 3.8, 0.55, -16.4), '#3A2A20', 0.04, 3000));
		p.push(facet(at(new THREE.CylinderGeometry(0.42, 0.2, 0.3, 10), sx * 3.8, 1.2, -16.4), GOLD, 0.04, 3001));
	}
	return merge(p);
};

// banners hanging between the columns
const bannerGeo = () => {
	const p: THREE.BufferGeometry[] = [];
	for (const side of [-1, 1]) {
		for (const z of [0, -8, -16]) {
			p.push(facet(at(box(0.9, 3.4, 0.04), side * (COL_X + 0.0), 6.2, z - 2), '#9A2E36', 0.04, 4000 + p.length));
			p.push(facet(at(box(0.92, 0.28, 0.05), side * COL_X, 4.6, z - 2), GOLD, 0.04, 4100 + p.length));
		}
	}
	return merge(p);
};

export const Hall: React.FC<{fire?: number}> = ({fire = 1}) => {
	const shot = useShot();
	const geo = useMemo(() => ({hall: hallGeo(), banners: bannerGeo()}), []);
	const frieze = useMemo(() => {
		const t = lionTexture();
		t.repeat.set(9, 1);
		return new THREE.MeshLambertMaterial({map: t});
	}, []);
	const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false}), []);
	useLayoutEffect(() => () => {
		Object.values(geo).forEach((g) => g.dispose());
		frieze.map?.dispose();
		frieze.dispose();
		shadowMat.dispose();
	}, [geo, frieze, shadowMat]);
	const mat = lambert();
	const sd = shot.sunDir;
	const flick = (s: number) => 0.85 + 0.15 * Math.sin(shot.t * 13 + s) * Math.sin(shot.t * 7.3 + s * 2);
	return (
		<group>
			<mesh geometry={geo.hall} material={mat} castShadow receiveShadow />
			<mesh geometry={geo.banners} material={mat} castShadow />
			{/* lion friezes along both walls */}
			{[-1, 1].map((side) => (
				<mesh key={side} material={frieze} position={[side * 7.72, 2.9, -9.5]} rotation={[0, (side * -Math.PI) / 2, 0]} receiveShadow>
					<planeGeometry args={[36, 1.6]} />
				</mesh>
			))}
			<mesh material={frieze} position={[0, 2.9, -26.92]} receiveShadow>
				<planeGeometry args={[16, 1.6]} />
			</mesh>
			{/* shadow-only roof and front wall: sun enters through the high windows only */}
			<mesh material={shadowMat} position={[0, 10.6, -9.5]} castShadow>
				<boxGeometry args={[17, 0.4, 38]} />
			</mesh>
			<mesh material={shadowMat} position={[0, 5.2, 9.2]} castShadow>
				<boxGeometry args={[17, 10.4, 0.4]} />
			</mesh>
			{HIGH_WIN_Z.map((wz) => {
				const y = 8.2;
				const k = y / Math.max(sd.y, 0.05);
				const to: Vec3 = [-8 - sd.x * k, 0.02, wz - sd.z * k];
				return <LightShaft key={wz} from={[-8, y, wz]} to={to} r0={0.6} r1={1.2} opacity={0.07} color="#FFE2B0" />;
			})}
			{[-1, 1].map((sx) => (
				<group key={sx}>
					<Glow at={[sx * 3.8, 1.55, -16.4]} size={1.1 * flick(sx)} color="#FFB04A" opacity={0.9 * fire} />
					<pointLight position={[sx * 3.8, 1.8, -16.4]} color="#FFB04A" intensity={6 * fire * flick(sx)} distance={7} decay={1.6} />
				</group>
			))}
		</group>
	);
};
