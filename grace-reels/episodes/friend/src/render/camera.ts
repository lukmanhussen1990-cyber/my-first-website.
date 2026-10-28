// Camera evaluation shared by the 3D renderer and the HTML overlay (labels project with the same camera).
import * as THREE from 'three';
import {noise1} from '../lib/random';
import type {CamState} from './types';

export const ASPECT = 1080 / 1920;

// Final camera for a shot at time t, including a tiny seeded handheld drift and any shake.
export const resolveCamera = (cam: CamState, t: number, seed = 7) => {
	const drift = cam.drift ?? 1;
	const shake = cam.shake ?? 0;
	const yaw = (noise1(t * 0.31, seed) * 0.0035 + noise1(t * 0.9, seed + 3) * 0.0012) * drift + noise1(t * 23, seed + 11) * 0.018 * shake;
	const pitch = (noise1(t * 0.27, seed + 5) * 0.0028 + noise1(t * 0.8, seed + 8) * 0.001) * drift + noise1(t * 21, seed + 13) * 0.016 * shake;
	const roll = (cam.roll ?? 0) + noise1(t * 0.22, seed + 9) * 0.0025 * drift + noise1(t * 19, seed + 17) * 0.01 * shake;
	return {pos: cam.pos, target: cam.target, fov: cam.fov, yaw, pitch, roll};
};

const tmpCam = new THREE.PerspectiveCamera();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();

export const applyCamera = (camera: THREE.PerspectiveCamera, cam: CamState, t: number, aspect = ASPECT) => {
	const r = resolveCamera(cam, t);
	camera.position.set(...r.pos);
	camera.up.set(0, 1, 0);
	camera.lookAt(...r.target);
	camera.fov = r.fov;
	camera.aspect = aspect;
	camera.near = 0.1;
	camera.far = 2000;
	camera.rotateY(r.yaw);
	camera.rotateX(r.pitch);
	camera.rotateZ(r.roll);
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld(true);
	return camera;
};

// World point -> pixel position in the 1080x1920 frame (null when behind the camera).
export const projectToScreen = (cam: CamState, t: number, p: [number, number, number], w = 1080, h = 1920) => {
	applyCamera(tmpCam, cam, t, w / h);
	const v = new THREE.Vector3(...p).project(tmpCam);
	if (v.z > 1) return null;
	return {x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h};
};

// Camera basis helpers for placing things relative to the view (e.g. the cloak flying at the lens).
export const cameraBasis = (cam: CamState, t: number) => {
	applyCamera(tmpCam, cam, t);
	tmpCam.getWorldDirection(fwd);
	right.setFromMatrixColumn(tmpCam.matrixWorld, 0);
	up.setFromMatrixColumn(tmpCam.matrixWorld, 1);
	return {pos: tmpCam.position.clone(), fwd: fwd.clone(), right: right.clone(), up: up.clone()};
};

const DEG = Math.PI / 180;

// Camera on a sphere around a target: pitch looks down (deg), yaw swings the camera toward +x (deg).
// Characters standing in such a shot use yaw = camera yaw and lean = camera pitch to face it.
export const orbit = (target: [number, number, number], dist: number, pitchDeg: number, yawDeg: number, fov: number, extra: Partial<CamState> = {}): CamState => {
	const p = pitchDeg * DEG;
	const y = yawDeg * DEG;
	return {
		pos: [target[0] + dist * Math.cos(p) * Math.sin(y), target[1] + dist * Math.sin(p), target[2] + dist * Math.cos(p) * Math.cos(y)],
		target,
		fov,
		...extra,
	};
};
export const deg = (d: number) => d * DEG;
