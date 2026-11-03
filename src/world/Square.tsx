// The town square (with a little stage in the middle) and the Bucket Man's toilet shop.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, cone, plane, glowMat, sphere, custom} from '../lib/materials';
import {stoneTex, noiseTex, textTex, woodTex} from '../lib/textures';
import {hash, pick} from '../lib/random';
import {LampPost, StringLights, Lighting, Window} from './Town';
import {RoundTree, Bush} from './Nature';
import {Sign, Counter, Shelf} from '../props/Furniture';
import {ThroneRows} from './CastleInside';
import {V3} from '../lib/anim';

const SHOPS = [
	{name: 'BAKERY', wall: '#ffb3a7', roof: '#b84848'},
	{name: 'TOYS', wall: '#9fd0ff', roof: '#353a68'},
	{name: 'CAFE', wall: '#ffe08a', roof: '#3f5d3a'},
	{name: 'BOOKS', wall: '#c9adff', roof: '#5b4a7e'},
	{name: 'FLOWERS', wall: '#a8e6a1', roof: '#7a3b52'},
	{name: 'BUCKETS', wall: '#d9dde3', roof: '#2c3648'},
	{name: 'TOWN HALL', wall: '#f5f2ea', roof: '#356b8c'},
	{name: 'ICE CREAM', wall: '#ff9fd0', roof: '#b84848'},
];

const Awning: React.FC<{w: number; color: string}> = ({w, color}) => {
	const stripes = Math.round(w / 0.8);
	return (
		<group>
			{Array.from({length: stripes}).map((_, i) => (
				<mesh key={i} geometry={box(w / stripes, 0.12, 2.0)} material={plastic(i % 2 ? '#ffffff' : color, {rough: 0.6})} position={[-w / 2 + (i + 0.5) * (w / stripes), 0, 0]} rotation={[0.35, 0, 0]} castShadow />
			))}
		</group>
	);
};

export const ShopFront: React.FC<{name: string; wall: string; roof: string; lit: Lighting; seed: number}> = ({name, wall, roof, lit, seed}) => {
	const W = 12;
	const H = 11;
	const D = 8;
	return (
		<group>
			<mesh geometry={box(W, H, D)} material={plastic(wall, {rough: 0.6})} position={[0, H / 2, 0]} castShadow receiveShadow />
			<mesh geometry={box(W + 0.6, 0.8, D + 0.6)} material={plastic(roof, {rough: 0.6})} position={[0, H + 0.4, 0]} castShadow />
			<mesh geometry={box(W + 0.2, 1.4, 0.3)} material={plastic('#ffffff')} position={[0, H - 0.2, D / 2 + 0.05]} />
			{/* big shop window + door */}
			<mesh geometry={rbox(6.2, 3.8, 0.3, 0.1)} material={plastic('#ffffff')} position={[-2.2, 2.9, D / 2]} castShadow />
			<mesh geometry={plane(5.6, 3.2)} material={lit === 'day' ? plastic('#a8dcff', {rough: 0.1}) : glowMat(lit === 'gold' ? '#ffbf2e' : '#ffd27a', 1.9)} position={[-2.2, 2.9, D / 2 + 0.17]} />
			<mesh geometry={rbox(2.4, 4.4, 0.3, 0.1)} material={plastic(pick(['#e63946', '#2a6fdb', '#1f9d8f'], seed, 2))} position={[3.4, 2.2, D / 2 + 0.05]} castShadow />
			<group position={[0, 5.4, D / 2 + 1.0]}>
				<Awning w={W - 0.4} color={roof} />
			</group>
			<Window p={[-3, 8.4, D / 2 + 0.05]} lit={lit} seed={seed * 7 + 1} shutters={'#ffffff'} />
			<Window p={[3, 8.4, D / 2 + 0.05]} lit={lit} seed={seed * 7 + 2} shutters={'#ffffff'} />
			<Sign position={[0, 6.6, D / 2 + 0.3]} text={name} w={6.4} h={1.3} bg={roof} glow={lit !== 'day'} />
		</group>
	);
};

/** triangle bunting flags along a line */
export const Bunting: React.FC<{a: V3; b: V3; sag?: number; n?: number}> = ({a, b, sag = 1.2, n = 14}) => {
	const cols = ['#ff4d6d', '#ffd23f', '#3ad1ff', '#7cff6b', '#c77dff', '#ff9e3d'];
	return (
		<group>
			{Array.from({length: n}).map((_, i) => {
				const t = (i + 0.5) / n;
				const x = a[0] + (b[0] - a[0]) * t;
				const y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag;
				const z = a[2] + (b[2] - a[2]) * t;
				const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2;
				return <mesh key={i} geometry={cone(0.45, 0.9, 3)} material={plastic(cols[i % cols.length], {rough: 0.6, side: THREE.DoubleSide})} position={[x, y - 0.45, z]} rotation={[Math.PI, yaw, 0]} scale={[1, 1, 0.12]} />;
			})}
		</group>
	);
};

