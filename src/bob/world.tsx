// Bob town: identical grey/beige houses, identical BOB mailboxes and cars, the town square with the big
// clock tower and the BOB shops. Every object takes k (0 = dull grey, 1 = full colour) so colour can
// spread through the town like a wave.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, sphere, cone, plane, circle, glowMat, custom} from '../lib/materials';
import {noiseTex, asphaltTex, stoneTex, canvasTex} from '../lib/textures';
import {hash, pick} from '../lib/random';
import {V3, clamp} from '../lib/anim';
import {POPPINS} from '../lib/fonts';
import {Look, LOOKS, mixLooks} from '../lib/Stage';
import {LampPost} from '../world/Town';
import {Cloud, SkyDisc} from '../world/Nature';

// ------------------------------------------------------------------ colour
export const GREY = {
	wall: '#cec7bc', roof: '#8b8680', door: '#7f766c', trim: '#e7e3dc', glass: '#9aa6b0', ground: '#aaab9c', road: '#79797d', walk: '#cfccc4',
	leaf: '#949b88', trunk: '#7d6f61', car: '#a7a7aa', mailbox: '#9c9a96',
};
export const BRIGHT_WALLS = ['#ff8fa3', '#7fc8ff', '#ffd166', '#9be08a', '#c9a0ff', '#ffb07a', '#6fe0d0', '#ff7a7a', '#b28dff', '#ffe08a'];
export const BRIGHT_ROOFS = ['#3b4fa8', '#c0392b', '#2e8b57', '#8e44ad', '#d35400', '#16a085', '#2c3e50'];
export const BRIGHT_DOORS = ['#e63946', '#2a6fdb', '#1f9d8f', '#ffb703', '#8338ec', '#ff6b35'];
export const BRIGHT_CARS = ['#ff3b5c', '#2f80ff', '#ffcc00', '#1fbf75', '#a259ff', '#ff7a00', '#00c2d1'];

/** grey -> colour, quantised so the material cache stays small */
export const mix = (a: string, b: string, k: number) => {
	const q = Math.round(clamp(k) * 10) / 10;
	return '#' + new THREE.Color(a).lerp(new THREE.Color(b), q).getHexString();
};

// ------------------------------------------------------------------ looks
export const LOOK_GREY: Look = {
	...LOOKS.day,
	skyTop: '#9fa9b3', skyMid: '#c3c8cc', skyBottom: '#dedcd6', fog: '#cfd0cd', fogNear: 50, fogFar: 200,
	hemiSky: '#e4e6e8', hemiGround: '#b4b0a8', hemi: 1.1, ambient: 0.28, sunColor: '#f4f1ea', sun: 2.2, sunDir: [-0.45, 0.78, 0.45], shadowIntensity: 0.55, env: 0.5,
};
export const LOOK_BRIGHT: Look = {
	...LOOKS.day,
	skyTop: '#2f84f0', skyMid: '#7cc2ff', skyBottom: '#eaf6ff', fog: '#cfe8ff', fogNear: 60, fogFar: 230,
	hemiSky: '#dcefff', hemiGround: '#d8c39a', hemi: 1.2, ambient: 0.25, sunColor: '#fff4dc', sun: 2.8, sunDir: [-0.45, 0.78, 0.45], shadowIntensity: 0.6, env: 0.6,
};
export const townLook = (k: number) => mixLooks(LOOK_GREY, LOOK_BRIGHT, clamp(k));

// ------------------------------------------------------------------ text plates
export const plateTex = (text: string, bg: string, fg: string, w = 512, h = 192) =>
	canvasTex(`plate|${text}|${bg}|${fg}|${w}|${h}`, w, h, (ctx, W, H) => {
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, W, H);
		ctx.fillStyle = fg;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		let size = H * 0.66;
		ctx.font = `800 ${size}px ${POPPINS}, sans-serif`;
		while (ctx.measureText(text).width > W * 0.88 && size > 10) {
			size -= 4;
			ctx.font = `800 ${size}px ${POPPINS}, sans-serif`;
		}
		ctx.fillText(text, W / 2, H / 2 + size * 0.05);
	});

