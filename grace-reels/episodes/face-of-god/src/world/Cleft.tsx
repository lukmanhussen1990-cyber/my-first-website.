// "A clift of the rock" (Exodus 33:22): a granite outcrop high on Sinai with one narrow cleft, Moses
// hidden inside. God's glory passes by only as light: a covering shadow over the opening (never a hand
// shape), a roaring river of white-gold light outside, and afterwards long trails of light fading away.
import {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {fbm2, hash} from '../lib/random';
import {cached} from './cache';
import {gridLine, mergePlaced, paintFaces, rock, terrainGrid} from './lowpoly';
import {sinaiGeometry} from './Sinai';
import {Rain, StormSky, Vec3} from './storm';

// The cleft: centred on x = CLEFT_X, CLEFT_W wide, CLEFT_H tall, CLEFT_D deep (the face is at z ~ 0).
export const CLEFT_X = 0.3;
export const CLEFT_W = 1.3;
export const CLEFT_H = 3.3;
export const CLEFT_D = 1.25;

const sstep = (a: number, b: number, x: number) => {
	const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return u * u * (3 - 2 * u);
};

// Half the width of the cleft at height y (the same profile outside and in the crevice behind it).
const cleftHalf = (y: number, top = CLEFT_H) => (CLEFT_W / 2) * (1 - sstep(0.9, top, y) * 0.94);

// How far the rock face stands out (+z) at (x, y). Negative = recessed. The face turns away at the
// right edge (the corner of the outcrop) so there is open sky beyond it.
export const faceDepth = (x: number, y: number) => {
	const relief = 0.28 * fbm2(x * 0.45, y * 0.45, 31) + 0.12 * fbm2(x * 1.3, y * 1.3, 32);
	const lean = -0.06 * Math.max(0, y - 1);
	const corner = x > 1.5 ? -((x - 1.5) ** 2) * 3.2 : 0;
	// the cleft: a jagged crack, wide enough for a man at the bottom, narrowing to a point at the top
	const top = CLEFT_H + 0.3 * fbm2(x * 3, 5, 33);
	const half = cleftHalf(y, top) + 0.05 * fbm2(y * 4, 1, 34);
	const inside = (1 - sstep(half - 0.04, half + 0.05, Math.abs(x - CLEFT_X))) * (1 - sstep(top - 0.15, top, y)) * sstep(-0.6, -0.4, y);
	return relief + lean + corner - inside * CLEFT_D;
};

const build = () => {
	const g1 = new THREE.Color('#857b72');
	const g2 = new THREE.Color('#9a9086');
	const g3 = new THREE.Color('#4e4741');
	// the face as a heightfield in (x, y), then stood up: terrainGrid works in (x, z), so map z -> y
	const xs = gridLine(-11, 2.6, CLEFT_X, 0.05, 0.9, 3.5);
	const ys = gridLine(-1.5, 11, 1.2, 0.08, 0.9, 4);
	const face = terrainGrid({
		xs,
		zs: ys,
		height: (x, y) => faceDepth(x, y),
		seed: 41,
		jitter: 0.05,
		wobble: 0.18,
		color: (x, h, y, ny) => {
			const n = fbm2(x * 0.5, y * 0.5, 7) + 0.5;
			const c = g1.clone().lerp(g2, Math.min(1, Math.max(0, n)));
			// the inner walls of the cleft are darker
			if (h < -0.2) c.lerp(g3, Math.min(1, -h / CLEFT_D) * 0.6);
			return c;
		},
	});
	// stand it up: (x, height, y) -> (x, y, height)
	const pos = face.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const h = pos.getY(i);
		const y = pos.getZ(i);
		pos.setXYZ(i, x, y, h);
	}
	face.computeVertexNormals();
	// the ledge in front of the face: walkable near the cleft, falling away to the right
	const ledgeC1 = new THREE.Color('#4f4a4c');
	const ledgeC2 = new THREE.Color('#625a58');
	const ground = terrainGrid({
		xs: gridLine(-40, 60, 0, 0.3, 6, 20),
		zs: gridLine(-2, 60, 0, 0.3, 6, 20),
		height: (x, z) => 0.06 * fbm2(x * 0.6, z * 0.6, 9) - (x > 2.4 ? (x - 2.4) ** 1.3 * 4 : 0) - (z > 3.5 ? (z - 3.5) ** 1.3 * 3 : 0) - (Math.hypot(x, z) > 20 ? 60 : 0),
		seed: 43,
		jitter: 0.05,
		color: (x, y, z, ny) => ledgeC1.clone().lerp(ledgeC2, Math.min(1, Math.max(0, 0.5 + fbm2(x * 0.3, z * 0.3, 2)))).multiplyScalar(ny < 0.6 ? 0.75 : 1),
	});
	const stones: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 18; i++) {
		const x = -6 + hash(61, i) * 8;
		const z = 0.6 + hash(62, i) * 3;
		if (Math.abs(x - CLEFT_X) < 1.2 && z < 2.2) continue;
		const s = 0.2 + hash(63, i) ** 2 * 0.9;
		stones.push({geo: rock(900 + i, hash(64, i) > 0.5 ? '#5a5452' : '#45434c'), pos: [x, -0.05, z], rot: hash(65, i) * 6, scale: s});
	}
	return {face, ground, stones: mergePlaced(stones)};
};

