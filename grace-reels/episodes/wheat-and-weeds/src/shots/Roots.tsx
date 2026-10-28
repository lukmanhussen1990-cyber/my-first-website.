// S7 underground: the cutaway. Below the soil line the roots of the wheat (gold-brown) and the tares (dark)
// are tangled like a net. When the weed is pulled, its roots tear out of the soil, and the golden roots
// knotted into them come up too ("lest… ye root up also the wheat with them").
import {useMemo} from 'react';
import * as THREE from 'three';
import {Particles, ParticleSpec} from '../fx/Particles';
import {clamp, easeIn, easeInOut, easeOut, lerp, seg} from '../lib/ease';
import {hash, mulberry32} from '../lib/random';
import {B} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Sky} from '../world/atmosphere';
import {MoodLights} from '../world/Lights';
import {FieldPatch, Wheat} from '../world/Field';
import {FIELD_GOLDEN, Mood, skyFromMood} from '../world/mood';
import {fogOf, GOLDEN_GRADE} from './common';

const MOOD: Mood = {...FIELD_GOLDEN, sunDir: [-0.55, 0.38, -0.74]};
const W = 1.9; // half width of the cut
const DEPTH = 1.5;

// the stalks standing on the cut: x positions, which are tares, and which wheat roots are knotted into the
// pulled tare's roots (they come up with it)
type Plant = {x: number; tare: boolean; tangled: boolean; seed: number};
const PLANTS: Plant[] = [
	{x: -1.25, tare: false, tangled: false, seed: 1},
	{x: -0.78, tare: false, tangled: false, seed: 2},
	{x: -0.36, tare: false, tangled: true, seed: 3},
	{x: 0.0, tare: true, tangled: false, seed: 4}, // the one the servant pulls
	{x: 0.38, tare: false, tangled: true, seed: 5},
	{x: 0.8, tare: true, tangled: false, seed: 6},
	{x: 1.22, tare: false, tangled: false, seed: 7},
];
const PULLED = 3;

// One root system: a few main roots wandering down and out, branching, built as tubes. Roots of a tangled
// neighbour reach toward the pulled tare and wrap through its roots.
const rootGeometry = (p: Plant) => {
	const rnd = mulberry32(900 + p.seed);
	const tubes: THREE.BufferGeometry[] = [];
	const hairs: number[] = [];
	const main = p.tare ? 7 : 6;
	for (let r = 0; r < main; r++) {
		const pts: THREE.Vector3[] = [];
		const spread = (r / (main - 1) - 0.5) * 2;
		let x = 0;
		let y = -0.02;
		let dx = spread * 0.12 + (rnd() - 0.5) * 0.05;
		const len = 0.7 + rnd() * 0.65;
		const n = 9;
		// tangled wheat roots bend toward the tare at x = 0
		const toward = p.tangled ? -Math.sign(p.x) * 0.06 : 0;
		for (let i = 0; i <= n; i++) {
			pts.push(new THREE.Vector3(x, y, 0.03 + rnd() * 0.06));
			const k = i / n;
			x += dx + (rnd() - 0.5) * 0.05 + toward * (1 - k);
			y -= (len / n) * (0.75 + rnd() * 0.5);
			dx *= 0.85;
		}
		const curve = new THREE.CatmullRomCurve3(pts);
		const radius = (p.tare ? 0.011 : 0.009) * (1 - 0.2 * rnd());
		const tube = new THREE.TubeGeometry(curve, 24, radius, 5, false);
		// taper toward the tip
		const pos = tube.attributes.position as THREE.BufferAttribute;
		const ring = 6;
		for (let s = 0; s <= 24; s++) {
			const c = curve.getPointAt(s / 24);
			const tp = 1 - 0.8 * (s / 24);
			for (let j = 0; j < ring; j++) {
				const v = s * ring + j;
				if (v >= pos.count) continue;
				pos.setXYZ(v, c.x + (pos.getX(v) - c.x) * tp, c.y + (pos.getY(v) - c.y) * tp, c.z + (pos.getZ(v) - c.z) * tp);
			}
		}
		tubes.push(tube.toNonIndexed());
		// branches and fine root hairs along the main root
		for (let b = 0; b < 4; b++) {
			const s = 0.2 + rnd() * 0.7;
			const o = curve.getPointAt(s);
			const bp = [o.clone()];
			let bx = o.x;
			let by = o.y;
			const side = rnd() > 0.5 ? 1 : -1;
			for (let i = 0; i < 4; i++) {
				bx += side * (0.04 + rnd() * 0.05);
				by -= 0.03 + rnd() * 0.05;
				bp.push(new THREE.Vector3(bx, by, o.z + (rnd() - 0.5) * 0.02));
			}
			tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), 8, radius * 0.5, 4, false).toNonIndexed());
		}
		for (let h = 0; h < 18; h++) {
			const o = curve.getPointAt(rnd());
			const a = rnd() * Math.PI * 2;
			const l = 0.02 + rnd() * 0.04;
			hairs.push(o.x, o.y, o.z + 0.005, o.x + Math.cos(a) * l, o.y + Math.sin(a) * l, o.z + 0.005);
		}
	}
	const P: number[] = [];
	for (const g of tubes) {
		g.deleteAttribute('uv');
		P.push(...(g.attributes.position.array as Float32Array));
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	geo.computeVertexNormals();
	const hair = new THREE.BufferGeometry();
	hair.setAttribute('position', new THREE.Float32BufferAttribute(hairs, 3));
	return {geo, hair};
};

