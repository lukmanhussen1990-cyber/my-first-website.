import {useThree} from '@react-three/fiber';
import React from 'react';
import * as THREE from 'three';
import {V3, wobble} from '../lib/anim';

/**
 * Sets the camera every frame (props are computed from the frame number, so renders are exact).
 * - look: the subject point; frameY: where the subject should sit on screen (0 = top, 0.5 = centre).
 * - sway: tiny handheld motion; shake: extra jolt (for stomps / stamps).
 */
export const Cam: React.FC<{pos: V3; look?: V3; target?: V3; frameY?: number; fov?: number; roll?: number; sway?: number; shake?: number; t?: number; seed?: number}> = ({
	pos,
	look,
	target,
	frameY = 0.5,
	fov = 40,
	roll = 0,
	sway = 0.05,
	shake = 0,
	t = 0,
	seed = 1,
}) => {
	const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
	const subj = look ?? target ?? [0, 0, 0];
	const dist = Math.hypot(pos[0] - subj[0], pos[1] - subj[1], pos[2] - subj[2]);
	// Shift the aim point so the subject lands at frameY on screen.
	const ys = 1 - 2 * frameY;
	const off = dist * Math.tan(((fov / 2) * Math.PI) / 180) * ys;
	const tgt: V3 = [subj[0], subj[1] - off, subj[2]];
	const k = sway * Math.max(0.4, Math.min(3, dist / 10));
	const sh = shake * Math.max(0.3, dist / 12);
	const j = (s: number) => (Math.sin(t * 61 + s * 13.1) * 0.6 + Math.sin(t * 97 + s * 5.3) * 0.4) * sh;
	camera.position.set(pos[0] + wobble(t, seed) * k + j(1), pos[1] + wobble(t, seed + 7) * k * 0.7 + j(2), pos[2] + wobble(t, seed + 13) * k * 0.5);
	camera.up.set(0, 1, 0);
	camera.lookAt(tgt[0] + wobble(t, seed + 21) * k * 0.6 + j(3) * 0.5, tgt[1] + wobble(t, seed + 29) * k * 0.5 + j(4) * 0.5, tgt[2]);
	if (roll !== 0) camera.rotateZ(roll);
	camera.rotateZ(wobble(t * 0.8, seed + 41) * 0.004 * (sway / 0.05) + j(5) * 0.01);
	camera.fov = fov;
	camera.near = 0.1;
	camera.far = 2000;
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld();
	return null;
};
