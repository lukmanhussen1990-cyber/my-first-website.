// Sets the scene camera every frame from pure values (position, look target, fov),
// with an optional tiny handheld sway and shake. Everything comes from the frame number.
import React, {useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useCurrentFrame} from 'remotion';
import {fbm1} from './random';
import {whipState} from '../timing';

export type CamState = {
	pos: [number, number, number];
	target: [number, number, number];
	fov: number;
	roll?: number;
	/** handheld sway amount (1 = default subtle) */
	sway?: number;
	/** camera shake amount (0 = none) */
	shake?: number;
	/** extra yaw added after lookAt (radians) – used for whip pans */
	yaw?: number;
	pitch?: number;
};

const tmp = new THREE.Vector3();

export const CameraRig: React.FC<CamState & {seed?: number}> = ({pos, target, fov, roll = 0, sway = 1, shake = 0, yaw = 0, pitch = 0, seed = 7}) => {
	const {camera} = useThree();
	const frame = useCurrentFrame();
	useLayoutEffect(() => {
		const cam = camera as THREE.PerspectiveCamera;
		const t = frame / 30;
		// slow handheld drift (very small) + optional fast shake
		const sx = fbm1(t * 0.45, seed) * 0.035 * sway + fbm1(t * 9, seed + 3) * 0.12 * shake;
		const sy = fbm1(t * 0.4, seed + 1) * 0.03 * sway + fbm1(t * 9.5, seed + 4) * 0.12 * shake;
		const sr = fbm1(t * 0.35, seed + 2) * 0.006 * sway + fbm1(t * 8, seed + 5) * 0.02 * shake;
		cam.position.set(pos[0], pos[1], pos[2]);
		cam.up.set(0, 1, 0);
		cam.lookAt(tmp.set(target[0], target[1], target[2]));
		// sway in camera space
		cam.translateX(sx);
		cam.translateY(sy);
		cam.rotateY(yaw + whipState(frame).yaw);
		cam.rotateX(pitch);
		cam.rotateZ(roll + sr);
		cam.fov = fov;
		cam.near = 0.05;
		cam.far = 1200;
		cam.updateProjectionMatrix();
		cam.updateMatrixWorld();
	});
	return null;
};
