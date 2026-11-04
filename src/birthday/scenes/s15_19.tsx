// Scenes 15-19: the lights, the whole town, 90 candles, the made-up song, six tries, the hug, every year after.
import React from 'react';
import {Stage, LOOKS, Look} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character} from '../../characters/Character';
import {FaceParts} from '../../characters/faceTexture';
import * as P from '../../characters/poses';
import {ME, GP, MOM, townsperson, hatColor} from '../cast';
import {QuietStreet, SunsetSky, NightSky} from '../world/Town';
import {Porch, CHAIR_AT, Kitchen, KITCHEN} from '../world/Rooms';
import {TownSquareNight, CROWD, Guest, GP_SPOT, ME_SPOT, CAKE_AT, CAKE_SCALE} from '../world/Square';
import {PerfectCake, NINETY, CandleState, CakeSlice, Plate} from '../props/Cake';
import {WallCalendar} from '../props/Things';
import {Confetti, Sparkles} from '../../props/Effects';
import {WalkingStick} from '../../props/HandProps';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, amp, speaking, wf} from '../timing';
import {V3, clamp, lerp, lerp3, easeInOut, easeOut, bump} from '../../lib/anim';
import {hash} from '../../lib/random';
import {SUNSET_FRONT, KITCHEN_EVE} from './s01_05';
import {BlindWalk, HandsOverEyes} from './s11_14';

const NIGHT_SQ: Look = {...LOOKS.night, hemi: 0.6, ambient: 0.14, sun: 0.6, fogNear: 40, fogFar: 160, exposure: 1.05};
const t30 = (f: number) => f / 30;

// ------------------------------------------------------------------ candle schedule (global frames)
/** the six tries */
export const TRIES = [wf(252), wf(252) + 28, wf(252) + 51, wf(252) + 71, wf(252) + 89, wf(262) + 2];
const COUNTS = [30, 22, 16, 12, 9, 1];
/** the last candle: back of the top ring (farthest from Grandpa) */
const LAST = (() => {
	let best = 0;
	for (let i = 0; i < 25; i++) if (NINETY[i][2] < NINETY[best][2]) best = i;
	return best;
})();
const OUT_AT: number[] = (() => {
	const order = NINETY.map((p, i) => ({i, key: p[2] + (hash(i, 77) - 0.5) * 0.9})).filter((o) => o.i !== LAST);
	order.sort((a, b) => b.key - a.key);
	const out = new Array(NINETY.length).fill(Infinity);
	let k = 0;
	COUNTS.forEach((c, ti) => {
		if (ti === 5) return;
		for (let j = 0; j < c && k < order.length; j++, k++) {
			const o = order[k];
			out[o.i] = TRIES[ti] + Math.round((1.4 - NINETY[o.i][2]) * 3);
		}
	});
	out[LAST] = TRIES[5];
	return out;
})();
/** how hard Grandpa is blowing at global frame g (0..1) */
const blowAt = (g: number) => Math.max(0, ...TRIES.map((T) => (g >= T - 4 && g <= T + 12 ? Math.sin(((g - T + 4) / 16) * Math.PI) : 0)));
/** cheeks: puffed just before and during each blow */
const puffAt = (g: number) => Math.max(0, ...TRIES.map((T) => (g >= T - 12 && g <= T + 8 ? Math.sin(((g - T + 12) / 20) * Math.PI) : 0)));
const candleState = (g: number): CandleState => ({outAt: OUT_AT, wind: [0, -0.7 * blowAt(g)]});

const Cake: React.FC<{g: number}> = ({g}) => (
	<group position={CAKE_AT} scale={CAKE_SCALE}>
		<PerfectCake frame={g} stand={false} candleState={candleState(g)} />
	</group>
);
/** world position of candle i */
const candleWorld = (i: number): V3 => [CAKE_AT[0] + NINETY[i][0] * CAKE_SCALE, CAKE_AT[1] + NINETY[i][1] * CAKE_SCALE, CAKE_AT[2] + NINETY[i][2] * CAKE_SCALE];

