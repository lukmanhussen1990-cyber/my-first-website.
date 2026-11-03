// The grey metal bucket (appears everywhere). Height 1 unit, rim radius 0.55. Origin at the bottom centre.
import React from 'react';
import * as THREE from 'three';
import {lathe, torus, cyl, plastic, sphere} from '../lib/materials';

const wallMat = () => plastic('#aab4be', {metal: 0.7, rough: 0.33, envInt: 1.3, side: THREE.DoubleSide});
const rimMat = () => plastic('#c3ccd4', {metal: 0.75, rough: 0.28, envInt: 1.3});
const handleMat = () => plastic('#8d969f', {metal: 0.8, rough: 0.3, envInt: 1.2});

const PROFILE: [number, number][] = [
	[0.0, 0.03],
	[0.4, 0.03],
	[0.41, 0.0],
	[0.43, 0.0],
	[0.555, 1.0],
];

export const Bucket: React.FC<{
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: number;
	/** handle tilt: 0 = standing straight up, about ±1.3 = lying on the rim */
	handle?: number;
	shadow?: boolean;
	dirty?: boolean;
}> = ({position, rotation, scale = 1, handle = 1.2, shadow = true, dirty = false}) => {
	return (
		<group position={position} rotation={rotation} scale={scale}>
			<mesh geometry={lathe('bucket', PROFILE, 28)} material={wallMat()} castShadow={shadow} receiveShadow />
			{/* rolled rim */}
			<mesh geometry={torus(0.555, 0.032, 8, 36)} material={rimMat()} position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadow} />
			{/* pressed ridges */}
			<mesh geometry={torus(0.468, 0.016, 6, 36)} material={rimMat()} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} />
			<mesh geometry={torus(0.512, 0.016, 6, 36)} material={rimMat()} position={[0, 0.65, 0]} rotation={[Math.PI / 2, 0, 0]} />
			{/* handle ears */}
			<mesh geometry={cyl(0.07, 0.07, 0.05, 12)} material={handleMat()} position={[0.56, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} />
			<mesh geometry={cyl(0.07, 0.07, 0.05, 12)} material={handleMat()} position={[-0.56, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} />
			{/* wire handle (half ring) pivoting on the ears */}
			<group position={[0, 0.9, 0]} rotation={[-handle, 0, 0]}>
				<mesh geometry={torus(0.565, 0.024, 6, 28, Math.PI)} material={handleMat()} castShadow={shadow} />
				<mesh geometry={cyl(0.05, 0.05, 0.32, 10)} material={plastic('#3d3f45', {rough: 0.6})} position={[0, 0.565, 0]} rotation={[0, 0, Math.PI / 2]} />
			</group>
			{dirty ? <mesh geometry={sphere(0.05)} material={plastic('#7a5a3a')} position={[0.3, 0.5, 0.42]} /> : null}
		</group>
	);
};

/** Bucket held by its handle: the hand grip point is the origin, the bucket hangs below. */
export const HangingBucket: React.FC<{scale?: number; swing?: number}> = ({scale = 1, swing = 0}) => (
	<group rotation={[swing, 0, 0]} scale={scale}>
		<Bucket position={[0, -1.465, 0]} handle={0} />
	</group>
);