// ------------------------------------------------------------------ mailbox, car, tree
export const Mailbox: React.FC<{position?: V3; rotation?: number; k?: number; seed?: number; name?: string}> = ({position, rotation = 0, k = 0, seed = 0, name = 'BOB'}) => {
	const c = mix(GREY.mailbox, pick(BRIGHT_DOORS, seed, 3), k);
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={rbox(0.22, 2.4, 0.22, 0.05)} material={plastic(mix('#8a847c', '#6b4a2e', k), {rough: 0.7})} position={[0, 1.2, 0]} castShadow />
			<mesh geometry={rbox(0.9, 0.75, 1.5, 0.3)} material={plastic(c, {rough: 0.45})} position={[0, 2.65, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(0.06, 0.55, 0.24, 0.02)} material={plastic(mix('#b5b1aa', '#ff3b30', k))} position={[0.48, 2.85, -0.2]} />
			<mesh geometry={plane(0.78, 0.36)} material={plastic('#ffffff', {map: plateTex(name, '#f2efe8', '#3a3a3e', 256, 112), rough: 0.6})} position={[0, 2.62, 0.761]} />
		</group>
	);
};

export const Car: React.FC<{position?: V3; rotation?: number; k?: number; seed?: number}> = ({position, rotation = 0, k = 0, seed = 0}) => {
	const body = plastic(mix(GREY.car, pick(BRIGHT_CARS, seed, 5), k), {rough: 0.3, envInt: 1.2});
	const glass = plastic('#3e4752', {rough: 0.15, metal: 0.2});
	const tyre = plastic('#232327', {rough: 0.8});
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={rbox(2.1, 1.0, 4.4, 0.3)} material={body} position={[0, 0.95, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(1.9, 0.9, 2.4, 0.3)} material={body} position={[0, 1.8, -0.2]} castShadow />
			<mesh geometry={rbox(1.94, 0.6, 2.1, 0.2)} material={glass} position={[0, 1.85, -0.2]} />
			{[[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]].map(([sx, sz], i) => (
				<mesh key={i} geometry={cyl(0.45, 0.45, 0.35, 18)} material={tyre} position={[sx * 0.95, 0.45, sz]} rotation={[0, 0, Math.PI / 2]} castShadow />
			))}
			{[-0.65, 0.65].map((x) => (
				<mesh key={x} geometry={rbox(0.4, 0.22, 0.06, 0.05)} material={plastic('#f6f2df', {rough: 0.2, emissive: '#fff4c0', emissiveIntensity: 0.2})} position={[x, 1.05, 2.21]} />
			))}
		</group>
	);
};

export const Tree: React.FC<{position?: V3; k?: number; seed?: number; scale?: number}> = ({position, k = 0, seed = 1, scale = 1}) => {
	const leaf = plastic(mix(GREY.leaf, pick(['#3fbf4a', '#52c24a', '#2fae5a'], seed, 2), k), {rough: 0.75});
	return (
		<group position={position} scale={scale}>
			<mesh geometry={cyl(0.35, 0.48, 3.2, 10)} material={plastic(mix(GREY.trunk, '#8a5a34', k), {rough: 0.8})} position={[0, 1.6, 0]} castShadow />
			<mesh geometry={sphere(1.9, 16, 12)} material={leaf} position={[0, 4.4, 0]} scale={[1, 0.9, 1]} castShadow receiveShadow />
			<mesh geometry={sphere(1.3, 14, 10)} material={leaf} position={[1.1 + hash(seed, 1) * 0.3, 3.9, 0.4]} castShadow />
			<mesh geometry={sphere(1.25, 14, 10)} material={leaf} position={[-1.0, 4.1, -0.3]} castShadow />
		</group>
	);
};

