import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Dust, Glow} from '../../../../src/shared/three/fx';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {at, blob, box, facet, lambert, merge} from '../../../../src/shared/three/lowpoly';
import {clamp, ease, lerp, rng, smoothstep} from '../../../../src/shared/math';
import {useShot, type Cam, type Vec3} from '../../../../src/shared/three/shot';
import {Hall, PLATFORM, STEP_Z, THRONE} from '../sets/Hall';
import {DANIEL_OLD, DARIUS, LEADERS, OFFICIALS, PRINCES, P} from '../cast';
import {den, hall, intrigue} from '../moods';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {tOf} from '../timeline';

// ---------- S4: the empire. A crane up the hall to Daniel among the three leaders ----------
export const DANIEL_AT: Vec3 = [-1.45, PLATFORM, STEP_Z];
const r = rng(31);
// princes line both sides of the aisle, facing it
const COURT = Array.from({length: 20}, (_, i) => {
	const side = i % 2 ? 1 : -1;
	const row = Math.floor(i / 2) % 2;
	const k = Math.floor(i / 4);
	return {look: PRINCES[(i * 7) % PRINCES.length], at: [side * (1.9 + row * 0.95 + r() * 0.2), 0, -3 - k * 2.6 - row * 1.1 - r() * 0.4] as Vec3, facing: (side < 0 ? 1 : -1) as 1 | -1, ph: r() * 6};
});

const Court: React.FC<{t: number}> = ({t}) => (
	<>
		{COURT.map((c, i) => (
			<Figure key={i} look={c.look} pose={{...P.courtStand, breath: Math.sin(t * 1.4 + c.ph) * 0.5 + 0.5, headTilt: Math.sin(t * 0.6 + c.ph) * 0.04}} at={c.at} facing={c.facing} res={i < 8 ? 560 : 420} />
		))}
		<Figure look={DARIUS} pose={{...P.throne, breath: Math.sin(t * 1.2) * 0.5 + 0.5}} at={[THRONE[0] - 0.05, THRONE[1], THRONE[2] + 0.1]} res={900} />
		<Figure look={DANIEL_OLD} pose={{...P.courtStand, breath: Math.sin(t * 1.5) * 0.5 + 0.5, gaze: [0.2, 0.1]}} at={DANIEL_AT} facing={1} res={900} />
		<Figure look={LEADERS[0]} pose={{...P.courtStand, eyes: 'narrow'}} at={[DANIEL_AT[0] - 1.05, PLATFORM, STEP_Z + 0.25]} facing={1} res={760} />
		<Figure look={LEADERS[1]} pose={{...P.courtStand, eyes: 'narrow'}} at={[1.6, PLATFORM, STEP_Z + 0.2]} facing={-1} res={760} />
	</>
);

const S4Content: React.FC<{t: number; d: number}> = ({t}) => (
	<>
		<SunLight target={[0, 0, -9]} extent={20} dist={60} mapSize={2048} fill={0.9} />
		<Atmosphere near={14} far={120} />
		<Hall />
		<Court t={t} />
		<Dust box={[[-7, 0.5, -24], [7, 8, 6]]} count={260} size={0.05} opacity={0.45} color="#FFE2B0" speed={0.25} />
	</>
);

const camS4 = (t: number, d: number): Cam => {
	const k = ease.inOut(clamp(t / d));
	return {
		pos: [lerp(0.35, -0.35, k), lerp(0.75, 5.6, Math.pow(k, 0.9)), lerp(7.6, -7.2, k)],
		target: [lerp(0, -0.7, k), lerp(2.7, 1.7, k), lerp(-20, -21.2, k)],
		fov: lerp(44, 34, k),
	};
};

export const S04: SceneDef = {
	id: 'S4',
	sunAz: 262,
	mood: () => hall(),
	camera: camS4,
	post: (t, d, sun) => ({
		bloom: {intensity: 0.6, threshold: 0.84},
		dof: {focusDistance: lerp(14, 14.5, clamp(t / d)), focusRange: 9, bokehScale: 2.2},
		vignette: {offset: 0.28, darkness: 0.55},
		grade: gradeFromSun(sun, {contrast: 1.06, saturation: 1.08}),
	}),
	Content: S4Content,
	anchors: () => ({daniel: [DANIEL_AT[0] + 0.05, PLATFORM + 1.78, DANIEL_AT[2]]}),
};

