// Bob props: sandwich, name tags, the wild hat, the yellow scarf, the photo album, paint splashes, mirror.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, sphere, torus, plane, cone, custom, glowMat} from '../lib/materials';
import {canvasTex} from '../lib/textures';
import {mulberry32, hash} from '../lib/random';
import {V3, clamp, easeOutBack} from '../lib/anim';
import {POPPINS} from '../lib/fonts';
import {CAVEAT} from '../birthday/fonts';
import {sandwichGeometries} from './BobCrowd';

// ------------------------------------------------------------------ sandwich (single, for close-ups)
export const Sandwich: React.FC<{bitten?: boolean; scale?: number}> = ({bitten = false, scale = 1}) => {
	const g = sandwichGeometries(bitten);
	return (
		<group scale={scale}>
			<mesh geometry={g.bread} material={plastic('#e8cf9a', {rough: 0.8})} castShadow />
			<mesh geometry={g.fill} material={plastic('#c9cbb0', {rough: 0.7})} castShadow />
		</group>
	);
};

// ------------------------------------------------------------------ name tag
/** HELLO my name is ... ; written = 0..1 how much of the name has been written */
export const nameTagTex = (name: string, written = 1) =>
	canvasTex(`nametag|${name}|${Math.round(written * 12)}`, 512, 360, (ctx, w, h) => {
		const r = 26;
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.roundRect(0, 0, w, h, r);
		ctx.fill();
		ctx.fillStyle = '#e8343c';
		ctx.beginPath();
		ctx.roundRect(0, 0, w, 136, [r, r, 0, 0]);
		ctx.fill();
		ctx.fillRect(0, h - 26, w, 26);
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `800 74px ${POPPINS}, sans-serif`;
		ctx.fillText('HELLO', w / 2, 58);
		ctx.font = `700 30px ${POPPINS}, sans-serif`;
		ctx.fillText('my name is', w / 2, 112);
		// hand-written name, revealed left to right
		let size = 118;
		ctx.font = `700 ${size}px ${CAVEAT}, cursive`;
		while (ctx.measureText(name).width > w * 0.9 && size > 40) {
			size -= 6;
			ctx.font = `700 ${size}px ${CAVEAT}, cursive`;
		}
		const tw = ctx.measureText(name).width;
		ctx.save();
		ctx.beginPath();
		ctx.rect((w - tw) / 2 - 10, 140, (tw + 20) * Math.round(written * 12) / 12, h - 170);
		ctx.clip();
		ctx.fillStyle = '#1d1d24';
		ctx.fillText(name, w / 2, 236);
		ctx.restore();
	});

export const NameTag: React.FC<{name: string; written?: number; scale?: number}> = ({name, written = 1, scale = 1}) => (
	<group scale={scale}>
		<mesh geometry={rbox(1.02, 0.72, 0.03, 0.04)} material={plastic('#ffffff', {rough: 0.6})} position={[0, 0, 0.01]} />
		<mesh geometry={plane(1.0, 0.7)} material={plastic('#ffffff', {map: nameTagTex(name, written), rough: 0.6})} position={[0, 0, 0.03]} />
	</group>
);

/** a marker pen (writing the name tags) */
export const Marker: React.FC = () => (
	<group>
		<mesh geometry={cyl(0.07, 0.07, 0.9, 12)} material={plastic('#1d1d24', {rough: 0.4})} position={[0, 0.45, 0]} castShadow />
		<mesh geometry={cyl(0.072, 0.072, 0.25, 12)} material={plastic('#e8343c', {rough: 0.4})} position={[0, 0.98, 0]} />
		<mesh geometry={cone(0.06, 0.14, 10)} material={plastic('#1d1d24')} position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]} />
	</group>
);

