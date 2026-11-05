// Entry point: deterministic frame renderer. The page exposes window.renderFrame(i).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {makeCharacter, makeChicken, makeDog} from './characters.js';
import {drawCaption} from './captions.js';
import {FONT, basic, box, clamp, cone, cyl, easeInOutCubic, glowTex, lerp, mat, mesh, rbox, rnd, sph, torus} from './lib.js';
import {M, P, buildTown} from './town.js';
import {bubbleTex, makeBubble} from './thoughtBubble.js';
import {SHOTS} from './shots.js';

const params = new URLSearchParams(location.search);
const SCALE = Number(params.get('scale') ?? 1);
const W = Math.round(1080 * SCALE);
const H = Math.round(1920 * SCALE);

const timeline = await (await fetch('../story/timeline.json')).json();
const font = new FontFace(FONT, `url(../assets/fonts/poppins-latin-800-normal.woff2)`, {weight: '800'});
await font.load();
document.fonts.add(font);

/* ---------- renderer ---------- */
const canvas = document.getElementById('gl');
canvas.width = W;
canvas.height = H;
const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const overlay = document.getElementById('ov');
overlay.width = W;
overlay.height = H;
const octx = overlay.getContext('2d');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000);

/* ---------- sky ---------- */
const skyMat = new THREE.ShaderMaterial({
	side: THREE.BackSide,
	depthWrite: false,
	fog: false,
	uniforms: {top: {value: new THREE.Color()}, mid: {value: new THREE.Color()}, bot: {value: new THREE.Color()}},
	vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
	fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0), 0.8)) : mix(mid, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat);
sky.renderOrder = -10;
scene.add(sky);
const sun = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex(), color: '#ffcf8a', transparent: true, depthWrite: false, fog: false}));
sun.scale.set(260, 260, 1);
scene.add(sun);
const sunDisc = mesh(new THREE.CircleGeometry(38, 32), basic('#fff0c0', {fog: false}), [0, 0, 0], [0, 0, 0], false);
scene.add(sunDisc);
const starGeo = new THREE.BufferGeometry();
{
	const n = 600;
	const p = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const th = rnd(`st${i}`) * Math.PI * 2;
		const ph = 0.08 + rnd(`sp${i}`) * 1.3;
		p.set([Math.cos(th) * Math.cos(ph) * 1400, Math.sin(ph) * 1400, Math.sin(th) * Math.cos(ph) * 1400], i * 3);
	}
	starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color: '#ffffff', size: 2.2 * SCALE, sizeAttenuation: false, fog: false}));
