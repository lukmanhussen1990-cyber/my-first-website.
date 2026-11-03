// "Stink": floating, wobbly green cloud puffs.
import React from 'react';
import {sphere, plastic} from '../lib/materials';
import {hash} from '../lib/random';
import {V3} from '../lib/anim';

export const StinkCloud: React.FC<{frame: number; position?: V3; scale?: number; seed?: number; rise?: number; color?: string; opacity?: number}> = ({
	frame,
	position = [0, 0, 0],
	scale = 1,
	seed = 1,
	rise = 0.25,
	color = '#8fdc4f',
	opacity = 0.88,
}) => {
	const t = frame / 30;
	const m = plastic(color, {rough: 0.9, emissive: '#3f8a12', emissiveIntensity: 0.35, transparent: opacity < 1, opacity});
	const m2 = plastic('#b6ef6a', {rough: 0.9, emissive: '#4f9a1a', emissiveIntensity: 0.3, transparent: opacity < 1, opacity});
	const n = 6;
	const drift: V3 = [Math.sin(t * 0.4 + seed) * 0.4, ((t * rise + hash(seed, 1) * 3) % 6) * 0.25, Math.cos(t * 0.35 + seed) * 0.3];
	return (
		<group position={[position[0] + drift[0], position[1] + drift[1], position[2] + drift[2]]} scale={scale}>
			{Array.from({length: n}).map((_, i) => {
				const a = (i / n) * Math.PI * 2 + hash(i, seed) * 0.6;
				const r = i === 0 ? 0 : 0.75 + hash(i, seed + 2) * 0.25;
				const wob = 1 + 0.13 * Math.sin(t * (2.6 + hash(i, seed + 3) * 2) + i * 1.7);
				const s = (i === 0 ? 1.05 : 0.62 + hash(i, seed + 4) * 0.3) * wob;
				return (
					<mesh
						key={i}
						geometry={sphere(1, 16, 12)}
						material={i % 2 ? m2 : m}
						position={[Math.cos(a) * r, (hash(i, seed + 5) - 0.4) * 0.5 + Math.sin(t * 2 + i) * 0.06, Math.sin(a) * r * 0.6]}
						scale={[s, s * (0.86 + 0.08 * Math.sin(t * 3 + i)), s]}
					/>
				);
			})}
			{/* stink squiggles */}
			{[-0.5, 0.5].map((x, i) => (
				<group key={'sq' + i} position={[x, 1.4 + Math.sin(t * 3 + i) * 0.12, 0]}>
					{[0, 1, 2].map((k) => (
						<mesh key={k} geometry={sphere(0.12, 8, 6)} material={m} position={[Math.sin(t * 4 + k * 1.5 + i) * 0.18, k * 0.28, 0]} />
					))}
				</group>
			))}
		</group>
	);
};
