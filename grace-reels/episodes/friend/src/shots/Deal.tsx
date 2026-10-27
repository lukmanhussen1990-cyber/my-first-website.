// S6 (the deal, a flashback: a ringed hand counts silver into Judas's open palm), S7 (the thirty coins
// fly onto an old balance scale; a slave's chain on the other pan balances it on "slave") and S8 (one
// coin spins on the table, wobbles faster and falls flat; the focus pulls back to Judas's face).
import partsJson from '../../public/sprites/props/scale_parts.json';
import spritesJson from '../../public/sprites/sprites.json';
import {CharacterRoot, PoseSprite} from '../characters/Character';
import {PoseWithBlink} from '../characters/Actor';
import {Flame, flicker, Glow} from '../fx/Flame';
import {clamp, easeIn, easeInOut, easeOut, keys, lerp, pulse, seg, springStep} from '../lib/ease';
import {hash} from '../lib/random';
import {B, SCENE} from '../lib/timeline';
import {meta} from '../lib/textures';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Haze, Layer, Pool} from '../world/Layer';

const SHEET = spritesJson as unknown as Record<string, {sheetBox: [number, number, number, number]; foot: [number, number]}>;
const PARTS = partsJson as unknown as {
	scale_bar: {pivot: [number, number]; knobL: [number, number]; knobR: [number, number]};
	scale_pan_l: {hang: [number, number]};
	scale_pan_r: {hang: [number, number]};
	scale_stand: {pivot: [number, number]};
};

// A sprite placed by a chosen pixel, at a world point, with a scale (px per metre), rotation and flip.
const Piece: React.FC<{sprite: string; at: Vec3; px: [number, number]; pxPerM: number; rot?: number; flip?: boolean; look?: Parameters<typeof PoseSprite>[0]['look']; order: number; sx?: number; sy?: number}> = ({
	sprite,
	at,
	px,
	pxPerM,
	rot = 0,
	flip,
	look,
	order,
	sx = 1,
	sy = 1,
}) => (
	<group position={at} rotation-z={rot} scale={[(flip ? -1 : 1) * sx, sy, 1]}>
		<group scale={[1 / pxPerM, 1 / pxPerM, 1 / pxPerM]}>
			<PoseSprite sprite={sprite} anchor={px} look={look} renderOrder={order} />
		</group>
	</group>
);

// ---------------- S6 · the deal ----------------
// The two hands keep the layout they were drawn in (one sheet, 1536 px wide) at HANDS_PX px per metre.
const HANDS_PX = 1650;
const sheetToWorld = (sx: number, sy: number): [number, number] => [(sx - 768) / HANDS_PX, (512 - sy) / HANDS_PX];
const FINGERS = sheetToWorld(770, 452); // where the ring hand lets each coin go
const PALM = sheetToWorld(1012, 610); // the hollow of Judas's palm
const COIN_PX = 5600; // coin sprites (coin_tilt is 336 px wide -> 6 cm, small enough for thirty to fit the palm)
// Each landed coin rests a little higher on the pile (seeded spread inside the palm).
const pileSpot = (k: number): [number, number] => {
	const a = hash(401, k) * Math.PI * 2;
	const r = 0.022 * Math.sqrt(hash(402, k));
	return [PALM[0] + Math.cos(a) * r * 1.4, PALM[1] + 0.006 + Math.sin(a) * r * 0.3 + 0.0016 * Math.min(k, 26)];
};
const DROP = 0.2; // seconds a coin falls