scene.add(stars);
const moon = mesh(new THREE.SphereGeometry(30, 24, 16), basic('#fff6d8', {fog: false}), [-500, 650, -1100], [0, 0, 0], false);
scene.add(moon);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight('#ffffff', '#88aa66', 1);
const amb = new THREE.AmbientLight('#ffffff', 0.15);
const sunLight = new THREE.DirectionalLight('#ffffff', 2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.03;
sunLight.shadow.radius = 3;
const fill = new THREE.DirectionalLight('#ffffff', 0);
scene.add(hemi, amb, sunLight, sunLight.target, fill, fill.target);

/* ---------- moods ---------- */
const MOODS = {
	day: {top: '#3d9cf0', mid: '#cdeeff', bot: '#9ad08a', hemi: ['#dff0ff', '#94b874', 1.05], amb: 0.12, sun: ['#fff4e0', 2.5, [0.45, 0.8, 0.5]], fog: ['#cdeeff', 160, 900], win: 0.05, lamp: 0.0, bloom: 0, sat: 1.1, tint: [1, 1, 1], bright: 0, exposure: 1.0, sunDisc: false, stars: false, fill: ['#ffffff', 0.45]},
	sunset: {top: '#7a7ad8', mid: '#ffc1a0', bot: '#c88a78', hemi: ['#ffd8c4', '#7a5a6a', 0.85], amb: 0.12, sun: ['#ffb070', 2.6, [-0.86, 0.25, 0.45]], fog: ['#ffcfb0', 140, 800], win: 0.9, lamp: 0.5, bloom: 0.45, sat: 1.1, tint: [1.06, 0.98, 0.94], bright: 0, exposure: 1.0, sunDisc: true, stars: false, fill: ['#ffd8b8', 0.7]},
	dusk: {top: '#2c3a8a', mid: '#ff9f86', bot: '#5a4a6a', hemi: ['#b8a8e8', '#3a3050', 0.75], amb: 0.12, sun: ['#ff9a70', 1.1, [-0.8, 0.18, 0.3]], fog: ['#a88aa8', 140, 800], win: 1.6, lamp: 1.2, bloom: 0.6, sat: 1.05, tint: [1, 0.96, 1.02], bright: 0, exposure: 1.05, sunDisc: false, stars: false, fill: ['#ffe2c8', 1.0]},
	night: {top: '#050a24', mid: '#1c2a6a', bot: '#0c1230', hemi: ['#4a62b8', '#141a30', 0.75], amb: 0.1, sun: ['#9fb6ff', 0.7, [-0.4, 0.8, 0.45]], fog: ['#141c48', 120, 700], win: 1.4, lamp: 0.9, bloom: 0.6, sat: 1.05, tint: [0.98, 1, 1.08], bright: 0.02, exposure: 1.1, sunDisc: false, stars: true, fill: ['#ffd9b0', 1.15]},
	memory: {top: '#8ab8e0', mid: '#f4e2c4', bot: '#b8a878', hemi: ['#fff0d8', '#a89870', 1.0], amb: 0.14, sun: ['#ffe4b0', 2.3, [0.45, 0.8, 0.5]], fog: ['#f4e2c4', 120, 700], win: 0.1, lamp: 0, bloom: 0.25, sat: 0.7, tint: [1.12, 1.0, 0.82], bright: 0.02, exposure: 1.0, sunDisc: false, stars: false, fill: ['#fff0d8', 0.5]},
	memoryNight: {top: '#1a1030', mid: '#4a2a50', bot: '#1a1020', hemi: ['#a080c0', '#2a1830', 0.75], amb: 0.12, sun: ['#ffb070', 0.6, [-0.4, 0.8, 0.45]], fog: ['#2a1830', 120, 700], win: 2.0, lamp: 1.4, bloom: 0.7, sat: 0.75, tint: [1.12, 0.98, 0.85], bright: 0.02, exposure: 1.1, sunDisc: false, stars: true, fill: ['#ffcf98', 1.4]},
	dark: {top: '#02030a', mid: '#070a1c', bot: '#03040a', hemi: ['#28345a', '#06080e', 0.32], amb: 0.04, sun: ['#6a7ab8', 0.25, [-0.4, 0.8, 0.45]], fog: ['#04060e', 60, 400], win: 0.0, lamp: 0.0, bloom: 0.6, sat: 0.9, tint: [0.92, 0.96, 1.1], bright: 0, exposure: 1.0, sunDisc: false, stars: true, fill: ['#8fa8ff', 0.35]},
	sad: {top: '#7d8aa8', mid: '#c4ccd8', bot: '#8a9aa0', hemi: ['#c8d4e8', '#6a7a88', 0.95], amb: 0.12, sun: ['#dfe8ff', 1.7, [0.4, 0.8, 0.5]], fog: ['#b8c4d4', 120, 700], win: 0.05, lamp: 0.2, bloom: 0, sat: 0.45, tint: [0.9, 0.95, 1.1], bright: 0, exposure: 1.0, sunDisc: false, stars: false, fill: ['#e8f0ff', 1.1]},
};

/* ---------- post ---------- */
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.45, 0.9);
composer.addPass(bloom);
const grade = new ShaderPass({
	uniforms: {tDiffuse: {value: null}, sat: {value: 1}, tint: {value: new THREE.Vector3(1, 1, 1)}, bright: {value: 0}, fade: {value: 0}},
	vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
	fragmentShader:
		'uniform sampler2D tDiffuse; uniform float sat; uniform vec3 tint; uniform float bright; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299,0.587,0.114)); vec3 g = mix(vec3(l), c.rgb, sat) * tint + bright; gl_FragColor = vec4(g, c.a); }',
});
composer.addPass(new OutputPass());
composer.addPass(grade);
const fxaa = new ShaderPass(FXAAShader);
fxaa.material.uniforms.resolution.value.set(1 / W, 1 / H);
composer.addPass(fxaa);

