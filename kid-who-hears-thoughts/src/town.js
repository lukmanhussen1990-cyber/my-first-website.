// buildTown(): the cozy suburban town built from primitives. Static parts are merged per material
// (few draw calls = faster software rendering). Dynamic parts (lights, clock, doors, bulbs) stay separate.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FONT, basic, box, canvasTex, cone, cyl, mat, mesh, plane, rbox, rnd, sph, textTex, torus} from './lib.js';

/* Places (world coordinates) */
export const P = {
	leoDoor: [-21.5, 0, -15.2],
	chickenYard: [0, 0, -11],
	walterHouse: [25, 0, -20],
	walterWindow: [21.5, 3.6, -15.6],
	walterChair: [21.5, 0, -19.6],
	walterDoor: [28.5, 0, -15.6],
	miaDoor: [-43.5, 0, 15.2],
	square: [150, 0, 0],
	bakery: [128, 0, -30],
	lampShop: [172, 0, -30],
	clockTower: [150, 0, -44],
	school: [-150, 0, -22],
	hall: [0, 0, 300],
	classroom: [100, 0, 300],
	kitchen: [-100, 0, 300],
	calendar: [0, 0, 500],
};

class Builder {
	constructor() {
		this.parts = new Map();
	}
	add(geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
		const g = (geo.index ? geo.toNonIndexed() : geo.clone());
		const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
		g.applyMatrix4(m);
		for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
		if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
		g.clearGroups();
		if (!this.parts.has(material)) this.parts.set(material, []);
		this.parts.get(material).push(g);
	}
	build(name) {
		const group = new THREE.Group();
		group.name = name;
		for (const [material, list] of this.parts) {
			const merged = mergeGeometries(list, false);
			const m = new THREE.Mesh(merged, material);
			m.castShadow = true;
			m.receiveShadow = true;
			group.add(m);
		}
		return group;
	}
}

/* Shared, mood-controlled materials */
export const M = {
	window: new THREE.MeshStandardMaterial({color: '#bfe6ff', roughness: 0.2, emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 0.1}),
	lamp: new THREE.MeshStandardMaterial({color: '#fff2cc', roughness: 0.3, emissive: new THREE.Color('#ffc977'), emissiveIntensity: 0.0}),
	sky: null,
};

const awningTex = (c1, c2) =>
	canvasTex(`awn|${c1}|${c2}`, 256, 64, (ctx, w, h) => {
		for (let i = 0; i < 8; i++) {
			ctx.fillStyle = i % 2 ? c1 : c2;
			ctx.fillRect((i * w) / 8, 0, w / 8 + 1, h);
		}
	});

