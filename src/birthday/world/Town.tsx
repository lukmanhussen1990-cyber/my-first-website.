// The plain, quiet town: soft muted houses, no decorations anywhere (until the very end),
// a long street, and the old closed bakery at the end of it.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, plane, glowMat, cone, sphere} from '../../lib/materials';
import {noiseTex, asphaltTex, woodTex, webTex, canvasTex} from '../../lib/textures';
import {hash, pick, mulberry32} from '../../lib/random';
import {House, HouseSpec, LampPost} from '../../world/Town';
import {RoundTree, Bush, Cloud, SkyDisc, Stars} from '../../world/Nature';
import {Bunting} from '../../world/Square';
import {Balloon, Banner} from '../props/Things';
import {V3} from '../../lib/anim';
import {POPPINS} from '../../lib/fonts';

const Q_WALLS = ['#e8dcc8', '#d9cbb5', '#c9cfd4', '#d8c3a5', '#cdd5c0', '#e3d0c0', '#bfc7cf', '#d6cdbf'];
const Q_ROOFS = ['#5a4a44', '#4a4f5a', '#6b4f3f', '#3f4652', '#5c5550'];
const Q_DOORS = ['#7a5a44', '#5a6270', '#8a6a4a', '#6a5a50', '#4f5a52'];

export const quietSpec = (seed: number): HouseSpec => ({
	wall: pick(Q_WALLS, seed, 1),
	roof: pick(Q_ROOFS, seed, 2),
	door: pick(Q_DOORS, seed, 3),
	shutters: '#ffffff',
	seed: seed + 200,
	chimney: hash(seed, 5) > 0.4,
	wide: hash(seed, 6) > 0.6,
});

export type TimeOfDay = 'sunset' | 'night';

/** the street surface: muted grass, road, sidewalks */
export const QuietGround: React.FC<{from?: number; to?: number; time?: TimeOfDay}> = ({from = 70, to = -190, time = 'sunset'}) => {
	const len = from - to;
	const cz = (from + to) / 2;
	const grass = plastic('#ffffff', {rough: 0.95, map: noiseTex(time === 'sunset' ? '#8daa5a' : '#3d5a3a', 0.1, 3, [14, len / 8])});
	const road = plastic('#ffffff', {rough: 0.85, map: asphaltTex([3, len / 6])});
	const walk = plastic(time === 'sunset' ? '#ddd6ca' : '#8f8f9c', {rough: 0.85});
	return (
		<group>
			<mesh geometry={plane(220, len)} material={grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, cz]} receiveShadow />
			<mesh geometry={plane(11, len)} material={road} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, cz]} receiveShadow />
			{[-1, 1].map((sd) => (
				<group key={sd}>
					<mesh geometry={box(3.4, 0.3, len)} material={walk} position={[sd * 7.2, 0.15, cz]} receiveShadow />
					<mesh geometry={box(0.3, 0.32, len)} material={plastic('#c8c2b8')} position={[sd * 5.55, 0.16, cz]} receiveShadow />
				</group>
			))}
		</group>
	);
};

/** sunset sky dressing: low warm sun and a few soft clouds (sun direction follows the look) */
export const SunsetSky: React.FC<{sunDir: V3; clouds?: boolean}> = ({sunDir, clouds = true}) => {
	const d = new THREE.Vector3(...sunDir).normalize();
	const sp: V3 = [d.x * 360, Math.max(14, d.y * 360), d.z * 360];
	const yaw = Math.atan2(-d.x, -d.z);
	return (
		<group>
			<group position={sp} rotation={[0, yaw, 0]}>
				<SkyDisc position={[0, 0, 0]} size={13} color="#fff1c6" halo="#ffb35c" intensity={2.4} />
			</group>
			{clouds
				? [0, 1, 2, 3, 4].map((i) => {
						const a = Math.atan2(d.x, d.z) + (i - 2) * 0.35 + 0.1;
						const r = 250 + i * 18;
						return <Cloud key={i} position={[Math.sin(a) * r, 46 + (i % 3) * 16, Math.cos(a) * r]} scale={9 + (i % 2) * 3} seed={i + 3} color={i % 2 ? '#ffd2b0' : '#ffc0a0'} />;
					})
				: null}
		</group>
	);
};

