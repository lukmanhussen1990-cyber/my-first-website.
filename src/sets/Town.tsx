import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3} from '../lib/anim';
import {boxGeo, coneGeo, cylGeo, plastic, rboxGeo, sphGeo} from '../three/cache';
import {Box, Cyl, Glow, RBox, TextPlane} from '../three/prims';
import {noiseTex} from '../three/textures';
import {Bench, Bush, Clock, Flowers, House, Shop, StreetLamp, StringLights, Tree} from './props';

export type TimeOfDay = 'day' | 'morning' | 'sunrise' | 'night';

/* ---------- Town Hall (faces +z, front steps end at z=+5) ---------- */

export const BALCONY_Y = 14.4;
export const BALCONY_Z = -4.6; // centre of the balcony floor
export const STEP_TOP_Y = 3;

export const TownHall: React.FC<{night?: boolean; clock?: [number, number]; sign?: string; banner?: React.ReactNode}> = ({night, clock = [10, 10], sign = 'TOWN HALL'}) => {
	const wall = plastic('#efdcbc', {rough: 0.55});
	const trim = plastic('#f4f1ea', {rough: 0.4});
	const roof = plastic('#4f78b0', {rough: 0.45, clearcoat: 0.2});
	const stone = plastic('#d9d6de', {rough: 0.6});
	const gold = plastic('#ffcc3a', {metal: 0.8, rough: 0.3});
	const winM = plastic(night ? '#ffe2a0' : '#a9d8ff', {rough: 0.08, emissive: night ? '#ffbf60' : '#20405a', ei: night ? 2.2 : 0.15});
	const pyramid = useMemo(() => {
		const g = new THREE.ConeGeometry(6.2, 5, 4, 1);
		g.rotateY(Math.PI / 4);
		return g;
	}, []);
	const win = (x: number, y: number, z: number, key: string) => (
		<group key={key} position={[x, y, z]}>
			<Box s={[2.2, 3.2, 0.2]} mat={winM} cast={false} />
			<Box s={[2.6, 0.3, 0.5]} mat={trim} position={[0, -1.75, 0.15]} />
			<Box s={[2.6, 0.4, 0.4]} mat={trim} position={[0, 1.8, 0.1]} />
			<Box s={[0.12, 3.2, 0.25]} mat={trim} position={[0, 0, 0.05]} cast={false} />
		</group>
	);
	return (
		<group>
			{/* plinth */}
			<mesh geometry={boxGeo(37, 3, 22)} material={stone} position={[0, 1.5, -18.5]} castShadow receiveShadow />
			{/* main block */}
			<mesh geometry={boxGeo(34, 18, 20)} material={wall} position={[0, 12, -18]} castShadow receiveShadow />
			<mesh geometry={boxGeo(35.5, 1.2, 21.5)} material={trim} position={[0, 21.3, -18]} castShadow />
			<mesh geometry={boxGeo(35, 0.6, 21)} material={roof} position={[0, 22.1, -18]} />
			<mesh geometry={boxGeo(34.4, 0.6, 0.6)} material={trim} position={[0, 12.6, -7.8]} />
			{/* windows (avoid the portico) */}
			{[-14, -10.5, 10.5, 14].map((x) => [win(x, 7.2, -7.95, `a${x}`), win(x, 17, -7.95, `b${x}`)])}
			{[-5.5, 5.5].map((x) => win(x, 17.6, -7.95, `c${x}`))}
			{/* side windows */}
			{[-1, 1].map((s) => [-12, -18, -24].map((z) => (
				<group key={`s${s}${z}`} rotation={[0, (s * Math.PI) / 2, 0]} position={[s * 17.05, 0, z]}>
					<Box s={[2.2, 3.2, 0.1]} mat={winM} position={[0, 7.2, 0]} cast={false} />
					<Box s={[2.2, 3.2, 0.1]} mat={winM} position={[0, 17, 0]} cast={false} />
				</group>
			)))}
			{/* main door */}
			<RBox s={[4.4, 6.6, 0.4]} r={0.1} color="#7a4426" position={[0, 6.3, -7.9]} />
			<Box s={[0.08, 6.4, 0.45]} color="#4a2410" position={[0, 6.3, -7.85]} />
			<Box s={[5.2, 0.5, 0.6]} mat={trim} position={[0, 9.9, -7.8]} />
			{/* balcony door */}
			<RBox s={[3.4, 4.6, 0.3]} r={0.1} color="#7a4426" position={[0, 16.7, -7.9]} />
			<Box s={[1.3, 3.4, 0.1]} mat={winM} position={[-0.8, 17.0, -7.72]} cast={false} />
			<Box s={[1.3, 3.4, 0.1]} mat={winM} position={[0.8, 17.0, -7.72]} cast={false} />
			{/* portico floor + steps */}
			<mesh geometry={boxGeo(22, 3, 6)} material={stone} position={[0, 1.5, -5]} castShadow receiveShadow />
			{[0, 1, 2, 3, 4].map((i) => (
				<mesh key={i} geometry={boxGeo(22 + (i + 1) * 0.8, 0.6, 1.4)} material={plastic(i % 2 ? '#e4e2ea' : '#d9d6de', {rough: 0.6})} position={[0, 2.7 - i * 0.6, -1.3 + i * 1.4]} castShadow receiveShadow />
			))}
			{[0, 1, 2, 3, 4].map((i) => (
				<mesh key={`f${i}`} geometry={boxGeo(22 + (i + 1) * 0.8, 3 - i * 0.6 - 0.6, 1.4)} material={stone} position={[0, (3 - i * 0.6 - 0.6) / 2, -1.3 + i * 1.4]} receiveShadow />
			))}
			{/* columns */}
			{[-6.6, -2.2, 2.2, 6.6].map((x) => (
				<group key={x} position={[x, 3, -2.6]}>
					<mesh geometry={boxGeo(2.2, 0.6, 2.2)} material={trim} position={[0, 0.3, 0]} castShadow />
					<mesh geometry={cylGeo(0.8, 0.9, 9.4, 20)} material={trim} position={[0, 5.3, 0]} castShadow receiveShadow />
					<mesh geometry={boxGeo(2.1, 0.5, 2.1)} material={trim} position={[0, 10.25, 0]} castShadow />
				</group>
			))}
			{/* portico roof = balcony floor */}
			<mesh geometry={boxGeo(19.5, 1.4, 7.0)} material={trim} position={[0, 13.7, -4.6]} castShadow receiveShadow />
			<TextPlane text={sign} w={13} opts={{w: 1024, h: 110, color: '#2a3a6a', weight: 800}} position={[0, 13.7, -1.08]} glow={night ? 0.9 : 0.3} />
			{/* balcony railing */}
			{Array.from({length: 23}).map((_, i) => (
				<mesh key={`r${i}`} geometry={cylGeo(0.13, 0.16, 1.5, 8)} material={trim} position={[-8.8 + i * 0.8, 15.15, -1.45]} castShadow />
			))}
			<mesh geometry={rboxGeo(19.2, 0.25, 0.5, 0.08)} material={gold} position={[0, 16.0, -1.45]} />
			{[-1, 1].map((s) => (
				<group key={`rs${s}`}>
					{Array.from({length: 7}).map((_, i) => (
						<mesh key={i} geometry={cylGeo(0.13, 0.16, 1.5, 8)} material={trim} position={[s * 9.4, 15.15, -2.2 - i * 0.85]} castShadow />
					))}
					<mesh geometry={rboxGeo(0.5, 0.25, 6.4, 0.08)} material={gold} position={[s * 9.4, 16.0, -4.7]} />
				</group>
			))}
			{/* clock tower */}
			<mesh geometry={boxGeo(8, 9, 8)} material={wall} position={[0, 26.5, -13]} castShadow receiveShadow />
			<mesh geometry={boxGeo(8.8, 0.8, 8.8)} material={trim} position={[0, 31.2, -13]} castShadow />
			<mesh geometry={pyramid} material={roof} position={[0, 34.1, -13]} castShadow />
			<mesh geometry={sphGeo(0.6, 16, 12)} material={gold} position={[0, 36.9, -13]} />
			<mesh geometry={cylGeo(0.08, 0.08, 3, 6)} material={plastic('#888')} position={[0, 38.4, -13]} />
			<mesh geometry={boxGeo(1.8, 1.1, 0.06)} material={plastic('#e8303a')} position={[0.9, 39.3, -13]} />
			<Clock hours={clock[0]} minutes={clock[1]} r={2.7} position={[0, 26.6, -8.82]} night={night} />
			{night ? <pointLight position={[0, 26.6, -5]} intensity={40} distance={14} color="#ffd9a0" /> : null}
		</group>
	);
};