// ------------------------------------------------------------------ the identical house
export const HOUSE = {W: 10, D: 8, H: 10, roofH: 3.8};
function prism(w: number, h: number, d: number) {
	return custom(`bobprism|${w}|${h}|${d}`, () => {
		const s = new THREE.Shape();
		s.moveTo(-w / 2, 0);
		s.lineTo(w / 2, 0);
		s.lineTo(0, h);
		s.lineTo(-w / 2, 0);
		const g = new THREE.ExtrudeGeometry(s, {depth: d, bevelEnabled: false});
		g.translate(0, 0, -d / 2);
		return g;
	});
}
export const BobHouse: React.FC<{position?: V3; rotation?: number; k?: number; seed?: number; mailbox?: boolean; mailName?: string; detail?: 'high' | 'low'}> = ({
	position,
	rotation = 0,
	k = 0,
	seed = 0,
	mailbox = true,
	mailName = 'BOB',
	detail = 'high',
}) => {
	const {W, D, H, roofH} = HOUSE;
	const wall = plastic(mix(GREY.wall, pick(BRIGHT_WALLS, seed, 1), k), {rough: 0.65});
	const roof = plastic(mix(GREY.roof, pick(BRIGHT_ROOFS, seed, 2), k), {rough: 0.6});
	const door = plastic(mix(GREY.door, pick(BRIGHT_DOORS, seed, 3), k), {rough: 0.45});
	const trim = plastic(GREY.trim, {rough: 0.5});
	const glass = plastic(mix(GREY.glass, '#9fd8ff', k), {rough: 0.15, metal: 0.1, envInt: 1.3});
	const over = 0.6;
	const slope = Math.atan2(roofH, D / 2 + over);
	const slopeLen = Math.hypot(D / 2 + over, roofH);
	const win = (x: number, y: number, key: string) => (
		<group key={key} position={[x, y, D / 2 + 0.05]}>
			<mesh geometry={rbox(2.1, 2.3, 0.25, 0.05)} material={trim} castShadow />
			<mesh geometry={plane(1.7, 1.9)} material={glass} position={[0, 0, 0.14]} />
			<mesh geometry={box(0.1, 1.9, 0.06)} material={trim} position={[0, 0, 0.17]} />
			<mesh geometry={box(1.7, 0.1, 0.06)} material={trim} position={[0, 0, 0.17]} />
		</group>
	);
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={box(W, H, D)} material={wall} position={[0, H / 2, 0]} castShadow receiveShadow />
			<mesh geometry={prism(D, roofH, W)} material={wall} position={[0, H, 0]} rotation={[0, Math.PI / 2, 0]} castShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={rbox(W + over * 2, 0.35, slopeLen, 0.08)} material={roof} position={[0, H + roofH / 2 + 0.1, (sd * (D / 2 + over)) / 2]} rotation={[sd * slope, 0, 0]} castShadow receiveShadow />
			))}
			<mesh geometry={box(W + 0.2, 0.3, D + 0.2)} material={trim} position={[0, H / 2, 0]} />
			<mesh geometry={box(W + 0.2, 0.5, D + 0.2)} material={plastic('#bdb8b0', {rough: 0.8})} position={[0, 0.25, 0]} receiveShadow />
			{win(-2.8, 7.4, 'w1')}
			{win(2.8, 7.4, 'w2')}
			{win(-2.8, 3.0, 'w3')}
			{detail === 'high' ? win(2.8, 3.0, 'w4') : null}
			<group position={[1.0 - 1.0, 0, D / 2 + 0.03]}>
				<mesh geometry={rbox(2.3, 4.2, 0.24, 0.05)} material={trim} position={[2.8 - 2.8 + 0, 2.1, 0]} castShadow />
				<mesh geometry={rbox(1.8, 3.8, 0.18, 0.05)} material={door} position={[0, 1.95, 0.1]} castShadow />
				<mesh geometry={sphere(0.11, 10, 8)} material={plastic('#cfc6a8', {metal: 0.8, rough: 0.3})} position={[0.62, 1.95, 0.24]} />
			</group>
			<mesh geometry={rbox(3.2, 0.4, 1.6, 0.08)} material={plastic('#c9c4bb', {rough: 0.8})} position={[0, 0.2, D / 2 + 0.8]} castShadow receiveShadow />
			<mesh geometry={box(2.0, 0.08, 5.6)} material={plastic(mix('#d6d2c9', '#e9e1d2', k), {rough: 0.85})} position={[0, 0.04, D / 2 + 4.2]} receiveShadow />
			{mailbox ? <Mailbox position={[2.2, 0, D / 2 + 6.6]} k={k} seed={seed} name={mailName} /> : null}
		</group>
	);
};

// ------------------------------------------------------------------ the street
export type ColorField = (x: number, z: number) => number;
const noColor: ColorField = () => 0;