/* ---------- world + cast ---------- */
const town = buildTown(scene);
const C = {
	leo: makeCharacter({skin: '#f6d3b3', shirt: '#ffc81f', pants: '#24346a', shoes: '#f2f2f2', hair: {style: 'messy', color: '#6a3f1e'}, accessory: ['hood'], front: 'hoodie', face: 'kid', scale: 0.82}),
	walter: makeCharacter({skin: '#f2c9a0', shirt: '#f08a2c', pants: '#d8c39a', shoes: '#5a3a26', hair: {style: 'bald', color: '#d8d8dc'}, front: 'sweater', face: 'old', scale: 0.98}),
	mia: makeCharacter({skin: '#f8d8bc', shirt: '#ff7eb6', pants: '#5a6ad0', shoes: '#ff4f8f', hair: {style: 'pigtails', color: '#d8462a'}, face: 'girl', sleeves: 'short', scale: 0.8}),
	baker: makeCharacter({skin: '#e8b48a', shirt: '#f4f4f4', pants: '#5a5f7a', hair: {style: 'short', color: '#5a3a22'}, accessory: ['chefHat'], front: 'apron', face: 'man', sleeves: 'short'}),
	lamp: makeCharacter({skin: '#d7a175', shirt: '#2c2c34', pants: '#2a2a32', hair: {style: 'short', color: '#2a1a12'}, accessory: ['topHat'], front: 'vest', frontColor: '#8a1a24', face: 'lamp', scale: 1.05}),
	teacher: makeCharacter({skin: '#c98c5c', shirt: '#8ad0c8', pants: '#3a3f5a', hair: {style: 'bun', color: '#2a1a12'}, front: 'tie', frontColor: '#2a5bd7', face: 'woman'}),
	mom: makeCharacter({skin: '#f6d3b3', shirt: '#6bcb77', pants: '#33427a', hair: {style: 'long', color: '#6a3f1e'}, face: 'woman'}),
	dad: makeCharacter({skin: '#f6d3b3', shirt: '#4d96ff', pants: '#3a3a40', hair: {style: 'short', color: '#4a2a14'}, face: 'man'}),
	kid1: makeCharacter({skin: '#9a6440', shirt: '#6bcb77', pants: '#2a3350', hair: {style: 'short', color: '#1a1210'}, face: 'kid', scale: 0.8, accessory: ['backpack'], frontColor: '#e23a3a'}),
	kid2: makeCharacter({skin: '#ffd9b8', shirt: '#9b5de5', pants: '#3a5a9a', hair: {style: 'bob', color: '#d9a441'}, face: 'girl', scale: 0.8, accessory: ['backpack'], frontColor: '#2a5bd7'}),
	kid3: makeCharacter({skin: '#d7a175', shirt: '#00bbf9', pants: '#5a4a3a', hair: {style: 'spiky', color: '#3b2416'}, face: 'kid', scale: 0.8, accessory: ['backpack'], frontColor: '#ffcc22'}),
	chicken: makeChicken(),
	dog: makeDog(),
};
const SKINS = ['#f6d3b3', '#eebd94', '#d7a175', '#c98c5c', '#9a6440', '#6b4128'];
const SHIRTS = ['#ff6b6b', '#ffb03a', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5', '#f15bb5', '#00bbf9', '#ff8fab', '#3ddbd9', '#ffffff', '#e76f51'];
const PANTS = ['#2a3350', '#3a5a9a', '#5a4a3a', '#333338', '#6b8e23', '#7a5aa8'];
const HAIRS = ['short', 'bob', 'bun', 'spiky', 'long', 'messy', 'bald'];
const HC = ['#1a1210', '#3b2416', '#6a4426', '#d9a441', '#b5462a', '#2a2a2a', '#e8e0d0'];
const pick = (arr, k) => arr[Math.floor(rnd(k) * arr.length)];
const crowd = Array.from({length: 18}).map((_, i) => {
	const kid = i % 4 === 0;
	const hair = pick(HAIRS, `h${i}`);
	return makeCharacter({skin: pick(SKINS, `s${i}`), shirt: pick(SHIRTS, `c${i}`), pants: pick(PANTS, `p${i}`), hair: {style: hair, color: pick(HC, `hc${i}`)}, face: kid ? 'kid' : ['bob', 'bun', 'long'].includes(hair) ? 'woman' : 'man', scale: kid ? 0.8 : 0.95 + rnd(`sc${i}`) * 0.1, sleeves: rnd(`sl${i}`) > 0.5 ? 'short' : 'long'});
});
for (const c of [...Object.values(C), ...crowd]) scene.add(c.root);

/* ---------- dynamic props ---------- */
const props = new THREE.Group();
scene.add(props);
const make = (fn) => {
	const g = new THREE.Group();
	fn(g);
	props.add(g);
	return g;
};
const flame = (g, x, y, z) => {
	g.add(mesh(cone(0.12, 0.35, 8), basic('#ffd27a', {toneMapped: false}), [x, y, z], [0, 0, 0], false));
	const s = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex(), color: '#ffb84a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
	s.position.set(x, y + 0.05, z);
	s.scale.set(1.2, 1.2, 1);
	g.add(s);
};
const PROPS = {
	smallCake: make((g) => {
		g.add(mesh(cyl(1.5, 1.5, 1.0, 32), mat('#ffffff'), [0, 0.5, 0]));
		g.add(mesh(cyl(1.55, 1.55, 0.25, 32), mat('#ff7eb6'), [0, 0.95, 0]));
		g.add(mesh(cyl(1.0, 1.0, 0.7, 32), mat('#ffd6e4'), [0, 1.4, 0]));
		[-0.35, 0.35].forEach((x) => {
			g.add(mesh(cyl(0.08, 0.08, 0.7, 8), mat(x < 0 ? '#2a5bd7' : '#ffd23a'), [x, 2.1, 0]));
		});
		g.add(mesh(rbox(0.12, 0.6, 0.12, 0.04), mat('#ff4f7a'), [-0.35, 2.75, 0]));
		g.add(mesh(torus(0.2, 0.07, 8, 16), mat('#ff4f7a'), [0.35, 2.75, 0]));
		flame(g, -0.35, 3.25, 0);
		flame(g, 0.35, 3.15, 0);
	}),
	bigCake: make((g) => {
		const tiers = [[3.2, 1.6, '#ffffff'], [2.4, 1.5, '#ffd6e4'], [1.6, 1.4, '#ffffff']];
		let y = 0;
		tiers.forEach(([r, h, c], i) => {
			g.add(mesh(cyl(r, r, h, 32), mat(c), [0, y + h / 2, 0]));
			g.add(mesh(cyl(r + 0.06, r + 0.06, 0.25, 32), mat(i % 2 ? '#ffffff' : '#ff7eb6'), [0, y + h - 0.1, 0]));
			for (let k = 0; k < 10; k++) {
				const a = (k / 10) * Math.PI * 2;
				g.add(mesh(sph(0.16, 8, 6), mat('#e8303a'), [Math.cos(a) * r * 0.85, y + h + 0.1, Math.sin(a) * r * 0.85]));
			}
			y += h;
		});
		for (let k = 0; k < 6; k++) {
			const a = (k / 6) * Math.PI * 2;
			g.add(mesh(cyl(0.07, 0.07, 0.7, 8), mat('#ffd23a'), [Math.cos(a) * 0.9, y + 0.35, Math.sin(a) * 0.9]));
			flame(g, Math.cos(a) * 0.9, y + 0.9, Math.sin(a) * 0.9);
		}
	}),
	pumpkins: make((g) => {
		[[-1.2, 0], [1.4, 0.4], [0.2, 1.2]].forEach(([x, z], i) => {
			const p = mesh(sph(0.7 - i * 0.1, 14, 10), mat('#ff8a1f', {emissive: '#ff6a00', ei: 0.35}), [x, 0.55, z]);
			p.scale.y = 0.8;
			g.add(p);
			g.add(mesh(cyl(0.07, 0.09, 0.3, 6), mat('#3a6a2a'), [x, 1.1, z]));
		});
	}),
	candyBowl: make((g) => {
		g.add(mesh(cyl(0.9, 0.5, 0.6, 20), mat('#ff8a1f'), [0, 0, 0]));
		for (let k = 0; k < 8; k++) g.add(mesh(sph(0.18, 8, 6), mat(['#ff4f7a', '#ffd23a', '#3ad1ff', '#7aff6a'][k % 4]), [Math.cos(k) * 0.5, 0.35, Math.sin(k) * 0.5]));
	}),
	bike: make((g) => {
		const fm = mat('#d6342f', {metal: 0.3, rough: 0.4});
		[-1.3, 1.3].forEach((z) => g.add(mesh(torus(0.95, 0.12, 8, 24), mat('#222228'), [0, 1.0, z], [0, Math.PI / 2, 0])));
		g.add(mesh(box(0.15, 0.15, 2.6), fm, [0, 1.6, 0], [0.2, 0, 0]));
		g.add(mesh(box(0.15, 1.2, 0.15), fm, [0, 1.6, -0.6], [0.3, 0, 0]));
		g.add(mesh(box(0.15, 1.2, 0.15), fm, [0, 1.8, 1.1], [-0.2, 0, 0]));
		g.add(mesh(box(0.5, 0.15, 0.8), mat('#222228'), [0, 2.25, -0.75]));
		g.add(mesh(box(1.4, 0.12, 0.12), mat('#c8ccd6', {metal: 0.6}), [0, 2.4, 1.25]));
	}),
	wrench: make((g) => {
		g.add(mesh(box(0.15, 0.9, 0.08), mat('#c8ccd6', {metal: 0.7, rough: 0.3}), [0, 0, 0]));
	}),
	ball: make((g) => {
		g.add(mesh(sph(0.35, 16, 12), mat('#d8f03a', {rough: 0.8}), [0, 0, 0]));
	}),
	ladder: make((g) => {
		const wd = mat('#c8ccd6', {metal: 0.5, rough: 0.4});
		[-0.8, 0.8].forEach((x) => g.add(mesh(box(0.18, 9, 0.18), wd, [x, 4.5, 0])));
		for (let y = 0.8; y < 9; y += 1.0) g.add(mesh(box(1.6, 0.12, 0.14), wd, [0, y, 0]));
	}),
	ladder2: make((g) => {
		const wd = mat('#c8ccd6', {metal: 0.5, rough: 0.4});
		[-0.8, 0.8].forEach((x) => g.add(mesh(box(0.18, 9, 0.18), wd, [x, 4.5, 0])));
		for (let y = 0.8; y < 9; y += 1.0) g.add(mesh(box(1.6, 0.12, 0.14), wd, [0, y, 0]));
	}),
	lightCoil: make((g) => {
		g.add(mesh(torus(0.5, 0.08, 8, 20), mat('#2a2a2a'), [0, 0, 0], [Math.PI / 2, 0, 0]));
		for (let k = 0; k < 8; k++) g.add(mesh(sph(0.11, 8, 6), mat(['#ffd27a', '#ff8a8a', '#8ad0ff', '#a8ff9a'][k % 4], {emissive: '#ffd27a', ei: 0.4}), [Math.cos(k * 0.8) * 0.5, 0, Math.sin(k * 0.8) * 0.5]));
	}),
};
for (const g of Object.values(PROPS)) g.visible = false;

/* string lights in the square: wires + bulbs (instanced on/off) */
const bulbPos = [];
const wireSeg = [];
{
	const [qx, , qz] = P.square;
	const top = [qx, 12.2, qz];
	const strand = (pts, order0) => {
		pts.forEach((p, k) => {
			if (k > 0) wireSeg.push(new THREE.Vector3(...pts[k - 1]), new THREE.Vector3(...p));
			if (k > 0 && k < pts.length - 1) bulbPos.push({p, order: order0 + (k / pts.length) * 0.5});
		});
	};
	town.dyn.poles.forEach(([px, pz], i) => {
		const a = [px, 9.1, pz];
		const n = 12;
		strand(Array.from({length: n + 1}).map((_, k) => {
			const u = k / n;
			return [lerp(a[0], top[0], u), lerp(a[1], top[1], u) - Math.sin(u * Math.PI) * 1.4, lerp(a[2], top[2], u)];
		}), i);
		const [nx, nz] = town.dyn.poles[(i + 1) % town.dyn.poles.length];
		strand(Array.from({length: 9}).map((_, k) => {
			const u = k / 8;
			return [lerp(px, nx, u), 9.1 - Math.sin(u * Math.PI) * 1.2, lerp(pz, nz, u)];
		}), i + 0.5);
	});
	bulbPos.sort((a, b) => a.order - b.order);
}
const BULB_COLS = ['#ffd27a', '#ff7a8a', '#7ad0ff', '#9aff7a', '#ffb0ff'];
const bulbGeo = sph(0.22, 8, 6);
const bulbsOn = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: false}), bulbPos.length);
const bulbsOff = new THREE.InstancedMesh(bulbGeo, mat('#8a8a90'), bulbPos.length);
bulbsOn.frustumCulled = bulbsOff.frustumCulled = false;
bulbPos.forEach((b, i) => bulbsOn.setColorAt(i, new THREE.Color(BULB_COLS[i % BULB_COLS.length]).multiplyScalar(2.2)));
scene.add(bulbsOn, bulbsOff);
const wireGeo = new THREE.BufferGeometry().setFromPoints(wireSeg);
const wires = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({color: '#1a1a1a'}));
scene.add(wires);

