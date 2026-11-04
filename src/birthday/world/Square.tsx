// The town square at night: plain buildings around, poles with string lights that switch on one by one,
// the hand-made banner, tables with cloths, the cake table in the middle, and the whole town.
import React from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, plane, glowMat, sphere} from '../../lib/materials';
import {stoneTex, noiseTex} from '../../lib/textures';
import {hash, pick} from '../../lib/random';
import {V3, clamp} from '../../lib/anim';
import {Window} from '../../world/Town';
import {RoundTree} from '../../world/Nature';
import {PartyLights, Banner, Table} from '../props/Things';
import {Plate} from '../props/Cake';
import {CharSpec} from '../../characters/Character';
import {townsperson, hatColor} from '../cast';
import {MOM} from '../cast';

export const R_SQ = 34;
export const TABLE_H = 2.3;
/** the low cake table in the middle */
export const CAKE_TABLE_H = 1.7;
export const CAKE_SCALE = 0.85;
/** cake origin (top of the cake board) */
export const CAKE_AT: V3 = [0, CAKE_TABLE_H + 0.12, 0];
/** where Grandpa stops in front of the cake (and faces -z) */
export const GP_SPOT: V3 = [0.5, 0, 3.7];
export const ME_SPOT: V3 = [-2.1, 0, 4.3];

const FACADE_COLS = ['#d9cbb5', '#c9cfd4', '#d8c3a5', '#cdd5c0', '#e3d0c0', '#bfc7cf'];
const Facade: React.FC<{seed: number}> = ({seed}) => {
	const W = 12;
	const H = 10 + hash(seed, 1) * 4;
	const wall = plastic(pick(FACADE_COLS, seed, 2), {rough: 0.8});
	return (
		<group>
			<mesh geometry={box(W, H, 8)} material={wall} position={[0, H / 2, -4]} castShadow receiveShadow />
			<mesh geometry={box(W + 0.6, 0.7, 8.6)} material={plastic('#5a4a44', {rough: 0.7})} position={[0, H + 0.35, -4]} />
			{[-3, 3].map((x) =>
				[3.2, 7.6].map((y) => <Window key={x + ',' + y} p={[x, y, 0.05]} lit="night" seed={seed * 13 + x + y} shutters="#ffffff" />),
			)}
		</group>
	);
};

/** pole tops the string lights hang from */
const POLES: V3[] = Array.from({length: 8}).map((_, i) => {
	const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
	return [Math.sin(a) * 17, 8.6, Math.cos(a) * 17] as V3;
});
/** strings: [pole a, pole b, wave order (0 = first to light)] */
const STRINGS: [number, number, number][] = [
	[0, 7, 0], [0, 1, 1], [7, 6, 1], [0, 4, 2], [7, 3, 2], [1, 5, 3], [6, 2, 3], [1, 2, 4], [6, 5, 4], [2, 3, 5], [5, 4, 5], [3, 4, 6],
];

/** square lights: k(g) for string s; lightsOn = global frame the first bulb lights */
export const stringOnAt = (lightsOn: number, s: number, bulb: number) => lightsOn + STRINGS[s][2] * 5 + bulb * 0.9;

