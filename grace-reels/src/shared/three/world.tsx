import React, {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useShot, type Vec3} from './shot';
import {smoothstep} from '../math';

// The sun as a shadow-casting key light + sky/ground fill, both from the shared SunState.
export const SunLight: React.FC<{
	target?: Vec3;
	extent?: number;
	dist?: number;
	mapSize?: number;
	scale?: number;
	fill?: number;
	bias?: number;
}> = ({target = [0, 0, 0], extent = 20, dist = 80, mapSize = 2048, scale = 1, fill = 1, bias = -0.0004}) => {
	const shot = useShot();
	const {scene} = useThree();
	const {light, hemi, tgt} = useMemo(() => {
		const light = new THREE.DirectionalLight();
		light.castShadow = true;
		const hemi = new THREE.HemisphereLight();
		const tgt = new THREE.Object3D();
		return {light, hemi, tgt};
	}, []);
	useLayoutEffect(() => {
		scene.add(light, hemi, tgt);
		light.target = tgt;
		return () => {
			scene.remove(light, hemi, tgt);
			light.dispose();
			hemi.dispose();
		};
	}, [scene, light, hemi, tgt]);
	useLayoutEffect(() => {
		const s = shot.sun;
		const up = smoothstep(-1.5, 3, s.elevationDeg);
		light.color.copy(s.light);
		light.intensity = s.lightIntensity * scale * up;
		tgt.position.set(...target);
		light.position.set(target[0] + shot.sunDir.x * dist, target[1] + Math.max(shot.sunDir.y, 0.02) * dist, target[2] + shot.sunDir.z * dist);
		tgt.updateMatrixWorld();
		const sc = light.shadow.camera as THREE.OrthographicCamera;
		sc.left = -extent;
		sc.right = extent;
		sc.top = extent;
		sc.bottom = -extent;
		sc.near = 0.5;
		sc.far = dist * 2 + extent;
		sc.updateProjectionMatrix();
		if (light.shadow.mapSize.x !== mapSize) {
			light.shadow.mapSize.set(mapSize, mapSize);
			light.shadow.map?.dispose();
			light.shadow.map = null;
		}
		light.shadow.bias = bias;
		light.shadow.normalBias = 0.03;
		light.shadow.radius = 3;
		light.castShadow = up > 0.01;
		hemi.color.copy(s.hemiSky);
		hemi.groundColor.copy(s.hemiGround);
		hemi.intensity = s.hemiIntensity * fill;
	});
	return null;
};

// Distance haze in the sun's fog colour (the reference reels live in thick warm haze).
export const Atmosphere: React.FC<{near: number; far: number; color?: THREE.Color; mix?: number}> = ({near, far, color, mix = 0}) => {
	const shot = useShot();
	const {scene} = useThree();
	const fog = useMemo(() => new THREE.Fog('#ffffff', near, far), [near, far]);
	useLayoutEffect(() => {
		scene.fog = fog;
		return () => {
			scene.fog = null;
		};
	}, [scene, fog]);
	useLayoutEffect(() => {
		fog.color.copy(shot.sun.fog);
		if (color) fog.color.lerp(color, mix);
		fog.near = near;
		fog.far = far;
	});
	return null;
};