// ---------- S5: the law ----------
// three quick cuts: whispers in a dark corner, the decree sealed, a glimpse of the den
export const cutsS5 = () => ({seal: tOf('S5', 'signed') + 0.32, den: tOf('S5', 'and', 1) - 0.12});
const SEAL_T = 0.55; // the press lands this long into the seal shot

// the corner: three officials leaning together by a lamp
const Whisper: React.FC<{t: number}> = ({t}) => {
	const lean = 0.12 + 0.05 * Math.sin(t * 2.2);
	return (
		<>
			<SunLight target={[-6, 0, -2]} extent={8} dist={40} fill={0.7} />
			<Atmosphere near={4} far={30} />
			<Hall fire={0.4} />
			<Figure look={OFFICIALS[0]} pose={{...P.whisper, lean, near: {sh: 0.95, el: 1.75, hand: 'flat', fore: 0.8}}} at={[-6.35, 0, -2.2]} facing={1} res={1100} />
			<Figure look={OFFICIALS[1]} pose={{...P.courtStand, eyes: 'narrow', brow: {inner: 7, outer: -2}, lean: -0.04, gaze: [-0.6, 0], headTilt: 0.06}} at={[-5.45, 0, -2.25]} facing={-1} res={1100} />
			<Figure look={OFFICIALS[2]} pose={{...P.whisper, lean: lean * 0.7, near: {sh: 0.3, el: 1.3}, gaze: [0.6, 0.2]}} at={[-6.95, 0, -2.7]} facing={1} res={1000} />
			<Glow at={[-5.9, 2.0, -3.1]} size={0.9} color="#FFB45A" opacity={0.85} />
			<pointLight position={[-5.9, 2.0, -2.9]} color="#FFB45A" intensity={7} distance={5} decay={1.5} />
		</>
	);
};

