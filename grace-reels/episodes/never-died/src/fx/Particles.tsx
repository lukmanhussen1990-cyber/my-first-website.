// GPU particles that are a pure function of time: each one has a birth time, start position,
// velocity and life (all precomputed with seeded randomness). Used for sparks, embers and dust.
import {useMemo} from 'react';
import * as THREE from 'three';
import {softDot} from '../lib/textures';

export type ParticleSpec = {birth: number; pos: [number, number, number]; vel: [number, number, number]; life: number; size: number; seed: number};

export const Particles: React.FC<{
	specs: ParticleSpec[];
	t: number;
	gravity?: number; // + rises (buoyant embers), - falls
	drag?: number;
	colors?: [string, string, string]; // young, middle, old
	additive?: boolean;
	opacity?: number;
	px?: number;
	swirl?: number;
	renderOrder?: number;
	fog?: boolean;
}> = ({specs, t, gravity = 0.8, drag = 0.6, colors = ['#fff1b0', '#ff9a3c', '#9c2a0c'], additive = true, opacity = 1, px = 10, swirl = 0.15, renderOrder = 960, fog = false}) => {
	const geo = useMemo(() => {
		const n = specs.length;
		const g = new THREE.BufferGeometry();
		const pos = new Float32Array(n * 3);
		const vel = new Float32Array(n * 3);
		const meta = new Float32Array(n * 4);
		specs.forEach((s, i) => {
			pos.set(s.pos, i * 3);
			vel.set(s.vel, i * 3);
			meta.set([s.birth, s.life, s.size, s.seed], i * 4);
		});
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
		g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4));
		return g;
	}, [specs]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uMap: {value: softDot()},
					uT: {value: 0},
					uG: {value: 0},
					uDrag: {value: 0},
					uC0: {value: new THREE.Color()},
					uC1: {value: new THREE.Color()},
					uC2: {value: new THREE.Color()},
					uOpacity: {value: 1},
					uPx: {value: 10},
					uSwirl: {value: 0},
					uAdd: {value: 1},
				},
				vertexShader: `attribute vec3 aVel; attribute vec4 aMeta;
					uniform float uT, uG, uDrag, uPx, uSwirl; varying float vAge; varying float vAlive;
					void main(){
						float age = uT - aMeta.x;
						float life = aMeta.y;
						vAlive = step(0., age) * step(age, life);
						float a = clamp(age, 0., life);
						float k = uDrag > 0. ? (1. - exp(-uDrag * a)) / uDrag : a;
						vec3 p = position + aVel * k + vec3(0., 0.5 * uG * a * a, 0.);
						p.x += uSwirl * sin(a * 6.0 + aMeta.w * 40.) * a;
						p.z += uSwirl * cos(a * 5.0 + aMeta.w * 30.) * a;
						vAge = a / life;
						vec4 mv = modelViewMatrix * vec4(p, 1.);
						gl_Position = projectionMatrix * mv;
						gl_PointSize = vAlive * uPx * aMeta.z * (1.0 - 0.6 * vAge) * (30.0 / max(0.5, -mv.z));
					}`,
				fragmentShader: `uniform sampler2D uMap; uniform vec3 uC0, uC1, uC2; uniform float uOpacity, uAdd; varying float vAge; varying float vAlive;
					void main(){
						if (vAlive < 0.5) discard;
						float m = texture2D(uMap, gl_PointCoord).a;
						vec3 c = vAge < 0.4 ? mix(uC0, uC1, vAge / 0.4) : mix(uC1, uC2, (vAge - 0.4) / 0.6);
						float fade = smoothstep(1.0, 0.65, vAge) * smoothstep(0.0, 0.05, vAge);
						float a = m * fade * uOpacity;
						gl_FragColor = uAdd > 0.5 ? vec4(c * a * 1.8, 1.) : vec4(c * a, a);
					}`,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uT.value = t;
	u.uG.value = gravity;
	u.uDrag.value = drag;
	u.uC0.value.set(colors[0]);
	u.uC1.value.set(colors[1]);
	u.uC2.value.set(colors[2]);
	u.uOpacity.value = opacity;
	u.uPx.value = px;
	u.uSwirl.value = swirl;
	u.uAdd.value = additive ? 1 : 0;
	mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
	mat.premultipliedAlpha = !additive;
	return <points geometry={geo} material={mat} renderOrder={renderOrder} frustumCulled={false} />;
};
