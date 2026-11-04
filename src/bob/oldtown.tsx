// The same town long ago, full of colour: different clothes, hats, hairstyles and shop names.
// Each person can be drained to grey (k = 1 means they look like a Bob).
import React from 'react';
import * as THREE from 'three';
import {Stage, LOOKS, Look} from '../lib/Stage';
import {Character, CharSpec, HairKind, OutfitKind} from '../characters/Character';
import {Expression} from '../characters/faceTexture';
import * as P from '../characters/poses';
import {plastic, rbox, cyl, sphere, torus} from '../lib/materials';
import {V3} from '../lib/anim';
import {hash, pick} from '../lib/random';
import {BobHouse, Shop, Tree, mix, GREY} from './world';
import {BOB_HAIR, BOB_PANTS, BOB_SHIRT, BOB_SHOES} from './cast';
import {LampPost} from '../world/Town';
import {noiseTex, asphaltTex} from '../lib/textures';
import {plane, box} from '../lib/materials';

export const OLD_LOOK: Look = {...LOOKS.day, sunDir: [-0.5, 0.7, 0.5], sun: 2.6, hemi: 1.15, skyTop: '#4e9be8', skyMid: '#a6d4ff', skyBottom: '#fff0d0'};

// ------------------------------------------------------------------ old hats (base head space)
export type OldHat = 'top' | 'bowler' | 'sun' | 'beret' | 'tall' | null;
export const HatMesh: React.FC<{kind: OldHat; color: string; band?: string; y?: number}> = ({kind, color, band = '#ffffff', y = 0.72}) => {
	const m = plastic(color, {rough: 0.55});
	const b = plastic(band, {rough: 0.5});
	if (!kind) return null;
	if (kind === 'top' || kind === 'tall')
		return (
			<group position={[0, y, 0]} rotation={[-0.05, 0, kind === 'tall' ? 0.12 : 0.05]}>
				<mesh geometry={cyl(1.0, 1.0, 0.08, 32)} material={m} castShadow />
				<mesh geometry={cyl(0.58, 0.6, kind === 'tall' ? 2.2 : 1.2, 28)} material={m} position={[0, kind === 'tall' ? 1.1 : 0.6, 0]} castShadow />
				<mesh geometry={cyl(0.61, 0.61, 0.22, 28)} material={b} position={[0, 0.18, 0]} />
				{kind === 'tall' ? <mesh geometry={sphere(0.25, 12, 10)} material={plastic('#ffe14a')} position={[0, 2.3, 0]} castShadow /> : null}
			</group>
		);
	if (kind === 'bowler')
		return (
			<group position={[0, y - 0.05, 0]}>
				<mesh geometry={cyl(0.92, 0.92, 0.07, 32)} material={m} castShadow />
				<mesh geometry={sphere(0.64, 24, 14, )} material={m} position={[0, 0.05, 0]} scale={[1, 0.85, 1]} castShadow />
				<mesh geometry={torus(0.62, 0.06, 6, 24)} material={b} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} />
			</group>
		);
	if (kind === 'sun')
		return (
			<group position={[0, y - 0.05, 0]} rotation={[-0.08, 0, 0.06]}>
				<mesh geometry={cyl(1.5, 1.5, 0.06, 36)} material={m} castShadow />
				<mesh geometry={cyl(0.62, 0.68, 0.5, 28)} material={m} position={[0, 0.25, 0]} castShadow />
				<mesh geometry={cyl(0.69, 0.69, 0.14, 28)} material={b} position={[0, 0.1, 0]} />
				<mesh geometry={sphere(0.18, 10, 8)} material={plastic('#ff5a8a')} position={[0.6, 0.2, 0.3]} />
			</group>
		);
	// beret
	return (
		<group position={[0.12, y + 0.02, 0]} rotation={[0, 0, -0.3]}>
			<mesh geometry={sphere(0.82, 24, 12)} material={m} scale={[1, 0.28, 1]} castShadow />
			<mesh geometry={cyl(0.04, 0.06, 0.18, 8)} material={m} position={[0, 0.26, 0]} />
		</group>
	);
};

// ------------------------------------------------------------------ the people of long ago
export type OldPerson = {spec: CharSpec; hat: OldHat; hatColor: string; pos: V3; yaw: number; expr: Expression};
const HAIRS: HairKind[] = ['afro', 'curly', 'ponytail', 'spiky', 'long', 'bun', 'pigtails', 'messy', 'short'];
const OUTFITS: OutfitKind[] = ['dress', 'overalls', 'shirt', 'cardigan', 'tshirt', 'hoodie'];
const TOPS = ['#ff4d5e', '#3b8cff', '#2ec27e', '#ffc93c', '#b56cff', '#ff8a2a', '#1fc7d4', '#ff6fb5', '#8ad13b'];
const HAIRC = ['#ff3d8a', '#3b8cff', '#1d1c23', '#ffd23a', '#7a3fe0', '#c84a2a', '#2ec27e', '#e8e8e8', '#ff7a1a'];
const HATS: OldHat[] = ['top', 'bowler', 'sun', 'beret', null, 'sun', 'top', 'beret', 'bowler', null, 'tall'];
const SKINS = ['#ffdcb6', '#f6c393', '#eaa97c', '#d0915f', '#b0703f', '#8d5431', '#6c3d22', '#ffd0a6'];