// ------------------------------------------------------------------ the wildest hat in the world
const HAT_COLS = ['#ff3d8a', '#ffd60a', '#14c9b8', '#8f4dff', '#ff7a1a', '#7ed321', '#3a86ff'];
/** in head space (base head), sits on top of the curly hair; wobble 0..1 springs it */
export const WildHat: React.FC<{wobble?: number; t?: number}> = ({wobble = 0, t = 0}) => {
	const rings = 7;
	const sway = Math.sin(t * 3.1) * 0.05 + wobble * Math.sin(t * 14) * 0.12;
	return (
		<group position={[0.05, 1.02, -0.05]} rotation={[0, 0, -0.08 + sway * 0.4]}>
			<mesh geometry={cyl(1.02, 1.02, 0.1, 36)} material={plastic('#3a86ff', {rough: 0.45})} castShadow />
			{Array.from({length: rings}).map((_, i) => {
				const y = 0.2 + i * 0.32;
				const r = 0.66 - i * 0.025;
				const off = Math.sin(i * 1.3) * 0.06 + sway * i * 0.18;
				return <mesh key={i} geometry={cyl(r, r + 0.02, 0.33, 28)} material={plastic(HAT_COLS[i % HAT_COLS.length], {rough: 0.4})} position={[off, y, 0]} rotation={[0, 0, sway * 0.3]} castShadow />;
			})}
			{/* polka dots on the band */}
			{Array.from({length: 8}).map((_, i) => {
				const a = (i / 8) * Math.PI * 2;
				return <mesh key={'d' + i} geometry={sphere(0.07, 8, 6)} material={plastic('#ffffff')} position={[Math.cos(a) * 0.68, 0.2, Math.sin(a) * 0.68]} />;
			})}
			{/* the big feather: a curved plume of fluffy pieces */}
			<group position={[0.15 + sway * 1.4, 0.2 + rings * 0.32, 0]} rotation={[0, 0, -0.35 + sway]}>
				{Array.from({length: 11}).map((_, i) => {
					const u = i / 10;
					const x = Math.sin(u * 1.8) * 0.9;
					const y = u * 2.2;
					const s = 0.28 * Math.sin(u * Math.PI * 0.95 + 0.15) + 0.08;
					return <mesh key={i} geometry={sphere(1, 12, 8)} material={plastic(i % 2 ? '#ff2fb2' : '#25e0ff', {rough: 0.6})} position={[x, y, 0]} scale={[s * 1.6, s * 0.9, s * 0.5]} rotation={[0, 0, -u * 1.2]} castShadow />;
				})}
				<mesh geometry={cyl(0.03, 0.04, 2.3, 6)} material={plastic('#fff3a0')} position={[0.35, 1.05, 0]} rotation={[0, 0, -0.45]} />
			</group>
			<mesh geometry={sphere(0.22, 12, 10)} material={plastic('#ffd60a', {rough: 0.7})} position={[0.6, 0.2 + rings * 0.32 + 0.05, 0.3]} castShadow />
		</group>
	);
};

// ------------------------------------------------------------------ yellow scarf (torso space, chest item origin)
export const Scarf: React.FC<{color?: string; t?: number}> = ({color = '#ffd21f', t = 0}) => {
	const m = plastic(color, {rough: 0.75});
	const sw = Math.sin(t * 2.2) * 0.06;
	return (
		<group position={[0, 0.66, -0.5]}>
			<mesh geometry={torus(0.78, 0.2, 10, 28)} material={m} rotation={[Math.PI / 2, 0, 0]} scale={[1.08, 0.82, 1]} castShadow />
			<group position={[0.45, -0.05, 0.62]} rotation={[0.1 + sw, 0, 0.12]}>
				<mesh geometry={rbox(0.34, 1.0, 0.12, 0.05)} material={m} position={[0, -0.5, 0]} castShadow />
				{[-0.1, 0, 0.1].map((x) => (
					<mesh key={x} geometry={box(0.06, 0.16, 0.08)} material={m} position={[x, -1.06, 0]} />
				))}
			</group>
		</group>
	);
};

// ------------------------------------------------------------------ photo album
export const Album: React.FC<{open?: number; left?: THREE.Material; right?: THREE.Material}> = ({open = 1, left, right}) => {
	const W = 2.2;
	const D = 1.6;
	const cover = plastic('#6a4a2e', {rough: 0.7});
	const page = plastic('#efe6d2', {rough: 0.9});
	const a = (1 - open) * 1.4;
	return (
		<group>
			{[-1, 1].map((sd) => (
				<group key={sd} rotation={[0, 0, sd * a]}>
					<mesh geometry={rbox(W, 0.08, D, 0.03)} material={cover} position={[sd * (W / 2), 0.04, 0]} castShadow receiveShadow />
					<mesh geometry={box(W - 0.12, 0.14, D - 0.1)} material={page} position={[sd * (W / 2 - 0.03), 0.14, 0]} />
					{(sd < 0 ? left : right) ? (
						<group position={[sd * (W / 2 - 0.03), 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]}>
							<mesh geometry={plane(1.66, 1.26)} material={(sd < 0 ? left : right)!} />
						</group>
					) : null}
				</group>
			))}
		</group>
	);
};