/* confetti */
const CONF = 260;
const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 0.55), new THREE.MeshStandardMaterial({side: THREE.DoubleSide, roughness: 0.5, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.35}), CONF);
confetti.frustumCulled = false;
for (let i = 0; i < CONF; i++) confetti.setColorAt(i, new THREE.Color(['#ff4f7a', '#ffd23a', '#3ad1ff', '#7aff6a', '#b46cff', '#ff8a3a', '#ffffff'][i % 7]));
scene.add(confetti);

/* bubbles pool */
const bubbles = Array.from({length: 60}).map(() => {
	const b = makeBubble();
	scene.add(b.sprite);
	return b;
});

/* ---------- per-frame shot API ---------- */
const allChars = [...Object.values(C), ...crowd];
const o3 = new THREE.Object3D();
let used = 0;
let state;
const reset = () => {
	for (const s of Object.values(town.sets)) if (s) s.visible = false;
	town.walterFrame.visible = false;
	for (const c of allChars) c.root.visible = false;
	for (const g of Object.values(PROPS)) g.visible = false;
	for (const b of bubbles) b.sprite.visible = false;
	bulbsOn.visible = bulbsOff.visible = wires.visible = false;
	confetti.visible = false;
	town.dyn.walterGlow.visible = false;
	used = 0;
	state = {shake: 0, fade: 0, mood: null, shadowC: [0, 0, 0], shadowS: 40, focus: [], lamp: null, win: null, water: null};
};