const DealHands: React.FC<{t: number}> = ({t}) => {
	const coins = B.coins;
	const last = coins.reduce((n, c) => (t >= c - DROP ? n + 1 : n), 0);
	// the ring hand dips a little as it lets each coin go
	const dip = coins.reduce((s, c) => s + 0.004 * pulse(t, c - DROP, 0.03, 0.08), 0);
	// Judas's palm sinks a hair under the weight as the pile grows
	const sink = 0.008 * clamp(last / 30) + coins.reduce((s, c) => s + 0.002 * pulse(t, c, 0.01, 0.06), 0);
	const ring = SHEET['props/hand_ring'].sheetBox;
	const jud = SHEET['props/hand_judas'].sheetBox;
	const centreOf = (b: number[]): [number, number] => sheetToWorld(b[0] + b[2] / 2, b[1] + b[3] / 2);
	const rc = centreOf(ring);
	const jc = centreOf(jud);
	const warm = {tint: '#f3d2b0', grad: {dir: [0.4, -1] as [number, number], color: '#ffc890', amount: 0.3}};
	return (
		<>
			<Piece sprite="props/hand_ring" at={[rc[0], rc[1] - dip, 0]} px={[ring[2] / 2, ring[3] / 2]} pxPerM={HANDS_PX} look={warm} order={40} />
			<Piece sprite="props/hand_judas" at={[jc[0], jc[1] - sink, -0.01]} px={[jud[2] / 2, jud[3] / 2]} pxPerM={HANDS_PX} look={{...warm, tint: '#e8c2a0'}} order={30} />
			{coins.map((c, k) => {
				const age = t - (c - DROP);
				if (age < 0) {
					// the next coin waits between the fingers
					if (k === last) return <Piece key={k} sprite="props/coin_tilt" at={[FINGERS[0], FINGERS[1] - dip, 0.005]} px={[168, 178]} pxPerM={COIN_PX} rot={0.5} look={{tint: '#f0f0f4'}} order={45} />;
					return null;
				}
				const [px, py] = pileSpot(k);
				const f = clamp(age / DROP);
				const x = lerp(FINGERS[0], px, f);
				const y = lerp(FINGERS[1], py - sink, easeIn(f)) + 0.012 * Math.sin(Math.PI * f);
				const spin = (1 - f) * 7 + hash(403, k) * 3;
				const landed = f >= 1;
				const bounce = landed ? 0.004 * Math.exp(-(t - c) * 30) * Math.abs(Math.sin((t - c) * 50)) : 0;
				return (
					<Piece
						key={k}
						sprite={landed ? 'props/coin_tilt' : Math.abs(Math.cos(spin)) < 0.3 ? 'props/coin_edge' : 'props/coin_face'}
						at={[x, y + bounce, 0.005 + k * 0.0002]}
						px={landed ? [168, 178] : Math.abs(Math.cos(spin)) < 0.3 ? [54, 191] : [185, 193]}
						pxPerM={landed ? COIN_PX : COIN_PX * 1.15}
						rot={landed ? (hash(404, k) - 0.5) * 0.9 : spin * 0.3}
						sx={landed ? 1 : Math.max(0.25, Math.abs(Math.cos(spin)))}
						look={{tint: '#eeeef2', light: 0.3 * pulse(t, c, 0.01, 0.12), lightColor: '#ffffff'}}
						order={35 + k * 0.01}
					/>
				);
			})}
		</>
	);
};

export const DEAL: ShotDef = {
	id: 'DEAL',
	start: SCENE.S6.start - 0.4,
	end: SCENE.S7.start + 0.5,
	Content: ({t}) => (
		<>
			<Layer sprite="bg/dealroom" position={[0.12, -1.55, -2.2]} width={2.25} look={{tint: '#d7b496', blur: 5}} renderOrder={-900} />
			<Flame position={[0.12 + (735 - 512) * (2.25 / 1024), -1.55 + (1536 - 838) * (2.25 / 1024), -2.18]} height={0.06} t={t} seed={9} glow={4} renderOrder={-880} />
			<Pool position={[0.0, -0.05, -0.6]} size={[1.6, 1.2]} color="#ffb060" intensity={0.3 * flicker(t, 9)} renderOrder={-870} />
			<DealHands t={t} />
		</>
	),
	camera: (t) => {
		const u = seg(t, SCENE.S6.start - 0.4, SCENE.S7.start + 0.5, (x) => x);
		return {pos: [0.02 + 0.03 * u, -0.02, 1.15 - 0.15 * u], target: [0.03, -0.035, 0], fov: 30, drift: 0.5};
	},
	grade: (t) => ({
		exposure: 0.98 + 0.04 * Math.sin(t * 23) * 0.3,
		contrast: 1.12,
		saturation: 0.82,
		gain: [1.08, 0.98, 0.84],
		lift: [0.02, 0.012, 0.0],
		vignette: 0.75,
		bloom: 0.45,
		bloomThreshold: 0.78,
		grain: 0.045,
		desat: 0.25,
	}),
	anchors: () => ({palm: [PALM[0], PALM[1] + 0.02, 0] as Vec3}),
};