function house(b, x, z, facing, o) {
	// facing: +1 = door faces +z, -1 = faces -z
	const W = o.w ?? 12;
	const D = 9;
	const H = 7.5;
	const rot = facing > 0 ? 0 : Math.PI;
	const T = (lx, ly, lz) => {
		const c = Math.cos(rot);
		const s = Math.sin(rot);
		return [x + lx * c + lz * s, ly, z - lx * s + lz * c];
	};
	const wall = mat(o.color);
	const trim = mat('#ffffff');
	if (o.hole) {
		// hollow house with a window opening in the front wall [x0, x1, y0, y1] (local coords)
		const [hx0, hx1, hy0, hy1] = o.hole;
		const fz = D / 2 - 0.2;
		b.add(box(W, H, 0.4), wall, T(0, H / 2, -D / 2 + 0.2), [0, rot, 0]);
		b.add(box(0.4, H, D), wall, T(-W / 2 + 0.2, H / 2, 0), [0, rot, 0]);
		b.add(box(0.4, H, D), wall, T(W / 2 - 0.2, H / 2, 0), [0, rot, 0]);
		b.add(box(hx0 + W / 2, H, 0.4), wall, T((-W / 2 + hx0) / 2, H / 2, fz), [0, rot, 0]);
		b.add(box(W / 2 - hx1, H, 0.4), wall, T((hx1 + W / 2) / 2, H / 2, fz), [0, rot, 0]);
		b.add(box(hx1 - hx0, hy0, 0.4), wall, T((hx0 + hx1) / 2, hy0 / 2, fz), [0, rot, 0]);
		b.add(box(hx1 - hx0, H - hy1, 0.4), wall, T((hx0 + hx1) / 2, (H + hy1) / 2, fz), [0, rot, 0]);
		b.add(box(W, 0.4, D), wall, T(0, H - 0.2, 0), [0, rot, 0]);
	} else b.add(rbox(W, H, D, 0.15), wall, T(0, H / 2, 0), [0, rot, 0]);
	// gable roof (two slabs)
	const roofM = mat(o.roof ?? '#c84a3a', {rough: 0.5});
	b.add(box(W + 1.2, 0.4, D * 0.62), roofM, T(0, H + 1.55, -D * 0.24), [0.62 * (facing > 0 ? -1 : 1) * -1, rot, 0]);
	b.add(box(W + 1.2, 0.4, D * 0.62), roofM, T(0, H + 1.55, D * 0.24), [0.62 * (facing > 0 ? 1 : -1) * -1, rot, 0]);
	b.add(box(W - 0.2, 3.0, D - 1.2), wall, T(0, H + 0.9, 0), [0, rot, 0]);
	// door
	const doorX = o.doorX ?? 3.5;
	b.add(rbox(2.2, 3.8, 0.3, 0.08), mat(o.door ?? '#7a4426'), T(doorX, 1.9, D / 2 + 0.05), [0, rot, 0]);
	b.add(sph(0.12, 8, 6), mat('#ffcc3a', {metal: 0.6, rough: 0.3}), T(doorX + 0.7, 1.9, D / 2 + 0.25), [0, rot, 0]);
	b.add(box(3.2, 0.3, 1.6), mat('#d9d6de'), T(doorX, 0.15, D / 2 + 0.8), [0, rot, 0]);
	// windows (glowing material shared by the whole town)
	const wins = o.windows ?? [[-3.2, 2.4], [-3.2, 5.6], [3.5, 5.6]];
	for (const [wx, wy] of wins) {
		b.add(box(2.4, 2.0, 0.12), M.window, T(wx, wy, D / 2 + 0.03), [0, rot, 0]);
		b.add(box(2.8, 0.25, 0.4), trim, T(wx, wy - 1.15, D / 2 + 0.15), [0, rot, 0]);
		b.add(box(0.12, 2.0, 0.2), trim, T(wx, wy, D / 2 + 0.1), [0, rot, 0]);
	}
	b.add(box(1.2, 2.5, 1.2), mat('#9a8a8a'), T(W / 2 - 2, H + 3.2, -1), [0, rot, 0]);
}

function tree(b, x, z, s = 1, color = '#5cbf4a') {
	b.add(cyl(0.35 * s, 0.45 * s, 3.2 * s, 8), mat('#8a5a3a'), [x, 1.6 * s, z]);
	b.add(sph(1.9 * s, 12, 10), mat(color), [x, 4.3 * s, z]);
	b.add(sph(1.3 * s, 10, 8), mat(color), [x + 1.2 * s, 3.8 * s, z + 0.4 * s]);
	b.add(sph(1.2 * s, 10, 8), mat(color), [x - 1.1 * s, 3.9 * s, z - 0.3 * s]);
}

function fence(b, x0, x1, z, color = '#ffffff') {
	for (let x = x0; x <= x1; x += 0.8) b.add(box(0.3, 1.8, 0.15), mat(color), [x, 0.9, z]);
	b.add(box(x1 - x0 + 0.3, 0.2, 0.1), mat(color), [(x0 + x1) / 2, 1.3, z + 0.1]);
	b.add(box(x1 - x0 + 0.3, 0.2, 0.1), mat(color), [(x0 + x1) / 2, 0.6, z + 0.1]);
}
function fenceZ(b, x, z0, z1, color = '#ffffff') {
	for (let z = z0; z <= z1; z += 0.8) b.add(box(0.15, 1.8, 0.3), mat(color), [x, 0.9, z]);
	b.add(box(0.1, 0.2, z1 - z0 + 0.3), mat(color), [x + 0.1, 1.3, (z0 + z1) / 2]);
	b.add(box(0.1, 0.2, z1 - z0 + 0.3), mat(color), [x + 0.1, 0.6, (z0 + z1) / 2]);
}