export const STAGE_TOP = 1.2;
export const TownSquare: React.FC<{lit?: Lighting; stage?: boolean}> = ({lit = 'night', stage = true}) => {
	const paving = plastic('#ffffff', {map: stoneTex('#e3d3b0', [10, 10], 23, 8), rough: 0.85});
	const grass = plastic('#ffffff', {map: noiseTex(lit === 'day' ? '#79cf5f' : '#4f8a4a', 0.1, 3, [20, 20]), rough: 0.9});
	const R = 30;
	return (
		<group>
			<mesh geometry={plane(260, 260)} material={grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
			<mesh geometry={cyl(R, R, 0.1, 64)} material={paving} position={[0, 0.0, 0]} receiveShadow />
			{stage ? (
				<group>
					<mesh geometry={cyl(4.6, 4.9, STAGE_TOP, 40)} material={plastic('#c9a46a', {rough: 0.7})} position={[0, STAGE_TOP / 2, 0]} castShadow receiveShadow />
					<mesh geometry={cyl(4.7, 4.7, 0.12, 40)} material={plastic('#e63946', {rough: 0.6})} position={[0, STAGE_TOP + 0.04, 0]} receiveShadow />
				</group>
			) : null}
			{SHOPS.map((s, i) => {
				const a = (i / SHOPS.length) * Math.PI * 2 + 0.2;
				const r = R + 5;
				return (
					<group key={i} position={[Math.sin(a) * r, 0, Math.cos(a) * r]} rotation={[0, a + Math.PI, 0]}>
						<ShopFront name={s.name} wall={s.wall} roof={s.roof} lit={lit} seed={i + 1} />
					</group>
				);
			})}
			{Array.from({length: 8}).map((_, i) => {
				const a = ((i + 0.5) / 8) * Math.PI * 2 + 0.2;
				return <LampPost key={'lp' + i} position={[Math.sin(a) * (R - 3), 0, Math.cos(a) * (R - 3)]} lit={lit} />;
			})}
			{/* string lights from the lamp posts to a tall centre-back pole */}
			{Array.from({length: 8}).map((_, i) => {
				const a = ((i + 0.5) / 8) * Math.PI * 2 + 0.2;
				const b = ((i + 1.5) / 8) * Math.PI * 2 + 0.2;
				return <StringLights key={'sl' + i} a={[Math.sin(a) * (R - 3), 7.6, Math.cos(a) * (R - 3)]} b={[Math.sin(b) * (R - 3), 7.6, Math.cos(b) * (R - 3)]} sag={1.6} n={22} lit={lit} seed={i} />;
			})}
			{Array.from({length: 4}).map((_, i) => {
				const a = (i / 4) * Math.PI * 2 + 0.6;
				const b = a + Math.PI * 0.75;
				return <Bunting key={'bt' + i} a={[Math.sin(a) * (R + 1), 17, Math.cos(a) * (R + 1)]} b={[Math.sin(b) * (R + 1), 17, Math.cos(b) * (R + 1)]} sag={1.6} n={24} />;
			})}
			{Array.from({length: 6}).map((_, i) => {
				const a = (i / 6) * Math.PI * 2 + 0.45;
				return <RoundTree key={'t' + i} position={[Math.sin(a) * (R - 7), 0, Math.cos(a) * (R - 7)]} seed={i + 50} scale={0.85} />;
			})}
		</group>
	);
};

/** the toilet shop interior */
export const ToiletShop: React.FC = () => {
	const floor = plastic('#ffffff', {map: woodTex('#d9a066', [4, 4], 8, 3), rough: 0.55});
	const wall = plastic('#bfe8ff', {rough: 0.8});
	const transforms = useMemo(() => {
		const out: {p: V3; r: number; s?: number}[] = [];
		// floor display rows
		for (let row = 0; row < 3; row++) for (const x of [-9.8, -5.6, 5.6, 9.8]) out.push({p: [x, 0, 6 - row * 4.6], r: x < 0 ? 0.35 : -0.35, s: 0.9});
		// on the shelves
		for (let lvl = 0; lvl < 2; lvl++) for (let i = 0; i < 6; i++) out.push({p: [-13.5, 0.45 + lvl * 3.4, -9 + i * 3.4], r: Math.PI / 2, s: 0.55});
		for (let lvl = 0; lvl < 2; lvl++) for (let i = 0; i < 6; i++) out.push({p: [13.5, 0.45 + lvl * 3.4, -9 + i * 3.4], r: -Math.PI / 2, s: 0.55});
		return out;
	}, []);
	const signTex = textTex('toilet-shop', 2048, 512, '#e63946', [{text: 'TOILET SHOP', size: 300, y: 270, color: '#ffffff', weight: 900}], {radius: 80, border: '#ffd23f', borderW: 40});
	return (
		<group>
			<mesh geometry={plane(32, 34)} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow />
			<mesh geometry={box(32, 14, 0.4)} material={wall} position={[0, 7, -16]} receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={box(0.4, 14, 34)} material={wall} position={[sd * 16, 7, -2]} receiveShadow />
			))}
			<mesh geometry={box(33, 0.4, 35)} material={plastic('#ffffff')} position={[0, 14, -2]} />
			{[-8, 0, 8].map((x) => [-10, -2, 6].map((z) => <mesh key={`${x}${z}`} geometry={box(4, 0.1, 1.6)} material={glowMat('#fffaf0', 1.4)} position={[x, 13.7, z]} />))}
			{/* big sign on the back wall */}
			<mesh geometry={rbox(16.4, 4.4, 0.4, 0.3)} material={plastic('#ffd23f')} position={[0, 10.2, -15.7]} castShadow />
			<mesh geometry={plane(16, 4)} material={new THREE.MeshBasicMaterial({map: signTex, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25)})} position={[0, 10.2, -15.45]} />
			{/* shelves along the side walls */}
			<Shelf position={[-13.5, 0, -0.5]} w={22} levels={2} rotation={Math.PI / 2} />
			<Shelf position={[13.5, 0, -0.5]} w={22} levels={2} rotation={-Math.PI / 2} />
			<ThroneRows transforms={transforms} />
			<Counter position={[0, 0, -11]} w={10} />
			{/* the old buckets, retired, in a corner */}
			<pointLight position={[0, 9, 2]} intensity={40} distance={30} color="#fff2d6" decay={1.4} />
		</group>
	);
};