// ------------------------------------------------------------------ the crowd
type CrowdMood = 'dark' | 'wow' | 'puzzled' | 'sing' | 'wait' | 'cheer';
const Crowd: React.FC<{g: number; mood: CrowdMood; hats?: boolean; lowAll?: boolean; skipMom?: boolean}> = ({g, mood, hats = true, lowAll = false, skipMom = false}) => {
	const t = t30(g);
	return (
		<>
			{CROWD.map((c: Guest, i) => {
				if (skipMom && c.spec.name === 'mom') return null;
				let pose = P.idle(t, c.seed);
				let expr: any = 'happy';
				let look: [number, number] | undefined;
				let talk = 0;
				let yaw = c.yaw;
				const ph = hash(c.seed, 3);
				if (mood === 'dark') expr = 'happy';
				if (mood === 'wow') {
					expr = ph > 0.5 ? 'bigSmile' : 'excited';
					if (ph > 0.6) pose = P.raiseHand(t + ph, 0.6);
				}
				if (mood === 'puzzled') {
					const side = ph > 0.5 ? 1 : -1;
					const sh = P.shrug(clamp((t - t30(wf(216)) - ph * 0.4) * 1.0));
					const nod = g > wf(221);
					pose = nod ? P.withPose(P.idle(t, c.seed), {head: [0.12 + Math.sin(t * 6 + i) * 0.08, side * 0.5, 0]}) : P.withPose(sh, {head: [0, side * 0.55, sh.head[2]]});
					expr = nod ? 'bigSmile' : 'confused';
					look = [side, 0];
				}
				if (mood === 'sing') {
					pose = P.clap(t + ph, c.seed);
					expr = 'happy';
					talk = amp(g) * (0.7 + ph * 0.3);
				}
				if (mood === 'wait') {
					pose = P.withPose(P.idle(t * 0.6, c.seed), {armL: [-0.9, 0, -0.35], armR: [-0.9, 0, 0.35]});
					expr = ph > 0.5 ? 'warm' : 'happy';
				}
				if (mood === 'cheer') {
					pose = ph > 0.4 ? P.cheer(t + ph, c.seed) : P.jumpJoy(t + ph, c.seed);
					expr = ph > 0.5 ? 'excited' : 'laugh';
				}
				return (
					<Character key={i} spec={c.spec} position={c.pos} rotation={yaw} pose={pose} expr={expr} look={look} talk={talk} lod={lowAll || c.low ? 'low' : 'high'} partyHat={hats ? c.hat : null} partyHatTilt={(ph - 0.5) * 0.5} frameOffset={c.seed * 7} />
				);
			})}
		</>
	);
};

const GpStand: React.FC<{g: number; expr?: any; face?: Partial<FaceParts>; pose?: P.Pose; talk?: number; hands?: boolean; hat?: boolean; puff?: number; look?: [number, number]; pos?: V3; yaw?: number}> = ({g, expr = 'warm', face, pose, talk = 0, hands = false, hat = false, puff, look, pos = GP_SPOT, yaw = Math.PI}) => (
	<Character
		spec={GP}
		position={pos}
		rotation={yaw}
		pose={pose ?? P.elderIdle(t30(g), 1)}
		expr={expr}
		face={face}
		talk={talk}
		puff={puff}
		look={look}
		headExtra={hands ? <HandsOverEyes /> : undefined}
		partyHat={hat ? '#ffc93c' : null}
		holdR={<WalkingStick length={2.05} />}
		holdRUpright
	/>
);

