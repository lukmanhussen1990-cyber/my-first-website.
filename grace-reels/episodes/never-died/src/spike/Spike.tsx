// Technical spike: low-poly world + GPT sprite + custom bloom chain under SwiftShader. Delete when done.
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';

const mulberry = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const useTex = (path: string) => {
	const [tex, setTex] = useState<THREE.Texture | null>(null);
	const [handle] = useState(() => delayRender('tex ' + path));
	useEffect(() => {
		new THREE.TextureLoader().load(staticFile(path), (t) => {
			t.colorSpace = THREE.SRGBColorSpace;
			t.anisotropy = 8;
			setTex(t);
			continueRender(handle);
		});
	}, [handle, path]);
	return tex;
};

const Terrain = () => {
	const geo = useMemo(() => {
		const g = new THREE.PlaneGeometry(400, 400, 60, 60).toNonIndexed();
		g.rotateX(-Math.PI / 2);
		const p = g.attributes.position as THREE.BufferAttribute;
		const rnd = mulberry(7);
		const jit = new Map<string, number>();
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i);
			const z = p.getZ(i);
			const k = `${x.toFixed(2)},${z.toFixed(2)}`;
			if (!jit.has(k)) jit.set(k, rnd());
			const h = Math.sin(x * 0.03) * 3 + Math.cos(z * 0.025) * 4 + jit.get(k)! * 0.8 + Math.max(0, -z - 40) * 0.12;
			p.setY(i, h);
		}
		g.computeVertexNormals();
		const col = new Float32Array(p.count * 3);
		const a = new THREE.Color('#c9a25a');
		const b = new THREE.Color('#9a9a4a');
		for (let i = 0; i < p.count; i += 3) {
			const c = a.clone().lerp(b, rnd() * 0.6);
			for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
		}
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		return g;
	}, []);
	return (
		<mesh geometry={geo} receiveShadow>
			<meshLambertMaterial vertexColors flatShading />
		</mesh>
	);
};

const Trees = () => {
	const items = useMemo(() => {
		const rnd = mulberry(3);
		return Array.from({length: 120}, () => ({x: (rnd() - 0.5) * 160, z: -rnd() * 150 + 20, s: 1.5 + rnd() * 2}));
	}, []);
	const canopy = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
	const trunk = useMemo(() => new THREE.CylinderGeometry(0.15, 0.2, 2, 5), []);
	return (
		<>
			{items.map((t, i) => (
				<group key={i} position={[t.x, 0, t.z]} scale={t.s}>
					<mesh geometry={trunk} position={[0, 1, 0]} castShadow>
						<meshLambertMaterial color="#5a3a22" flatShading />
					</mesh>
					<mesh geometry={canopy} position={[0, 2.6, 0]} castShadow>
						<meshLambertMaterial color="#6f7a36" flatShading />
					</mesh>
				</group>
			))}
		</>
	);
};

