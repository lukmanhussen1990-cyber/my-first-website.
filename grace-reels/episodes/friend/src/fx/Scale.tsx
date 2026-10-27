// An old bronze balance scale, a simple iron chain with a shackle ring, and a small blank tag, built in
// code so the beam can tip and the pans can swing. Units are metres; the scale stands on y = 0.
import {useMemo} from 'react';
import * as THREE from 'three';
import {cached} from '../world/cache';

export const SCALE = {
	pivotY: 0.52,
	arm: 0.27, // pivot to the hanging point
	hang: 0.29, // hanging point to the pan
	panR: 0.1,
};

const bronze = () =>
	cached('bronze', () => new THREE.MeshPhongMaterial({color: '#9a6a34', specular: new THREE.Color('#ffd9a0'), shininess: 38, flatShading: true}));
const iron = () => cached('iron', () => new THREE.MeshPhongMaterial({color: '#5e5a55', specular: new THREE.Color('#d8d0c4'), shininess: 30, flatShading: true}));

// Hanging point of a pan for a beam tilt (radians, + = left side down) and the pan centre below it.
export const panAt = (side: -1 | 1, tilt: number, swing = 0): {hook: THREE.Vector3; pan: THREE.Vector3} => {
	// beam: left end at -arm, right end at +arm; positive tilt lowers the left end
	const a = -tilt;
	const hook = new THREE.Vector3(side * SCALE.arm * Math.cos(a), SCALE.pivotY + side * SCALE.arm * Math.sin(a), 0);
	const pan = hook.clone().add(new THREE.Vector3(Math.sin(swing) * SCALE.hang, -Math.cos(swing) * SCALE.hang, 0));
	return {hook, pan};
};

const geoms = () =>
	cached('scaleGeo', () => {
		const lathe = (pts: [number, number][], seg = 18) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
		const base = lathe([[0, 0], [0.13, 0], [0.13, 0.012], [0.1, 0.03], [0.03, 0.04], [0.02, 0.05], [0, 0.05]], 20);
		const post = new THREE.CylinderGeometry(0.013, 0.018, SCALE.pivotY - 0.04, 8);
		post.translate(0, 0.04 + (SCALE.pivotY - 0.04) / 2, 0);
		const finial = lathe([[0, 0], [0.022, 0.01], [0.026, 0.03], [0.012, 0.055], [0, 0.07]], 10);
		finial.translate(0, SCALE.pivotY + 0.01, 0);
		const beam = new THREE.BoxGeometry(SCALE.arm * 2 + 0.03, 0.016, 0.018);
		const knob = new THREE.SphereGeometry(0.014, 8, 6);
		const pan = lathe([[0, 0], [0.06, 0.003], [0.092, 0.016], [SCALE.panR, 0.03], [0.096, 0.031], [0.088, 0.019], [0.055, 0.008], [0, 0.006]], 22);
		const ring = new THREE.TorusGeometry(0.011, 0.003, 6, 12);
		return {base, post, finial, beam, knob, pan, ring};
	});

// Three thin chains from the hook down to the pan rim (drawn as fine cylinders).
const PanChains: React.FC<{hook: THREE.Vector3; pan: THREE.Vector3; mat: THREE.Material}> = ({hook, pan, mat}) => (
	<>
		{[0, 1, 2].map((k) => {
			const a = (k / 3) * Math.PI * 2 + 0.4;
			const rim = pan.clone().add(new THREE.Vector3(Math.cos(a) * (SCALE.panR - 0.006), 0.03, Math.sin(a) * (SCALE.panR - 0.006)));
			const mid = hook.clone().add(rim).multiplyScalar(0.5);
			const len = hook.distanceTo(rim);
			const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rim.clone().sub(hook).normalize());
			return (
				<mesh key={k} position={mid} quaternion={q} material={mat} castShadow>
					<cylinderGeometry args={[0.0018, 0.0018, len, 4]} />
				</mesh>
			);
		})}
	</>
);