const S = {
	C,
	crowd,
	P,
	PROPS,
	town,
	clamp,
	lerp,
	ease: easeInOutCubic,
	rnd,
	show: (...names) => names.forEach((n) => {
		if (n === 'walterWindow') town.walterFrame.visible = true;
		else town.sets[n].visible = true;
	}),
	/** Place a character. focus=true: its face is protected from captions. */
	put(c, pos, yaw = 0, pose = {}, expr = 'neutral', talk = false, opts = {}) {
		c.root.visible = true;
		c.root.position.set(...pos);
		c.root.rotation.set(0, yaw, 0);
		if (c.kind === 'person') c.update(state.t + (opts.tOff ?? 0), pose, expr, talk);
		else c.update(state.t + (opts.tOff ?? 0), pose);
		if (opts.focus !== false) state.focus.push(c);
		return c;
	},
	prop(name, pos, rot = [0, 0, 0], scale = 1) {
		const g = PROPS[name];
		g.visible = true;
		g.position.set(...pos);
		g.rotation.set(...rot);
		g.scale.setScalar(scale);
		return g;
	},
	/** Thought bubble over a point; pops in at time `at` (local seconds). */
	bubble(text, pos, size = 3, at = 0, opts = {}) {
		if (state.collect && at >= 0 && at < state.d) state.collect.push({t: +(state.shotStart + at).toFixed(3), type: 'pop', text});
		const b = bubbles[used++ % bubbles.length];
		b.set(text, opts.kind ?? 'thought', opts.color ?? '#ffffff');
		b.place(pos, size, state.lt, at, opts);
		return b;
	},
	/** Camera from -> to with easeInOutCubic and a subtle push-in. */
	cam({from, to, look, lookTo, fov = 40, frameY = 0.5, push = 0.05, roll = 0}) {
		const e = easeInOutCubic(state.p);
		const pos = to ? [lerp(from[0], to[0], e), lerp(from[1], to[1], e), lerp(from[2], to[2], e)] : from;
		const lk = lookTo ? [lerp(look[0], lookTo[0], e), lerp(look[1], lookTo[1], e), lerp(look[2], lookTo[2], e)] : look;
		const f = fov * (1 - push * e);
		const dist = Math.hypot(pos[0] - lk[0], pos[1] - lk[1], pos[2] - lk[2]);
		const off = dist * Math.tan(((f / 2) * Math.PI) / 180) * (1 - 2 * frameY);
		const sh = state.shake;
		const j = (k) => (Math.sin(state.t * 61 + k * 13.1) * 0.6 + Math.sin(state.t * 97 + k * 5.3) * 0.4) * sh * Math.max(0.3, dist / 12);
		const sway = (k) => Math.sin(state.t * (0.7 + k * 0.13) + k * 2.1) * 0.03 * Math.max(0.5, dist / 10);
		camera.position.set(pos[0] + j(1) + sway(1), pos[1] + j(2) + sway(2), pos[2] + sway(3));
		camera.up.set(0, 1, 0);
		camera.lookAt(lk[0] + j(3) * 0.5, lk[1] - off + j(4) * 0.5, lk[2]);
		state.look = lk;
		if (roll) camera.rotateZ(roll);
		camera.fov = f;
		camera.updateProjectionMatrix();
	},
	shake(a) {
		state.shake = Math.max(state.shake, a);
	},
	fade(a) {
		state.fade = Math.max(state.fade, a);
	},
	/** Override emissive levels after the mood (streetlights / windows / fountain). */
	glow({lamp, win, water} = {}) {
		if (lamp !== undefined) state.lamp = lamp;
		if (win !== undefined) state.win = win;
		if (water !== undefined) state.water = water;
	},
	walterLamp(on = true) {
		town.dyn.walterGlow.visible = on;
	},
	mood(m) {
		state.mood = m;
	},
	shadow(center, size = 40) {
		state.shadowC = center;
		state.shadowS = size;
	},
	/** String lights: on(i, n) -> boolean for bulb i of n. */
	stringLights(on) {
		bulbsOn.visible = bulbsOff.visible = wires.visible = true;
		const hid = new THREE.Matrix4().makeScale(0, 0, 0);
		bulbPos.forEach((b, i) => {
			o3.position.set(...b.p);
			o3.scale.setScalar(1);
			o3.updateMatrix();
			const isOn = on(i, bulbPos.length);
			bulbsOn.setMatrixAt(i, isOn ? o3.matrix : hid);
			bulbsOff.setMatrixAt(i, isOn ? hid : o3.matrix);
		});
		bulbsOn.instanceMatrix.needsUpdate = true;
		bulbsOff.instanceMatrix.needsUpdate = true;
	},
	confetti(center, area = 30, top = 20, t0 = 0) {
		confetti.visible = true;
		const tt = state.lt - t0;
		for (let i = 0; i < CONF; i++) {
			const sp = 0.6 + rnd(`cf${i}`) * 0.8;
			const burst = Math.min(1, tt * 3);
			const y = top - ((tt * 4 * sp + rnd(`cy${i}`) * top * 0.3) % top);
			o3.position.set(center[0] + (rnd(`cx${i}`) - 0.5) * area * burst + Math.sin(tt * 2 + i) * 0.6, center[1] + y, center[2] + (rnd(`cz${i}`) - 0.5) * area * burst);
			o3.rotation.set(tt * (2 + rnd(`cr${i}`) * 4) + i, tt * 3 + i * 0.7, tt * 2);
			o3.scale.setScalar(tt < 0 ? 0 : 1);
			o3.updateMatrix();
			confetti.setMatrixAt(i, o3.matrix);
		}
		confetti.instanceMatrix.needsUpdate = true;
	},
	clock(h, m) {
		town.dyn.hourHand.rotation.z = -(((h % 12) + m / 60) / 12) * Math.PI * 2;
		town.dyn.minHand.rotation.z = -(m / 60) * Math.PI * 2;
	},
	wallClock(h, m) {
		town.dyn.wallHour.rotation.z = -(((h % 12) + m / 60) / 12) * Math.PI * 2;
		town.dyn.wallMin.rotation.z = -(m / 60) * Math.PI * 2;
	},
	calendar(flip) {
		town.dyn.calPage.rotation.x = -flip * Math.PI * 0.98;
		town.dyn.calPage.visible = flip < 0.99;
	},
};