export const TownSquareNight: React.FC<{frame: number; lightsOn?: number; banner?: boolean}> = ({frame, lightsOn = -9999, banner = true}) => {
	const paving = plastic('#ffffff', {map: stoneTex('#bfb6a6', [10, 10], 23, 8), rough: 0.85});
	const grass = plastic('#ffffff', {map: noiseTex('#36503a', 0.1, 3, [20, 20]), rough: 0.9});
	const k = clamp((frame - lightsOn) / 40);
	return (
		<group>
			<mesh geometry={plane(320, 320)} material={grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow />
			<mesh geometry={cyl(R_SQ, R_SQ, 0.1, 64)} material={paving} position={[0, 0.0, 0]} receiveShadow />
			{/* street coming in from +z */}
			<mesh geometry={plane(11, 120)} material={plastic('#4a4e58', {rough: 0.85})} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, R_SQ + 55]} receiveShadow />
			{Array.from({length: 9}).map((_, i) => {
				const a = (i / 10) * Math.PI * 2 + Math.PI + Math.PI / 10 + 0.15;
				const r = R_SQ + 6;
				return (
					<group key={i} position={[Math.sin(a) * r, 0, Math.cos(a) * r]} rotation={[0, a + Math.PI, 0]}>
						<Facade seed={i + 3} />
					</group>
				);
			})}
			{/* poles */}
			{POLES.map((p, i) => (
				<group key={i} position={[p[0], 0, p[2]]}>
					<mesh geometry={cyl(0.16, 0.22, 8.8, 10)} material={plastic('#4a3a2c', {rough: 0.7})} position={[0, 4.4, 0]} castShadow />
					<mesh geometry={cyl(0.4, 0.5, 0.4, 10)} material={plastic('#3a3a3e', {rough: 0.6})} position={[0, 0.2, 0]} />
				</group>
			))}
			{STRINGS.map(([a, b], s) => (
				<PartyLights key={s} a={POLES[a]} b={POLES[b]} sag={a + 4 === b || b + 4 === a ? 2.6 : 1.4} n={a + 4 === b || b + 4 === a ? 30 : 16} frame={frame} onAt={(i) => stringOnAt(lightsOn, s, i)} seed={s} />
			))}
			{/* warm light from the bulbs (a few point lights that fade up with the wave) */}
			{k > 0
				? ([
						[0, 7.2, 8],
						[-9, 7.4, 0],
						[9, 7.4, 0],
						[0, 6.8, -9],
						[0, 6.2, 0],
					] as V3[]).map((p, i) => <pointLight key={i} position={p} color="#ffcf8a" intensity={17 * clamp(k * 1.6 - i * 0.12)} distance={24} decay={1.4} />)
				: null}
			{banner ? (
				<group position={[0, 0, -15]}>
					{[-7.4, 7.4].map((x) => (
						<mesh key={x} geometry={cyl(0.18, 0.22, 11.5, 10)} material={plastic('#4a3a2c', {rough: 0.7})} position={[x, 5.75, 0]} castShadow />
					))}
					<group position={[0, 8.0, 0]}>
						<Banner text="HAPPY BIRTHDAY|GRANDPA" w={13.6} h={5.5} sag={0.5} />
					</group>
				</group>
			) : null}
			{/* side tables with cloths */}
			{[
				[-13, -3, 0.6],
				[13, -3, -0.6],
				[-12, 8, 0.9],
				[12, 8, -0.9],
			].map(([x, z, r], i) => (
				<group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
					<Table w={6} d={2.6} h={TABLE_H} cloth={['#f3e6d2', '#e9d2d2', '#d8e2ea', '#efe1c0'][i]} />
					{[-2, -0.7, 0.7, 2].map((px) => (
						<group key={px} position={[px, TABLE_H + 0.05, 0.4]}>
							<Plate r={0.45} />
						</group>
					))}
					{[-1.4, 0, 1.4].map((px) => (
						<mesh key={'c' + px} geometry={cyl(0.16, 0.13, 0.4, 10)} material={plastic(['#ff9a8a', '#8ac8ff', '#ffe08a'][(i + Math.round(px)) % 3 < 0 ? 0 : (i + Math.round(px + 2)) % 3], {rough: 0.4})} position={[px, TABLE_H + 0.24, -0.5]} />
					))}
				</group>
			))}
			{/* the cake table */}
			<Table w={4.4} d={3.6} h={CAKE_TABLE_H} cloth="#fbf7ef" />
			<mesh geometry={cyl(1.75, 1.75, 0.1, 40)} material={plastic('#d9dde2', {metal: 0.7, rough: 0.3})} position={[0, CAKE_TABLE_H + 0.07, 0]} receiveShadow />
			{Array.from({length: 5}).map((_, i) => {
				const a = (i / 5) * Math.PI * 2 + 0.4;
				return <RoundTree key={'t' + i} position={[Math.sin(a) * (R_SQ - 5), 0, Math.cos(a) * (R_SQ - 5) - (Math.cos(a) > 0.8 ? 99 : 0)]} seed={i + 50} scale={0.9} leaf="#35553a" trunk="#5a3a24" />;
			})}
		</group>
	);
};

// ------------------------------------------------------------------ the whole town, waiting
export type Guest = {spec: CharSpec; pos: V3; yaw: number; hat: string; kid: boolean; low: boolean; seed: number};
function makeCrowd(): Guest[] {
	const out: Guest[] = [];
	let s = 0;
	const add = (x: number, z: number, kid = false, spec?: CharSpec) => {
		const seed = s++;
		const sp = spec ?? townsperson(seed * 7 + 3, {kid, elder: !kid && hash(seed, 9) > 0.85});
		const yaw = Math.atan2(GP_SPOT[0] - x, GP_SPOT[2] - z) + (hash(seed, 4) - 0.5) * 0.3;
		const d = Math.hypot(x - GP_SPOT[0], z - GP_SPOT[2]);
		out.push({spec: sp, pos: [x, 0, z], yaw, hat: hatColor(seed), kid, low: d > 14, seed});
	};
	// first row: right behind the cake table, kids in front
	add(-3.6, -3.4, true);
	add(-1.2, -3.0, true);
	add(1.3, -3.1, true);
	add(3.7, -3.5, true);
	// second row
	[-6, -3.6, -1.2, 1.2, 3.6, 6].forEach((x, i) => add(x + (i % 2) * 0.3, -6.2 - (i % 2) * 0.5));
	// third row
	[-7.4, -4.8, -2.4, 0, 2.4, 4.8, 7.4].forEach((x, i) => add(x, -9.4 - (i % 2) * 0.4));
	// sides
	[-1, 1].forEach((sd) => {
		add(sd * 6.4, -1.4);
		add(sd * 7.6, 1.6);
		add(sd * 9.2, -3.6);
		add(sd * 10.2, -0.4, true);
		add(sd * 8.8, 4.4);
	});
	// Mom near the front left
	add(-4.6, 2.4, false, MOM);
	return out;
}
export const CROWD = makeCrowd();
export const MOM_GUEST = CROWD[CROWD.length - 1];