export const NightSky: React.FC = () => (
	<group>
		<Stars count={420} radius={380} seed={7} />
		<group position={[-120, 150, -300]}>
			<SkyDisc position={[0, 0, 0]} size={10} color="#fff6dd" halo="#9fb4ff" intensity={1.6} />
		</group>
	</group>
);

/** decorations for the very last scene (everyone has a birthday now) */
const Decorations: React.FC<{zFrom: number; zTo: number; frame: number}> = ({zFrom, zTo, frame}) => {
	const items: React.ReactNode[] = [];
	let k = 0;
	for (let z = zFrom; z > zTo; z -= 15) {
		items.push(<Bunting key={'b' + z} a={[-6.3, 7.2, z - 4]} b={[6.3, 7.2, z - 11]} sag={1.3} n={18} />);
		for (const sd of [-1, 1]) {
			const cols = ['#ff6b8a', '#ffc93c', '#4cc3ff', '#7ad36b', '#b38cff'];
			for (let j = 0; j < 3; j++) {
				items.push(
					<group key={`bal${z}${sd}${j}`} position={[sd * 9.6, 0, z + 1.2 + j * 0.9]}>
						<Balloon color={cols[(k + j) % cols.length]} frame={frame} seed={k * 3 + j} string={2.6 + j * 0.4} />
					</group>,
				);
			}
			k++;
		}
	}
	return <group>{items}</group>;
};

/** the whole street of plain houses, both sides facing the road */
export const QuietStreet: React.FC<{time?: TimeOfDay; zFrom?: number; zTo?: number; skip?: number[]; decorated?: boolean; frame?: number; doorOpen?: (i: number) => number; trees?: boolean}> = ({
	time = 'sunset',
	zFrom = 40,
	zTo = -130,
	skip = [],
	decorated = false,
	frame = 0,
	doorOpen,
	trees = true,
}) => {
	const items: React.ReactNode[] = [];
	let i = 0;
	const lit = time === 'night' ? 'night' : 'night'; // windows glow warm at sunset too
	for (let z = zFrom; z > zTo; z -= 15) {
		for (const sd of [-1, 1]) {
			const idx = i++;
			if (skip.includes(idx)) continue;
			items.push(
				<House key={'h' + idx} spec={quietSpec(idx + 5)} position={[sd * 19, 0, z]} rotation={sd < 0 ? Math.PI / 2 : -Math.PI / 2} lit={lit} bucket={false} doorOpen={doorOpen ? doorOpen(idx) : 0} detail={Math.abs(z) > 70 ? 'low' : 'high'} />,
			);
			if (trees && hash(idx, 13) > 0.4) items.push(<RoundTree key={'t' + idx} position={[sd * 11.5, 0, z - 7.5]} seed={idx} scale={0.9 + hash(idx, 14) * 0.3} leaf={time === 'sunset' ? '#7c9a48' : '#35553a'} trunk="#6e4a30" />);
		}
		items.push(<LampPost key={'l' + z} position={[-6.3, 0, z - 4]} lit={time === 'night' ? 'night' : 'day'} />);
		items.push(<LampPost key={'r' + z} position={[6.3, 0, z - 11]} lit={time === 'night' ? 'night' : 'day'} />);
	}
	return (
		<group>
			<QuietGround from={zFrom + 30} to={zTo - 60} time={time} />
			{items}
			{decorated ? <Decorations zFrom={zFrom} zTo={zTo} frame={frame} /> : null}
		</group>
	);
};

/** front-door key of house i in QuietStreet (world position of its front step and the yaw it faces) */
export function quietHouseDoor(idx: number, zFrom = 40): {p: V3; yaw: number} {
	const row = Math.floor(idx / 2);
	const sd = idx % 2 === 0 ? -1 : 1;
	const z = zFrom - row * 15;
	// house at x = sd*19 rotated to face the road; its front (local +z) points toward x = 0
	return {p: [sd * (19 - 4 - 1.9), 0, z], yaw: sd < 0 ? Math.PI / 2 : -Math.PI / 2};
}