// ------------------------------------------------------------------ paint splash (flat decal facing +z)
const splashTex = (seed: number) =>
	canvasTex(`splash|${seed}`, 256, 256, (ctx, w, h) => {
		const r = mulberry32(seed);
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		const n = 18;
		for (let i = 0; i <= n; i++) {
			const a = (i / n) * Math.PI * 2;
			const rr = 70 + r() * 40;
			const x = w / 2 + Math.cos(a) * rr;
			const y = h / 2 + Math.sin(a) * rr;
			i === 0 ? ctx.moveTo(x, y) : ctx.quadraticCurveTo(w / 2 + Math.cos(a - 0.17) * (rr + 30), h / 2 + Math.sin(a - 0.17) * (rr + 30), x, y);
		}
		ctx.fill();
		for (let i = 0; i < 9; i++) {
			const a = r() * Math.PI * 2;
			const d = 100 + r() * 24;
			ctx.beginPath();
			ctx.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 6 + r() * 10, 0, Math.PI * 2);
			ctx.fill();
		}
	}, {srgb: false});

export const Splash: React.FC<{color: string; k: number; size?: number; seed?: number; position?: V3; rotation?: V3}> = ({color, k, size = 2, seed = 1, position, rotation}) => {
	const mat = useMemo(() => {
		const m = new THREE.MeshStandardMaterial({color: new THREE.Color(color), alphaMap: splashTex(seed), transparent: true, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4});
		return m;
	}, [color, seed]);
	if (k <= 0) return null;
	const s = size * easeOutBack(clamp(k), 2.4);
	return <mesh geometry={plane(1, 1)} material={mat} position={position} rotation={rotation} scale={[s, s, 1]} renderOrder={3} />;
};

// ------------------------------------------------------------------ standing mirror
export const MIRROR = {w: 2.4, h: 3.6, y: 3.0};
export const StandMirror: React.FC = () => {
	const frame = plastic('#8a8f96', {rough: 0.35, metal: 0.3});
	const {w, h, y} = MIRROR;
	const glass = useMemo(() => {
		const m = new THREE.MeshStandardMaterial({color: '#cfe6f2', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false});
		return m;
	}, []);
	return (
		<group>
			<mesh geometry={rbox(w + 0.3, 0.2, 0.2, 0.06)} material={frame} position={[0, y + h / 2 + 0.05, 0]} castShadow />
			<mesh geometry={rbox(w + 0.3, 0.2, 0.2, 0.06)} material={frame} position={[0, y - h / 2 - 0.05, 0]} castShadow />
			<mesh geometry={rbox(0.2, h + 0.3, 0.2, 0.06)} material={frame} position={[-w / 2 - 0.05, y, 0]} castShadow />
			<mesh geometry={rbox(0.2, h + 0.3, 0.2, 0.06)} material={frame} position={[w / 2 + 0.05, y, 0]} castShadow />
			<mesh geometry={plane(w, h)} material={glass} position={[0, y, 0.02]} renderOrder={20} />
			{/* glint */}
			<mesh geometry={plane(0.18, h * 0.8)} material={glowMat('#ffffff', 0.5, {transparent: true, opacity: 0.25, depthWrite: false})} position={[-w * 0.25, y + 0.1, 0.03]} rotation={[0, 0, -0.35]} renderOrder={21} />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={rbox(0.16, y - h / 2 + 0.1, 0.16, 0.05)} material={frame} position={[sd * (w / 2 - 0.2), (y - h / 2) / 2, -0.3]} rotation={[-0.15, 0, 0]} castShadow />
			))}
			<mesh geometry={rbox(w + 0.6, 0.14, 1.2, 0.05)} material={frame} position={[0, 0.07, -0.25]} castShadow receiveShadow />
		</group>
	);
};