// ===================================================================== S15
// "The lights came on. The whole town was there. And in the middle was a cake with 90 little candles."
const S15: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(15, 204) - 4; // "And in the middle was a cake"
	const shot = shotIndex(f, [cB]);
	const lightsOn = wf(196) - 2; // "lights"
	if (shot === 0) {
		const hands = 1 - easeOut(clamp((f - 1) / 9));
		const k = easeInOut(clamp(f / cB));
		const lit = g >= lightsOn + 8;
		return (
			<Stage look={NIGHT_SQ} focus={[0, 0, -2]} shadowSize={20}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={lightsOn} />
				<Cake g={g} />
				<Crowd g={g} mood={lit ? 'wow' : 'dark'} />
				<Character spec={GP} position={GP_SPOT} rotation={Math.PI} pose={P.withPose(P.elderIdle(t30(g), 1), {head: [lit ? -0.12 : 0.05, 0, 0]})} expr="surprised" headExtra={hands > 0.5 ? <HandsOverEyes /> : undefined} holdR={<WalkingStick length={2.05} />} holdRUpright />
				<Character spec={ME} position={[GP_SPOT[0] + 0.75, 0, GP_SPOT[2] + 1.0]} rotation={Math.PI} pose={hands > 0.02 ? P.coverEyes(t30(g), 0, lerp(0.4, 2.8, hands)) : P.idle(t30(g), 2)} expr="bigSmile" />
				<CameraRig pos={[lerp(2.6, 2.0, k), lerp(10.4, 11.2, k), lerp(19.0, 17.6, k)]} target={[0, lerp(4.4, 4.8, k), -6]} fov={46} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cB;
	const k = easeInOut(clamp(fs / (192 - cB)));
	return (
		<Stage look={NIGHT_SQ} focus={[0, 0, 0]} shadowSize={10}>
			<NightSky />
			<TownSquareNight frame={g} lightsOn={lightsOn} />
			<Cake g={g} />
			<Crowd g={g} mood="wow" />
			<CameraRig pos={[lerp(1.6, 0.7, k), lerp(5.6, 4.9, k), lerp(9.6, 4.6, k)]} target={[0, lerp(3.5, 3.85, k), 0]} fov={lerp(40, 38, k)} sway={0.35} />
		</Stage>
	);
};

// ===================================================================== S16
// "Nobody knew any birthday songs, so we made one up. Happy grandpa day to you. You are 90, and we love you."
const S16: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(16, 225) - 4; // "Happy grandpa day to you"
	const cC = W(16, 230) - 4; // "You are 90, and we love you"
	const shot = shotIndex(f, [cB, cC]);
	const lightsOn = -9999;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={NIGHT_SQ} focus={[-3, 0, -5]} shadowSize={14}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={lightsOn} />
				<Cake g={g} />
				<Crowd g={g} mood="puzzled" skipMom />
				<CameraRig pos={[lerp(-3.2, -3.6, k), lerp(5.0, 4.8, k), lerp(5.5, 4.6, k)]} target={[-4.4, 3.8, -6.2]} fov={36} sway={0.5} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={NIGHT_SQ} focus={[0, 0, -2]} shadowSize={20}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={lightsOn} />
				<Cake g={g} />
				<Crowd g={g} mood="sing" />
				<GpStand g={g} expr="awe" />
				<Character spec={ME} position={ME_SPOT} rotation={Math.PI - 0.3} pose={P.clap(t30(g), 3)} expr="bigSmile" talk={amp(g)} partyHat="#ff6b8a" />
				<CameraRig pos={[lerp(-3.2, -2.0, k), lerp(9.4, 10.6, k), lerp(19.5, 18.0, k)]} target={[0, 4.2, -5]} fov={46} sway={0.5} />
			</Stage>
		);
	}
	// Grandpa's face in the candlelight
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 107));
	const head: V3 = [GP_SPOT[0], 4.35, GP_SPOT[2] - 0.35];
	return (
		<Stage look={NIGHT_SQ} focus={[0, 0, 2]} shadowSize={10}>
			<NightSky />
			<TownSquareNight frame={g} lightsOn={lightsOn} />
			<Cake g={g} />
			<Crowd g={g} mood="sing" />
			<GpStand g={g} face={{eyes: 'sparkle', brows: 'sad', mouth: 'softSmile', blush: 0.95}} look={[0, 0.4]} />
			<Character spec={ME} position={ME_SPOT} rotation={Math.PI - 0.3} pose={P.clap(t30(g), 3)} expr="bigSmile" talk={amp(g)} partyHat="#ff6b8a" />
			<CameraRig pos={[lerp(-2.9, -2.4, k), lerp(4.8, 4.7, k), lerp(-1.2, -0.5, k)]} target={[head[0], head[1] - 0.25, head[2]]} fov={lerp(36, 31, k)} sway={0.3} />
		</Stage>
	);
};

