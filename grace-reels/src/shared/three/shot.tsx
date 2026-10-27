import React, {createContext, useContext, useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {SunState} from '../sun';
import {fbm1} from '../math';

export type Vec3 = [number, number, number];
export type Cam = {pos: Vec3; target: Vec3; fov: number; roll?: number; near?: number; far?: number};

// Everything a set needs for one frame: time, camera, and the one sun.
export type Shot = {
	t: number; // seconds since the scene started
	T: number; // seconds since the reel started
	frame: number;
	cam: Cam;
	sun: SunState;
	sunDir: THREE.Vector3;
	W: number;
	H: number;
};

export const ShotContext = createContext<Shot | null>(null);
export const useShot = () => {
	const s = useContext(ShotContext);
	if (!s) throw new Error('useShot outside a ShotContext');
	return s;
};

export const makeCamera = (cam: Cam, W: number, H: number) => {
	const c = new THREE.PerspectiveCamera(cam.fov, W / H, cam.near ?? 0.1, cam.far ?? 2000);
	c.position.set(...cam.pos);
	c.up.set(0, 1, 0);
	c.lookAt(...cam.target);
	if (cam.roll) c.rotateZ(cam.roll);
	c.updateMatrixWorld(true);
	c.updateProjectionMatrix();
	return c;
};

export const camBasis = (cam: Cam) => {
	const fwd = new THREE.Vector3(...cam.target).sub(new THREE.Vector3(...cam.pos)).normalize();
	const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
	const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
	return {fwd, right, up};
};

// world point -> screen pixels (for labels that stick to characters)
export const project = (cam: Cam, p: Vec3, W: number, H: number) => {
	const c = makeCamera(cam, W, H);
	const v = new THREE.Vector3(...p).project(c);
	return {x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, visible: v.z < 1 && v.z > -1};
};

// tiny seeded handheld drift (in metres / radians), smooth in time
export const handheld = (cam: Cam, T: number, amount = 1, seed = 1): Cam => {
	const a = 0.012 * amount;
	const dx = fbm1(T * 0.6, seed) * a;
	const dy = fbm1(T * 0.5, seed + 3) * a * 0.8;
	const dz = fbm1(T * 0.4, seed + 7) * a * 0.6;
	const roll = fbm1(T * 0.35, seed + 11) * 0.004 * amount;
	return {
		...cam,
		pos: [cam.pos[0] + dx, cam.pos[1] + dy, cam.pos[2] + dz],
		target: [cam.target[0] + dx * 0.6, cam.target[1] + dy * 0.6, cam.target[2]],
		roll: (cam.roll ?? 0) + roll,
	};
};

// Pushes the shot camera into R3F's default camera before Remotion advances the frame.
export const ApplyCamera: React.FC = () => {
	const {camera, size} = useThree();
	const shot = useShot();
	useLayoutEffect(() => {
		const c = camera as THREE.PerspectiveCamera;
		const cam = shot.cam;
		c.fov = cam.fov;
		c.aspect = size.width / size.height;
		c.near = cam.near ?? 0.1;
		c.far = cam.far ?? 2000;
		c.position.set(...cam.pos);
		c.up.set(0, 1, 0);
		c.lookAt(...cam.target);
		if (cam.roll) c.rotateZ(cam.roll);
		c.updateProjectionMatrix();
		c.updateMatrixWorld(true);
	});
	return null;
};