/** where house i of the street stands (both sides face the road) */
export function streetHouse(i: number, zFrom = 40): {p: V3; rot: number; side: number} {
	const row = Math.floor(i / 2);
	const side = i % 2 === 0 ? -1 : 1;
	return {p: [side * 18, 0, zFrom - row * 14], rot: side < 0 ? Math.PI / 2 : -Math.PI / 2, side};
}

export const BobStreet: React.FC<{zFrom?: number; zTo?: number; color?: ColorField; ground?: ColorField; cars?: boolean; trees?: boolean; mailNames?: (i: number) => string}> = ({
	zFrom = 40,
	zTo = -150,
	color = noColor,
	ground = noColor,
	cars = true,
	trees = true,
	mailNames,
}) => {
	const items: React.ReactNode[] = [];
	const rows = Math.floor((zFrom - zTo) / 14);
	for (let r = 0; r < rows; r++) {
		for (const sd of [-1, 1]) {
			const i = r * 2 + (sd < 0 ? 0 : 1);
			const h = streetHouse(i, zFrom);
			const k = color(h.p[0], h.p[2]);
			items.push(<BobHouse key={'h' + i} position={h.p} rotation={h.rot} k={k} seed={i + 3} detail={Math.abs(h.p[2]) > 80 ? 'low' : 'high'} mailName={mailNames ? mailNames(i) : 'BOB'} />);
			if (cars && r % 2 === 0) items.push(<Car key={'c' + i} position={[sd * 4.3, 0, h.p[2] + 5]} rotation={sd < 0 ? Math.PI : 0} k={color(sd * 4.3, h.p[2] + 5)} seed={i} />);
			if (trees && r % 2 === 1) items.push(<Tree key={'t' + i} position={[sd * 10.5, 0, h.p[2] - 6.5]} k={color(sd * 10.5, h.p[2] - 6.5)} seed={i} scale={0.95} />);
		}
		items.push(<LampPost key={'l' + r} position={[-6.3, 0, zFrom - r * 14 - 4]} lit="day" />);
		items.push(<LampPost key={'lr' + r} position={[6.3, 0, zFrom - r * 14 - 11]} lit="day" />);
	}
	const len = zFrom - zTo + 80;
	const cz = (zFrom + zTo) / 2;
	const gk = ground(0, cz);
	return (
		<group>
			<mesh geometry={plane(240, len)} material={plastic('#ffffff', {map: noiseTex(mix(GREY.ground, '#6fcf5a', gk), 0.08, 3, [14, len / 8]), rough: 0.95})} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, cz]} receiveShadow />
			<mesh geometry={plane(10, len)} material={plastic('#ffffff', {map: asphaltTex([3, len / 6]), rough: 0.85})} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, cz]} receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={box(3.4, 0.3, len)} material={plastic(GREY.walk, {rough: 0.85})} position={[sd * 6.8, 0.15, cz]} receiveShadow />
			))}
			{items}
		</group>
	);
};

// ------------------------------------------------------------------ shops + the clock tower
export const Shop: React.FC<{name: string; position?: V3; rotation?: number; k?: number; seed?: number}> = ({name, position, rotation = 0, k = 0, seed = 0}) => {
	const W = 12;
	const H = 10;
	const D = 8;
	const wall = plastic(mix('#c9c2b6', pick(BRIGHT_WALLS, seed, 7), k), {rough: 0.65});
	const awning = mix('#9a958e', pick(BRIGHT_DOORS, seed, 8), k);
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={box(W, H, D)} material={wall} position={[0, H / 2, 0]} castShadow receiveShadow />
			<mesh geometry={box(W + 0.5, 0.7, D + 0.5)} material={plastic(mix('#8b8680', '#3b4fa8', k), {rough: 0.6})} position={[0, H + 0.35, 0]} castShadow />
			<mesh geometry={rbox(6.4, 3.6, 0.3, 0.08)} material={plastic('#e7e3dc')} position={[-2.2, 2.9, D / 2]} castShadow />
			<mesh geometry={plane(5.8, 3.0)} material={plastic(mix('#9aa6b0', '#a8dcff', k), {rough: 0.15})} position={[-2.2, 2.9, D / 2 + 0.16]} />
			<mesh geometry={rbox(2.3, 4.3, 0.3, 0.08)} material={plastic(mix('#7f766c', '#e63946', k))} position={[3.4, 2.15, D / 2 + 0.05]} castShadow />
			{Array.from({length: 12}).map((_, i) => (
				<mesh key={i} geometry={box(W / 12, 0.12, 1.9)} material={plastic(i % 2 ? '#efece6' : awning, {rough: 0.6})} position={[-W / 2 + (i + 0.5) * (W / 12), 5.2, D / 2 + 0.95]} rotation={[0.35, 0, 0]} castShadow />
			))}
			<group position={[0, 7.4, D / 2 + 0.2]}>
				<mesh geometry={rbox(9.2, 1.9, 0.3, 0.08)} material={plastic('#efece6')} castShadow />
				<mesh geometry={plane(8.8, 1.6)} material={plastic('#ffffff', {map: plateTex(name, mix('#6f6c68', '#2b2f6b', k), '#ffffff', 1024, 186), rough: 0.6})} position={[0, 0, 0.16]} />
			</group>
		</group>
	);
};