/* ---------- The whole town square ---------- */

export const Ground: React.FC<{night?: boolean; size?: number}> = ({night, size = 900}) => (
	<>
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('grass2', night ? '#3f7a3a' : '#7cc95a', night ? '#2f6a2f' : '#64b247', 'grass', 120), rough: 0.95})}>
			<planeGeometry args={[size, size]} />
		</mesh>
	</>
);

export const Plaza: React.FC<{night?: boolean}> = ({night}) => (
	<>
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 19]} receiveShadow material={plastic('#ffffff', {map: noiseTex('tiles', night ? '#bfb6a6' : '#e2d2b0', '#b9a47e', 'tiles', 14), rough: 0.8})}>
			<planeGeometry args={[64, 44]} />
		</mesh>
		{/* sidewalk + road in front */}
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 43]} receiveShadow material={plastic('#d6d6dc', {rough: 0.8})}>
			<planeGeometry args={[400, 4]} />
		</mesh>
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 50]} receiveShadow material={plastic('#4a4d58', {rough: 0.85})}>
			<planeGeometry args={[400, 10]} />
		</mesh>
		{Array.from({length: 30}).map((_, i) => (
			<mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-150 + i * 10, 0.05, 50]} material={plastic('#ffd23a', {emissive: '#ffd23a', ei: 0.2})} geometry={boxGeo(4, 0.5, 0.01)} />
		))}
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 57]} receiveShadow material={plastic('#d6d6dc', {rough: 0.8})}>
			<planeGeometry args={[400, 4]} />
		</mesh>
		{/* side streets */}
		{[-1, 1].map((s) => (
			<mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[s * 43, 0.03, 0]} receiveShadow material={plastic('#4a4d58', {rough: 0.85})}>
				<planeGeometry args={[8, 100]} />
			</mesh>
		))}
	</>
);