// ===================================================================== S17
// "Grandpa didn't say anything. He just stood there. Then he took a big breath and blew. It took him six tries."
const S17: React.FC<SceneProps> = ({f, g}) => {
	const cA2 = W(17, 241) - 4; // "He just stood there"
	const cB = W(17, 247) - 2; // "took a big breath"
	const cC = W(17, 253) - 8; // "It took him six tries"
	const shot = shotIndex(f, [cA2, cB, cC]);
	const t = t30(g);
	const head: V3 = [GP_SPOT[0], 4.35, GP_SPOT[2] - 0.35];
	const moved: Partial<FaceParts> = {eyes: 'sparkle', brows: 'sad', mouth: 'tiny', blush: 1};
	if (shot === 0) {
		const k = easeInOut(clamp(f / cA2));
		return (
			<Stage look={NIGHT_SQ} focus={[0, 0, 2]} shadowSize={10}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={-9999} />
				<Cake g={g} />
				<Crowd g={g} mood="wait" />
				<GpStand g={g} face={moved} look={[0, 0.5]} />
				<CameraRig pos={[lerp(-1.7, -1.35, k), lerp(4.75, 4.65, k), lerp(-1.6, -1.0, k)]} target={[head[0], head[1] - 0.15, head[2]]} fov={lerp(28, 25, k)} sway={0.25} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cA2;
		const k = easeInOut(clamp(fs / (cB - cA2)));
		return (
			<Stage look={NIGHT_SQ} focus={[0, 0, 1]} shadowSize={14}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={-9999} />
				<Cake g={g} />
				<Crowd g={g} mood="wait" />
				<GpStand g={g} face={moved} look={[0, 0.5]} />
				<Character spec={ME} position={ME_SPOT} rotation={Math.PI - 0.5} pose={P.idle(t, 3)} expr="warm" look={[1, -1]} partyHat="#ff6b8a" />
				<CameraRig pos={[lerp(-0.3, 0.1, k), lerp(6.2, 6.0, k), lerp(-2.9, -2.6, k)]} target={[0.3, 3.9, 3.9]} fov={40} sway={0.4} />
			</Stage>
		);
	}
	if (shot === 2) {
		// profile: big breath, cheeks puff, blow
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		const breathK = easeInOut(clamp((g - (wf(247) - 2)) / 30)) * (1 - clamp((g - (TRIES[0] - 8)) / 6));
		const blow = blowAt(g);
		const puff = puffAt(g);
		let pose = P.breathIn(breathK, P.elderIdle(t, 1));
		pose = P.blowCandles(Math.max(blow, puff * 0.6), pose);
		const expr = puff > 0.1 || blow > 0.1 ? 'blowing' : breathK > 0.2 ? 'breath' : 'warm';
		return (
			<Stage look={NIGHT_SQ} focus={[0, 0, 1.5]} shadowSize={10}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={-9999} />
				<Cake g={g} />
				<Crowd g={g} mood="wait" />
				<GpStand g={g} expr={expr} pose={pose} puff={Math.max(puff, blow * 0.8)} />
				<CameraRig pos={[lerp(-3.4, -3.1, k), lerp(3.75, 3.6, k), lerp(0.4, 0.5, k)]} target={[lerp(0.45, 0.25, k), lerp(4.15, 3.85, k), lerp(3.3, 2.55, k)]} fov={42} sway={0.3} />
			</Stage>
		);
	}
	// six tries: candles go out in waves
	const fs = f - cC;
	const k = easeInOut(clamp(fs / (259 - cC)));
	const blow = blowAt(g);
	const puff = puffAt(g);
	const pose = P.blowCandles(Math.max(blow, puff * 0.6), P.elderIdle(t, 1));
	return (
		<Stage look={NIGHT_SQ} focus={[0, 0, 1]} shadowSize={8}>
			<NightSky />
			<TownSquareNight frame={g} lightsOn={-9999} />
			<Cake g={g} />
			<Crowd g={g} mood="wait" />
			<GpStand g={g} expr={puff > 0.1 || blow > 0.1 ? 'blowing' : 'determined'} pose={pose} puff={Math.max(puff, blow * 0.8)} />
			<CameraRig pos={[lerp(-1.6, -1.3, k), lerp(6.4, 6.0, k), lerp(-3.4, -2.8, k)]} target={[0.2, 3.9, 1.6]} fov={40} sway={0.3} />
		</Stage>
	);
};

// ===================================================================== S18
// "When the last candle went out, grandpa hugged me really tight. And he whispered, I waited 90 years for this."
const HUG_GP: V3 = [0.3, 0, 3.7];
const HUG_ME: V3 = [-0.6, 0, 4.8];
/** Grandpa down on one knee */
const kneel = (t: number): P.Pose => P.withPose(P.idle(t, 1), {y: -1.0, lean: 0.05, legL: [1.2, 0, 0.06], legR: [1.2, 0, -0.06]});
const S18: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(18, 264) - 4; // "grandpa hugged me"
	const cC = W(18, 269) - 4; // "And he whispered"
	const shot = shotIndex(f, [cB, cC]);
	const t = t30(g);
	const cheerAt = TRIES[5] + 5;
	const cheering = g >= cheerAt;
	const confetti = <Confetti frame={g} start={cheerAt} count={320} area={[24, 11, 18]} position={[0, 1.5, 0]} seed={4} />;
	if (shot === 0) {
		const c = candleWorld(LAST);
		const k = easeInOut(clamp(f / cB));
		const blow = blowAt(g);
		const puff = puffAt(g);
		const pose = P.blowCandles(Math.max(blow, puff * 0.6), P.elderIdle(t, 1));
		return (
			<Stage look={NIGHT_SQ} focus={[0, 0, 1]} shadowSize={8}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={-9999} />
				<Cake g={g} />
				<Crowd g={g} mood={cheering ? 'cheer' : 'wait'} />
				<GpStand g={g} expr={cheering ? 'bigSmile' : puff > 0.1 || blow > 0.1 ? 'blowing' : 'determined'} pose={pose} puff={Math.max(puff, blow * 0.8)} />
				{confetti}
				<CameraRig pos={[c[0] + lerp(0.16, 0.12, k), c[1] + lerp(0.44, 0.42, k), c[2] - lerp(0.95, 0.8, k)]} target={[c[0] + 0.05, c[1] + 0.36, c[2] + 1.0]} fov={38} sway={0.15} />
			</Stage>
		);
	}
	const hugK = easeInOut(clamp((f - cB) / 12));
	const sway = Math.sin(t * 1.4) * 0.03;
	const gpPose = P.withPose(kneel(t), {tilt: sway, armL: [-1.45, 0, lerp(0.1, -0.62, hugK)], armR: [-1.45, 0, lerp(-0.1, 0.62, hugK)], head: [0.08, -0.32, -0.12]});
	const mePose = P.withPose(P.idle(t, 2), {tilt: -sway, lean: 0.06, armL: [-1.5, 0, lerp(0.1, -0.58, hugK)], armR: [-1.5, 0, lerp(-0.1, 0.58, hugK)], head: [-0.05, 0.32, 0.12]});
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={NIGHT_SQ} focus={[-0.5, 0, 4]} shadowSize={10}>
				<NightSky />
				<TownSquareNight frame={g} lightsOn={-9999} />
				<Cake g={g} />
				<Crowd g={g} mood="cheer" skipMom />
				<GpStand g={g} pos={HUG_GP} yaw={0} pose={gpPose} expr="blissful" />
				<Character spec={ME} position={HUG_ME} rotation={Math.PI} pose={mePose} expr="blissful" partyHat="#ff6b8a" />
				<Character spec={MOM} position={[-3.9, 0, 2.2]} rotation={0.9} pose={P.clap(t, 4)} expr="happyCry" partyHat="#b38cff" />
				{confetti}
				<CameraRig pos={[lerp(2.6, 2.0, k), lerp(5.2, 5.0, k), lerp(12.6, 11.0, k)]} target={[0.0, 3.2, 4.2]} fov={34} sway={0.4} />
			</Stage>
		);
	}
	// happy tears, the whisper
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 118));
	const whisper = speaking(g, 272, 277) ? amp(g) * 0.55 : 0;
	return (
		<Stage look={NIGHT_SQ} focus={[-0.5, 0, 4]} shadowSize={8}>
			<NightSky />
			<TownSquareNight frame={g} lightsOn={-9999} />
			<Cake g={g} />
			<Crowd g={g} mood="cheer" lowAll skipMom />
			<GpStand g={g} pos={HUG_GP} yaw={0} pose={P.withPose(gpPose, {head: [0.08 + Math.sin(t * 2.2) * 0.02, 0.18, 0.1]})} expr="happyCry" talk={whisper} />
			<Character spec={ME} position={HUG_ME} rotation={Math.PI} pose={mePose} expr="blissful" partyHat="#ff6b8a" />
			{confetti}
			<CameraRig pos={[lerp(1.5, 1.15, k), lerp(4.35, 4.2, k), lerp(7.9, 7.1, k)]} target={[0.3, 3.5, 4.35]} fov={lerp(34, 27, k)} sway={0.25} />
		</Stage>
	);
};