// ---------------- S7 · but notice: the price of a slave ----------------
const SC_PX = 1150; // scale sheet pixels per metre (the stand is ~0.68 m tall)
const STAND_AT: Vec3 = [0, -0.62, 0];
// beam tilt (radians, + = left pan down): heavy with coins, then the chain lands and it swings level
const tiltAt = (t: number) => {
	const coins = seg(t, B.coinsFly + 0.35, B.coinsLanded + 0.15, easeInOut) * 0.2;
	const chain = t > B.chainLand ? 1 - Math.exp(-(t - B.chainLand) * 2.8) * Math.cos((t - B.chainLand) * 10) : 0;
	const settle = seg(t, B.chainLand, B.scaleLevel + 0.05);
	return coins * (1 - Math.max(chain, settle)) + 0.035 * Math.exp(-(t - B.coinsLanded) * 2) * Math.sin((t - B.coinsLanded) * 9) * (t > B.coinsLanded ? 1 : 0);
};
const pivotWorld = (): Vec3 => {
	const m = meta('props/scale_stand');
	const [px, py] = PARTS.scale_stand.pivot;
	return [STAND_AT[0] + (px - m.foot[0]) / SC_PX, STAND_AT[1] + (m.foot[1] - py) / SC_PX, 0];
};
const knobWorld = (side: 'L' | 'R', tilt: number): Vec3 => {
	const [cx, cy] = PARTS.scale_bar.pivot;
	const [kx, ky] = side === 'L' ? PARTS.scale_bar.knobL : PARTS.scale_bar.knobR;
	const dx = (kx - cx) / SC_PX;
	const dy = -(ky - cy) / SC_PX;
	const a = -tilt;
	const p = pivotWorld();
	return [p[0] + dx * Math.cos(a) - dy * Math.sin(a), p[1] + dx * Math.sin(a) + dy * Math.cos(a), 0];
};
// the pan's bowl (where things rest), below the knob
const PAN_DROP = 0.252;
const panSeat = (side: 'L' | 'R', tilt: number): Vec3 => {
	const k = knobWorld(side, tilt);
	return [k[0] + (side === 'L' ? 0.008 : -0.008), k[1] - PAN_DROP, 0.01];
};

const ScaleScene: React.FC<{t: number}> = ({t}) => {
	const tilt = tiltAt(t);
	const p = pivotWorld();
	const kl = knobWorld('L', tilt);
	const kr = knobWorld('R', tilt);
	const swingL = 0.04 * Math.sin(t * 2.2) * Math.exp(-Math.max(0, t - B.scaleLevel) * 0.8);
	const look = {tint: '#f4d7b0', rim: 0.5, rimColor: '#ffd08a', rimDir: [0.3, 1] as [number, number]};
	// the coins arcing up from below and stacking in the left pan
	const seatL = panSeat('L', tilt);
	const coins = B.coinLand.map((land, k) => {
		const start = land - 0.38 - 0.012 * k;
		if (t < start) return null;
		const f = clamp((t - start) / (land - start));
		const from: [number, number] = [-0.12 + 0.18 * hash(411, k), -0.9];
		const tx = seatL[0] + (hash(412, k) - 0.5) * 0.11;
		const ty = seatL[1] + 0.012 + 0.0032 * Math.min(k, 22) + (hash(413, k) - 0.5) * 0.004;
		const x = lerp(from[0], tx, f);
		const y = lerp(from[1], ty, f) + 0.32 * Math.sin(Math.PI * f) * (1 - 0.4 * f);
		const spin = (1 - f) * 9 + hash(414, k) * 4;
		const landed = f >= 1;
		return (
			<Piece
				key={k}
				sprite={landed ? 'props/coin_tilt' : Math.abs(Math.cos(spin)) < 0.3 ? 'props/coin_edge' : 'props/coin_face'}
				at={[x, y, 0.02 + k * 0.0002]}
				px={landed ? [168, 178] : Math.abs(Math.cos(spin)) < 0.3 ? [54, 191] : [185, 193]}
				pxPerM={landed ? 7000 : 7600}
				rot={landed ? (hash(415, k) - 0.5) * 0.5 : spin * 0.4}
				sx={landed ? 1 : Math.max(0.25, Math.abs(Math.cos(spin)))}
				look={{tint: '#efeff3', light: landed ? 0.15 * pulse(t, land, 0.01, 0.1) : 0.1, lightColor: '#ffffff'}}
				order={60 + k * 0.01}
			/>
		);
	});
	// the chain and the tag drop into the right pan on "price" and land just after
	const seatR = panSeat('R', tilt);
	const chainF = clamp((t - B.chainDrop) / (B.chainLand - B.chainDrop));
	const chainY = t < B.chainDrop ? seatR[1] + 0.6 : lerp(seatR[1] + 0.6, seatR[1] + 0.03, easeIn(chainF));
	const squash = t > B.chainLand ? 1 - 0.08 * Math.exp(-(t - B.chainLand) * 14) * Math.cos((t - B.chainLand) * 30) : 1;
	return (
		<>
			<Piece sprite="props/scale_stand" at={STAND_AT} px={meta('props/scale_stand').foot} pxPerM={SC_PX} look={look} order={10} />
			<Piece sprite="props/scale_pan_l" at={kl} px={PARTS.scale_pan_l.hang} pxPerM={SC_PX} rot={swingL} look={look} order={12} />
			<Piece sprite="props/scale_pan_r" at={kr} px={PARTS.scale_pan_r.hang} pxPerM={SC_PX} rot={-swingL * 0.8} look={look} order={12} />
			<Piece sprite="props/scale_bar" at={p} px={PARTS.scale_bar.pivot} pxPerM={SC_PX} rot={-tilt} look={look} order={14} />
			{coins}
			{t >= B.chainDrop && (
				<>
					<Piece sprite="props/chain" at={[seatR[0] + 0.0, chainY, 0.03]} px={[355, 200]} pxPerM={3300} sy={squash} rot={-0.08} look={{tint: '#d8d4d0', rim: 0.6, rimColor: '#ffd8a0', rimDir: [0.2, 1]}} order={70} />
					<Piece sprite="props/tag" at={[seatR[0] + 0.07, chainY + 0.05, 0.04]} px={[120, 30]} pxPerM={3800} rot={0.12 + 0.15 * Math.sin((t - B.chainDrop) * 6) * Math.exp(-Math.max(0, t - B.chainLand) * 2)} look={{tint: '#f6e6c8'}} order={71} />
				</>
			)}
		</>
	);
};