const clockFaceTex = () =>
	canvasTex('bobClockFace', 512, 512, (ctx, w, h) => {
		ctx.fillStyle = '#f4f1e8';
		ctx.beginPath();
		ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#3a3a3e';
		ctx.lineWidth = 16;
		ctx.stroke();
		ctx.fillStyle = '#3a3a3e';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `800 64px ${POPPINS}, sans-serif`;
		for (let i = 1; i <= 12; i++) {
			const a = (i / 12) * Math.PI * 2;
			ctx.fillText(String(i), w / 2 + Math.sin(a) * 190, h / 2 - Math.cos(a) * 190);
		}
		for (let i = 0; i < 60; i++) {
			const a = (i / 60) * Math.PI * 2;
			const r0 = i % 5 === 0 ? 224 : 232;
			ctx.lineWidth = i % 5 === 0 ? 6 : 3;
			ctx.beginPath();
			ctx.moveTo(w / 2 + Math.sin(a) * r0, h / 2 - Math.cos(a) * r0);
			ctx.lineTo(w / 2 + Math.sin(a) * 244, h / 2 - Math.cos(a) * 244);
			ctx.stroke();
		}
	});

/** the big clock tower. hour/minute in clock units; bell swings with ring (0..1) */
export const CLOCK_Y = 25;
export const ClockTowerBob: React.FC<{position?: V3; rotation?: number; hour?: number; minute?: number; k?: number; ring?: number}> = ({position, rotation = 0, hour = 11, minute = 58, k = 0, ring = 0}) => {
	const wall = plastic('#ffffff', {map: noiseTex(mix('#d2ccc1', '#f3e3c3', k), 0.06, 41, [2, 6]), rough: 0.75});
	const trim = plastic(mix('#9a948c', '#b9614a', k), {rough: 0.6});
	const roof = plastic(mix('#7f7b76', '#c0392b', k), {rough: 0.5});
	const ha = -((hour % 12) + minute / 60) * (Math.PI / 6);
	const ma = -(minute / 60) * Math.PI * 2;
	const faceMat = useMemo(() => new THREE.MeshStandardMaterial({map: clockFaceTex(), roughness: 0.5}), []);
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={rbox(8, 28, 8, 0.2)} material={wall} position={[0, 14, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(9, 1.2, 9, 0.2)} material={trim} position={[0, 0.6, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(9.6, 9.6, 9.6, 0.3)} material={wall} position={[0, CLOCK_Y, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(10.2, 0.9, 10.2, 0.2)} material={trim} position={[0, CLOCK_Y + 5.2, 0]} castShadow />
			<mesh geometry={rbox(10.2, 0.9, 10.2, 0.2)} material={trim} position={[0, CLOCK_Y - 5.2, 0]} castShadow />
			{/* belfry with a swinging bell */}
			<mesh geometry={rbox(7.6, 4.2, 7.6, 0.2)} material={wall} position={[0, CLOCK_Y + 7.8, 0]} castShadow />
			<mesh geometry={box(5.2, 3.2, 7.8)} material={plastic('#2e2c2a')} position={[0, CLOCK_Y + 7.7, 0]} />
			<group position={[0, CLOCK_Y + 9.2, 0]} rotation={[Math.sin(ring * Math.PI * 6) * 0.45 * ring, 0, 0]}>
				<mesh geometry={cone(1.1, 1.7, 20)} material={plastic(mix('#8f8b84', '#d4a017', k), {metal: 0.8, rough: 0.3})} position={[0, -1.0, 0]} castShadow />
			</group>
			<mesh geometry={cone(6.6, 7.4, 4)} material={roof} position={[0, CLOCK_Y + 13.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />
			{/* clock faces on all four sides */}
			{[0, 1, 2, 3].map((s) => (
				<group key={s} rotation={[0, (s * Math.PI) / 2, 0]}>
					<group position={[0, CLOCK_Y, 4.86]}>
						<mesh geometry={cyl(3.8, 3.8, 0.4, 40)} material={trim} rotation={[Math.PI / 2, 0, 0]} castShadow />
						<mesh geometry={circle(3.45, 48)} material={faceMat} position={[0, 0, 0.22]} />
						<group position={[0, 0, 0.32]} rotation={[0, 0, ha]}>
							<mesh geometry={rbox(0.36, 2.1, 0.1, 0.05)} material={plastic('#26262a')} position={[0, 0.9, 0]} />
						</group>
						<group position={[0, 0, 0.4]} rotation={[0, 0, ma]}>
							<mesh geometry={rbox(0.24, 3.0, 0.1, 0.05)} material={plastic('#26262a')} position={[0, 1.35, 0]} />
						</group>
						<mesh geometry={cyl(0.3, 0.3, 0.22, 16)} material={plastic('#26262a')} position={[0, 0, 0.46]} rotation={[Math.PI / 2, 0, 0]} />
					</group>
				</group>
			))}
		</group>
	);
};

/** the town square: paving, the clock tower in the middle, the BOB shops around */
export const SQUARE_SHOPS = ["BOB'S SHOP", "BOB'S CAFE", "BOB'S BANK", 'BOB SCHOOL', "BOB'S SHOP", "BOB'S CAFE"];
export const TownSquareBob: React.FC<{k?: number; hour?: number; minute?: number; ring?: number; shopNames?: string[]}> = ({k = 0, hour, minute, ring, shopNames = SQUARE_SHOPS}) => {
	const paving = plastic('#ffffff', {map: stoneTex(mix('#c8c2b8', '#e9d6b0', k), [12, 12], 23, 8), rough: 0.85});
	const R = 34;
	return (
		<group>
			<mesh geometry={plane(320, 320)} material={plastic('#ffffff', {map: noiseTex(mix(GREY.ground, '#6fcf5a', k), 0.08, 3, [30, 30]), rough: 0.95})} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
			<mesh geometry={cyl(R, R, 0.1, 64)} material={paving} position={[0, 0, 0]} receiveShadow />
			<ClockTowerBob position={[0, 0, -14]} hour={hour} minute={minute} k={k} ring={ring} />
			{shopNames.map((n, i) => {
				const a = Math.PI + ((i - (shopNames.length - 1) / 2) / shopNames.length) * Math.PI * 1.25;
				const r = R + 4;
				return <Shop key={i} name={n} position={[Math.sin(a) * r, 0, Math.cos(a) * r - 6]} rotation={a + Math.PI} k={k} seed={i} />;
			})}
			{Array.from({length: 6}).map((_, i) => {
				const a = ((i + 0.5) / 6) * Math.PI * 2;
				return <Tree key={'t' + i} position={[Math.sin(a) * (R - 6), 0, Math.cos(a) * (R - 6)]} k={k} seed={i + 30} />;
			})}
		</group>
	);
};

/** soft sky dressing: sun + clouds (clouds go from grey to white) */
export const BobSky: React.FC<{k?: number}> = ({k = 0}) => (
	<group>
		<group position={[-170, 300, 170]} rotation={[0, -0.8, 0]}>
			<SkyDisc position={[0, 0, 0]} size={12} color={mix('#e8e6e0', '#fff4c4', k)} halo={mix('#dcdcdc', '#ffd27a', k)} intensity={1.2 + k * 1.2} />
		</group>
		{[0, 1, 2, 3, 4, 5].map((i) => (
			<Cloud key={i} position={[(i - 2.5) * 70, 70 + (i % 3) * 14, -220 - (i % 2) * 40]} scale={9 + (i % 3) * 2} seed={i + 2} color={mix('#c9ccd0', '#ffffff', k)} />
		))}
	</group>
);