// ===================================================================== S19
// "Now everyone in town has a birthday. And every year, the first slice goes to grandpa."
const S19: React.FC<SceneProps> = ({f, g}) => {
	const cB = 63; // calendar ("And every year")
	const cC = 110; // the first slice
	const shot = shotIndex(f, [cB, cC]);
	const t = t30(g);
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		const kids = [0, 1, 2].map((i) => (
			<Character key={'k' + i} spec={townsperson(70 + i, {kid: true})} position={[-1.5 + i * 1.6, 0, -10 + i * 0.8 + t30(f) * 3.2]} rotation={0} pose={P.run(t + i * 0.3, 0.8)} expr="excited" partyHat={hatColor(i + 2)} />
		));
		return (
			<Stage look={SUNSET_FRONT} focus={[0, 0, -4]} shadowSize={22}>
				<SunsetSky sunDir={SUNSET_FRONT.sunDir} />
				<QuietStreet time="sunset" zFrom={40} zTo={-100} decorated frame={g} />
				{kids}
				<Character spec={townsperson(81)} position={[7.0, 0.3, -6 + t30(f) * 1.4]} rotation={0} pose={P.carryCake(t)} expr="happy" partyHat={hatColor(5)} />
				<Character spec={townsperson(84, {elder: true})} position={[-7.2, 0.3, 2 - t30(f) * 1.2]} rotation={Math.PI} pose={P.elderWalk(t)} expr="happy" partyHat={hatColor(1)} holdR={<WalkingStick length={2.0} />} holdRUpright />
				<CameraRig pos={[lerp(3.0, 2.2, k), lerp(9.0, 5.6, k), lerp(20, 16, k)]} target={[0, lerp(4.4, 4.0, k), -12]} fov={42} sway={0.5} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const page = 0.15 + clamp(fs / (cC - cB)) * 2.2;
		const calPos: V3 = [KITCHEN.left + 0.12, 6.9, -1.2];
		const k = easeInOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={KITCHEN_EVE} sky={false} fog={false} focus={[-6, 3, -1]} shadowSize={12}>
				<Kitchen />
				<group position={calPos} rotation={[0, Math.PI / 2, 0]}>
					<WallCalendar page={page} year={2030} cakes />
				</group>
				<CameraRig pos={[lerp(-4.0, -3.6, k), 5.7, lerp(-0.7, -0.5, k)]} target={[calPos[0], 5.45, -1.2]} fov={40} sway={0.3} />
			</Stage>
		);
	}
	// sunset on Grandpa's porch: party hat, the first slice
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 82));
	const give = easeInOut(clamp(fs / 24));
	const sitter = (
		<>
			<Character spec={GP} position={[0, 0, -0.35]} pose={P.withPose(P.sitRock(t, 0, 0), {armL: [lerp(-0.75, -1.2, give), 0, -0.1], armR: [lerp(-0.75, -1.2, give), 0, 0.1]})} expr={fs > 30 ? 'happyCry' : 'blissful'} partyHat="#ffc93c" partyHatTilt={-0.25} />
		</>
	);
	const meAt: V3 = [CHAIR_AT[0] - 2.2, CHAIR_AT[1], CHAIR_AT[2] + 2.0];
	return (
		<Stage look={SUNSET_FRONT} focus={[2, 0, 3]} shadowSize={10}>
			<SunsetSky sunDir={SUNSET_FRONT.sunDir} />
			<Porch rock={Math.sin(t * 1.2) * 0.02} sitter={sitter} />
			<Character spec={ME} position={meAt} rotation={2.35} pose={P.withPose(P.holdFront(t, 2), {armL: [-1.2, 0, -0.3], armR: [-1.2, 0, 0.3]})} expr="bigSmile" partyHat="#ff6b8a">
				<group position={[0, 2.95, lerp(2.0, 2.3, give)]}>
					<Plate r={0.75} />
					<group position={[0, 0.07, 0]} scale={0.9}>
						<CakeSlice frame={g} />
					</group>
				</group>
			</Character>
			<Character spec={MOM} position={[CHAIR_AT[0] - 4.6, CHAIR_AT[1], CHAIR_AT[2] - 0.6]} rotation={1.5} pose={P.clap(t, 2)} expr="happy" partyHat="#b38cff" />
			<Character spec={townsperson(91)} position={[CHAIR_AT[0] + 3.4, CHAIR_AT[1], CHAIR_AT[2] - 1.0]} rotation={-1.2} pose={P.clap(t, 5)} expr="bigSmile" partyHat={hatColor(3)} />
			<Character spec={townsperson(93, {kid: true})} position={[CHAIR_AT[0] - 1.0, 0, CHAIR_AT[2] + 5.4]} rotation={3.0} pose={P.jumpJoy(t, 2)} expr="excited" partyHat={hatColor(4)} />
			<Sparkles frame={g} count={20} radius={2.2} height={3} position={[CHAIR_AT[0], 3.4, CHAIR_AT[2]]} color="#ffe6a0" size={0.45} />
			<CameraRig pos={[lerp(CHAIR_AT[0] + 4.6, CHAIR_AT[0] + 3.4, k), lerp(6.0, 5.6, k), lerp(CHAIR_AT[2] + 11.4, CHAIR_AT[2] + 8.8, k)]} target={[CHAIR_AT[0] - 1.0, 3.9, CHAIR_AT[2] + 0.7]} fov={36} sway={0.35} />
		</Stage>
	);
};

export const SCENES_15_19: SceneDef[] = [
	{Comp: S15, post: () => ({bloom: 0.75, threshold: 0.84})},
	{Comp: S16, post: () => ({bloom: 0.75, threshold: 0.84})},
	{Comp: S17, post: () => ({bloom: 0.8, threshold: 0.82, vignette: 0.5})},
	{Comp: S18, post: () => ({bloom: 0.75, threshold: 0.84, vignette: 0.48})},
	{Comp: S19},
];