export const BalanceScale: React.FC<{tilt: number; swing?: [number, number]; position?: [number, number, number]; children?: React.ReactNode}> = ({
	tilt,
	swing = [0, 0],
	position = [0, 0, 0],
	children,
}) => {
	const g = geoms();
	const m = bronze();
	const L = panAt(-1, tilt, swing[0]);
	const R = panAt(1, tilt, swing[1]);
	return (
		<group position={position}>
			<mesh geometry={g.base} material={m} castShadow receiveShadow />
			<mesh geometry={g.post} material={m} castShadow />
			<mesh geometry={g.finial} material={m} castShadow />
			<group position={[0, SCALE.pivotY, 0]} rotation-z={-tilt}>
				<mesh geometry={g.beam} material={m} castShadow />
				<mesh geometry={g.knob} material={m} position={[-SCALE.arm - 0.012, 0, 0]} />
				<mesh geometry={g.knob} material={m} position={[SCALE.arm + 0.012, 0, 0]} />
				<mesh geometry={g.knob} material={m} scale={1.3} />
			</group>
			{[L, R].map((p, i) => (
				<group key={i}>
					<mesh geometry={g.ring} material={m} position={p.hook} />
					<PanChains hook={p.hook} pan={p.pan} mat={m} />
					<mesh geometry={g.pan} material={m} position={p.pan} castShadow receiveShadow />
				</group>
			))}
			{children}
		</group>
	);
};

// An iron chain along a list of points (links alternate their plane), ending in an open shackle ring.
export const Chain: React.FC<{points: [number, number, number][]; linkLen?: number; withShackle?: boolean}> = ({points, linkLen = 0.022, withShackle = true}) => {
	const mat = iron();
	const geo = useMemo(() => new THREE.TorusGeometry(linkLen * 0.42, linkLen * 0.13, 5, 10).scale(1.35, 1, 1), [linkLen]);
	const shackle = useMemo(() => new THREE.TorusGeometry(0.034, 0.006, 6, 16, Math.PI * 1.7), []);
	const links: {p: THREE.Vector3; q: THREE.Quaternion}[] = [];
	const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
	const n = Math.max(2, Math.floor(curve.getLength() / (linkLen * 0.78)));
	for (let i = 0; i < n; i++) {
		const u = (i + 0.5) / n;
		const p = curve.getPointAt(u);
		const tg = curve.getTangentAt(u);
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tg);
		q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), i % 2 ? Math.PI / 2 : 0));
		links.push({p, q});
	}
	const end = curve.getPointAt(1);
	return (
		<>
			{links.map((l, i) => (
				<mesh key={i} geometry={geo} material={mat} position={l.p} quaternion={l.q} castShadow />
			))}
			{withShackle && <mesh geometry={shackle} material={mat} position={[end.x + 0.03, end.y + 0.004, end.z]} rotation-x={-Math.PI / 2} castShadow />}
		</>
	);
};

// A small blank parchment tag on a string (no writing: the label overlay says what it means).
export const Tag: React.FC<{position: [number, number, number]; rot?: number}> = ({position, rot = 0}) => {
	const mat = useMemo(() => new THREE.MeshLambertMaterial({color: '#e6d3a8', side: THREE.DoubleSide, flatShading: true}), []);
	const shape = useMemo(() => {
		const s = new THREE.Shape();
		s.moveTo(-0.022, -0.035);
		s.lineTo(0.022, -0.035);
		s.lineTo(0.022, 0.022);
		s.lineTo(0.0, 0.036);
		s.lineTo(-0.022, 0.022);
		s.closePath();
		return new THREE.ShapeGeometry(s);
	}, []);
	return (
		<group position={position} rotation-z={rot}>
			<mesh geometry={shape} material={mat} castShadow />
			<mesh position={[0, 0.06, 0]} material={iron()}>
				<cylinderGeometry args={[0.0012, 0.0012, 0.05, 4]} />
			</mesh>
		</group>
	);
};