export const cleftGeometry = () => cached('cleftGeo', build);

// The view from inside: a long narrow crevice behind the opening (only used by the inside shot): two
// jagged walls with the same profile as the cleft, meeting overhead, and a floor.
const buildCrevice = () => {
	const parts: THREE.BufferGeometry[] = [];
	const c1 = new THREE.Color('#4b4d57');
	const c2 = new THREE.Color('#67666e');
	for (const side of [-1, 1]) {
		// coarse cells with every corner knocked about: broken granite facets, not smooth folds
		const g = new THREE.PlaneGeometry(4.6, 3.8, 13, 11);
		const pos = g.attributes.position as THREE.BufferAttribute;
		const sd = side > 0 ? 51 : 52;
		for (let i = 0; i < pos.count; i++) {
			const u0 = pos.getX(i);
			const v0 = pos.getY(i);
			const edge = Math.abs(u0) > 2.29 || Math.abs(v0) > 1.89;
			const u = u0 + (edge ? 0 : (hash(sd, i, 1) - 0.5) * 0.24); // along the crevice (-2.3..2.3)
			const v = v0 + 1.9 + (edge ? 0 : (hash(sd, i, 2) - 0.5) * 0.22); // height 0..3.8
			const z = u - 2.3; // from the opening (z 0) back to z -4.6
			const half = cleftHalf(v);
			const amp = Math.min(1, half / 0.3);
			const x = CLEFT_X + side * (half + amp * (0.12 * fbm2(z * 0.6, v * 0.6, sd) + (hash(sd, i, 3) - 0.5) * 0.16) + 0.03);
			pos.setXYZ(i, x, v - 0.1, z);
		}
		parts.push(paintFaces(g.toNonIndexed(), (x, y, z) => c1.clone().lerp(c2, Math.min(1, Math.max(0, 0.5 + fbm2(y * 2, z * 2, 53)))).multiplyScalar(0.75 + 0.35 * Math.min(1, (z + 4.6) / 4.6)), 0.16, side > 0 ? 54 : 55));
	}
	const floor = new THREE.PlaneGeometry(2.4, 4.8, 6, 12);
	floor.rotateX(-Math.PI / 2);
	floor.translate(CLEFT_X, -0.03, -2.3);
	parts.push(paintFaces(floor, () => new THREE.Color('#3e3936'), 0.12, 59));
	const back = new THREE.PlaneGeometry(1.6, 3.8, 4, 6);
	back.translate(CLEFT_X, 1.8, -4.55);
	parts.push(paintFaces(back, () => c1.clone().multiplyScalar(0.5), 0.05, 56));
	return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
};
export const creviceGeometry = () => cached('creviceGeo', buildCrevice);

