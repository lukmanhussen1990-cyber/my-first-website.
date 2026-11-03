// The Golden Throne: a toilet made of shiny gold, glowing, with sparkles and a big flush button.
// Origin at the bottom centre; the bowl faces +z, the tank is at the back (-z).
import React from 'react';
import * as THREE from 'three';
import {lathe, torus, sphere, rbox, cyl, plastic, goldMat, circle, glowMat, cone} from '../lib/materials';
import {Sparkles} from './Effects';
import {GlowSprite} from '../world/Nature';
import {V3} from '../lib/anim';

export const SEAT_HEIGHT = 1.3;

export const GoldenThrone: React.FC<{
	frame: number;
	position?: V3;
	rotation?: number;
	scale?: number;
	glow?: number; // 0..1 how much it glows / sparkles
	press?: number; // 0..1 flush button pressed
	light?: boolean; // add a real point light
	sparkles?: boolean;
	lidOpen?: number;
	dirty?: boolean;
}> = ({frame, position, rotation = 0, scale = 1, glow = 1, press = 0, light = true, sparkles = true, lidOpen = 1}) => {
	const gold = goldMat(0.18 + glow * 0.22);
	const goldDark = plastic('#d99a12', {metal: 1, rough: 0.28, emissive: '#7a4a00', emissiveIntensity: 0.25 + glow * 0.2, envInt: 1.4});
	const pulse = 0.85 + 0.15 * Math.sin((frame / 30) * 3);
	return (
		<group position={position} rotation={[0, rotation, 0]} scale={scale}>
			{/* pedestal */}
			<mesh geometry={lathe('throne-base', [[0, 0], [0.78, 0], [0.82, 0.08], [0.6, 0.2], [0.46, 0.5], [0.52, 0.72], [0, 0.72]], 36)} material={gold} castShadow receiveShadow />
			{/* bowl (oval) */}
			<group scale={[1, 1, 1.22]}>
				<mesh
					geometry={lathe('throne-bowl', [[0.0, 0.62], [0.46, 0.64], [0.72, 0.8], [0.86, 1.04], [0.9, 1.18], [0.78, 1.18], [0.66, 0.98], [0.0, 0.9]], 40)}
					material={gold}
					castShadow
					receiveShadow
				/>
				<mesh geometry={circle(0.66, 32)} material={glowMat('#7fe3ff', 0.6 + glow * 1.4)} position={[0, 1.0, 0]} rotation={[-Math.PI / 2, 0, 0]} />
				{/* seat ring */}
				<mesh geometry={torus(0.74, 0.13, 12, 40)} material={gold} position={[0, 1.24, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow />
			</group>
			{/* back / neck to the tank */}
			<mesh geometry={rbox(1.1, 0.9, 0.6, 0.2)} material={goldDark} position={[0, 0.95, -0.85]} castShadow />
			{/* lid standing open */}
			<group position={[0, 1.28, -0.86]} rotation={[-0.15 - (1 - lidOpen) * 1.42, 0, 0]}>
				<mesh geometry={sphere(1, 28, 16)} material={gold} position={[0, 0.9, 0]} scale={[0.82, 0.95, 0.11]} castShadow />
				<mesh geometry={sphere(0.17, 16, 12)} material={plastic('#ff2d55', {rough: 0.08, metal: 0.2, emissive: '#ff2d55', emissiveIntensity: 0.5 + glow * 0.6})} position={[0, 0.98, 0.11]} scale={[1, 1, 0.6]} />
				<mesh geometry={torus(0.22, 0.04, 8, 24)} material={goldDark} position={[0, 0.98, 0.1]} />
			</group>
			{/* tank */}
			<mesh geometry={rbox(1.78, 1.3, 0.82, 0.16)} material={gold} position={[0, 2.02, -1.12]} castShadow receiveShadow />
			<mesh geometry={rbox(1.98, 0.18, 1.0, 0.07)} material={goldDark} position={[0, 2.72, -1.12]} castShadow />
			<mesh geometry={rbox(1.9, 0.14, 0.92, 0.06)} material={goldDark} position={[0, 1.42, -1.12]} />
			{/* gems on the tank front */}
			{[-0.55, 0, 0.55].map((x, i) => (
				<mesh key={i} geometry={sphere(0.12, 14, 10)} material={plastic(['#2d7bff', '#ff2d55', '#29d17d'][i], {rough: 0.06, emissive: ['#2d7bff', '#ff2d55', '#29d17d'][i], emissiveIntensity: 0.4 + glow * 0.5})} position={[x, 2.05, -0.7]} scale={[1, 1, 0.6]} />
			))}
			{/* corner balls */}
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={sphere(0.15, 14, 10)} material={gold} position={[sd * 0.93, 2.88, -1.12]} />
			))}
			{/* the big flush button */}
			<group position={[0, 2.82, -1.12]}>
				<mesh geometry={cyl(0.38, 0.42, 0.14, 28)} material={goldDark} castShadow />
				<mesh geometry={cyl(0.29, 0.31, 0.2, 28)} material={plastic('#ff3b3b', {rough: 0.12, emissive: '#ff2020', emissiveIntensity: 0.35 + glow * 0.5})} position={[0, 0.16 - press * 0.12, 0]} />
				<mesh geometry={sphere(0.29, 20, 10)} material={plastic('#ff5a5a', {rough: 0.1, emissive: '#ff2020', emissiveIntensity: 0.3 + glow * 0.5})} position={[0, 0.25 - press * 0.12, 0]} scale={[1, 0.35, 1]} />
			</group>
			{/* little crown ornament on the lid top */}
			<group position={[0, 3.0, -1.52]} rotation={[-0.15, 0, 0]}>
				{lidOpen > 0.5
					? [-0.2, 0, 0.2].map((x, i) => <mesh key={i} geometry={cone(0.08, 0.22, 4)} material={gold} position={[x, i === 1 ? 0.06 : 0, 0]} />)
					: null}
			</group>
			{/* glow */}
			{glow > 0 ? (
				<>
					{/* halo behind the tank (never in front of someone sitting on it) */}
					<GlowSprite position={[0, 2.2, -1.9]} size={7 * glow * pulse} color="#ffcf4a" opacity={0.55 * glow} />
					{light ? <pointLight position={[0, 2.2, 1.2]} color="#ffc94a" intensity={22 * glow} distance={12} decay={1.6} /> : null}
					{sparkles ? <Sparkles frame={frame} count={34} radius={2.1} height={3.4} position={[0, 0.2, 0]} size={0.9} /> : null}
				</>
			) : null}
		</group>
	);
};

/** A stone stand / altar for the throne */
export const StoneStand: React.FC<{position?: V3; color?: string}> = ({position, color = '#8c8f9c'}) => {
	const m = plastic(color, {rough: 0.85});
	const m2 = plastic(new THREE.Color(color).multiplyScalar(0.85).getStyle(), {rough: 0.85});
	return (
		<group position={position}>
			<mesh geometry={rbox(5.2, 0.6, 5.2, 0.15)} material={m2} position={[0, 0.3, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(4.2, 0.6, 4.2, 0.15)} material={m} position={[0, 0.9, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(3.4, 0.6, 3.4, 0.15)} material={m2} position={[0, 1.5, 0]} castShadow receiveShadow />
		</group>
	);
};
export const STAND_TOP = 1.8;
