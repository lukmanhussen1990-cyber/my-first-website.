import {useMemo} from 'react';
import * as THREE from 'three';
import {meta, tex} from '../lib/textures';
import {applyLook, makeSpriteMaterial, SpriteLook} from '../render/spriteMaterial';
import {childrenOf, RIGS, rigInfo, RigName} from './rig';

export type PartWarp = {
	hem?: [number, number, number]; // shear px, start v, end v
	wave?: [number, number, number, number]; // amp px, freq, phase, anchor v
	tilt?: [number, number, number, number]; // angle rad, pivot u, pivot v, edge v
	breath?: number;
};

export type RigPose = {
	angles: Record<string, number>; // degrees, CCW positive
	lift?: [number, number]; // root offset in px (x right, y up)
	warps?: Record<string, PartWarp>;
	hide?: string[];
	offsets?: Record<string, [number, number]>; // extra translation in parent px (x right, y down), e.g. feet
};

const SEGS: Record<string, [number, number]> = {
	torso: [4, 28],
	body: [4, 32],
	cloak: [8, 28],
	hair: [6, 16],
	beard: [4, 14],
};

// Renders a cut-out rig with its feet at the local origin (pixel units; scale it with CharacterRoot).
export const Rig: React.FC<{name: RigName; pose: RigPose; look?: SpriteLook; renderOrder?: number}> = ({name, pose, look, renderOrder = 0}) => {
	const rig = RIGS[name];
	const info = rigInfo(name);
	const kids = useMemo(() => childrenOf(rig), [rig]);
	const parts = useMemo(() => {
		const out: Record<string, {mesh: THREE.Mesh; mat: ReturnType<typeof makeSpriteMaterial>; w: number; h: number}> = {};
		for (const [part, def] of Object.entries(rig.parts)) {
			const m = meta(def.sprite);
			const [sx, sy] = SEGS[part] ?? [1, 1];
			const geo = new THREE.PlaneGeometry(m.w, m.h, sx, sy);
			const mat = makeSpriteMaterial(tex(def.sprite), m.w, m.h);
			const mesh = new THREE.Mesh(geo, mat);
			mesh.frustumCulled = false;
			out[part] = {mesh, mat, w: m.w, h: m.h};
		}
		return out;
	}, [rig]);

	// Per-frame material state (mutated during render; R3F draws after commit).
	rig.order.forEach((part, i) => {
		const p = parts[part];
		const def = rig.parts[part];
		applyLook(p.mat, look, def.shade ?? 1);
		const w = pose.warps?.[part];
		const u = p.mat.uniforms;
		u.uHem.value.set(w?.hem?.[0] ?? 0, w?.hem?.[1] ?? 0.6, w?.hem?.[2] ?? 1, 0);
		u.uWave.value.set(w?.wave?.[0] ?? 0, w?.wave?.[1] ?? 6, w?.wave?.[2] ?? 0, w?.wave?.[3] ?? 0);
		u.uTilt.value.set(w?.tilt?.[0] ?? 0, w?.tilt?.[1] ?? 0.5, w?.tilt?.[2] ?? 0.2, w?.tilt?.[3] ?? 0.2);
		u.uBreath.value.set(w?.breath ?? 0, 0.45, 0, 0);
		p.mesh.renderOrder = renderOrder + i;
		p.mesh.visible = !pose.hide?.includes(part);
	});

	const node = (part: string): React.ReactNode => {
		const def = rig.parts[part];
		const parent = def.parent ? rig.parts[def.parent] : null;
		const off = pose.offsets?.[part] ?? [0, 0];
		const pos: [number, number, number] = parent
			? [def.at[0] - parent.pivot[0] + off[0], -(def.at[1] - parent.pivot[1] + off[1]), 0]
			: [0, 0, 0];
		const p = parts[part];
		return (
			<group key={part} position={pos} rotation-z={((pose.angles[part] ?? 0) * Math.PI) / 180}>
				<primitive object={p.mesh} position={[p.w / 2 - def.pivot[0], -(p.h / 2 - def.pivot[1]), 0]} />
				{(kids[part] ?? []).map(node)}
			</group>
		);
	};
	const lift = pose.lift ?? [0, 0];
	return <group position={[-info.soleX + lift[0], info.sole + lift[1], 0]}>{node(rig.root)}</group>;
};
