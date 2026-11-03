// Grandpa's cosy home: my bed, Grandpa's armchair, lamp, bookshelf, window with curtains, string lights.
import React from 'react';
import * as THREE from 'three';
import {plastic, box, plane, glowMat, rbox, cyl, sphere} from '../lib/materials';
import {woodTex} from '../lib/textures';
import {Bed, Armchair, FloorLamp, SideTable, Curtains, WallWindow, Bookshelf, WallFrame, Rug, PottedPlant} from '../props/Furniture';
import {StringLights} from '../world/Town';
import {Stars} from '../world/Nature';
import {Bucket} from '../props/Bucket';

let wallpaper: THREE.Texture | null = null;
function wallpaperTex() {
	if (wallpaper) return wallpaper;
	const c = document.createElement('canvas');
	c.width = 256;
	c.height = 256;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = '#6fb3a5';
	ctx.fillRect(0, 0, 256, 256);
	ctx.fillStyle = '#7fc2b3';
	for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 28, 256);
	ctx.fillStyle = 'rgba(255,255,255,0.18)';
	for (let y = 16; y < 256; y += 64)
		for (let x = 46; x < 256; x += 64) {
			ctx.beginPath();
			ctx.arc(x, y, 6, 0, Math.PI * 2);
			ctx.fill();
		}
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(6, 2);
	wallpaper = t;
	return t;
}

export const BED_POS: [number, number, number] = [-7.5, 0, -4.5];
export const CHAIR_POS: [number, number, number] = [6.5, 0, -2.5];
export const CHAIR_ROT = -0.5;
export const WINDOW_POS: [number, number, number] = [0.5, 6.4, -10.8];

export const GrandpaHome: React.FC<{night: boolean; curtains?: number; lamp?: boolean; stringLights?: boolean}> = ({night, curtains = 0, lamp = true, stringLights = true}) => {
	const wall = plastic('#ffffff', {map: wallpaperTex(), rough: 0.85});
	const wood = plastic('#ffffff', {map: woodTex('#a86f45', [5, 5], 8, 21), rough: 0.6});
	const wain = plastic('#7a4a2e', {rough: 0.6});
	const W = 28;
	const D = 24;
	const H = 11.5;
	return (
		<group>
			<mesh geometry={plane(W, D)} material={wood} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
			<mesh geometry={box(W, H, 0.4)} material={wall} position={[0, H / 2, -11]} receiveShadow />
			<mesh geometry={box(W, 2.6, 0.5)} material={wain} position={[0, 1.3, -10.9]} receiveShadow />
			{[-1, 1].map((sd) => (
				<group key={sd}>
					<mesh geometry={box(0.4, H, D)} material={wall} position={[sd * 14, H / 2, 0]} receiveShadow />
					<mesh geometry={box(0.5, 2.6, D)} material={wain} position={[sd * 13.9, 1.3, 0]} receiveShadow />
				</group>
			))}
			<mesh geometry={box(W, H, 0.4)} material={wall} position={[0, H / 2, 12]} receiveShadow />
			<mesh geometry={box(W + 1, 0.4, D + 1)} material={plastic('#f3e9d6')} position={[0, H, 0]} />
			{/* window with sky behind */}
			<group position={WINDOW_POS}>
				<WallWindow w={6.4} h={5.6} night={night} />
				{night ? (
					<group position={[0, 0, -0.2]}>
						<Stars count={40} radius={3} seed={8} />
					</group>
				) : null}
			</group>
			<Curtains position={[WINDOW_POS[0], WINDOW_POS[1] + 0.2, WINDOW_POS[2] + 0.2]} width={7.6} height={6.6} k={curtains} color="#ff9f1c" />
			{/* furniture */}
			<Bed position={BED_POS} rotation={0} blanket="#5b8cff" />
			<Armchair position={CHAIR_POS} rotation={CHAIR_ROT} color="#c0453b" />
			{lamp ? <FloorLamp position={[10.2, 0, -5.8]} on={night || curtains > 0.5} /> : <FloorLamp position={[10.2, 0, -5.8]} on={false} />}
			<SideTable position={[2.6, 0, -6.2]} />
			<mesh geometry={cyl(0.28, 0.22, 0.45, 12)} material={plastic('#ffffff', {rough: 0.3})} position={[2.6, 2.32, -6.2]} castShadow />
			<Bookshelf position={[13.2, 0, 3]} rotation={-Math.PI / 2} />
			<WallFrame position={[-7.5, 7.6, -10.75]} w={2.6} h={2.0} />
			<WallFrame position={[6.5, 7.8, -10.75]} w={2.2} h={2.8} color="#c8963e" art="#ff9fb0" />
			<Rug position={[0, 0.04, 1]} r={5} color="#e07a5f" />
			<PottedPlant position={[-12.2, 0, -9.0]} />
			{/* the house's bucket, of course */}
			<Bucket position={[-12.3, 0, 6.5]} rotation={[0, 0.6, 0]} handle={1.1} />
			{stringLights ? <StringLights a={[-13.6, 10.4, -10.6]} b={[13.6, 10.4, -10.6]} sag={1.2} n={26} lit={night ? 'night' : 'day'} seed={2} /> : null}
		</group>
	);
};

/** thought bubble with content; origin at the bubble centre */
export const ThoughtBubble: React.FC<{scale?: number; k?: number; children?: React.ReactNode; trail?: [number, number, number]}> = ({scale = 1, k = 1, children, trail = [-1.6, -2.6, 0]}) => {
	const m = plastic('#ffffff', {rough: 0.9, emissive: '#ffffff', emissiveIntensity: 0.35});
	const puffs: [number, number, number, number][] = [
		[0, 0, 0, 2.2], [-1.9, 0.2, 0, 1.6], [1.9, 0.1, 0, 1.6], [-1.0, 1.4, 0, 1.5], [1.1, 1.4, 0, 1.5], [0, -1.2, 0, 1.6], [-1.8, -0.9, 0, 1.2], [1.8, -0.9, 0, 1.2],
	];
	const s = Math.max(0.001, k) * scale;
	return (
		<group scale={s}>
			{puffs.map(([x, y, z, r], i) => (
				<mesh key={i} geometry={sphere(r, 20, 14)} material={m} position={[x, y, z - 0.6]} scale={[1, 1, 0.55]} />
			))}
			{[0.55, 0.38, 0.24].map((r, i) => (
				<mesh key={'t' + i} geometry={sphere(r, 14, 10)} material={m} position={[trail[0] * (0.55 + i * 0.32), trail[1] * (0.55 + i * 0.32), 0]} />
			))}
			<group position={[0, 0, 0.9]}>{children}</group>
		</group>
	);
};