const Post = () => {
	const {gl, scene, camera, size} = useThree();
	const res = useMemo(() => {
		const opt = {type: THREE.HalfFloatType, samples: 4};
		const main = new THREE.WebGLRenderTarget(size.width, size.height, opt);
		const levels = [2, 4, 8, 16].map((d) => [0, 1].map(() => new THREE.WebGLRenderTarget(size.width / d, size.height / d, {type: THREE.HalfFloatType})));
		const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
		const qs = new THREE.Scene();
		qs.add(quad);
		const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
		const blur = new THREE.ShaderMaterial({
			uniforms: {tex: {value: null}, dir: {value: new THREE.Vector2()}, threshold: {value: 0}},
			vertexShader: vs,
			fragmentShader: `uniform sampler2D tex; uniform vec2 dir; uniform float threshold; varying vec2 vUv;
				void main(){ vec3 c = vec3(0.); float w[5]; w[0]=.227; w[1]=.1945; w[2]=.1216; w[3]=.054; w[4]=.0162;
				for(int i=-4;i<=4;i++){ vec3 s = texture2D(tex, vUv + dir*float(i)).rgb; if(threshold>0.) s = max(s - threshold, 0.); c += s*w[abs(i)]; }
				gl_FragColor = vec4(c,1.); }`,
		});
		const comp = new THREE.ShaderMaterial({
			uniforms: {base: {value: null}, b0: {value: null}, b1: {value: null}, b2: {value: null}, b3: {value: null}},
			vertexShader: vs,
			fragmentShader: `uniform sampler2D base,b0,b1,b2,b3; varying vec2 vUv;
				void main(){ vec3 c = texture2D(base,vUv).rgb; vec3 bl = texture2D(b0,vUv).rgb*.5+texture2D(b1,vUv).rgb*.7+texture2D(b2,vUv).rgb*.9+texture2D(b3,vUv).rgb;
				c += bl*0.35; vec2 d = vUv-.5; c *= 1. - dot(d,d)*0.55; gl_FragColor = vec4(c,1.);
				#include <colorspace_fragment>
				}`,
		});
		return {main, levels, quad, qs, qc, blur, comp};
	}, [size.width, size.height]);
	useFrame(() => {
		const {main, levels, quad, qs, qc, blur, comp} = res;
		gl.setRenderTarget(main);
		gl.render(scene, camera);
		let src: THREE.Texture = main.texture;
		quad.material = blur;
		levels.forEach(([a, b], i) => {
			blur.uniforms.tex.value = src;
			blur.uniforms.threshold.value = i === 0 ? 0.85 : 0;
			blur.uniforms.dir.value.set(1 / a.width, 0);
			gl.setRenderTarget(a);
			gl.render(qs, qc);
			blur.uniforms.tex.value = a.texture;
			blur.uniforms.threshold.value = 0;
			blur.uniforms.dir.value.set(0, 1 / a.height);
			gl.setRenderTarget(b);
			gl.render(qs, qc);
			src = b.texture;
		});
		quad.material = comp;
		comp.uniforms.base.value = main.texture;
		levels.forEach(([, b], i) => (comp.uniforms[`b${i}`].value = b.texture));
		gl.setRenderTarget(null);
		gl.render(qs, qc);
	}, 1);
	return null;
};

const World = () => {
	const frame = useCurrentFrame();
	const tex = useTex('sprites/elijah/side.png');
	const {camera} = useThree();
	camera.position.set(-6 + frame * 0.05, 6, 22);
	camera.lookAt(0, 3, 0);
	return (
		<>
			<color attach="background" args={['#e8c48a']} />
			<fog attach="fog" args={['#e8c48a', 30, 160]} />
			<hemisphereLight args={['#fff1d0', '#7a6038', 0.9]} />
			<directionalLight
				position={[-40, 50, 30]}
				intensity={2.2}
				color="#ffe2b0"
				castShadow
				shadow-mapSize={[2048, 2048]}
				shadow-camera-left={-60}
				shadow-camera-right={60}
				shadow-camera-top={60}
				shadow-camera-bottom={-60}
				shadow-radius={6}
			/>
			<Terrain />
			<Trees />
			{tex && (
				<mesh position={[0, 3.2, 4]} castShadow>
					<planeGeometry args={[(3.2 * tex.image.width) / tex.image.height * 2, 6.4]} />
					<meshBasicMaterial map={tex} transparent alphaTest={0.02} />
				</mesh>
			)}
			<mesh position={[8, 15, -6]}>
				<cylinderGeometry args={[1.5, 6, 30, 32, 1, true]} />
				<meshBasicMaterial color="#fff2c0" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
			</mesh>
			<Post />
		</>
	);
};

export const Spike: React.FC = () => {
	const {width, height} = useVideoConfig();
	return (
		<AbsoluteFill>
			<ThreeCanvas width={width} height={height} flat shadows={{type: THREE.PCFSoftShadowMap}} dpr={1} camera={{fov: 30, near: 0.5, far: 600}}>
				<World />
			</ThreeCanvas>
		</AbsoluteFill>
	);
};