function applyMood(name) {
	const m = MOODS[name] ?? MOODS.day;
	skyMat.uniforms.top.value.set(m.top);
	skyMat.uniforms.mid.value.set(m.mid);
	skyMat.uniforms.bot.value.set(m.bot);
	hemi.color.set(m.hemi[0]);
	hemi.groundColor.set(m.hemi[1]);
	hemi.intensity = m.hemi[2];
	amb.intensity = m.amb;
	sunLight.color.set(m.sun[0]);
	sunLight.intensity = m.sun[1];
	const d = new THREE.Vector3(...m.sun[2]).normalize();
	const c = state.shadowC;
	sunLight.position.set(c[0] + d.x * 120, c[1] + d.y * 120, c[2] + d.z * 120);
	sunLight.target.position.set(...c);
	sunLight.target.updateMatrixWorld();
	const sc = sunLight.shadow.camera;
	sc.left = sc.bottom = -state.shadowS;
	sc.right = sc.top = state.shadowS;
	sc.near = 1;
	sc.far = 400;
	sc.updateProjectionMatrix();
	scene.fog = new THREE.Fog(m.fog[0], m.fog[1], m.fog[2]);
	M.window.emissiveIntensity = m.win;
	M.lamp.emissiveIntensity = m.lamp;
	town.dyn.clockFace.material.emissiveIntensity = name === 'night' || name === 'dusk' ? 0.9 : 0.1;
	bloom.enabled = m.bloom > 0;
	bloom.strength = m.bloom;
	grade.uniforms.sat.value = m.sat;
	grade.uniforms.tint.value.set(...m.tint);
	grade.uniforms.bright.value = m.bright;
	renderer.toneMappingExposure = m.exposure;
	// soft key light from the camera side so faces always read (strong at night)
	const lk = state.look ?? [0, 0, 0];
	fill.color.set(m.fill[0]);
	fill.intensity = m.fill[1];
	fill.position.set(camera.position.x + 2, camera.position.y + 4, camera.position.z);
	fill.target.position.set(...lk);
	fill.target.updateMatrixWorld();
	if (state.lamp !== null) M.lamp.emissiveIntensity = state.lamp;
	if (state.win !== null) M.window.emissiveIntensity = state.win;
	town.dyn.water.material.emissiveIntensity = state.water ?? 0.4;
	stars.visible = m.stars;
	moon.visible = m.stars;
	sun.visible = sunDisc.visible = m.sunDisc;
	if (m.sunDisc) {
		const sp = new THREE.Vector3(camera.position.x + d.x * 1300, camera.position.y + d.y * 1300, camera.position.z + d.z * 1300);
		sun.position.copy(sp);
		sunDisc.position.copy(sp);
		sunDisc.lookAt(camera.position);
	}
}