export const SCALE: ShotDef = {
	id: 'SCALE',
	start: SCENE.S7.start - 0.5,
	end: SCENE.S8.start + 0.4,
	Content: ({t}) => (
		<>
			<Layer sprite="bg/dealroom" position={[0.3, -2.4, -3.4]} width={4.2} look={{tint: '#8a6a52', blur: 16}} renderOrder={-900} />
			<Pool position={[0, -0.1, -1.5]} size={[2.6, 2.6]} color="#ffb870" intensity={0.32} falloff={1.6} renderOrder={-880} />
			<Haze position={[0, -0.75, -1]} size={[4, 1.2]} color="#2a1810" bottom={0.6} top={0} renderOrder={-870} />
			<ScaleScene t={t} />
		</>
	),
	camera: (t) => {
		// wide enough for both pans; the beam sits a little below the middle so the card fits above it
		const u = seg(t, SCENE.S7.start - 0.5, SCENE.S8.start + 0.4, (x) => x);
		const level = seg(t, B.chainDrop - 0.3, B.scaleLevel + 0.5, easeInOut);
		const px = pivotWorld()[0];
		return {pos: [px, -0.02 + 0.02 * u, 2.95 - 0.2 * u - 0.15 * level], target: [px, -0.06 + 0.02 * level, 0], fov: 32, drift: 0.5};
	},
	grade: () => ({exposure: 1.02, contrast: 1.1, saturation: 0.95, gain: [1.06, 1.0, 0.9], lift: [0.012, 0.008, 0.0], vignette: 0.65, bloom: 0.5, bloomThreshold: 0.75, grain: 0.025}),
	anchors: (t) => {
		const s = panSeat('R', tiltAt(t));
		return {chain: [s[0] + 0.02, s[1] + 0.06, 0] as Vec3};
	},
};

// ---------------- S8 · worth: one coin spins and falls flat ----------------
// 2D spin from the drawn coin: the face narrows and widens as it turns (the edge shows when it is thin);
// then it wobbles down faster and faster and slaps flat.
const coinSpinState = (t: number) => {
	const t0 = B.spinStart;
	const u = Math.max(0, t - t0);
	const wob = clamp((t - B.wobble) / (B.coinFlat - B.wobble));
	const rate = t < B.wobble ? 16 - 6 * clamp(u / (B.wobble - t0)) : 10 + 26 * wob ** 2;
	// integrate the turning angle (closed form per phase)
	const d1 = Math.min(t, B.wobble) - t0;
	let ang = 16 * d1 - (6 / (2 * (B.wobble - t0))) * d1 * d1;
	if (t > B.wobble) {
		const d2 = Math.min(t, B.coinFlat) - B.wobble;
		const L = B.coinFlat - B.wobble;
		ang += 10 * d2 + (26 * L * (d2 / L) ** 3) / 3;
	}
	const lie = t < B.wobble ? 0 : t >= B.coinFlat ? 1 : wob ** 1.6;
	return {ang: Math.max(0, ang), rate, lie, flat: t >= B.coinFlat};
};