export const Fountain: React.FC<{position: V3; t?: number}> = ({position, t = 0}) => {
	const stone = plastic('#e4e2ea', {rough: 0.5});
	const water = plastic('#5ec8ff', {rough: 0.05, emissive: '#1a6aa0', ei: 0.35, transparent: true, opacity: 0.85});
	return (
		<group position={position}>
			<mesh geometry={cylGeo(5, 5.3, 1.4, 32)} material={stone} position={[0, 0.7, 0]} castShadow receiveShadow />
			<mesh geometry={cylGeo(4.5, 4.5, 0.2, 32)} material={water} position={[0, 1.3, 0]} />
			<mesh geometry={cylGeo(0.6, 0.9, 3.4, 16)} material={stone} position={[0, 2.6, 0]} castShadow />
			<mesh geometry={cylGeo(2.0, 1.2, 0.6, 24)} material={stone} position={[0, 4.4, 0]} castShadow />
			<mesh geometry={cylGeo(1.7, 1.7, 0.12, 24)} material={water} position={[0, 4.7, 0]} />
			<mesh geometry={sphGeo(0.45 + Math.sin(t * 8) * 0.04, 12, 8)} material={water} position={[0, 5.2, 0]} />
		</group>
	);
};

export const SHOPS: {name: string; color: string; awning: [string, string]; pos: V3; yaw: number}[] = [
	{name: 'BAKERY', color: '#ffb3c7', awning: ['#e23a6a', '#ffffff'], pos: [-36, 0, 8], yaw: Math.PI / 2},
	{name: 'CAFE', color: '#9fe6cf', awning: ['#1a9a7a', '#ffffff'], pos: [-36, 0, 21], yaw: Math.PI / 2},
	{name: 'TOYS', color: '#ffe28a', awning: ['#e8781a', '#ffffff'], pos: [-36, 0, 34], yaw: Math.PI / 2},
	{name: 'BOOKS', color: '#a9c8ff', awning: ['#2a5bd7', '#ffffff'], pos: [36, 0, 8], yaw: -Math.PI / 2},
	{name: 'FLOWERS', color: '#e1c4ff', awning: ['#8a3ad7', '#ffffff'], pos: [36, 0, 21], yaw: -Math.PI / 2},
	{name: 'PET SHOP', color: '#ffc89a', awning: ['#d75a1a', '#ffffff'], pos: [36, 0, 34], yaw: -Math.PI / 2},
];