/** Screen boxes (0..1) of faces that are large on screen. */
function faceBoxes() {
	const out = [];
	const v = new THREE.Vector3();
	for (const c of state.focus) {
		if (!c.head || !c.root.visible) continue;
		c.head.updateWorldMatrix(true, false);
		let x0 = 1;
		let x1 = 0;
		let y0 = 1;
		let y1 = 0;
		let front = false;
		for (const [a, b, z] of [[-0.66, -0.65, 0.63], [0.66, -0.65, 0.63], [-0.66, 0.65, 0.63], [0.66, 0.65, 0.63], [0, 0, 0.63]]) {
			v.set(a, b, z).applyMatrix4(c.head.matrixWorld).project(camera);
			if (v.z < 1 && v.z > -1) front = true;
			x0 = Math.min(x0, (v.x + 1) / 2);
			x1 = Math.max(x1, (v.x + 1) / 2);
			y0 = Math.min(y0, (1 - v.y) / 2);
			y1 = Math.max(y1, (1 - v.y) / 2);
		}
		if (front && y1 - y0 > 0.07 && x1 > 0 && x0 < 1 && y1 > 0 && y0 < 1) out.push({x0, x1, y0, y1});
	}
	return out;
}

const shots = timeline.shots;
const findShot = (f) => shots.find((s) => f >= s.startFrame && f < s.endFrame) ?? shots[shots.length - 1];

