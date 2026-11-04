// Bob the dog: a blocky dog in a tiny grey shirt with a tiny flat Bob haircut and the Bob face.
import React from 'react';
import * as THREE from 'three';
import {useCurrentFrame} from 'remotion';
import {plastic, rbox, sphere, torus, cyl} from '../lib/materials';
import {faceMaterial, DEFAULT_STYLE, EXPRESSIONS, Expression, FaceParts} from '../characters/faceTexture';
import {isBlinking} from '../characters/Character';
import {V3} from '../lib/anim';
import {BOB_HAIR, BOB_SHIRT} from './cast';

const FUR = '#c8a57a';

export const Dog: React.FC<{
	position?: V3;
	rotation?: number;
	scale?: number;
	expr?: Expression;
	face?: Partial<FaceParts>;
	wag?: number;
	walk?: number;
	headTilt?: number;
	shirt?: string;
	hair?: string;
	tag?: React.ReactNode;
	frameOffset?: number;
}> = ({position, rotation = 0, scale = 1, expr = 'bob', face, wag = 1, walk = 0, headTilt = 0, shirt = BOB_SHIRT, hair = BOB_HAIR, tag, frameOffset = 0}) => {
	const frame = useCurrentFrame() + frameOffset;
	const t = frame / 30;
	const fur = plastic(FUR, {rough: 0.6});
	const furDk = plastic('#a8865c', {rough: 0.6});
	const shirtM = plastic(shirt, {rough: 0.5});
	const hairM = plastic(hair, {rough: 0.55});
	const st = {...DEFAULT_STYLE, skin: FUR, eyeY: -20, eyeGap: 70, mouthY: 200, featureScale: 1.15};
	let parts: FaceParts = {...EXPRESSIONS[expr], ...(face ?? {})};
	if (isBlinking(frame, 4242) && parts.eyes === 'dot') parts = {...parts, eyes: 'blink'};
	const faceM = faceMaterial(st, parts, 0, 512);
	const headMats = [fur, fur, fur, fur, faceM, fur];
	const sw = Math.sin(t * Math.PI * 2 * 1.4) * 0.5 * walk;
	const bob = Math.abs(Math.sin(t * Math.PI * 2 * 1.4)) * 0.06 * walk + Math.sin(t * 2) * 0.015;
	const tail = Math.sin(t * Math.PI * 2 * 3.2) * 0.5 * wag;
	const leg = (x: number, z: number, ph: number) => (
		<group position={[x, 0.95, z]} rotation={[sw * ph, 0, 0]}>
			<mesh geometry={rbox(0.32, 0.95, 0.34, 0.1)} material={fur} position={[0, -0.47, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(0.36, 0.16, 0.42, 0.06)} material={furDk} position={[0, -0.9, 0.04]} castShadow />
		</group>
	);
	return (
		<group position={position} rotation={[0, rotation, 0]} scale={scale}>
			<group position={[0, bob, 0]}>
				{leg(0.32, 0.55, 1)}
				{leg(-0.32, 0.55, -1)}
				{leg(0.32, -0.55, -1)}
				{leg(-0.32, -0.55, 1)}
				{/* body + tiny shirt */}
				<mesh geometry={rbox(1.0, 0.85, 1.75, 0.2)} material={fur} position={[0, 1.25, 0]} castShadow receiveShadow />
				<mesh geometry={rbox(1.08, 0.93, 1.05, 0.18)} material={shirtM} position={[0, 1.27, 0.32]} castShadow receiveShadow />
				<mesh geometry={rbox(0.5, 0.08, 0.06, 0.03)} material={plastic(new THREE.Color(shirt).multiplyScalar(0.8).getStyle())} position={[0, 1.62, 0.86]} />
				{tag ? <group position={[0, 1.3, 0.86]}>{tag}</group> : null}
				{/* tail */}
				<group position={[0, 1.5, -0.86]} rotation={[0.75, tail, 0]}>
					<mesh geometry={rbox(0.16, 0.62, 0.16, 0.07)} material={fur} position={[0, 0.3, 0]} castShadow />
				</group>
				{/* head */}
				<group position={[0, 1.95, 0.85]} rotation={[0, 0, headTilt]}>
					<mesh geometry={rbox(0.98, 0.9, 0.86, 0.22, 4)} material={headMats} castShadow receiveShadow />
					{/* snout, nose and the little Bob smile */}
					<mesh geometry={rbox(0.5, 0.36, 0.42, 0.14)} material={plastic('#e3c79f', {rough: 0.55})} position={[0, -0.24, 0.55]} castShadow />
					<mesh geometry={rbox(0.2, 0.13, 0.08, 0.05)} material={plastic('#1d1a1c', {rough: 0.3})} position={[0, -0.13, 0.77]} />
					<mesh geometry={torus(0.07, 0.012, 6, 16, Math.PI)} material={plastic('#3a1414')} position={[0, -0.3, 0.765]} rotation={[0, 0, Math.PI]} />
					{/* floppy ears */}
					{[-1, 1].map((sd) => (
						<mesh key={sd} geometry={rbox(0.16, 0.6, 0.4, 0.07)} material={furDk} position={[sd * 0.55, -0.05, -0.05]} rotation={[0, 0, sd * 0.18 + Math.sin(t * 3) * 0.04]} castShadow />
					))}
					{/* tiny flat Bob haircut with a side part */}
					<mesh geometry={rbox(0.28, 0.16, 0.72, 0.06)} material={hairM} position={[-0.33, 0.49, -0.02]} castShadow />
					<mesh geometry={rbox(0.62, 0.2, 0.74, 0.07)} material={hairM} position={[0.14, 0.5, -0.02]} castShadow />
					<mesh geometry={rbox(0.62, 0.14, 0.18, 0.05)} material={hairM} position={[0.12, 0.45, 0.36]} rotation={[-0.2, 0, -0.1]} />
				</group>
			</group>
		</group>
	);
};