export function oldPerson(i: number, pos: V3, yaw: number, kid = false): OldPerson {
	const outfit = pick(OUTFITS, i, 3);
	const skin = pick(SKINS, i, 4);
	const spec: CharSpec = {
		name: 'old' + i,
		seed: 300 + i,
		scale: kid ? 0.8 : 0.95 + hash(i, 5) * 0.1,
		skin,
		headSize: kid ? 1.12 : 1,
		legH: kid ? 1.8 : 2,
		face: {lashes: outfit === 'dress' || hash(i, 6) > 0.6, freckles: hash(i, 7) > 0.7},
		hair: pick(HAIRS, i, 8),
		hairColor: pick(HAIRC, i, 9),
		outfit,
		top: pick(TOPS, i, 10),
		top2: pick(['#ffffff', '#ffe9a8', '#bfe3ff'], i, 11),
		sleeve: outfit === 'tshirt' ? 'short' : 'long',
		pants: outfit === 'dress' ? skin : pick(['#3d4a8a', '#7a3a2a', '#2d6a4f', '#5a2d82', '#c27a2a'], i, 12),
		shoes: pick(['#2a2a2a', '#7a4a2a', '#ff5a5a', '#f7f7f7'], i, 13),
		glasses: hash(i, 14) > 0.8 ? 'round' : null,
	};
	return {spec, hat: pick(HATS, i, 15), hatColor: pick(['#2a2a33', '#8e44ad', '#e67e22', '#c0392b', '#16a085', '#f1c40f'], i, 16), pos, yaw, expr: pick(['happy', 'bigSmile', 'laugh', 'proud'] as Expression[], i, 17)};
}

/** the person drained to grey (k = 1: a Bob) */
export function greyed(p: OldPerson, k: number): CharSpec {
	if (k <= 0) return p.spec;
	const s = p.spec;
	return {
		...s,
		name: s.name + '|' + Math.round(k * 10),
		top: mix(s.top, BOB_SHIRT, k),
		top2: s.top2 ? mix(s.top2, '#d0d0d4', k) : s.top2,
		pants: mix(s.pants, s.outfit === 'dress' ? s.skin : BOB_PANTS, k),
		hairColor: mix(s.hairColor, BOB_HAIR, k),
		shoes: mix(s.shoes, BOB_SHOES, k),
		hair: k > 0.85 ? 'bobFlat' : s.hair,
	};
}

/** the old street: colourful houses + shops with different names */
export const OLD_SHOPS = ['MAPLE BAKERY', "LULU'S HATS", "OTTO'S TOYS", 'JAZZ CAFE', 'PETAL FLOWERS'];
export const OldStreet: React.FC<{k?: number}> = ({k = 1}) => (
	<group>
		<mesh geometry={plane(200, 200)} material={plastic('#ffffff', {map: noiseTex(mix(GREY.ground, '#7fd06a', k), 0.08, 3, [24, 24]), rough: 0.95})} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow />
		<mesh geometry={plane(10, 200)} material={plastic('#ffffff', {map: asphaltTex([3, 30]), rough: 0.85})} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow />
		{[-1, 1].map((sd) => (
			<mesh key={sd} geometry={box(3.4, 0.3, 200)} material={plastic('#e8dfd0', {rough: 0.85})} position={[sd * 6.8, 0.15, 0]} receiveShadow />
		))}
		{OLD_SHOPS.map((n, i) => (
			<Shop key={i} name={n} position={[(i % 2 ? 1 : -1) * 15, 0, 14 - Math.floor(i / 2) * 14 - (i % 2) * 6]} rotation={i % 2 ? -Math.PI / 2 : Math.PI / 2} k={k} seed={i + 4} />
		))}
		<BobHouse position={[-18, 0, -30]} rotation={Math.PI / 2} k={k} seed={9} mailbox={false} />
		<BobHouse position={[18, 0, -30]} rotation={-Math.PI / 2} k={k} seed={12} mailbox={false} />
		{[-14, 0, 14].map((z) => (
			<group key={z}>
				<Tree position={[-9.6, 0, z - 6]} k={k} seed={z + 50} scale={0.9} />
				<LampPost position={[9.4, 0, z]} lit="day" />
			</group>
		))}
	</group>
);

export const OldPersonView: React.FC<{p: OldPerson; k?: number; pose?: P.Pose; expr?: Expression; t: number; look?: [number, number]}> = ({p, k = 0, pose, expr, t, look}) => (
	<Character
		spec={greyed(p, k)}
		position={p.pos}
		rotation={p.yaw}
		pose={pose ?? P.idle(t, p.spec.seed)}
		expr={k > 0.6 ? 'bob' : expr ?? p.expr}
		look={look}
		blink={false}
		headExtra={k < 0.85 ? <HatMesh kind={p.hat} color={mix(p.hatColor, '#8e8e94', k)} band={mix('#ffffff', '#b0b0b4', k)} /> : undefined}
	/>
);