// ---------------- light only: the river, the covering shadow, the trails ----------------
const riverMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uT: {value: 0}, uI: {value: 0}, uFlow: {value: 1}},
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: `
			float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
			float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
				return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
			float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
			uniform float uT, uI, uFlow; varying vec2 vUv;
			void main(){
				// streaks rushing sideways, stretched along the flow
				vec2 p = vec2(vUv.x * 3.0 - uT * 2.6 * uFlow, vUv.y * 14.0);
				float s = fbm(vec2(p.x, p.y * 0.35)) * 0.7 + fbm(vec2(p.x * 2.3 - uT * 1.4, p.y)) * 0.5;
				s = smoothstep(0.35, 1.05, s);
				float band = exp(-pow((vUv.y - 0.5) / 0.22, 2.0));
				float core = exp(-pow((vUv.y - 0.5) / 0.07, 2.0));
				float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
				vec3 gold = vec3(1.0, 0.86, 0.55), white = vec3(1.0, 0.97, 0.9);
				vec3 c = gold * band * (0.15 + 1.2 * s) + white * core * (0.5 + 1.2 * s);
				gl_FragColor = vec4(c * edge * uI, 1.0);
			}`,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		side: THREE.DoubleSide,
		fog: false,
	});

// A roaring river of white-gold light rushing past (left to right), seen through the opening.
export const LightRiver: React.FC<{position: Vec3; size: [number, number]; t: number; intensity: number}> = ({position, size, t, intensity}) => {
	const mat = useMemo(riverMaterial, []);
	mat.uniforms.uT.value = t;
	mat.uniforms.uI.value = intensity;
	return (
		<mesh position={position} material={mat} renderOrder={900} frustumCulled={false} visible={intensity > 0.001}>
			<planeGeometry args={size} />
		</mesh>
	);
};

const coverMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uCover: {value: 0}, uLeak: {value: 0}},
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: `uniform float uCover, uLeak; varying vec2 vUv;
			void main(){
				// a broad soft shade that slides over the cleft from the right and lifts off again; a little light
				// leaks along its edge (no shape of anything, only shade)
				vec2 c = vec2(mix(1.9, 0.5, uCover), 0.5);
				float d = length((vUv - c) * vec2(1.0, 0.7));
				float shade = smoothstep(0.75, 0.2, d) * uCover;
				float rim = exp(-pow((d - 0.62) / 0.08, 2.0));
				gl_FragColor = vec4(vec3(1.0, 0.86, 0.58) * rim * uLeak * 0.5, shade * 0.72);
			}`,
		transparent: true,
		depthWrite: false,
		fog: false,
	});

export const CoveringShadow: React.FC<{position: Vec3; size: [number, number]; cover: number; leak: number}> = ({position, size, cover, leak}) => {
	const mat = useMemo(coverMaterial, []);
	mat.uniforms.uCover.value = cover;
	mat.uniforms.uLeak.value = leak;
	return (
		<mesh position={position} material={mat} renderOrder={910} frustumCulled={false} visible={cover > 0.001}>
			<planeGeometry args={size} />
		</mesh>
	);
};

const trailMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uHead: {value: 0}, uLen: {value: 0.4}, uI: {value: 1}, uW: {value: 0.012}},
		vertexShader: `uniform float uW; attribute vec3 aDir; varying vec2 vUv;
			void main(){
				vUv = uv;
				vec3 P = position;
				vec3 toCam = cameraPosition - P;
				vec3 side = normalize(cross(aDir, normalize(toCam)));
				// about the same width on screen all along, thinning toward the far end
				P += side * uv.y * uW * length(toCam) * (1.0 - 0.55 * uv.x);
				gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
			}`,
		fragmentShader: `uniform float uHead, uLen, uI; varying vec2 vUv;
			void main(){
				// bright at the head (moving away along the curve), a long tail behind it
				float d = uHead - vUv.x;
				float tail = d < 0.0 ? 0.0 : exp(-d / uLen);
				float head = exp(-pow(d / 0.015, 2.0)) * 0.6;
				float across = exp(-vUv.y * vUv.y * 3.0);
				float ends = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
				vec3 c = vec3(1.0, 0.86, 0.58) * tail * across + vec3(1.0, 0.97, 0.9) * head * 2.0 * across;
				gl_FragColor = vec4(c * uI * ends, 1.0);
			}`,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		side: THREE.DoubleSide,
		fog: false,
	});

