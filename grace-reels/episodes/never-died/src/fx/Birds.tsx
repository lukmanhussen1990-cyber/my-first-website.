// A loose flock of small dark birds crossing the sky, wings flapping (geometry updated from time).
import {useMemo} from 'react';
import * as THREE from 'three';
import {hash} from '../lib/random';

export const Birds: React.FC<{t: number; t0: number; from: [number, number, number]; vel: [number, number, number]; count?: number; size?: number; color?: string; seed?: number}> = ({
	t,
	t0,
	from,
	vel,
	count = 6,
	size = 0.9,
	color = '#3a2b25',
	seed = 3,
}) => {
	const {geo, mat} = useMemo(() => {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 9 * 2), 3));
		const m = new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide, fog: true, transparent: true, opacity: 0.85, depthWrite: false});
		return {geo: g, mat: m};
	}, [count, color]);
	const pos = geo.attributes.position as THREE.BufferAttribute;
	const s = Math.max(0, t - t0);
	for (let i = 0; i < count; i++) {
		// V formation with a little wander
		const row = Math.ceil(i / 2);
		const side = i === 0 ? 0 : i % 2 ? -1 : 1;
		const cx = from[0] + vel[0] * s - row * 1.6 * size * 2 + Math.sin(s * 0.8 + i) * 0.3;
		const cy = from[1] + vel[1] * s - row * 0.5 * size + Math.sin(s * 1.3 + i * 2) * 0.25;
		const cz = from[2] + vel[2] * s + side * row * 1.4 * size * 2;
		const flap = Math.sin(s * (7 + hash(seed, i) * 2) + i * 1.7);
		const w = size * (0.9 + 0.2 * hash(seed, i, 1));
		const tip = flap * 0.45 * w;
		const verts = [
			// left wing: body front, body back, tip
			cx + 0.12 * w, cy, cz, cx - 0.15 * w, cy, cz, cx - 0.05 * w, cy + tip, cz - w,
			cx + 0.12 * w, cy, cz, cx - 0.15 * w, cy, cz, cx - 0.05 * w, cy + tip, cz + w,
		];
		pos.set(verts, i * 18);
	}
	pos.needsUpdate = true;
	return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={60} />;
};