// ------------------------------------------------------------------ the old bakery (outside)
const bakerySignTex = () =>
	canvasTex('bakerySign', 1024, 256, (ctx, w, h) => {
		const r = mulberry32(3);
		ctx.fillStyle = '#7c5a3c';
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 30; i++) {
			ctx.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.08})`;
			ctx.fillRect(0, r() * h, w, 2 + r() * 4);
		}
		ctx.fillStyle = '#e8d6b0';
		ctx.font = `800 170px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('BAKERY', w / 2, h / 2 + 8);
		// peeling paint
		ctx.globalCompositeOperation = 'destination-out';
		for (let i = 0; i < 160; i++) {
			ctx.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`;
			ctx.fillRect(r() * w, r() * h, 4 + r() * 14, 3 + r() * 8);
		}
		ctx.globalCompositeOperation = 'source-over';
	});

const Boards: React.FC<{w: number; h: number; seed?: number; gap?: boolean}> = ({w, h, seed = 1, gap = false}) => {
	const r = mulberry32(seed);
	const m = plastic('#ffffff', {map: woodTex('#8a6a4a', [1, 1], 3, seed), rough: 0.85});
	const boards = gap ? 2 : 4;
	return (
		<group>
			{Array.from({length: boards}).map((_, i) => {
				const y = -h / 2 + (i + 0.5) * (h / boards) + (gap && i === 1 ? h * 0.18 : 0);
				return <mesh key={i} geometry={rbox(w + 0.6, 0.55, 0.12, 0.03)} material={m} position={[0, y, 0.12 + i * 0.01]} rotation={[0, 0, (r() - 0.5) * 0.18]} castShadow />;
			})}
			{gap ? null : <mesh geometry={rbox(Math.hypot(w, h) * 0.9, 0.5, 0.12, 0.03)} material={m} position={[0, 0, 0.2]} rotation={[0, 0, Math.atan2(h, w) * 0.9]} castShadow />}
			{Array.from({length: boards * 2}).map((_, i) => (
				<mesh key={'n' + i} geometry={sphere(0.05, 6, 4)} material={plastic('#5a5a5a', {metal: 0.6})} position={[(i % 2 ? 1 : -1) * (w / 2), -h / 2 + (Math.floor(i / 2) + 0.5) * (h / boards), 0.22]} />
			))}
		</group>
	);
};

export const Web: React.FC<{position: V3; rotation?: V3; size?: number; seed?: number; opacity?: number}> = ({position, rotation, size = 3, seed = 13, opacity = 1}) => {
	const mat = useMemo(() => new THREE.MeshBasicMaterial({map: webTex(seed), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.1, 1.15)}), [seed, opacity]);
	return <mesh geometry={plane(size, size)} material={mat} position={position} rotation={rotation} renderOrder={6} />;
};

/** where the bakery stands (front centre), at the end of the street */
export const BAKERY_POS: V3 = [0, 0, -152];
export const BAKERY = {W: 16, D: 10, H: 12};
/** the broken low window on the bakery front (bakery space) */
export const BROKEN_WIN: V3 = [5.2, 1.9, BAKERY.D / 2];

export const BakeryOutside: React.FC = () => {
	const {W, D, H} = BAKERY;
	const wall = plastic('#ffffff', {map: noiseTex('#9a8f7c', 0.12, 19, [3, 3], 420), rough: 0.9});
	const trim = plastic('#6f675c', {rough: 0.8});
	const glassDark = plastic('#2a2724', {rough: 0.4});
	return (
		<group position={BAKERY_POS}>
			<mesh geometry={box(W, H, D)} material={wall} position={[0, H / 2, 0]} castShadow receiveShadow />
			<mesh geometry={box(W + 0.8, 0.9, D + 0.8)} material={trim} position={[0, H + 0.45, 0]} castShadow />
			<mesh geometry={box(W + 0.3, 0.6, D + 0.3)} material={plastic('#7a7468', {rough: 0.9})} position={[0, 0.3, 0]} receiveShadow />
			{/* shop window left (boarded) */}
			<group position={[-4.2, 3.2, D / 2]}>
				<mesh geometry={rbox(5.6, 4, 0.3, 0.06)} material={trim} castShadow />
				<mesh geometry={plane(5, 3.4)} material={glassDark} position={[0, 0, 0.16]} />
				<Boards w={5} h={3.4} seed={3} />
			</group>
			{/* door (boarded) */}
			<group position={[1.2, 2.5, D / 2]}>
				<mesh geometry={rbox(2.8, 5, 0.3, 0.06)} material={trim} castShadow />
				<mesh geometry={plane(2.2, 4.5)} material={plastic('#4a3a2c', {rough: 0.9})} position={[0, 0, 0.16]} />
				<Boards w={2.2} h={4.2} seed={7} />
			</group>
			{/* low broken window on the right: two boards hang loose, a gap to squeeze through */}
			<group position={BROKEN_WIN}>
				<mesh geometry={rbox(3.4, 2.6, 0.3, 0.06)} material={trim} castShadow />
				<mesh geometry={plane(2.8, 2.0)} material={plastic('#0d0b0a', {rough: 1})} position={[0, 0, 0.16]} />
				<group position={[0, 0.75, 0]}>
					<mesh geometry={rbox(3.3, 0.5, 0.12, 0.03)} material={plastic('#ffffff', {map: woodTex('#8a6a4a', [1, 1], 3, 9), rough: 0.85})} position={[0, 0, 0.2]} rotation={[0, 0, -0.08]} castShadow />
				</group>
				<mesh geometry={rbox(2.2, 0.45, 0.12, 0.03)} material={plastic('#ffffff', {map: woodTex('#7a5a3a', [1, 1], 3, 4), rough: 0.85})} position={[-0.9, -0.7, 0.25]} rotation={[0, 0, 0.9]} castShadow />
				{/* glass shards in the corners */}
				{[[-1.25, 0.8, 0.4], [1.2, -0.85, -0.5], [1.25, 0.75, 2.4]].map(([x, y, a], i) => (
					<mesh key={i} geometry={cone(0.32, 0.7, 3)} material={plastic('#bcd4dc', {rough: 0.1, transparent: true, opacity: 0.55})} position={[x, y, 0.18]} rotation={[0, 0, a]} scale={[1, 1, 0.1]} />
				))}
			</group>
			{/* torn faded awning */}
			<group position={[-1.5, 5.9, D / 2 + 1.0]}>
				{Array.from({length: 10}).map((_, i) => (
					<mesh key={i} geometry={box(1.0, 0.1, 2.0 - (i % 3 === 1 ? 0.7 : 0))} material={plastic(i % 2 ? '#cfc4b0' : '#9a5a50', {rough: 0.9})} position={[-4.5 + i * 1.0, -(i % 4 === 2 ? 0.25 : 0), (i % 3 === 1 ? -0.35 : 0)]} rotation={[0.35 + (i % 4 === 2 ? 0.3 : 0), 0, 0]} castShadow />
				))}
			</group>
			{/* crooked BAKERY sign, hanging from one chain */}
			<group position={[0, 8.6, D / 2 + 0.5]} rotation={[0, 0, -0.16]}>
				<mesh geometry={rbox(9.4, 2.3, 0.3, 0.08)} material={trim} castShadow />
				<mesh geometry={plane(9, 2)} material={plastic('#ffffff', {map: bakerySignTex(), rough: 0.85})} position={[0, 0, 0.16]} />
			</group>
			<mesh geometry={cyl(0.04, 0.04, 1.2, 4)} material={plastic('#5a5a5a', {metal: 0.6})} position={[-4.4, 10.1, D / 2 + 0.5]} />
			{/* upper windows, dark */}
			{[-4, 4].map((x) => (
				<group key={x} position={[x, 9.6, D / 2]}>
					<mesh geometry={rbox(2.6, 2.2, 0.3, 0.06)} material={trim} />
					<mesh geometry={plane(2.1, 1.7)} material={glassDark} position={[0, 0, 0.16]} />
				</group>
			))}
			<Web position={[-6.6, 5.5, D / 2 + 0.2]} rotation={[0, 0, Math.PI]} size={2.4} seed={21} />
			<Web position={[2.6, 4.95, D / 2 + 0.35]} rotation={[0, 0, -Math.PI / 2]} size={1.6} seed={5} />
			{/* weeds */}
			{Array.from({length: 14}).map((_, i) => (
				<mesh key={'w' + i} geometry={cone(0.18, 0.9 + hash(i, 3) * 0.6, 4)} material={plastic('#6f8a3c', {rough: 0.9})} position={[-7.5 + i * 1.15, 0.45, D / 2 + 0.6 + hash(i, 4) * 0.4]} rotation={[0, 0, (hash(i, 5) - 0.5) * 0.6]} />
			))}
		</group>
	);
};