// Long trails of light curving away into the distance, like a comet's tail (all that Moses saw).
export const LightTrails: React.FC<{curves: Vec3[][]; head: number; intensity: number; len?: number; width?: number}> = ({curves, head, intensity, len = 0.45, width = 0.012}) => {
	const items = useMemo(
		() =>
			curves.map((pts) => {
				const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
				const n = 120;
				const pos: number[] = [];
				const uv: number[] = [];
				const dir: number[] = [];
				const idx: number[] = [];
				for (let i = 0; i <= n; i++) {
					const u = i / n;
					const p = curve.getPointAt(u);
					const d = curve.getTangentAt(u);
					for (const side of [-1, 1]) {
						pos.push(p.x, p.y, p.z);
						uv.push(u, side);
						dir.push(d.x, d.y, d.z);
					}
					if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
				}
				const g = new THREE.BufferGeometry();
				g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
				g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
				g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
				g.setIndex(idx);
				return {g, mat: trailMaterial()};
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);
	return (
		<>
			{items.map(({g, mat}, k) => {
				mat.uniforms.uHead.value = head * (1 - 0.08 * k);
				mat.uniforms.uLen.value = len * (1 + 0.25 * k);
				mat.uniforms.uW.value = width * (1 - 0.2 * k);
				mat.uniforms.uI.value = intensity * (1 - 0.25 * k);
				return <mesh key={k} geometry={g} material={mat} renderOrder={905} frustumCulled={false} visible={intensity > 0.001} />;
			})}
		</>
	);
};

export type CleftLook = {
	glow: number; // the glory light approaching / passing (warm light on the rock)
	hole: number; // the opening in the clouds
	rain: number;
	storm: number;
};

export const CleftWorld: React.FC<{t: number; look: CleftLook; rainBox?: {center: Vec3; size: Vec3}; glowFrom?: Vec3; face?: boolean; holeDir?: Vec3; holeSize?: number}> = ({
	t,
	look,
	rainBox,
	glowFrom = [9, 6, 6],
	face = true,
	holeDir = [0.62, 0.42, -0.66],
	holeSize = 1,
}) => {
	const g = cleftGeometry();
	const s = sinaiGeometry();
	const m = cached('cleftMat', () => new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, side: THREE.DoubleSide}));
	const target = cached('cleftTarget', () => new THREE.Object3D());
	return (
		<>
			<StormSky t={t} holeDir={holeDir} hole={look.hole} holeSize={holeSize} top="#121831" mid="#353a58" low="#262b45" swirl={1} />
			<primitive object={target} position={[CLEFT_X, 1.2, -0.4]} />
			<hemisphereLight args={['#6c7cb4', '#1a1f33', 1.4 * look.storm]} />
			<directionalLight position={[-20, 25, 40]} target={target} color="#8ea2d8" intensity={0.5 * look.storm} />
			{/* the glory's light, raking in from the right */}
			<directionalLight position={glowFrom} target={target} color="#ffe2a8" intensity={0.2 + 3.2 * look.glow} />
			{face && <mesh geometry={g.face} material={m} />}
			<mesh geometry={g.ground} material={m} />
			<mesh geometry={g.stones} material={m} />
			<group position={[30, -12, -40]}>
				<mesh geometry={s.peaks} material={m} />
			</group>
			{rainBox && <Rain count={1300} center={rainBox.center} size={rainBox.size} t={t} wind={[0.42, 0.08]} speed={15} length={0.6} opacity={0.4 * look.rain} />}
		</>
	);
};
