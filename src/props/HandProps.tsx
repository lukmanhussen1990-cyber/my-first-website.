// Small props held by characters. Each prop's origin is its grip point.
import React from 'react';
import * as THREE from 'three';
import {lathe, cyl, sphere, torus, plastic, goldMat, cone, rbox, glowMat} from '../lib/materials';

const brass = () => plastic('#e8b23a', {metal: 0.95, rough: 0.22, envInt: 1.5, emissive: '#5a3a00', emissiveIntensity: 0.3});
const wood = (c = '#8a5a34') => plastic(c, {rough: 0.6});

/** Hand bell: grip on the wooden handle, bell hangs below the hand. */
export const HandBell: React.FC<{swing?: number}> = ({swing = 0}) => (
	<group rotation={[0, 0, 0]}>
		<mesh geometry={cyl(0.075, 0.09, 0.5, 14)} material={wood('#7a4a2a')} position={[0, 0, 0]} castShadow />
		<mesh geometry={sphere(0.1, 14, 10)} material={wood('#6a3a1e')} position={[0, 0.27, 0]} castShadow />
		<group position={[0, -0.27, 0]} rotation={[swing, 0, 0]}>
			<mesh
				geometry={lathe('bell', [[0.0, 0.0], [0.12, -0.02], [0.2, -0.12], [0.24, -0.32], [0.33, -0.52], [0.36, -0.56], [0.34, -0.58], [0.0, -0.4]], 28)}
				material={brass()}
				castShadow
			/>
			<mesh geometry={torus(0.345, 0.03, 8, 28)} material={brass()} position={[0, -0.56, 0]} rotation={[Math.PI / 2, 0, 0]} />
			<mesh geometry={sphere(0.08, 12, 8)} material={plastic('#5b4a2a', {metal: 0.6, rough: 0.4})} position={[Math.sin(swing * 3) * 0.08, -0.56, 0]} />
		</group>
	</group>
);

/** Grandpa's walking stick: grip at the curved handle, stick goes down to the floor. */
export const WalkingStick: React.FC<{length?: number}> = ({length = 2.05}) => (
	<group>
		<mesh geometry={torus(0.17, 0.065, 8, 20, Math.PI)} material={wood('#6b3f22')} position={[0.17, 0.05, 0]} castShadow />
		<mesh geometry={cyl(0.06, 0.055, length, 10)} material={wood('#6b3f22')} position={[0, 0.05 - length / 2, 0]} castShadow />
		<mesh geometry={cyl(0.07, 0.07, 0.1, 10)} material={plastic('#2b2b2b', {rough: 0.8})} position={[0, 0.05 - length, 0]} />
	</group>
);

/** Gold crown. Origin at the bottom centre of the band. */
export const Crown: React.FC<{scale?: number}> = ({scale = 1}) => {
	const pts = 5;
	return (
		<group scale={scale}>
			<mesh geometry={cyl(0.62, 0.58, 0.32, 28, true)} material={goldMat(0.35)} position={[0, 0.16, 0]} castShadow />
			<mesh geometry={torus(0.6, 0.045, 8, 32)} material={goldMat(0.35)} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />
			{Array.from({length: pts}).map((_, i) => {
				const a = (i / pts) * Math.PI * 2;
				return (
					<group key={i} position={[Math.sin(a) * 0.6, 0.32, Math.cos(a) * 0.6]}>
						<mesh geometry={cone(0.15, 0.36, 4)} material={goldMat(0.35)} position={[0, 0.18, 0]} castShadow />
						<mesh geometry={sphere(0.065, 12, 8)} material={goldMat(0.5)} position={[0, 0.4, 0]} />
					</group>
				);
			})}
			{Array.from({length: pts}).map((_, i) => {
				const a = ((i + 0.5) / pts) * Math.PI * 2;
				const col = i % 2 === 0 ? '#ff2d55' : '#2d7bff';
				return <mesh key={'g' + i} geometry={sphere(0.075, 12, 8)} material={plastic(col, {rough: 0.1, emissive: col, emissiveIntensity: 0.4})} position={[Math.sin(a) * 0.62, 0.16, Math.cos(a) * 0.62]} />;
			})}
		</group>
	);
};

/** Flashlight: grip at the middle of the body, pointing along +Z (beam optional). */
export const Flashlight: React.FC<{on?: boolean}> = ({on = false}) => (
	<group>
		<mesh geometry={cyl(0.1, 0.1, 0.7, 14)} material={plastic('#ff4b3a', {rough: 0.35})} rotation={[Math.PI / 2, 0, 0]} castShadow />
		<mesh geometry={cyl(0.17, 0.11, 0.22, 16)} material={plastic('#2a2a2e', {rough: 0.4})} position={[0, 0, 0.44]} rotation={[Math.PI / 2, 0, 0]} castShadow />
		<mesh geometry={cyl(0.15, 0.15, 0.02, 16)} material={on ? glowMat('#fff6d8', 4) : plastic('#ddeeff', {rough: 0.1})} position={[0, 0, 0.56]} rotation={[Math.PI / 2, 0, 0]} />
	</group>
);

/** Folded newspaper held open with both hands (origin at centre). */
export const PaperSheet: React.FC<{map?: THREE.Texture | null}> = ({map}) => (
	<mesh geometry={rbox(1.6, 1.15, 0.04, 0.01, 1)} material={plastic('#f3efe6', {rough: 0.9, map: map ?? null})} castShadow />
);