function streetlight(b, x, z) {
	b.add(cyl(0.14, 0.2, 7, 8), mat('#2c3242', {metal: 0.4, rough: 0.4}), [x, 3.5, z]);
	b.add(cyl(0.5, 0.3, 0.9, 8), M.lamp, [x, 7.3, z]);
	b.add(cone(0.62, 0.45, 8), mat('#2c3242', {metal: 0.4}), [x, 7.95, z]);
}

function shop(b, cx, cz, name, color, awn) {
	const W = 14;
	b.add(rbox(W, 10, 9, 0.15), mat(color), [cx, 5, cz]);
	b.add(box(W + 0.6, 0.7, 9.6), mat('#ffffff'), [cx, 10.3, cz]);
	b.add(box(W * 0.5, 3.6, 0.15), M.window, [cx - 2.6, 2.6, cz + 4.55]);
	b.add(box(2.2, 4, 0.2), mat('#7a4426'), [cx + 4, 2, cz + 4.55]);
	const aw = new THREE.MeshStandardMaterial({map: awningTex(awn[0], awn[1]), roughness: 0.6});
	b.add(box(W * 0.92, 0.15, 2.6), aw, [cx, 4.9, cz + 5.8], [0.35, 0, 0]);
	const sign = new THREE.MeshStandardMaterial({map: textTex(name, {w: 1024, h: 200, bg: '#ffffff', color: awn[0], radius: 40}), roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.15});
	b.add(plane(W * 0.8, (W * 0.8 * 200) / 1024), sign, [cx, 8.2, cz + 4.56]);
}

