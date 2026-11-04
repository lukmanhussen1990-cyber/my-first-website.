// Everyday things for the Birthday video, all from simple shapes + code-drawn canvas textures:
// wall calendar, rocking chair, the old photo, the recipe book, boxes, kitchen things, the oven,
// tables, the home-made banner, balloons and string lights that switch on one by one.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, sphere, torus, cone, plane, glowMat, custom, lathe} from '../../lib/materials';
import {canvasTex, woodTex} from '../../lib/textures';
import {hash, mulberry32} from '../../lib/random';
import {V3, clamp, easeOut, easeInOut} from '../../lib/anim';
import {POPPINS} from '../../lib/fonts';
import {CAVEAT} from '../fonts';

// ================================================================== wall calendar
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function drawCake(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string, r: () => number) {
	// a little crayon cake with one candle (hand-drawn look)
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate((r() - 0.5) * 0.25);
	ctx.lineWidth = 2.2 * s;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#6a3b2a';
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.rect(-10 * s, -2 * s, 20 * s, 11 * s);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#fffaf0';
	ctx.beginPath();
	ctx.moveTo(-10 * s, -2 * s);
	for (let k = 0; k <= 4; k++) ctx.quadraticCurveTo(-10 * s + (k - 0.5) * 5 * s, 3 * s, -10 * s + k * 5 * s, -2 * s);
	ctx.fill();
	ctx.strokeStyle = '#e0565b';
	ctx.lineWidth = 3 * s;
	ctx.beginPath();
	ctx.moveTo(0, -3 * s);
	ctx.lineTo(0, -10 * s);
	ctx.stroke();
	ctx.fillStyle = '#ffb21e';
	ctx.beginPath();
	ctx.ellipse(0, -13 * s, 2.6 * s, 4 * s, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export const calendarPageTex = (month: number, year: number, cakes: boolean) =>
	canvasTex(`cal|${month}|${year}|${cakes}`, 512, 640, (ctx, w, h) => {
		const r = mulberry32(month * 31 + year);
		ctx.fillStyle = '#fbf8f1';
		ctx.fillRect(0, 0, w, h);
		// header band
		ctx.fillStyle = cakes ? '#f08a8a' : '#9aa3ad';
		ctx.fillRect(0, 0, w, 120);
		ctx.fillStyle = '#ffffff';
		ctx.font = `800 64px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(MONTHS[month], w / 2, 54);
		ctx.font = `700 30px ${POPPINS}, sans-serif`;
		ctx.fillText(String(year), w / 2, 100);
		// weekday letters
		ctx.fillStyle = '#7b8088';
		ctx.font = `700 24px ${POPPINS}, sans-serif`;
		'SMTWTFS'.split('').forEach((d, i) => ctx.fillText(d, 40 + i * 72, 150));
		const start = (month * 3 + year) % 7;
		const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
		ctx.strokeStyle = '#e1ddd3';
		ctx.lineWidth = 2;
		for (let d = 0; d < days; d++) {
			const c = (start + d) % 7;
			const row = Math.floor((start + d) / 7);
			const x = 4 + c * 72;
			const y = 172 + row * 90;
			ctx.strokeRect(x, y, 70, 88);
			ctx.fillStyle = '#4a4f57';
			ctx.font = `700 24px ${POPPINS}, sans-serif`;
			ctx.textAlign = 'left';
			ctx.fillText(String(d + 1), x + 8, y + 20);
			ctx.textAlign = 'center';
			if (cakes && r() > 0.58) drawCake(ctx, x + 40, y + 58, 1.25, ['#ffb3c7', '#a8d8ff', '#fff0a0', '#b8f0c8', '#d9c2ff'][Math.floor(r() * 5)], r);
		}
	});

/** wall calendar. page = index of the visible month (can be fractional while flipping: the top page lifts away) */
export const WallCalendar: React.FC<{page: number; year?: number; cakes?: boolean; months?: number}> = ({page, year = 2025, cakes = false}) => {
	const W = 2.4;
	const H = 3.0;
	const base = Math.floor(page);
	const k = page - base; // flip progress of the top page
	const pageMat = (p: number) => {
		const m = ((p % 12) + 12) % 12;
		const y = year + Math.floor(p / 12);
		return plastic('#ffffff', {map: calendarPageTex(m, y, cakes), rough: 0.8});
	};
	return (
		<group>
			<mesh geometry={rbox(W + 0.2, H + 0.25, 0.06, 0.03)} material={plastic('#c9a27a', {rough: 0.7})} position={[0, -H / 2, -0.04]} castShadow receiveShadow />
			<mesh geometry={box(W, H, 0.04)} material={plastic('#f2eee6', {rough: 0.9})} position={[0, -H / 2, 0.0]} />
			{/* the page underneath */}
			<mesh geometry={plane(W, H)} material={pageMat(base + 1)} position={[0, -H / 2, 0.025]} />
			{/* top page: flips up around the binding */}
			<group position={[0, 0, 0.03]} rotation={[-easeInOut(clamp(k)) * Math.PI * 0.92, 0, 0]}>
				<mesh geometry={plane(W, H)} material={pageMat(base)} position={[0, -H / 2, 0]} />
				<mesh geometry={plane(W, H)} material={plastic('#e9e4da', {rough: 0.9})} position={[0, -H / 2, -0.003]} rotation={[0, Math.PI, 0]} />
			</group>
			{/* rings + nail */}
			{[-0.7, -0.25, 0.25, 0.7].map((x) => (
				<mesh key={x} geometry={torus(0.09, 0.02, 6, 16)} material={plastic('#9aa1aa', {metal: 0.8, rough: 0.3})} position={[x * (W / 1.6), 0.02, 0.03]} rotation={[0, Math.PI / 2, 0]} />
			))}
			<mesh geometry={cyl(0.04, 0.04, 0.2, 8)} material={plastic('#6b6f76', {metal: 0.6})} position={[0, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]} />
			<mesh geometry={cyl(0.012, 0.012, 0.6, 4)} material={plastic('#5a4a3a')} position={[-0.17, 0.17, 0.0]} rotation={[0, 0, 0.6]} />
			<mesh geometry={cyl(0.012, 0.012, 0.6, 4)} material={plastic('#5a4a3a')} position={[0.17, 0.17, 0.0]} rotation={[0, 0, -0.6]} />
		</group>
	);
};

// ================================================================== rocking chair
/** seat top height (world) */
export const ROCK_SEAT = 1.45;
export const RockingChair: React.FC<{rock?: number; children?: React.ReactNode}> = ({rock = 0, children}) => {
	const wood = plastic('#ffffff', {map: woodTex('#8a5a36', [1, 1], 5, 11), rough: 0.6});
	const dark = plastic('#6e4428', {rough: 0.6});
	const rocker = useMemo(
		() =>
			custom('rocker', () => {
				const curve = new THREE.EllipseCurve(0, 6.2, 6.2, 6.2, -Math.PI / 2 - 0.36, -Math.PI / 2 + 0.36, false, 0);
				const pts = curve.getPoints(24).map((p) => new THREE.Vector3(0, p.y, p.x));
				return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.11, 8, false);
			}),
		[],
	);
	const S = 2.15; // half inner width
	return (
		// rocks around the contact point under the seat
		<group rotation={[rock, 0, 0]}>
			{[-1, 1].map((sd) => (
				<group key={sd} position={[sd * S, 0.11, 0]}>
					<mesh geometry={rocker} material={dark} castShadow receiveShadow />
					{/* legs */}
					<mesh geometry={rbox(0.22, 1.3, 0.22, 0.05)} material={wood} position={[0, 0.72, 0.85]} castShadow />
					<mesh geometry={rbox(0.22, 1.3, 0.22, 0.05)} material={wood} position={[0, 0.72, -0.85]} castShadow />
					{/* arm rest */}
					<mesh geometry={rbox(0.36, 0.16, 2.6, 0.06)} material={wood} position={[0, ROCK_SEAT + 1.05, 0.15]} castShadow />
					<mesh geometry={rbox(0.18, 1.1, 0.18, 0.05)} material={wood} position={[0, ROCK_SEAT + 0.5, 1.15]} castShadow />
					{/* back post */}
					<mesh geometry={rbox(0.24, 3.6, 0.24, 0.06)} material={wood} position={[0, ROCK_SEAT + 1.45, -1.12]} rotation={[-0.14, 0, 0]} castShadow />
				</group>
			))}
			<mesh geometry={rbox(2 * S + 0.3, 0.26, 2.5, 0.08)} material={wood} position={[0, ROCK_SEAT - 0.13, 0]} castShadow receiveShadow />
			{/* back slats */}
			{[-1.2, -0.6, 0, 0.6, 1.2].map((x) => (
				<mesh key={x} geometry={rbox(0.32, 2.9, 0.12, 0.04)} material={wood} position={[x, ROCK_SEAT + 1.5, -1.18]} rotation={[-0.14, 0, 0]} castShadow />
			))}
			<mesh geometry={rbox(2 * S + 0.4, 0.34, 0.2, 0.08)} material={wood} position={[0, ROCK_SEAT + 3.0, -1.38]} rotation={[-0.14, 0, 0]} castShadow />
			{/* a soft cushion */}
			<mesh geometry={rbox(2 * S - 0.3, 0.22, 2.1, 0.1)} material={plastic('#9c4a3c', {rough: 0.9})} position={[0, ROCK_SEAT + 0.08, 0.05]} castShadow receiveShadow />
			{children}
		</group>
	);
};

// ================================================================== photo
/** back of the photo: hand-written note on old paper */
export const photoBackTex = () =>
	canvasTex('photoBack', 1024, 768, (ctx, w, h) => {
		const r = mulberry32(5);
		ctx.fillStyle = '#efe2c4';
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 70; i++) {
			ctx.fillStyle = `rgba(150,110,60,${0.03 + r() * 0.05})`;
			ctx.beginPath();
			ctx.ellipse(r() * w, r() * h, 30 + r() * 120, 20 + r() * 60, r() * 3, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = '#3a2a6a';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `700 118px ${CAVEAT}, cursive`;
		ctx.fillText('The Old Bakery', w / 2, h * 0.36);
		ctx.font = `600 84px ${CAVEAT}, cursive`;
		ctx.fillText('end of our street', w / 2, h * 0.58);
		ctx.strokeStyle = '#3a2a6a';
		ctx.lineWidth = 6;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(w * 0.3, h * 0.7);
		ctx.quadraticCurveTo(w * 0.5, h * 0.74, w * 0.7, h * 0.69);
		ctx.stroke();
		// a tiny drawn heart
		ctx.fillStyle = '#c4475a';
		ctx.save();
		ctx.translate(w * 0.82, h * 0.6);
		ctx.rotate(0.2);
		ctx.beginPath();
		ctx.moveTo(0, 14);
		ctx.bezierCurveTo(-30, -10, -12, -32, 0, -14);
		ctx.bezierCurveTo(12, -32, 30, -10, 0, 14);
		ctx.fill();
		ctx.restore();
	});

/** old-photo look on a render target: sepia, faded blacks, vignette, grain, white paper border */
export function oldPhotoMaterial(tex: THREE.Texture, border = 0.06) {
	return new THREE.ShaderMaterial({
		uniforms: {map: {value: tex}, border: {value: border}},
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
		fragmentShader: `
			uniform sampler2D map; uniform float border; varying vec2 vUv;
			float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
			void main(){
				vec2 b = vec2(border * 0.75, border);
				vec2 inUv = (vUv - b) / (1.0 - 2.0 * b);
				vec3 paper = vec3(0.93, 0.89, 0.80);
				if (inUv.x < 0.0 || inUv.x > 1.0 || inUv.y < 0.0 || inUv.y > 1.0) {
					gl_FragColor = vec4(paper * (0.92 + 0.06 * h(floor(vUv * 300.0))), 1.0);
					return;
				}
				vec3 c = texture2D(map, inUv).rgb;
				// soft shoulder above 0.8 (keeps mid tones, rolls off the bright flames)
				c = mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) / 0.2)), step(0.8, c));
				c = pow(c, vec3(1.0 / 2.2));
				float l = dot(c, vec3(0.299, 0.587, 0.114));
				vec3 sep = vec3(l * 1.07 + 0.05, l * 0.93 + 0.03, l * 0.72);
				c = mix(c, sep, 0.82 * (1.0 - 0.65 * smoothstep(0.82, 1.0, l)));
				c = mix(vec3(0.12, 0.09, 0.06), vec3(0.97, 0.92, 0.80), c); // faded blacks + warm whites
				vec2 q = inUv - 0.5;
				c *= 1.0 - dot(q, q) * 0.9;
				c += (h(floor(inUv * 420.0)) - 0.5) * 0.05;
				c = pow(max(c, 0.0), vec3(2.2));
				gl_FragColor = vec4(c, 1.0);
			}`,
	});
}

/** the photo as a thin card; front shows a texture/material, back the hand-written note */
export const PhotoCard: React.FC<{front: THREE.Material; w?: number; h?: number; dusty?: number; note?: boolean}> = ({front, w = 1.2, h = 0.9, dusty = 0, note = true}) => {
	const back = useMemo(() => (note ? plastic('#ffffff', {map: photoBackTex(), rough: 0.9}) : plastic('#efe2c4', {rough: 0.9})), [note]);
	return (
		<group>
			<mesh geometry={box(w, h, 0.015)} material={plastic('#e9dfca', {rough: 0.9})} castShadow />
			<mesh geometry={plane(w, h)} material={front} position={[0, 0, 0.009]} />
			<mesh geometry={plane(w, h)} material={back} position={[0, 0, -0.009]} rotation={[0, Math.PI, 0]} />
			{dusty > 0 ? <mesh geometry={plane(w, h)} material={plastic('#c9c3b5', {transparent: true, opacity: 0.55 * dusty, rough: 1, depthWrite: false})} position={[0, 0, 0.012]} /> : null}
		</group>
	);
};

// ================================================================== the old book
export const bookCoverTex = () =>
	canvasTex('bookCover', 512, 640, (ctx, w, h) => {
		const r = mulberry32(8);
		ctx.fillStyle = '#7a2e2a';
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 90; i++) {
			ctx.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`;
			ctx.fillRect(r() * w, r() * h, 4 + r() * 30, 2 + r() * 6);
		}
		ctx.strokeStyle = '#d9b25a';
		ctx.lineWidth = 8;
		ctx.strokeRect(30, 30, w - 60, h - 60);
		ctx.lineWidth = 3;
		ctx.strokeRect(46, 46, w - 92, h - 92);
		ctx.fillStyle = '#f0cf72';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `800 150px ${POPPINS}, sans-serif`;
		ctx.fillText('CAKE', w / 2, h * 0.36);
		// a simple gold cake picture
		ctx.lineWidth = 7;
		ctx.strokeStyle = '#f0cf72';
		ctx.strokeRect(w / 2 - 90, h * 0.6, 180, 80);
		ctx.strokeRect(w / 2 - 60, h * 0.6 - 56, 120, 56);
		ctx.beginPath();
		ctx.moveTo(w / 2, h * 0.6 - 60);
		ctx.lineTo(w / 2, h * 0.6 - 100);
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(w / 2, h * 0.6 - 116, 10, 16, 0, 0, Math.PI * 2);
		ctx.fill();
	});