// The soil face: layered earth, darker and redder deeper down, crumbs and little stones.
const soilMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uLight: {value: 1}},
		vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
		fragmentShader: `
			uniform float uLight; varying vec3 vP;
			float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
			float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
				return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
			void main(){
				float d = -vP.y;
				vec3 top = vec3(0.36, 0.25, 0.16), mid = vec3(0.27, 0.18, 0.12), deep = vec3(0.2, 0.13, 0.1);
				vec3 c = d < 0.5 ? mix(top, mid, d / 0.5) : mix(mid, deep, clamp((d - 0.5) / 1.0, 0.0, 1.0));
				// soft bands of earth and a fine grain of crumbs
				c *= 0.9 + 0.12 * sin(d * 18.0 + vn(vP.xy * 3.0) * 4.0);
				float g = vn(vP.xy * 60.0);
				c *= 0.82 + 0.3 * g;
				float speck = step(0.93, h21(floor(vP.xy * 140.0)));
				c = mix(c, vec3(0.55, 0.45, 0.36), speck * 0.6);
				gl_FragColor = vec4(c * uLight, 1.0);
				#include <colorspace_fragment>
			}`,
		toneMapped: false,
	});

// pull amounts over time: tension, the tare tearing out, then the tangled wheat following it
const pullState = (t: number) => {
	const tension = easeInOut(seg(t, B.pull, B.taresRip, (x) => x));
	const tareUp = easeIn(seg(t, B.taresRip, B.taresRip + 0.5, (x) => x)) * 0.5 + easeOut(seg(t, B.taresRip + 0.5, B.wheatRip + 1.4, (x) => x)) * 0.9;
	const wheatUp = easeIn(seg(t, B.wheatRip, B.wheatRip + 0.45, (x) => x)) * 0.35 + easeOut(seg(t, B.wheatRip + 0.45, B.s8, (x) => x)) * 0.6;
	return {tension, tareUp, wheatUp};
};

const rootsCam = (t: number): CamState => {
	const k = easeOut(seg(t, B.underground - 0.3, B.underground + 0.7, (x) => x));
	const push = seg(t, B.underground + 0.7, B.s8, (x) => x);
	return {pos: [lerp(0.05, 0.0, k), lerp(0.45, -0.3, k), lerp(1.9, 2.15, k) - 0.25 * push], target: [0, lerp(0.1, -0.33, k), 0], fov: 52, drift: 0.5};
};

// crumbs of soil falling from the roots as they come out
const crumbs = (() => {
	const out: ParticleSpec[] = [];
	const add = (t0: number, t1: number, x0: number, n: number, seed: number) => {
		for (let i = 0; i < n; i++) {
			out.push({
				birth: t0 + hash(seed, i) * (t1 - t0),
				pos: [x0 + (hash(seed + 1, i) - 0.5) * 0.5, -0.05 - hash(seed + 2, i) * 0.6, 0.06],
				vel: [(hash(seed + 3, i) - 0.5) * 0.4, 0.2 + hash(seed + 4, i) * 0.5, (hash(seed + 5, i) - 0.5) * 0.1],
				life: 0.9 + hash(seed + 6, i) * 0.6,
				size: 0.5 + hash(seed + 7, i) * 0.8,
				seed: hash(seed + 8, i),
			});
		}
	};
	add(B.pull + 0.2, B.taresRip, 0, 30, 11);
	add(B.taresRip, B.taresRip + 0.5, 0, 90, 21);
	add(B.wheatRip, B.wheatRip + 0.5, 0, 110, 31);
	return out;
})();

const STRIP: FieldPatch = {x0: -W, x1: W, z0: -0.55, z1: -0.12, row: 0.21, step: 0.13, tare: 0.2, seed: 91, detail: 'hero', path: false, chunk: 2, flat: true};
const single = (p: Plant): FieldPatch => ({x0: p.x, x1: p.x, z0: 0.03, z1: 0.03, row: 0.001, step: 0.001, tare: p.tare ? 1 : 0, seed: 300 + p.seed, detail: 'hero', path: false, flat: true, rot: 0.3 * p.seed});

const RootsContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const roots = useMemo(() => PLANTS.map(rootGeometry), []);
	const mats = useMemo(
		() => ({
			soil: soilMaterial(),
			wheatRoot: new THREE.MeshLambertMaterial({color: '#c99a5a', emissive: '#6a4a20', emissiveIntensity: 0.25}),
			tareRoot: new THREE.MeshLambertMaterial({color: '#3b2a2a', emissive: '#120a0a', emissiveIntensity: 0.2}),
			hairW: new THREE.LineBasicMaterial({color: '#d9b37a', transparent: true, opacity: 0.7}),
			hairT: new THREE.LineBasicMaterial({color: '#4a3632', transparent: true, opacity: 0.7}),
			stalk: new THREE.MeshLambertMaterial({color: '#c9a050'}),
			stalkT: new THREE.MeshLambertMaterial({color: '#4c4636'}),
			ground: new THREE.MeshLambertMaterial({color: '#6a4a30'}),
		}),
		[],
	);
	const ps = pullState(t);
	const shake = (k: number, s: number) => (k > 0 && k < 1 ? Math.sin(t * 60 + s) * 0.004 * Math.sin(Math.PI * k) : 0);
	return (
		<>
			<Sky {...skyFromMood(MOOD, t)} />
			<MoodLights mood={MOOD} center={[0, 0, 0]} span={4} lite={lite} />
			{/* the soil block, cut open toward the camera; the field surface on top of it */}
			<mesh position={[0, -DEPTH / 2, -0.01]} material={mats.soil}>
				<planeGeometry args={[W * 2 + 3, DEPTH + 0.02]} />
			</mesh>
			<mesh position={[0, 0.0, -0.6]} rotation-x={-Math.PI / 2} material={mats.ground} receiveShadow>
				<planeGeometry args={[W * 2 + 3, 1.2]} />
			</mesh>
			<Wheat patch={STRIP} state={{time: t, wind: 0.6, grow: 1, ripe: 0.75, tareDark: 1, tareShow: 1, spots: 0, glow: 0}} light={{dir: MOOD.sunDir, color: MOOD.sunColor, back: 0.6}} />
			{PLANTS.map((p, i) => {
				const up = i === PULLED ? ps.tension * 0.035 + ps.tareUp : p.tangled ? ps.tension * 0.015 + ps.wheatUp : ps.tension * 0.006;
				// tangled roots are first stretched, then snap free and follow
				const stretch = p.tangled ? 1 + 0.06 * ps.tension * (1 - seg(t, B.wheatRip, B.wheatRip + 0.15)) : 1;
				const sway = i === PULLED || p.tangled ? shake(ps.tension, i) : 0;
				return (
					<group key={i} position={[p.x + sway, up, 0.02]}>
						<group scale={[1, stretch, 1]}>
							<mesh geometry={roots[i].geo} material={p.tare ? mats.tareRoot : mats.wheatRoot} />
							<lineSegments geometry={roots[i].hair} material={p.tare ? mats.hairT : mats.hairW} />
						</group>
					</group>
				);
			})}
			{PLANTS.map((p, i) => {
				const up = i === PULLED ? ps.tension * 0.035 + ps.tareUp : p.tangled ? ps.tension * 0.015 + ps.wheatUp : ps.tension * 0.006;
				// the stalk above the soil line, in front of the strip of field
				return (
					<group key={`s${i}`} position={[0, up, 0]}>
						<Wheat patch={single(p)} state={{time: t, wind: i === PULLED || p.tangled ? 0.2 : 0.6, grow: 1, ripe: 0.75, tareDark: 1, tareShow: 1, spots: 0, glow: 0}} light={{dir: MOOD.sunDir, color: MOOD.sunColor, back: 0.6}} />
					</group>
				);
			})}
			<Particles specs={crumbs} t={t} gravity={-2.2} drag={0.6} additive={false} colors={['#5a4030', '#4a3424', '#3a281c']} opacity={0.95} px={6} swirl={0.01} renderOrder={70} />
		</>
	);
};

export const ROOTS: ShotDef = {
	id: 'ROOTS',
	start: B.underground - 0.5,
	end: B.s8 + 0.3,
	Content: RootsContent,
	camera: rootsCam,
	grade: (t) => ({...GOLDEN_GRADE, exposure: 0.85 + 0.15 * seg(t, B.underground - 0.2, B.underground + 0.4), vignette: 0.6}),
	fog: () => fogOf(MOOD, 4),
};

void clamp;