/** Returns {root, sets:{street,square,school,hall,classroom,kitchen,calendar,walterRoom}, dyn:{...}} */
export function buildTown(scene) {
	const root = new THREE.Group();
	scene.add(root);
	const dyn = {};

	/* ---------- ground (shared) ---------- */
	const ground = mesh(new THREE.CircleGeometry(700, 48), mat('#7cc95a', {rough: 0.95}), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
	root.add(ground);
	const hillsB = new Builder();
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2;
		const d = 330 + rnd(`hd${i}`) * 80;
		hillsB.add(sph(1, 16, 12), mat(i % 2 ? '#6cbf55' : '#5aae4a', {rough: 0.9}), [Math.cos(a) * d + 60, -10, Math.sin(a) * d], [0, 0, 0], [90 + rnd(`hw${i}`) * 60, 32 + rnd(`hh${i}`) * 22, 70]);
	}
	root.add(hillsB.build('hills'));

	/* ---------- Leo's street ---------- */
	const sb = new Builder();
	sb.add(box(330, 0.05, 10), mat('#4a4d58', {rough: 0.85}), [40, 0.02, 0]);
	for (let x = -120; x < 200; x += 8) sb.add(box(3.5, 0.06, 0.4), mat('#ffd23a', {emissive: '#ffd23a', ei: 0.15}), [x, 0.05, 0]);
	sb.add(box(330, 0.25, 3.4), mat('#d6d6dc'), [40, 0.12, -6.7]);
	sb.add(box(330, 0.25, 3.4), mat('#d6d6dc'), [40, 0.12, 6.7]);
	const north = [[-50, '#7ab8e8', '#3a5ac8'], [-25, '#ffd76a', '#c84a3a'], [0, '#9ad6a0', '#8a4a2a'], [25, '#f2e2c4', '#7a4a2a'], [50, '#ffb3b3', '#3a5ac8'], [75, '#c8b3ff', '#c84a3a']];
	for (const [x, c, r] of north) {
		if (x === 25) {
			// Mr. Walter's house: big front window with a room behind it (built separately)
			house(sb, x, -20, 1, {color: c, roof: r, windows: [[3.5, 5.6], [-3.5, 6.2]], doorX: 3.5, hole: [-5.4, -1.6, 1.95, 5.25]});
		} else house(sb, x, -20, 1, {color: c, roof: r});
	}
	const south = [[-65, '#ffd28a'], [-40, '#e1c4ff'], [-15, '#9fe6cf'], [10, '#ffc89a'], [35, '#a9c8ff'], [60, '#ffe28a']];
	for (const [x, c] of south) house(sb, x, 20, -1, {color: c, roof: ['#c84a3a', '#3a5ac8', '#8a4a2a'][Math.floor(rnd(x) * 3)]});
	for (let x = -80; x < 110; x += 20) {
		if (x + 6 < 12 || x + 6 > 36) streetlight(sb, x + 6, -7.6); // keep Mr. Walter's front clear
		streetlight(sb, x + 16, 7.6);
	}
	[[-37.5, -12], [-12.5, -13], [37.5, -12], [62.5, -13], [-52, 12], [-27, 13], [-2, 12], [22, 13], [47, 12], [85, -12]].forEach(([x, z], i) => tree(sb, x, z, 1.1 + rnd(`ts${i}`) * 0.3, ['#5cbf4a', '#4fae3f', '#6ccf55'][i % 3]));
	// chicken yard next door (fenced) + coop
	fence(sb, -6, 6, -9.5);
	fenceZ(sb, -6.2, -15, -9.5);
	fenceZ(sb, 6.2, -15, -9.5);
	sb.add(rbox(3.2, 2.6, 2.6, 0.1), mat('#c0392b'), [3.5, 1.3, -13.2]);
	sb.add(box(3.8, 0.3, 3.2), mat('#7a3a20'), [3.5, 2.75, -13.2], [0, 0, 0.12]);
	// Walter's picket fence and Leo's yard fence
	fence(sb, 15, 33, -9.8);
	fence(sb, -33, -17, -9.8);
	const street = sb.build('street');
	root.add(street);

	// Walter's room behind the big window (cozy interior lit warm)
	const wr = new Builder();
	const [wx, , wz] = P.walterHouse;
	wr.add(box(11, 0.2, 8.4), mat('#8a5a3a'), [wx, 0.1, wz]); // floor
	wr.add(box(11, 7, 0.2), mat('#e9c99a'), [wx, 3.5, wz - 4.0]); // back wall (wallpaper)
	for (let x = wx - 5; x < wx + 5.5; x += 1.4) wr.add(box(0.5, 7, 0.05), mat('#dcb684'), [x, 3.5, wz - 3.88]);
	wr.add(box(0.2, 7, 8), mat('#e2bf8e'), [wx - 5.4, 3.5, wz]);
	wr.add(box(11, 0.2, 8.4), mat('#f2e2c8'), [wx, 7.0, wz]); // ceiling
	// green armchair facing the window
	const chairM = mat('#3f8f4f', {rough: 0.7});
	const [chx, , chz] = P.walterChair;
	wr.add(rbox(3.4, 1.4, 3.0, 0.3), chairM, [chx, 1.3, chz - 0.4]);
	wr.add(rbox(3.4, 4.2, 0.9, 0.35), chairM, [chx, 3.0, chz - 1.9]);
	wr.add(rbox(0.8, 2.4, 3.0, 0.3), chairM, [chx - 1.95, 2.2, chz - 0.4]);
	wr.add(rbox(0.8, 2.4, 3.0, 0.3), chairM, [chx + 1.95, 2.2, chz - 0.4]);
	// side table, lamp, framed photo, rug
	wr.add(rbox(1.4, 2.2, 1.4, 0.1), mat('#7a4426'), [chx - 3.6, 1.2, chz - 1.0]);
	wr.add(cyl(0.55, 0.85, 0.9, 12), mat('#fff0c8', {emissive: '#ffcf80', ei: 1.4}), [chx - 3.6, 3.6, chz - 1.0]);
	wr.add(box(1.4, 1.8, 0.1), mat('#ffcc3a'), [chx + 1.0, 5.2, wz - 3.85]);
	wr.add(new THREE.CircleGeometry(2.6, 24), mat('#b8242e', {rough: 0.9}), [chx, 0.22, chz + 0.5], [-Math.PI / 2, 0, 0]);
	const walterRoom = wr.build('walterRoom');
	root.add(walterRoom);
	// front wall of Walter's house has a hole for the big window: build the frame + glass separately
	const wf = new THREE.Group();
	wf.add(mesh(box(4.4, 0.4, 0.6), mat('#ffffff'), [P.walterWindow[0], P.walterWindow[1] - 1.75, -15.3]));
	wf.add(mesh(box(4.4, 0.3, 0.4), mat('#ffffff'), [P.walterWindow[0], P.walterWindow[1] + 1.65, -15.4]));
	wf.add(mesh(box(0.3, 3.6, 0.4), mat('#ffffff'), [P.walterWindow[0] - 2.0, P.walterWindow[1], -15.4]));
	wf.add(mesh(box(0.3, 3.6, 0.4), mat('#ffffff'), [P.walterWindow[0] + 2.0, P.walterWindow[1], -15.4]));
	
	const glass = mesh(box(3.8, 3.3, 0.05), new THREE.MeshStandardMaterial({color: '#cfe8ff', transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false}), [P.walterWindow[0], P.walterWindow[1], -15.45], [0, 0, 0], false);
	wf.add(glass);
	root.add(wf);
	dyn.walterGlow = new THREE.PointLight('#ffc070', 30, 14, 1.6);
	dyn.walterGlow.position.set(P.walterChair[0] - 2.5, 5.0, P.walterChair[2] + 1.5);
	root.add(dyn.walterGlow);

	/* ---------- town square ---------- */
	const qb = new Builder();
	const [qx, , qz] = P.square;
	qb.add(new THREE.CircleGeometry(30, 48), mat('#e2d2b0', {rough: 0.8}), [qx, 0.03, qz], [-Math.PI / 2, 0, 0]);
	qb.add(cyl(5, 5.4, 1.4, 32), mat('#e4e2ea'), [qx, 0.7, qz]);
	qb.add(cyl(0.6, 0.9, 3.6, 16), mat('#e4e2ea'), [qx, 2.7, qz]);
	qb.add(cyl(2.0, 1.2, 0.6, 24), mat('#e4e2ea'), [qx, 4.5, qz]);
	shop(qb, P.bakery[0], P.bakery[2], 'BAKERY', '#ffb3c7', ['#e23a6a', '#ffffff']);
	shop(qb, P.lampShop[0], P.lampShop[2], 'LAMP SHOP', '#ffe28a', ['#d75a1a', '#ffffff']);
	// clock tower
	const [tx, , tz] = P.clockTower;
	qb.add(rbox(8, 26, 8, 0.2), mat('#e8dcc6'), [tx, 13, tz]);
	qb.add(box(9, 1, 9), mat('#ffffff'), [tx, 26.5, tz]);
	const pyr = new THREE.ConeGeometry(6.5, 6, 4);
	qb.add(pyr, mat('#4f78b0', {rough: 0.45}), [tx, 30, tz], [0, Math.PI / 4, 0]);
	qb.add(sph(0.6, 12, 10), mat('#ffcc3a', {metal: 0.7, rough: 0.3}), [tx, 33.3, tz]);
	// houses around the square
	[[qx - 40, 32, '#7ab8e8'], [qx - 14, 34, '#ffd28a'], [qx + 14, 34, '#9ad6a0'], [qx + 40, 32, '#ffb3b3']].forEach(([x, z, c]) => house(qb, x, z, -1, {color: c}));
	[[qx - 32, -10], [qx + 32, -10], [qx - 30, 18], [qx + 30, 18]].forEach(([x, z], i) => tree(qb, x, z, 1.3, ['#5cbf4a', '#4fae3f'][i % 2]));
	// poles for the string lights (ring of 10) + centre mast above the fountain
	const poles = [];
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		const p = [qx + Math.cos(a) * 24, qz + Math.sin(a) * 24];
		poles.push(p);
		qb.add(cyl(0.16, 0.2, 9, 8), mat('#2c3242', {metal: 0.4}), [p[0], 4.5, p[1]]);
		qb.add(sph(0.3, 8, 6), mat('#ffcc3a', {metal: 0.6}), [p[0], 9.1, p[1]]);
	}
	qb.add(cyl(0.2, 0.25, 12, 8), mat('#2c3242', {metal: 0.4}), [qx, 6, qz]);
	for (const x of [qx - 26, qx - 11, qx + 11, qx + 26]) streetlight(qb, x, qz + 27);
	// party table (cake goes on top dynamically)
	qb.add(rbox(10, 0.3, 4, 0.08), mat('#ffffff'), [qx, 2.7, qz + 12]);
	qb.add(box(10, 2.6, 0.08), mat('#ff9db8'), [qx, 1.35, qz + 13.95]);
	const square = qb.build('square');
	root.add(square);
	dyn.water = mesh(cyl(4.6, 4.6, 0.2, 32), mat('#5ec8ff', {rough: 0.05, emissive: '#1a6aa0', ei: 0.4}), [qx, 1.32, qz], [0, 0, 0], false);
	root.add(dyn.water);
	dyn.poles = poles;

	/* ---------- school exterior ---------- */
	const scb = new Builder();
	const [scx, , scz] = P.school;
	scb.add(rbox(40, 14, 14, 0.2), mat('#c8553d'), [scx, 7, scz]);
	scb.add(box(41, 1, 15), mat('#ffffff'), [scx, 14.4, scz]);
	for (let i = -3; i <= 3; i++) if (i !== 0) [4.5, 10].forEach((y) => scb.add(box(3, 2.4, 0.15), M.window, [scx + i * 5.2, y, scz + 7.05]));
	scb.add(rbox(6, 6.5, 0.4, 0.1), mat('#2a5bd7'), [scx, 3.25, scz + 7.05]);
	scb.add(plane(16, 2.6), new THREE.MeshStandardMaterial({map: textTex('SCHOOL', {w: 1024, h: 170, bg: '#ffffff', color: '#c8553d', radius: 30}), roughness: 0.6}), [scx, 12.2, scz + 7.08]);
	scb.add(cyl(0.15, 0.15, 16, 8), mat('#c8ccd6', {metal: 0.6}), [scx + 26, 8, scz + 10]);
	scb.add(box(3, 2, 0.08), mat('#2a62d8'), [scx + 27.5, 14.8, scz + 10]);
	scb.add(box(60, 0.08, 20), mat('#cfcfd6'), [scx, 0.04, scz + 17]);
	[[scx - 26, scz + 12], [scx + 32, scz + 14]].forEach(([x, z]) => tree(scb, x, z, 1.3));
	const school = scb.build('school');
	root.add(school);

	/* ---------- school hallway interior ---------- */
	const hb = new Builder();
	const [hx, , hz] = P.hall;
	hb.add(box(80, 0.2, 18), mat('#d8cbb0', {rough: 0.5}), [hx, 0, hz]);
	hb.add(box(80, 0.2, 18), mat('#f2efe6'), [hx, 14, hz]);
	hb.add(box(80, 14, 0.4), mat('#a8d0e8'), [hx, 7, hz - 9]);
	hb.add(box(80, 14, 0.4), mat('#a8d0e8'), [hx, 7, hz + 9]);
	for (let x = hx - 38; x < hx + 38; x += 2.6) {
		hb.add(rbox(2.4, 7.5, 1.6, 0.06), mat(['#2a6ad0', '#2a5bd7', '#d84a3a'][Math.floor(rnd(x) * 3)]), [x, 3.9, hz - 8.1]);
		hb.add(box(0.8, 0.08, 0.05), mat('#cfd3dc'), [x + 0.4, 6.5, hz - 7.28]);
	}
	for (let x = hx - 36; x < hx + 36; x += 9) hb.add(box(5, 0.2, 1.4), M.lamp, [x, 13.8, hz]);
	hb.add(box(80, 1.2, 0.3), mat('#ffd23a'), [hx, 9.5, hz + 8.8]);
	const hall = hb.build('hall');
	root.add(hall);

	/* ---------- classroom ---------- */
	const cb = new Builder();
	const [cx, , cz] = P.classroom;
	cb.add(box(40, 0.2, 34), mat('#c49a6a', {rough: 0.5}), [cx, 0, cz]);
	cb.add(box(40, 14, 0.4), mat('#f6e7c8'), [cx, 7, cz - 12]);
	cb.add(box(0.4, 14, 34), mat('#f3dfbc'), [cx - 20, 7, cz]);
	cb.add(box(0.4, 14, 34), mat('#f3dfbc'), [cx + 20, 7, cz]);
	cb.add(rbox(16, 6, 0.3, 0.1), mat('#2f5a3a', {rough: 0.8}), [cx, 6.5, cz - 11.7]);
	cb.add(box(16.6, 0.4, 0.6), mat('#8a5a3a'), [cx, 3.3, cz - 11.5]);
	cb.add(plane(9, 2.2), new THREE.MeshStandardMaterial({map: textTex('2 + 2 = 4', {w: 1024, h: 250, color: '#ffffff'}), transparent: true, roughness: 0.8}), [cx - 2, 7.4, cz - 11.5]);
	cb.add(rbox(7, 3, 3.4, 0.1), mat('#8a5030'), [cx + 5, 1.5, cz - 6.5]);
	for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c++) {
		cb.add(rbox(4, 0.3, 2.6, 0.06), mat('#d6a06a'), [cx + c * 8, 2.6, cz + 1 + r * 6]);
		cb.add(box(0.25, 2.5, 0.25), mat('#5a5f6a'), [cx + c * 8, 1.25, cz + 1 + r * 6]);
		cb.add(rbox(2.0, 0.25, 1.8, 0.06), mat('#e8703a'), [cx + c * 8, 1.48, cz + 3.0 + r * 6]);
		cb.add(rbox(2.0, 1.8, 0.2, 0.06), mat('#e8703a'), [cx + c * 8, 2.4, cz + 3.9 + r * 6]);
		cb.add(box(0.2, 1.4, 0.2), mat('#5a5f6a'), [cx + c * 8, 0.7, cz + 3.0 + r * 6]);
	}
	[-12, 12].forEach((x) => cb.add(box(6, 5, 0.1), M.window, [cx + x, 8, cz - 11.75]));
	const classroom = cb.build('classroom');
	root.add(classroom);

	/* ---------- Leo's kitchen (birthday) ---------- */
	const kb = new Builder();
	const [kx, , kz] = P.kitchen;
	kb.add(box(40, 0.2, 34), mat('#d9b48a', {rough: 0.5}), [kx, 0, kz]);
	kb.add(box(40, 14, 0.4), mat('#ffe8c8'), [kx, 7, kz - 10]);
	kb.add(box(0.4, 14, 34), mat('#ffdcb0'), [kx - 16, 7, kz]);
	kb.add(box(0.4, 14, 34), mat('#ffdcb0'), [kx + 16, 7, kz]);
	kb.add(rbox(12, 0.4, 6, 0.1), mat('#ffffff'), [kx, 2.0, kz]);
	[[-4.5, -2], [4.5, -2], [-4.5, 2], [4.5, 2]].forEach(([dx, dz]) => kb.add(box(0.4, 1.9, 0.4), mat('#8a5a3a'), [kx + dx, 0.95, kz + dz]));
	kb.add(box(6, 5, 0.1), M.window, [kx - 6, 8, kz - 9.75]);
	kb.add(plane(14, 2.2), new THREE.MeshStandardMaterial({map: textTex('HAPPY BIRTHDAY LEO', {w: 1024, h: 160, color: '#e23a6a'}), transparent: true, roughness: 0.6}), [kx + 3, 11.5, kz - 9.75]);
	for (let i = 0; i < 9; i++) {
		const bx = kx - 12 + i * 3;
		kb.add(cyl(0.02, 0.02, 1.4, 4), mat('#ffffff'), [bx, 12.6 - (i % 2) * 0.4, kz - 9.4]);
		kb.add(sph(0.85, 12, 10), mat(['#ff5c8a', '#ffd23a', '#3ad1ff', '#7aff6a', '#b46cff'][i % 5], {rough: 0.3}), [bx, 13.6 - (i % 2) * 0.4, kz - 9.3]);
	}
	const kitchen = kb.build('kitchen');
	root.add(kitchen);

	/* ---------- calendar close-up set ---------- */
	const calB = new Builder();
	const [ax, , az] = P.calendar;
	calB.add(box(30, 30, 0.4), mat('#ffe8c8'), [ax, 10, az - 0.6]);
	calB.add(rbox(8, 9.5, 0.3, 0.1), mat('#ffffff'), [ax, 10, az]);
	calB.add(box(8.2, 2.2, 0.36), mat('#e23a3a'), [ax, 13.9, az]);
	const calendar = calB.build('calendar');
	root.add(calendar);
	const page = (text, sub) =>
		new THREE.MeshStandardMaterial({
			roughness: 0.7,
			side: THREE.DoubleSide,
			map: canvasTex(`cal|${text}`, 512, 512, (ctx, w, h) => {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, w, h);
				ctx.fillStyle = '#e23a3a';
				ctx.textAlign = 'center';
				ctx.font = `800 70px ${FONT}, sans-serif`;
				ctx.fillText(sub, w / 2, 110);
				ctx.fillStyle = '#1a1a2a';
				ctx.font = `800 260px ${FONT}, sans-serif`;
				ctx.fillText(text, w / 2, 380);
			}),
		});
	dyn.calBack = mesh(plane(7.6, 7.2), page('15', 'SUNDAY'), [ax, 8.9, az + 0.2], [0, 0, 0], false);
	root.add(dyn.calBack);
	dyn.calPage = new THREE.Group();
	dyn.calPage.position.set(ax, 12.5, az + 0.3);
	dyn.calPage.add(mesh(plane(7.6, 7.2), page('14', 'SATURDAY'), [0, -3.6, 0], [0, 0, 0], false));
	root.add(dyn.calPage);

	/* ---------- dynamic: clock hands on the tower ---------- */
	const clockFace = mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({
		roughness: 0.5,
		emissive: new THREE.Color('#fff0c8'),
		emissiveIntensity: 0.1,
		map: canvasTex('clockface', 512, 512, (ctx, w) => {
			ctx.fillStyle = '#fffaf0';
			ctx.fillRect(0, 0, w, w);
			ctx.fillStyle = '#1a1a2a';
			for (let i = 0; i < 12; i++) {
				const a = (i / 12) * Math.PI * 2;
				ctx.save();
				ctx.translate(w / 2 + Math.sin(a) * w * 0.4, w / 2 - Math.cos(a) * w * 0.4);
				ctx.rotate(a);
				ctx.fillRect(-8, -26, 16, 52);
				ctx.restore();
			}
		}),
	}), [tx, 20, tz + 4.06], [0, 0, 0], false);
	root.add(clockFace);
	dyn.clockFace = clockFace;
	const handM = mat('#1a1a2a');
	dyn.hourHand = new THREE.Group();
	dyn.hourHand.position.set(tx, 20, tz + 4.15);
	dyn.hourHand.add(mesh(box(0.28, 1.7, 0.1), handM, [0, 0.75, 0], [0, 0, 0], false));
	dyn.minHand = new THREE.Group();
	dyn.minHand.position.set(tx, 20, tz + 4.22);
	dyn.minHand.add(mesh(box(0.18, 2.5, 0.1), handM, [0, 1.15, 0], [0, 0, 0], false));
	root.add(dyn.hourHand, dyn.minHand);
	root.add(mesh(torus(3.05, 0.25, 8, 40), mat('#ffcc3a', {metal: 0.6, rough: 0.3}), [tx, 20, tz + 4.1], [0, 0, 0], false));
	// classroom wall clock
	const wc = new THREE.Group();
	wc.position.set(cx - 11, 11.2, cz - 11.75);
	wc.add(mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshStandardMaterial({map: canvasTex('clockface', 512, 512, () => {}), roughness: 0.5}), [0, 0, 0], [0, 0, 0], false));
	wc.add(mesh(torus(1.65, 0.15, 8, 32), mat('#d23a3a'), [0, 0, 0], [0, 0, 0], false));
	dyn.wallMin = new THREE.Group();
	dyn.wallMin.position.set(0, 0, 0.1);
	dyn.wallMin.add(mesh(box(0.12, 1.3, 0.05), handM, [0, 0.6, 0], [0, 0, 0], false));
	dyn.wallHour = new THREE.Group();
	dyn.wallHour.position.set(0, 0, 0.08);
	dyn.wallHour.add(mesh(box(0.16, 0.9, 0.05), handM, [0, 0.4, 0], [0, 0, 0], false));
	wc.add(dyn.wallMin, dyn.wallHour);
	root.add(wc);

	return {root, sets: {street, square, school, hall, classroom, kitchen, calendar, walterRoom, hills: root.getObjectByName('hills')}, dyn, walterFrame: wf};
}