export const Town: React.FC<{time?: TimeOfDay; clock?: [number, number]; t?: number; fountain?: boolean; houses?: boolean; lampsLit?: boolean; children?: React.ReactNode; hall?: boolean; shops?: boolean}> = ({time = 'day', clock, t = 0, fountain = true, houses = true, children, hall = true, shops = true}) => {
	const night = time === 'night';
	const lit = night;
	return (
		<group>
			<Ground night={night} />
			<Plaza night={night} />
			{hall ? <TownHall night={night} clock={clock} /> : null}
			{fountain ? <Fountain position={[0, 0, 24]} t={t} /> : null}
			{shops ? SHOPS.map((s) => <Shop key={s.name} position={s.pos} yaw={s.yaw} name={s.name} color={s.color} awning={s.awning} night={night} />) : null}
			{/* trees, lamps, benches, flowers */}
			{[[-26, 0, 0], [26, 0, 0], [-26, 0, 40], [26, 0, 40], [-22, 0, -32], [22, 0, -32], [-30, 0, -20], [30, 0, -20]].map((p, i) => (
				<Tree key={i} position={p as V3} scale={1.4} night={night} />
			))}
			{[-22, 22].map((x) => [10, 22, 34].map((z) => <StreetLamp key={`${x}${z}`} position={[x, 0, z]} on={lit} light={lit && z === 22} />))}
			{lit ? (
				<>
					<StringLights a={[-22, 7.6, 10]} b={[22, 7.6, 10]} n={22} sag={1.6} t={t} />
					<StringLights a={[-22, 7.6, 22]} b={[22, 7.6, 22]} n={22} sag={1.6} t={t + 1} />
					<StringLights a={[-22, 7.6, 34]} b={[22, 7.6, 34]} n={22} sag={1.6} t={t + 2} />
				</>
			) : null}
			{[[-14, 0, 13, Math.PI / 2], [14, 0, 13, -Math.PI / 2], [-14, 0, 33, Math.PI / 2], [14, 0, 33, -Math.PI / 2]].map(([x, y, z, r], i) => (
				<Bench key={i} position={[x, y, z]} yaw={r} />
			))}
			<Flowers position={[-15, 0, 2]} w={6} seed="fa" />
			<Flowers position={[15, 0, 2]} w={6} seed="fb" />
			<Bush position={[-19, 0, -7]} scale={1.4} />
			<Bush position={[19, 0, -7]} scale={1.4} />
			{houses ? (
				<>
					{[-60, -45, -30, -15, 0, 15, 30, 45, 60].map((x, i) => (
						<House key={x} position={[x, 0, 66]} yaw={Math.PI} color={['#7ab8e8', '#ffd28a', '#9ad6a0', '#ffb3b3', '#c8b3ff'][i % 5]} roof={['#c84a3a', '#3a5ac8', '#8a4a2a'][i % 3]} night={night} seed={`h${i}`} />
					))}
					{[-70, -55, 55, 70].map((x, i) => (
						<House key={`b${x}`} position={[x, 0, -10 - i * 6]} yaw={x < 0 ? Math.PI / 2 : -Math.PI / 2} color={['#ffd28a', '#9ad6a0', '#7ab8e8', '#ffb3b3'][i % 4]} night={night} seed={`hb${i}`} />
					))}
					{[-80, -60, -40, 40, 60, 80].map((x, i) => (
						<Tree key={`ft${x}`} position={[x, 0, -45 - (i % 2) * 10]} scale={2} kind={i % 2 ? 'pine' : 'round'} night={night} />
					))}
				</>
			) : null}
			{night ? <Glow position={[0, 26.6, -8]} size={9} color="#ffd9a0" opacity={0.35} /> : null}
			{children}
		</group>
	);
};

export {Box, Cyl, RBox, coneGeo, rboxGeo};