export const recipePageTex = (side: 0 | 1) =>
	canvasTex(`recipe|${side}`, 512, 640, (ctx, w, h) => {
		const r = mulberry32(17 + side);
		ctx.fillStyle = '#f1e6c9';
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 40; i++) {
			ctx.fillStyle = `rgba(140,100,50,${0.03 + r() * 0.04})`;
			ctx.beginPath();
			ctx.ellipse(r() * w, r() * h, 20 + r() * 80, 10 + r() * 40, r() * 3, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = '#4a2f22';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		if (side === 0) {
			ctx.font = `700 64px ${CAVEAT}, cursive`;
			ctx.fillText('Cake', 50, 70);
			ctx.font = `600 38px ${CAVEAT}, cursive`;
			['3 eggs', '2 cups flour', '1 cup sugar', 'butter, milk', 'a pinch of love'].forEach((l, i) => ctx.fillText('• ' + l, 56, 160 + i * 62));
		} else {
			// hand-drawn tall cake
			ctx.strokeStyle = '#4a2f22';
			ctx.lineWidth = 5;
			ctx.strokeRect(150, 330, 220, 140);
			ctx.strokeRect(190, 230, 140, 100);
			for (let i = 0; i < 5; i++) {
				const x = 210 + i * 25;
				ctx.beginPath();
				ctx.moveTo(x, 228);
				ctx.lineTo(x, 190);
				ctx.stroke();
			}
			ctx.font = `600 40px ${CAVEAT}, cursive`;
			ctx.fillText('bake slowly, with patience', 70, 560);
		}
	});

export const OldBook: React.FC<{open?: number; glow?: number}> = ({open = 0, glow = 0}) => {
	const W = 1.3;
	const D = 1.65;
	const T = 0.26;
	const cover = useMemo(() => new THREE.MeshStandardMaterial({map: bookCoverTex(), roughness: 0.7, emissive: new THREE.Color('#ffcf7a'), emissiveMap: bookCoverTex(), emissiveIntensity: 0}), []);
	cover.emissiveIntensity = glow * 0.22;
	const leather = plastic('#6a2622', {rough: 0.7});
	const pages = plastic('#efe4c8', {rough: 0.9});
	if (open > 0.5) {
		const a = (1 - open) * 1.2;
		return (
			<group>
				{[-1, 1].map((sd) => (
					<group key={sd} rotation={[0, 0, sd * a]}>
						<mesh geometry={rbox(W, 0.06, D, 0.02)} material={leather} position={[sd * (W / 2), 0.03, 0]} castShadow receiveShadow />
						<mesh geometry={box(W - 0.08, 0.1, D - 0.08)} material={pages} position={[sd * (W / 2 - 0.02), 0.11, 0]} />
						<mesh geometry={plane(W - 0.1, D - 0.1)} material={plastic('#ffffff', {map: recipePageTex(sd < 0 ? 0 : 1), rough: 0.9})} position={[sd * (W / 2 - 0.02), 0.162, 0]} rotation={[-Math.PI / 2, 0, 0]} />
					</group>
				))}
			</group>
		);
	}
	return (
		<group>
			<mesh geometry={rbox(W, 0.05, D, 0.02)} material={leather} position={[0, 0.025, 0]} castShadow receiveShadow />
			<mesh geometry={box(W - 0.06, T - 0.08, D - 0.08)} material={pages} position={[0.02, T / 2, 0]} />
			<mesh geometry={rbox(W, 0.05, D, 0.02)} material={leather} position={[0, T - 0.025, 0]} castShadow />
			<mesh geometry={rbox(0.1, T, D, 0.04)} material={leather} position={[-W / 2 + 0.03, T / 2, 0]} />
			<mesh geometry={plane(W - 0.04, D - 0.04)} material={cover} position={[0, T + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} />
		</group>
	);
};

// ================================================================== boxes & attic things
export const CardBox: React.FC<{w?: number; h?: number; d?: number; color?: string; dust?: boolean; open?: number; seed?: number}> = ({w = 2.2, h = 1.6, d = 1.8, color = '#b98a5a', dust = true, open = 0, seed = 1}) => {
	const m = plastic(color, {rough: 0.85});
	const dk = plastic(new THREE.Color(color).multiplyScalar(0.8).getStyle(), {rough: 0.9});
	return (
		<group>
			<mesh geometry={rbox(w, h, d, 0.04)} material={m} position={[0, h / 2, 0]} castShadow receiveShadow />
			<mesh geometry={box(w * 0.18, 0.02, d + 0.01)} material={plastic('#d9c49a', {rough: 0.5})} position={[0, h + 0.005, 0]} />
			{dust ? <mesh geometry={box(w - 0.04, 0.015, d - 0.04)} material={plastic('#cfc8bc', {rough: 1, transparent: true, opacity: 0.7})} position={[0, h + 0.012, 0]} /> : null}
			{open > 0
				? [-1, 1].map((sd) => (
						<group key={sd} position={[0, h, sd * (d / 2)]} rotation={[sd * (Math.PI * 0.62 * open), 0, 0]}>
							<mesh geometry={box(w - 0.02, 0.03, d / 2)} material={dk} position={[0, 0, -sd * (d / 4)]} castShadow />
						</group>
					))
				: null}
			<mesh geometry={plane(w * 0.5, h * 0.3)} material={plastic('#f2ead8', {rough: 0.9})} position={[hash(seed, 1) * 0.3 - 0.15, h * 0.55, d / 2 + 0.01]} />
		</group>
	);
};

export const OldTrunk: React.FC = () => {
	const wood = plastic('#ffffff', {map: woodTex('#5e3b22', [1, 1], 4, 7), rough: 0.7});
	const metal = plastic('#8a7a5a', {metal: 0.6, rough: 0.4});
	return (
		<group>
			<mesh geometry={rbox(3, 1.6, 1.8, 0.06)} material={wood} position={[0, 0.8, 0]} castShadow receiveShadow />
			<mesh geometry={custom('trunkLid', () => new THREE.CylinderGeometry(0.9, 0.9, 3, 20, 1, false, 0, Math.PI))} material={wood} position={[0, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.45]} castShadow />
			{[-1.1, 1.1].map((x) => (
				<mesh key={x} geometry={box(0.12, 1.62, 1.84)} material={metal} position={[x, 0.8, 0]} />
			))}
			<mesh geometry={rbox(0.3, 0.36, 0.1, 0.04)} material={metal} position={[0, 1.4, 0.92]} />
		</group>
	);
};

// ================================================================== kitchen things
export const Bowl: React.FC<{r?: number; color?: string; batter?: string | null; stir?: number}> = ({r = 0.75, color = '#f3efe8', batter = '#f1d690', stir = 0}) => {
	const geo = lathe(`bowl|${r}`, [
		[0.001, 0],
		[r * 0.55, 0],
		[r * 0.9, r * 0.35],
		[r, r * 0.75],
		[r * 0.94, r * 0.78],
		[r * 0.84, r * 0.4],
		[r * 0.5, r * 0.1],
		[0.001, r * 0.1],
	]);
	return (
		<group>
			<mesh geometry={geo} material={plastic(color, {rough: 0.25, envInt: 1.2, side: THREE.DoubleSide})} castShadow receiveShadow />
			{batter ? (
				<mesh geometry={cyl(r * 0.84, r * 0.84, 0.04, 28)} material={plastic(batter, {rough: 0.45})} position={[0, r * 0.52, 0]} rotation={[0, stir, 0]} />
			) : null}
		</group>
	);
};

export const Spoon: React.FC = () => (
	<group>
		<mesh geometry={cyl(0.04, 0.05, 1.3, 8)} material={plastic('#c9925a', {rough: 0.6})} position={[0, 0.65, 0]} castShadow />
		<mesh geometry={sphere(0.13, 10, 8)} material={plastic('#c9925a', {rough: 0.6})} position={[0, 0.02, 0]} scale={[1, 0.5, 1.4]} castShadow />
	</group>
);

export const Egg: React.FC<{position?: V3; rot?: number}> = ({position, rot = 0}) => (
	<mesh geometry={sphere(0.17, 14, 10)} material={plastic('#f6ead6', {rough: 0.5})} position={position} rotation={[0, 0, rot]} scale={[1, 1.28, 1]} castShadow receiveShadow />
);

export const FlourBag: React.FC<{tilt?: number}> = ({tilt = 0}) => {
	const label = useMemo(
		() =>
			plastic('#ffffff', {
				map: canvasTex('flourLabel', 256, 256, (ctx, w, h) => {
					ctx.fillStyle = '#f4efe2';
					ctx.fillRect(0, 0, w, h);
					ctx.fillStyle = '#c9584a';
					ctx.fillRect(0, 70, w, 90);
					ctx.fillStyle = '#ffffff';
					ctx.font = `800 64px ${POPPINS}, sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText('FLOUR', w / 2, 116);
				}),
				rough: 0.9,
			}),
		[],
	);
	return (
		<group rotation={[0, 0, tilt]}>
			<mesh geometry={rbox(0.9, 1.25, 0.6, 0.1)} material={plastic('#f4efe2', {rough: 0.95})} position={[0, 0.62, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(0.8, 0.25, 0.4, 0.08)} material={plastic('#ece4d0', {rough: 0.95})} position={[0, 1.3, 0]} rotation={[0.2, 0, 0.1]} castShadow />
			<mesh geometry={plane(0.8, 0.8)} material={label} position={[0, 0.62, 0.305]} />
		</group>
	);
};

/** kitchen oven: door hinged at the bottom (open 0..1), glowing window, inner light */
export const OVEN = {w: 3.0, h: 3.0, d: 2.6};
export const Oven: React.FC<{open?: number; glow?: number; children?: React.ReactNode}> = ({open = 0, glow = 0.4, children}) => {
	const body = plastic('#e9e4dc', {rough: 0.35, envInt: 1.1});
	const dark = plastic('#2a2a30', {rough: 0.4});
	const inner = plastic('#3a3230', {rough: 0.8});
	const {w, h, d} = OVEN;
	return (
		<group>
			{/* body with a hollow front: back, sides, top, bottom */}
			<mesh geometry={box(w, h, 0.2)} material={body} position={[0, h / 2, -d / 2 + 0.1]} castShadow receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={box(0.25, h, d)} material={body} position={[sd * (w / 2 - 0.125), h / 2, 0]} castShadow receiveShadow />
			))}
			<mesh geometry={box(w, 0.6, d)} material={body} position={[0, h - 0.3, 0]} castShadow />
			<mesh geometry={box(w, 0.35, d)} material={body} position={[0, 0.175, 0]} receiveShadow />
			{/* cavity walls + rack */}
			<mesh geometry={box(w - 0.5, h - 0.95, 0.05)} material={inner} position={[0, 0.35 + (h - 0.95) / 2, -d / 2 + 0.23]} />
			<mesh geometry={box(w - 0.5, 0.05, d - 0.3)} material={inner} position={[0, 0.37, 0]} />
			<mesh geometry={box(w - 0.5, 0.04, d - 0.5)} material={plastic('#9a9aa2', {metal: 0.8, rough: 0.3})} position={[0, 0.95, 0]} />
			<mesh geometry={plane(w - 0.5, h - 0.95)} material={glowMat('#ff9a3a', Math.round((0.25 + glow * 1.2) * 10) / 10)} position={[0, 0.35 + (h - 0.95) / 2, -d / 2 + 0.26]} />
			{glow > 0.05 ? <pointLight position={[0, 1.6, 0.2]} color="#ffae55" intensity={10 * glow} distance={9} decay={1.6} /> : null}
			<group position={[0, 0.96, 0]}>{children}</group>
			{/* control panel */}
			<mesh geometry={box(w - 0.1, 0.58, 0.08)} material={dark} position={[0, h - 0.3, d / 2 + 0.02]} />
			{[-1, -0.5, 0.5, 1].map((x) => (
				<mesh key={x} geometry={cyl(0.1, 0.1, 0.1, 14)} material={plastic('#d9d4cc', {metal: 0.5, rough: 0.3})} position={[x, h - 0.3, d / 2 + 0.1]} rotation={[Math.PI / 2, 0, 0]} />
			))}
			<mesh geometry={rbox(0.5, 0.26, 0.04, 0.03)} material={glowMat('#7dffb0', 1.4)} position={[0, h - 0.3, d / 2 + 0.07]} />
			{/* door */}
			<group position={[0, 0.36, d / 2]} rotation={[open * 1.45, 0, 0]}>
				<mesh geometry={rbox(w - 0.06, h - 0.98, 0.16, 0.05)} material={body} position={[0, (h - 0.98) / 2, 0.08]} castShadow />
				<mesh geometry={plane(w - 0.9, h - 1.7)} material={glowMat('#ffb15a', Math.round((0.3 + glow * 1.4) * 10) / 10)} position={[0, (h - 0.98) / 2 + 0.05, 0.165]} />
				<mesh geometry={rbox(w - 0.6, 0.12, 0.12, 0.05)} material={plastic('#bfc3c9', {metal: 0.8, rough: 0.25})} position={[0, h - 1.15, 0.3]} />
			</group>
		</group>
	);
};

// ================================================================== tables & chairs
export const Table: React.FC<{w?: number; d?: number; h?: number; cloth?: string | null; wood?: string}> = ({w = 5, d = 3, h = 2.3, cloth = null, wood = '#9a6a42'}) => {
	const m = plastic('#ffffff', {map: woodTex(wood, [1, 1], 5, 9), rough: 0.6});
	return (
		<group>
			<mesh geometry={rbox(w, 0.2, d, 0.06)} material={m} position={[0, h - 0.1, 0]} castShadow receiveShadow />
			{[-1, 1].map((sx) =>
				[-1, 1].map((sz) => <mesh key={sx + ',' + sz} geometry={rbox(0.22, h - 0.2, 0.22, 0.05)} material={m} position={[sx * (w / 2 - 0.3), (h - 0.2) / 2, sz * (d / 2 - 0.3)]} castShadow />),
			)}
			{cloth ? (
				<>
					<mesh geometry={box(w + 0.4, 0.04, d + 0.4)} material={plastic(cloth, {rough: 0.85})} position={[0, h + 0.02, 0]} receiveShadow />
					{[-1, 1].map((sd) => (
						<mesh key={'c' + sd} geometry={box(w + 0.4, 0.7, 0.03)} material={plastic(cloth, {rough: 0.85})} position={[0, h - 0.33, sd * (d / 2 + 0.2)]} castShadow />
					))}
					{[-1, 1].map((sd) => (
						<mesh key={'s' + sd} geometry={box(0.03, 0.7, d + 0.4)} material={plastic(cloth, {rough: 0.85})} position={[sd * (w / 2 + 0.2), h - 0.33, 0]} castShadow />
					))}
				</>
			) : null}
		</group>
	);
};

export const KitchenChair: React.FC<{color?: string}> = ({color = '#a0703f'}) => {
	const m = plastic(color, {rough: 0.6});
	return (
		<group>
			<mesh geometry={rbox(1.8, 0.18, 1.7, 0.05)} material={m} position={[0, 1.45, 0]} castShadow receiveShadow />
			{[-1, 1].map((sx) => [-1, 1].map((sz) => <mesh key={sx + ',' + sz} geometry={rbox(0.16, 1.4, 0.16, 0.04)} material={m} position={[sx * 0.75, 0.7, sz * 0.7]} castShadow />))}
			<mesh geometry={rbox(1.8, 1.6, 0.14, 0.05)} material={m} position={[0, 2.4, -0.8]} castShadow />
		</group>
	);
};

// ================================================================== party things
/** home-made cloth banner hanging between a and b (x axis), letters painted by hand in different colours */
export const bannerTex = (text: string) =>
	canvasTex(`banner|${text}`, 1536, 620, (ctx, w, h) => {
		const r = mulberry32(77);
		ctx.fillStyle = '#f6ecd8';
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 60; i++) {
			ctx.fillStyle = `rgba(160,120,70,${0.03 + r() * 0.04})`;
			ctx.fillRect(r() * w, r() * h, 10 + r() * 80, 2 + r() * 4);
		}
		const cols = ['#e2475f', '#f29a2e', '#e8b923', '#3fa36b', '#2f86c9', '#8a5cc7'];
		ctx.font = `800 200px ${POPPINS}, sans-serif`;
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';
		const lines = text.split('|');
		let ci = 0;
		lines.forEach((line, li) => {
			const letters = line.split('');
			const widths = letters.map((ch) => (ch === ' ' ? 60 : ctx.measureText(ch).width + 6));
			const tw = widths.reduce((a, b) => a + b, 0);
			let x = (w - tw) / 2;
			const y = (h / (lines.length + 0.1)) * (li + 0.55);
			letters.forEach((ch, i) => {
				const lw = widths[i];
				if (ch !== ' ') {
					ctx.save();
					ctx.translate(x + lw / 2, y + (r() - 0.5) * 20);
					ctx.rotate((r() - 0.5) * 0.22);
					ctx.fillStyle = cols[ci++ % cols.length];
					ctx.fillText(ch, 0, 0);
					ctx.restore();
				}
				x += lw;
			});
		});
		// stitched border
		ctx.strokeStyle = '#c45a4a';
		ctx.setLineDash([26, 18]);
		ctx.lineWidth = 8;
		ctx.strokeRect(22, 22, w - 44, h - 44);
	});

export const Banner: React.FC<{text: string; w?: number; h?: number; sag?: number}> = ({text, w = 22, h = 3.4, sag = 0.9}) => {
	const geo = useMemo(
		() =>
			custom(`bannerGeo|${w}|${h}|${sag}`, () => {
				const g = new THREE.PlaneGeometry(w, h, 40, 2);
				const p = g.attributes.position as THREE.BufferAttribute;
				for (let i = 0; i < p.count; i++) {
					const x = p.getX(i);
					const t = x / w + 0.5;
					p.setY(i, p.getY(i) - Math.sin(t * Math.PI) * sag);
					p.setZ(i, Math.sin(t * Math.PI * 3) * 0.08);
				}
				g.computeVertexNormals();
				return g;
			}),
		[w, h, sag],
	);
	const mat = useMemo(() => plastic('#ffffff', {map: bannerTex(text), rough: 0.9, side: THREE.DoubleSide}), [text]);
	return (
		<group>
			<mesh geometry={geo} material={mat} castShadow receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={cyl(0.03, 0.03, 1.2, 4)} material={plastic('#6a5a4a')} position={[sd * (w / 2 + 0.4), h / 2 + 0.2, 0]} rotation={[0, 0, sd * 1.1]} />
			))}
		</group>
	);
};

export const Balloon: React.FC<{color: string; frame: number; seed?: number; string?: number}> = ({color, frame, seed = 1, string = 3}) => {
	const t = frame / 30;
	const bob = Math.sin(t * 1.3 + seed) * 0.12;
	const sway = Math.sin(t * 0.9 + seed * 2) * 0.08;
	return (
		<group rotation={[0, 0, sway]}>
			<mesh geometry={cyl(0.012, 0.012, string, 4)} material={plastic('#f4f4f4', {rough: 0.6})} position={[0, string / 2, 0]} />
			<group position={[0, string + 0.7 + bob, 0]}>
				<mesh geometry={sphere(0.7, 24, 18)} material={plastic(color, {rough: 0.18, envInt: 1.4})} scale={[1, 1.16, 1]} castShadow />
				<mesh geometry={cone(0.12, 0.18, 10)} material={plastic(color, {rough: 0.3})} position={[0, -0.86, 0]} rotation={[Math.PI, 0, 0]} />
			</group>
		</group>
	);
};

const BULBS = ['#ffe7b0', '#ffd27a', '#fff3d6', '#ffc58a'];
/** a string of warm bulbs from a to b; bulb i lights up at onAt(i) (frames), with a little flash */
export const PartyLights: React.FC<{a: V3; b: V3; sag?: number; n?: number; frame: number; onAt?: (i: number) => number; seed?: number}> = ({a, b, sag = 1.6, n = 18, frame, onAt, seed = 0}) => {
	const key = `${a.join(',')}|${b.join(',')}|${sag}`;
	const {wire, pts} = useMemo(() => {
		const raw: THREE.Vector3[] = [];
		for (let i = 0; i <= 24; i++) {
			const t = i / 24;
			raw.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t));
		}
		const curve = new THREE.CatmullRomCurve3(raw);
		const wire = custom('pwire|' + key, () => new THREE.TubeGeometry(curve, 32, 0.025, 4, false));
		const pts: V3[] = [];
		for (let i = 1; i < n; i++) {
			const p = curve.getPoint(i / n);
			pts.push([p.x, p.y - 0.16, p.z]);
		}
		return {wire, pts};
	}, [key, n]);
	const off = plastic('#d8d2c4', {rough: 0.25, transparent: true, opacity: 0.85});
	return (
		<group>
			<mesh geometry={wire} material={plastic('#2a2620', {rough: 0.6})} />
			{pts.map((p, i) => {
				const on = onAt ? onAt(i) : -999;
				const k = clamp((frame - on) / 4);
				const flash = frame >= on ? Math.max(0, 1 - (frame - on) / 8) : 0;
				const col = BULBS[(i + seed) % BULBS.length];
				return (
					<group key={i} position={p}>
						<mesh geometry={cyl(0.07, 0.07, 0.12, 8)} material={plastic('#3a342c', {rough: 0.5})} position={[0, 0.12, 0]} />
						<mesh geometry={sphere(0.15, 12, 10)} material={k > 0 ? glowMat(col, Math.round((1.8 + 2.4 * k + flash * 3) * 4) / 4) : off} scale={[1, 1.2, 1]} />
					</group>
				);
			})}
		</group>
	);
};