const scrollTexture = () => {
	const c = document.createElement('canvas');
	c.width = 512;
	c.height = 640;
	const g = c.getContext('2d')!;
	g.fillStyle = '#EAD9B4';
	g.fillRect(0, 0, 512, 640);
	// abstract writing strokes (not real letters)
	const r = rng(4);
	g.strokeStyle = '#4A3624';
	g.lineCap = 'round';
	for (let row = 0; row < 11; row++) {
		let x = 50;
		const y = 70 + row * 42;
		while (x < 450 - (row === 10 ? 200 : 0)) {
			const w = 14 + r() * 40;
			g.lineWidth = 3 + r() * 2;
			g.beginPath();
			g.moveTo(x, y + (r() - 0.5) * 4);
			for (let k = 1; k <= 4; k++) g.lineTo(x + (w * k) / 4, y + (r() - 0.5) * 9);
			g.stroke();
			x += w + 10 + r() * 10;
		}
	}
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
};
const lionSealTexture = () => {
	const c = document.createElement('canvas');
	c.width = 256;
	c.height = 256;
	const g = c.getContext('2d')!;
	g.fillStyle = '#9E2A24';
	g.beginPath();
	g.arc(128, 128, 124, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = '#6E1A16';
	// a lion's head: mane ring of points, face, ears
	g.beginPath();
	for (let i = 0; i < 24; i++) {
		const a = (i / 24) * Math.PI * 2;
		const rr = i % 2 ? 78 : 96;
		g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr);
	}
	g.closePath();
	g.fill();
	g.fillStyle = '#B23A30';
	g.beginPath();
	g.ellipse(128, 136, 46, 54, 0, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = '#6E1A16';
	g.beginPath();
	g.ellipse(110, 122, 7, 5, 0, 0, Math.PI * 2);
	g.ellipse(146, 122, 7, 5, 0, 0, Math.PI * 2);
	g.fill();
	g.beginPath();
	g.moveTo(116, 150);
	g.lineTo(140, 150);
	g.lineTo(128, 166);
	g.closePath();
	g.fill();
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
};

// the decree on a table, a gold seal pressing a lion into red wax (low angle)
const Seal: React.FC<{t: number}> = ({t}) => {
	const shot = useShot();
	const tex = useMemo(() => ({scroll: scrollTexture(), seal: lionSealTexture()}), []);
	useLayoutEffect(() => () => Object.values(tex).forEach((x) => x.dispose()), [tex]);
	const table = useMemo(() => merge([facet(at(box(3, 0.1, 1.6), 0, 0.8, 0), '#6A4630', 0.04, 1), facet(at(box(0.12, 0.8, 0.12), -1.3, 0.4, 0.6), '#4E3222', 0.04, 2), facet(at(box(0.12, 0.8, 0.12), 1.3, 0.4, 0.6), '#4E3222', 0.04, 3)]), []);
	useLayoutEffect(() => () => table.dispose(), [table]);
	const mat = lambert();
	// the stamp comes down, presses (squash), and lifts off
	const down = ease.in(clamp(t / SEAL_T));
	const up = ease.out(clamp((t - SEAL_T - 0.18) / 0.4));
	const y = 0.86 + 0.07 + lerp(0.16, 0, down) + up * 0.16;
	const pressed = t > SEAL_T;
	const squash = pressed ? 1 - 0.25 * Math.exp(-(t - SEAL_T) * 14) : 1;
	void shot;
	return (
		<>
			<SunLight target={[0, 0.8, 0]} extent={3} dist={12} fill={0.8} />
			<Atmosphere near={4} far={20} />
			<mesh geometry={table} material={mat} castShadow receiveShadow />
			{/* scroll sheet with rolled ends */}
			<mesh position={[0, 0.852, 0]} rotation={[-Math.PI / 2, 0, 0.06]} receiveShadow>
				<planeGeometry args={[0.8, 1.0]} />
				<meshLambertMaterial map={tex.scroll} />
			</mesh>
			{[-0.52, 0.52].map((zz) => (
				<mesh key={zz} position={[Math.sin(0.06) * zz, 0.88, zz]} rotation={[0, 0.06, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.035, 0.035, 0.86, 10]} />
					<meshLambertMaterial color="#D9C49A" flatShading />
				</mesh>
			))}
			{/* the wax: a red disc, then the lion appears when the stamp lifts */}
			<mesh position={[0.08, 0.862, 0.3]} scale={[1, squash, 1]} castShadow>
				<cylinderGeometry args={[0.085, 0.09, 0.02, 18]} />
				<meshLambertMaterial color="#9E2A24" flatShading />
			</mesh>
			{pressed ? (
				<mesh position={[0.08, 0.8735, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
					<circleGeometry args={[0.083, 24]} />
					<meshLambertMaterial map={tex.seal} transparent opacity={clamp((t - SEAL_T) / 0.1)} />
				</mesh>
			) : null}
			{/* the gold stamp */}
			<group position={[0.08, y, 0.3]}>
				<mesh position={[0, 0.02, 0]} castShadow>
					<cylinderGeometry args={[0.08, 0.08, 0.04, 18]} />
					<meshLambertMaterial color="#D8A64A" flatShading />
				</mesh>
				<mesh position={[0, 0.14, 0]} castShadow>
					<cylinderGeometry args={[0.03, 0.045, 0.2, 10]} />
					<meshLambertMaterial color="#C8953E" flatShading />
				</mesh>
				<mesh position={[0, 0.27, 0]} castShadow>
					<sphereGeometry args={[0.05, 10, 8]} />
					<meshLambertMaterial color="#D8A64A" flatShading />
				</mesh>
			</group>
			<Glow at={[-0.7, 1.15, -0.4]} size={0.6} color="#FFB45A" opacity={0.7} />
			<pointLight position={[-0.5, 1.3, -0.1]} color="#FFB45A" intensity={7} distance={4} decay={1.3} />
			<pointLight position={[0.6, 1.4, 0.9]} color="#FFD9A0" intensity={2.2} distance={3} decay={1.5} />
		</>
	);
};

// the den: dark rock, calm glowing eyes, no lions shown
const rocks = () => {
	const p: THREE.BufferGeometry[] = [];
	const rr = rng(7);
	for (let i = 0; i < 22; i++) {
		const a = (i / 21) * Math.PI;
		const rad = 2.4 + rr() * 0.3;
		p.push(facet(at(blob(0.7 + rr() * 0.5, 50 + i, 0.3, 1), Math.cos(a) * rad, Math.sin(a) * rad * 1.05, -0.2 + rr() * 0.3), rr() > 0.5 ? '#4A4452' : '#3E3A46', 0.06, 50 + i));
	}
	for (let i = 0; i < 10; i++) {
		const side = i % 2 ? 1 : -1;
		p.push(facet(at(blob(0.7 + rr() * 0.5, 80 + i, 0.3, 1), side * (2.6 + rr() * 2.5), -0.3, 0.6 + rr() * 2), '#35323E', 0.06, 80 + i));
	}
	p.push(facet(at(box(14, 0.2, 10), 0, -0.4, 0), '#2E2C36', 0.04, 99));
	return merge(p);
};
const EYES: [Vec3, number][] = [
	[[-0.55, 0.55, -3.0], 0.0],
	[[0.6, 0.42, -4.2], 1.3],
	[[0.05, 0.9, -5.6], 2.1],
];
const Den: React.FC<{t: number}> = ({t}) => {
	const geo = useMemo(() => rocks(), []);
	useLayoutEffect(() => () => geo.dispose(), [geo]);
	const mat = lambert();
	return (
		<>
			<SunLight target={[0, 0, 0]} extent={8} dist={30} fill={0.6} />
			<Atmosphere near={3} far={14} />
			<mesh geometry={geo} material={mat} receiveShadow />
			<mesh position={[0, 1.2, -7.5]}>
				<planeGeometry args={[12, 6]} />
				<meshBasicMaterial color="#07060A" />
			</mesh>
			{EYES.map(([p, ph], i) => {
				const blink = Math.abs(Math.sin(t * 0.9 + ph)) < 0.06 ? 0.15 : 1;
				const on = smoothstep(0.1 + i * 0.25, 0.4 + i * 0.25, t) * blink;
				return (
					<group key={i}>
						{[-0.11, 0.11].map((dx) => (
							<Glow key={dx} at={[p[0] + dx, p[1], p[2]]} size={0.13} color="#FFB43A" opacity={on} />
						))}
						<Glow at={p} size={0.5} color="#C8701E" opacity={0.25 * on} />
					</group>
				);
			})}
			<Dust box={[[-3, 0, -3], [3, 2.5, 2]]} count={60} size={0.04} opacity={0.25} color="#8A90B8" speed={0.2} />
		</>
	);
};

const S5Content: React.FC<{t: number; d: number}> = ({t}) => {
	const c = cutsS5();
	if (t < c.seal) return <Whisper t={t} />;
	if (t < c.den) return <Seal t={t - c.seal} />;
	return <Den t={t - c.den} />;
};

export const S05: SceneDef = {
	id: 'S5',
	sunAz: 262,
	mood: (t) => {
		const c = cutsS5();
		return t < c.den ? intrigue() : den();
	},
	camera: (t) => {
		const c = cutsS5();
		if (t < c.seal) {
			const k = t / c.seal;
			return {pos: [lerp(-2.6, -2.9, k), 1.6, lerp(3.4, 2.9, k)], target: [-6.1, 0.95, -2.4], fov: 38};
		}
		if (t < c.den) {
			const k = (t - c.seal) / (c.den - c.seal);
			return {pos: [lerp(0.62, 0.52, k), lerp(1.06, 1.02, k), lerp(0.86, 0.74, k)], target: [0.06, 0.88, 0.3], fov: 40};
		}
		const k = (t - c.den) / 2;
		return {pos: [0, 1.35, lerp(4.4, 3.7, k)], target: [0, 0.7, -3.5], fov: 40};
	},
	post: (t, d, sun) => {
		const c = cutsS5();
		const inDen = t >= c.den;
		return {
			bloom: {intensity: inDen ? 1.4 : 0.9, threshold: inDen ? 0.4 : 0.72},
			dof: t >= c.seal && t < c.den ? {focusDistance: 0.72, focusRange: 0.3, bokehScale: 3.2} : {focusDistance: inDen ? 7 : 5.4, focusRange: 2.2, bokehScale: 2.4},
			vignette: {offset: 0.22, darkness: 0.75},
			grade: gradeFromSun(sun, {contrast: 1.1, saturation: inDen ? 0.7 : 0.9}),
		};
	},
	Content: S5Content,
	anchors: (t) => {
		const c = cutsS5();
		return {scroll: t >= c.seal && t < c.den ? [0.08, 0.9, 0.3] : [-6, 2.2, -2.3]};
	},
};
