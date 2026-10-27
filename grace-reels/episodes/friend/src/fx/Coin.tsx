// Silver coins in 3D (so they catch the lamp light as they turn): a plain coin with a raised rim and a
// ring of dots (no face, no letters), a darker milled edge. Also the analytic spin of a coin that
// wobbles down and falls flat (like Euler's disk: the wobble speeds up as it settles).
import {useMemo} from 'react';
import * as THREE from 'three';
import {canvasTexture} from '../lib/textures';
import {cached} from '../world/cache';

export const COIN_R = 0.012; // 2.4 cm across: a little larger than life so it reads on screen
export const COIN_H = 0.0022;

const faceTexture = () =>
	canvasTexture('coinFace', 256, 256, (ctx) => {
		const g = ctx.createRadialGradient(110, 100, 10, 128, 128, 128);
		g.addColorStop(0, '#e9ecef');
		g.addColorStop(0.7, '#b9bdc2');
		g.addColorStop(1, '#8a9097');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 256, 256);
		// raised rim
		ctx.strokeStyle = '#7f858c';
		ctx.lineWidth = 14;
		ctx.beginPath();
		ctx.arc(128, 128, 118, 0, Math.PI * 2);
		ctx.stroke();
		ctx.strokeStyle = '#dfe3e7';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(128, 128, 109, Math.PI * 0.9, Math.PI * 1.6);
		ctx.stroke();
		// a ring of dots and a simple centre boss (a plain pattern, no image)
		ctx.fillStyle = '#8d939a';
		for (let i = 0; i < 24; i++) {
			const a = (i / 24) * Math.PI * 2;
			ctx.beginPath();
			ctx.arc(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84, 7, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.beginPath();
		ctx.arc(128, 128, 30, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#d6dadf';
		ctx.beginPath();
		ctx.arc(122, 122, 16, 0, Math.PI * 2);
		ctx.fill();
	});

const edgeTexture = () =>
	canvasTexture('coinEdge', 256, 8, (ctx) => {
		for (let x = 0; x < 256; x += 4) {
			ctx.fillStyle = x % 8 ? '#80868d' : '#a7acb2';
			ctx.fillRect(x, 0, 4, 8);
		}
	});

export const coinParts = () =>
	cached('coin', () => {
		const geo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 40, 1);
		const face = new THREE.MeshPhongMaterial({map: faceTexture(), specular: new THREE.Color('#fff4dc'), shininess: 60, color: '#ffffff'});
		const edge = new THREE.MeshPhongMaterial({map: edgeTexture(), specular: new THREE.Color('#fff4dc'), shininess: 40, color: '#ffffff'});
		// CylinderGeometry groups: 0 side, 1 top, 2 bottom
		return {geo, mats: [edge, face, face]};
	});

// One coin: centre position, orientation as Euler angles (a flat coin has rot [0, 0, 0]).
export const Coin: React.FC<{
	position: [number, number, number];
	rot?: [number, number, number];
	scale?: number;
	glow?: number; // extra brightness for a shine sweep
	renderOrder?: number;
	castShadow?: boolean;
}> = ({position, rot = [0, 0, 0], scale = 1, glow = 0, renderOrder, castShadow}) => {
	const {geo, mats} = coinParts();
	const m = useMemo(() => mats.map((x) => x.clone()), [mats]);
	m.forEach((x) => x.emissive.setScalar(glow * 0.6));
	return <mesh geometry={geo} material={m} position={position} rotation={rot} scale={scale} renderOrder={renderOrder} castShadow={castShadow} receiveShadow />;
};

// Many identical coins in one draw call (piles, stacks, the stream of coins).
export const CoinCloud: React.FC<{items: {p: [number, number, number]; r: [number, number, number]; s?: number}[]; castShadow?: boolean}> = ({items, castShadow}) => {
	const {geo, mats} = coinParts();
	const mesh = useMemo(() => {
		const me = new THREE.InstancedMesh(geo, mats, 64);
		me.frustumCulled = false;
		return me;
	}, [geo, mats]);
	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const e = new THREE.Euler();
	const n = Math.min(64, items.length);
	for (let i = 0; i < n; i++) {
		const it = items[i];
		q.setFromEuler(e.set(...it.r));
		const s = it.s ?? 1;
		m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(s, s, s));
		mesh.setMatrixAt(i, m);
	}
	mesh.count = n;
	mesh.instanceMatrix.needsUpdate = true;
	mesh.castShadow = !!castShadow;
	mesh.receiveShadow = true;
	return <primitive object={mesh} />;
};

// A coin spun on a table. While upright it spins fast about the vertical (slowing down); then it starts
// to wobble down, and the wobble (precession) speeds up as it lies down, like Euler's disk, until it
// slaps flat at tFlat. The contact point stays at the origin of the table; returns the coin's centre and
// rotation, plus the precession rate (for the motion blur) at time t.
const spinState = (t: number, t0: number, tWob: number, tFlat: number) => {
	const DEG = Math.PI / 180;
	const spin0 = 2 * Math.PI * 7; // rad/s about the vertical at the start
	const spin1 = 2 * Math.PI * 2.2; // at the start of the wobble
	const u = Math.max(0, Math.min(t, tWob) - t0);
	const d1 = tWob - t0;
	let psi = spin0 * u - ((spin0 - spin1) / (2 * d1)) * u * u;
	let rate = spin0 - ((spin0 - spin1) / d1) * u;
	let theta = (88 - 6 * Math.min(1, u / d1) ** 2) * DEG;
	if (t > tWob) {
		const tt = Math.min(t, tFlat);
		const steps = Math.ceil((tt - tWob) / 0.002);
		const dt = (tt - tWob) / Math.max(1, steps);
		for (let i = 0; i < steps; i++) {
			const w = (i * dt) / (tFlat - tWob);
			rate = spin1 + (2 * Math.PI * 1.1) / (1 - w + 0.045) ** 0.85;
			psi += rate * dt;
		}
		const w = (tt - tWob) / (tFlat - tWob);
		theta = 82 * DEG * (1 - w) ** 0.75;
	}
	return {psi, theta: t >= tFlat ? 0 : theta, rate};
};

export const spinningCoin = (t: number, t0: number, tWob: number, tFlat: number) => {
	const {psi, theta, rate} = spinState(t, t0, tWob, tFlat);
	const n = new THREE.Vector3(Math.sin(theta) * Math.cos(psi), Math.cos(theta), Math.sin(theta) * Math.sin(psi));
	const k = new THREE.Vector3(Math.sin(psi), 0, -Math.cos(psi));
	// the coin turns slowly about its own axis as it rolls around
	const body = 0.25 * psi;
	const q = new THREE.Quaternion().setFromAxisAngle(k, theta).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), body));
	const e = new THREE.Euler().setFromQuaternion(q);
	const bounce = t >= tFlat ? 0.0012 * Math.exp(-(t - tFlat) * 28) * Math.abs(Math.sin((t - tFlat) * 70)) : 0;
	const pos: [number, number, number] = [-COIN_R * Math.cos(theta) * Math.cos(psi), COIN_R * Math.sin(theta) + COIN_H / 2 + bounce, -COIN_R * Math.cos(theta) * Math.sin(psi)];
	return {pos, rot: [e.x, e.y, e.z] as [number, number, number], theta, rate, normal: n};
};
