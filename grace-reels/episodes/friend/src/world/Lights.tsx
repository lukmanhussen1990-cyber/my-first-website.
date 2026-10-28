import {useMemo} from 'react';
import * as THREE from 'three';
import type {Mood} from './mood';

// Sun (with soft shadows over the action area) + sky/ground fill, driven by a mood.
// The light target lives in the scene graph so its matrix updates as the action area moves.
export const MoodLights: React.FC<{mood: Mood; center: [number, number, number]; span?: number; lite: boolean; dist?: number}> = ({
	mood,
	center,
	span = 30,
	lite,
	dist = 60,
}) => {
	const target = useMemo(() => new THREE.Object3D(), []);
	const [dx, dy, dz] = mood.sunDir;
	const ly = Math.max(0.45, dy);
	const n = Math.hypot(dx, ly, dz);
	const pos: [number, number, number] = [center[0] + (dx / n) * dist, center[1] + (ly / n) * dist, center[2] + (dz / n) * dist];
	return (
		<>
			<primitive object={target} position={center} />
			<hemisphereLight args={[mood.hemiSky, mood.hemiGround, mood.hemiI]} />
			<directionalLight
				position={pos}
				target={target}
				color={mood.light}
				intensity={mood.lightI}
				castShadow={!lite}
				shadow-mapSize={[2048, 2048]}
				shadow-bias={-0.0006}
				shadow-normalBias={0.04}
				shadow-radius={5}
				shadow-camera-left={-span}
				shadow-camera-right={span}
				shadow-camera-top={span}
				shadow-camera-bottom={-span}
				shadow-camera-near={1}
				shadow-camera-far={dist * 2.5}
			/>
		</>
	);
};