window.renderFrame = (i, opts = {}) => {
	const t = i / timeline.fps;
	const shot = opts.shot ? shots.find((s) => s.id === opts.shot) : findShot(i);
	const lt = opts.shot ? opts.lt ?? 0 : t - shot.start;
	const d = shot.end - shot.start;
	reset();
	state.t = t;
	state.lt = lt;
	state.p = clamp(lt / d);
	state.d = d;
	const fn = SHOTS[shot.id];
	if (!fn) throw new Error(`no shot ${shot.id}`);
	fn(S, {t: lt, p: state.p, d, gt: t});
	applyMood(state.mood ?? shot.mood);
	// bubbles slightly below pure white when bloom is strong (night) so their text stays readable
	const bloomy = bloom.enabled && bloom.strength >= 0.6;
	for (const b of bubbles) b.sprite.material.color.setScalar(bloomy ? 0.84 : 1);
	scene.updateMatrixWorld();
	grade.uniforms.fade.value = 0;
	composer.render();
	// overlay: vignette, fade, captions
	octx.clearRect(0, 0, W, H);
	const vg = octx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
	vg.addColorStop(0, 'rgba(0,0,0,0)');
	vg.addColorStop(1, 'rgba(0,0,0,0.32)');
	octx.fillStyle = vg;
	octx.fillRect(0, 0, W, H);
	if (state.fade > 0) {
		octx.fillStyle = `rgba(0,0,0,${clamp(state.fade)})`;
		octx.fillRect(0, 0, W, H);
	}
	let cap = null;
	if (!opts.noCaptions && state.fade < 0.95) cap = drawCaption(octx, timeline.words, t, faceBoxes());
	if (opts.thumbnail) opts.thumbnail(octx, W, H);
	return {shot: shot.id, cap};
};
/** Dry-run every shot once to list bubble pop times (used to place sound effects). */
window.collectEvents = () => {
	const ev = [];
	for (const shot of shots) {
		reset();
		state.t = shot.start;
		state.lt = 0;
		state.p = 0;
		state.d = shot.end - shot.start;
		state.shotStart = shot.start;
		state.collect = ev;
		SHOTS[shot.id](S, {t: 0, p: 0, d: state.d, gt: shot.start});
	}
	state.collect = null;
	return ev;
};
/** Canvas of a thought bubble (used by the thumbnail). */
window.bubbleCanvas = (text) => bubbleTex(text).image;
window.timeline = timeline;
window.ready = true;