const SpinningCoin: React.FC<{t: number; blur: number}> = ({t, blur}) => {
	const s = coinSpinState(t);
	const base: Vec3 = [0, 0, 0];
	if (s.flat) {
		const bounce = 0.004 * Math.exp(-(t - B.coinFlat) * 22) * Math.abs(Math.sin((t - B.coinFlat) * 55));
		const sq = 1 - 0.1 * Math.exp(-(t - B.coinFlat) * 20) * Math.cos((t - B.coinFlat) * 40);
		return <Piece sprite="props/coin_tilt" at={[base[0], base[1] + 0.012 + bounce, 0]} px={[168, 178]} pxPerM={4200} sx={1 / sq} sy={0.62 * sq} look={{tint: '#ececf0', blur, light: 0.4 * pulse(t, B.coinFlat, 0.01, 0.25), lightColor: '#ffffff'}} order={50} />;
	}
	// motion ghosts: a few copies a little behind in the turn, fading
	const ghosts = s.rate > 12 ? 3 : 1;
	return (
		<>
			{Array.from({length: ghosts}, (_, g) => {
				const a = s.ang - g * 0.18;
				const c = Math.cos(a);
				const thin = Math.abs(c) < 0.18;
				// the lying-down phase: the coin tilts back, so its face reads more and more as an ellipse
				const h = 1 - 0.5 * s.lie;
				return (
					<Piece
						key={g}
						sprite={thin ? 'props/coin_edge' : 'props/coin_face'}
						at={[base[0] + 0.004 * Math.sin(a * 0.5) * s.lie, base[1] + 0.0215 * h, -0.001 * g]}
						px={thin ? [54, 191] : [185, 193]}
						pxPerM={thin ? 4200 * 0.62 : 4200}
						sx={thin ? 1 : Math.max(0.08, Math.abs(c))}
						sy={h}
						rot={0.35 * s.lie * Math.sin(a)}
						look={{tint: '#ececf0', opacity: g === 0 ? 1 : 0.35 / g, blur: blur + (g > 0 ? 2 : 0), light: 0.25 * Math.max(0, Math.sin(a * 2)), lightColor: '#ffffff'}}
						order={50 - g}
					/>
				);
			})}
		</>
	);
};

export const COINSPIN: ShotDef = {
	id: 'COINSPIN',
	start: SCENE.S8.start - 0.3,
	end: SCENE.S9.start + 0.4,
	Content: ({t}) => {
		const rack = seg(t, B.rackJudas - 0.05, B.rackJudas + 0.45, easeInOut);
		return (
			<>
				<Layer sprite="bg/dealroom" position={[0.05, -1.62, -1.9]} width={2.3} look={{tint: '#b08868', blur: 10}} renderOrder={-900} />
				{/* Judas's face in the shadows behind, half lit by the lamp below */}
				<CharacterRoot position={[-0.1, 0.06, -0.5]} pxPerM={2600} shadow={null} facing={1}>
					<PoseWithBlink
						sprite="kiss/judas"
						t={t}
						blinkSeed={null}
						shut={0}
						anchor={[722, 400]}
						look={{tint: '#8a5a44', grad: {dir: [0, -1], color: '#ffb070', amount: 0.55, soft: 0.25}, blur: 10 * (1 - rack), sil: 0.25}}
						renderOrder={-400}
					/>
				</CharacterRoot>
				<Pool position={[0.0, 0.0, -0.3]} size={[0.5, 0.25]} color="#000000" intensity={0.5} additive={false} renderOrder={40} />
				<SpinningCoin t={t} blur={6 * rack} />
				<Glow position={[0.0, 0.03, 0.02]} size={0.12} color="#ffffff" intensity={0.3 * pulse(t, B.coinFlat, 0.01, 0.3)} renderOrder={55} />
			</>
		);
	},
	camera: (t) => {
		const rack = seg(t, B.rackJudas - 0.05, B.rackJudas + 0.5, easeInOut);
		return {pos: [0.0, 0.045 + 0.05 * rack, 0.32 + 0.1 * rack], target: [-0.01, 0.02 + 0.07 * rack, 0], fov: 30, drift: 0.4};
	},
	grade: () => ({exposure: 0.98, contrast: 1.14, saturation: 0.9, gain: [1.06, 0.98, 0.88], lift: [0.008, 0.004, 0.0], vignette: 0.75, bloom: 0.45, bloomThreshold: 0.78, grain: 0.03}),
};

