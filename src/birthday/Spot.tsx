// A spot light whose target is part of the scene (so it really points where we ask).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3} from '../lib/anim';
import {QUALITY} from '../lib/quality';

export const Spot: React.FC<{from: V3; to: V3; angle?: number; penumbra?: number; intensity?: number; distance?: number; color?: string; shadow?: boolean; decay?: number}> = ({
	from,
	to,
	angle = 0.4,
	penumbra = 0.6,
	intensity = 100,
	distance = 30,
	color = '#ffd59a',
	shadow = true,
	decay = 1.5,
}) => {
	const target = useMemo(() => new THREE.Object3D(), []);
	target.position.set(...to);
	target.updateMatrixWorld();
	const size = Math.min(1024, QUALITY.shadowMap);
	return (
		<>
			<primitive object={target} />
			<spotLight position={from} target={target} angle={angle} penumbra={penumbra} intensity={intensity} distance={distance} decay={decay} color={color} castShadow={shadow} shadow-mapSize-width={size} shadow-mapSize-height={size} shadow-bias={-0.0005} shadow-normalBias={0.03} />
		</>
	);
};
