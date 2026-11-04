// Scenes 11-14: baking (burnt, flat, exploded, perfect), the secret plan, walking Grandpa to the square.
import React from 'react';
import {Stage, LOOKS, Look} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character, CharSpec} from '../../characters/Character';
import * as P from '../../characters/poses';
import {ME, GP, townsperson} from '../cast';
import {QuietStreet, SunsetSky, NightSky, quietHouseDoor} from '../world/Town';
import {Kitchen} from '../world/Rooms';
import {Bowl, Spoon, Egg, FlourBag, OldBook, Oven, OVEN, Table, KitchenChair} from '../props/Things';
import {BurntCake, FlatCake, ExplodingCake, FlourCloud, Plate} from '../props/Cake';
import {WalkingStick} from '../../props/HandProps';
import {Sparkles, GlowPoints} from '../../props/Effects';
import {plastic, rbox, cyl} from '../../lib/materials';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, amp, speaking, wf} from '../timing';
import {V3, clamp, lerp, easeInOut, easeOut, easeOutBack} from '../../lib/anim';
import {hash} from '../../lib/random';
import {SUNSET, KITCHEN_EVE} from './s01_05';

const KITCHEN_NIGHT: Look = {...LOOKS.interiorNight, hemiSky: '#8a8ab0', hemiGround: '#3a2a22', hemi: 0.55, ambient: 0.16, sun: 0.35, env: 0.25};
const NIGHT: Look = {...LOOKS.night, hemi: 0.7, ambient: 0.16, sun: 0.75, fogNear: 30, fogFar: 150};

export const OVEN_POS: V3 = [6.0, 0, -6 + OVEN.d / 2];
const TABLE_POS: V3 = [-1, 0, 2.0];
const TABLE_TOP = 2.3;
const ON_TABLE = (x: number, z: number): V3 => [TABLE_POS[0] + x, TABLE_TOP, TABLE_POS[2] + z];

/** flour-dusted me */
const FLOURY: CharSpec = {...ME, name: 'meFloury', hairColor: '#cdbba8', top: '#e8b2ad', pants: '#a9b8de', skin: '#fde9d8', shoes: '#ffffff'};

const KitchenSet: React.FC<{night?: boolean; mess?: number; oven?: {open: number; glow: number; children?: React.ReactNode}; things?: boolean}> = ({night, mess = 0, oven, things = true}) => (
	<>
		<Kitchen night={night} mess={mess} />
		<group position={OVEN_POS}>
			<Oven open={oven?.open ?? 0} glow={oven?.glow ?? 0.3}>
				{oven?.children}
			</Oven>
		</group>
		<group position={TABLE_POS}>
			<Table w={5.2} d={3.2} h={TABLE_TOP} cloth={null} wood="#a8784a" />
		</group>
		{things ? (
			<>
				<group position={ON_TABLE(1.5, 0.2)} rotation={[0, -0.3, 0]}>
					<OldBook open={1} />
				</group>
				<group position={ON_TABLE(-2.0, 0.5)} rotation={[0, 0.4, 0]}>
					<FlourBag />
				</group>
				<Egg position={ON_TABLE(-0.9, -0.9)} />
				<Egg position={ON_TABLE(-0.55, -1.05)} rot={0.4} />
				<Egg position={ON_TABLE(-1.3, -1.1)} rot={-0.3} />
			</>
		) : null}
	</>
);

// ===================================================================== S11
// "I tried to make it. My first cake was burnt. My second cake was flat. My third cake exploded. Flour everywhere."
const S11: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(11, 143) - 4; // My first cake was burnt
	const cC = W(11, 148) - 4; // My second cake was flat
	const cD = W(11, 153) - 4; // My third cake exploded
	const cE = W(11, 157) - 4; // Flour everywhere
	const shot = shotIndex(f, [cB, cC, cD, cE]);
	const t = f / 30;
	const me: V3 = [TABLE_POS[0], 0, TABLE_POS[2] - 2.6];
	if (shot === 0) {
		// stirring, determined, the recipe book open next to me
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={KITCHEN_EVE} sky={false} fog={false} focus={[-1, 2, 1]} shadowSize={9}>
				<KitchenSet />
				<group position={ON_TABLE(0, -0.2)}>
					<Bowl stir={t * 6} />
				</group>
				<Character spec={ME} position={me} rotation={0} pose={P.withPose(P.stir(t), {armL: [-0.75, 0, -0.1]})} expr="determined" look={[0, 0.8]}
					holdR={
						<group position={[0, -0.25, 0.0]} rotation={[0.2, 0, 0]}>
							<Spoon />
						</group>
					}
				/>
				<CameraRig pos={[lerp(2.4, 1.6, k), lerp(4.8, 4.5, k), lerp(8.6, 7.4, k)]} target={[-1, 3.0, 0.8]} fov={36} sway={0.5} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		const wave = Math.sin(t * 9) * 0.35;
		return (
			<Stage look={KITCHEN_EVE} sky={false} fog={false} focus={[-1, 2, 1]} shadowSize={9}>
				<KitchenSet things={false} />
				<group position={ON_TABLE(0, 0.2)}>
					<Plate r={1.7} />
					<group position={[0, 0.08, 0]}>
						<BurntCake frame={f} />
					</group>
				</group>
				<Character spec={ME} position={me} rotation={0} pose={P.withPose(P.idle(t, 2), {lean: -0.06, armR: [-2.2 + wave, 0, -0.3], head: [0.12, Math.sin(t * 5) * 0.08, 0]})} expr="sad" look={[0, 0.8]} />
				<CameraRig pos={[lerp(1.6, 1.0, k), lerp(4.9, 4.7, k), lerp(9.8, 8.8, k)]} target={[-1, 3.2, 1.2]} fov={36} sway={0.4} />
			</Stage>
		);
	}
	if (shot === 2) {
		const fs = f - cC;
		const k = easeInOut(clamp(fs / (cD - cC)));
		const poke = Math.max(0, Math.sin(fs * 0.35)) * 0.25;
		return (
			<Stage look={KITCHEN_EVE} sky={false} fog={false} focus={[-1, 2, 1]} shadowSize={9}>
				<KitchenSet things={false} />
				<group position={ON_TABLE(0, 0.2)}>
					<Plate r={1.7} />
					<group position={[0, 0.08, 0]}>
						<FlatCake />
					</group>
				</group>
				<Character spec={ME} position={me} rotation={0} pose={P.withPose(P.idle(t, 2), {lean: 0.12, armR: [-1.15 + poke, 0, 0.32], head: [0.35, 0, 0.12]})} expr="confused" look={[0, 1]}
					holdR={
						<group position={[0, -0.2, 0]} rotation={[0.3, 0, 0]}>
							<Spoon />
						</group>
					}
				/>
				<CameraRig pos={[lerp(2.6, 2.0, k), lerp(7.6, 7.2, k), lerp(7.6, 6.8, k)]} target={[-1, 2.9, 1.0]} fov={38} sway={0.4} />
			</Stage>
		);
	}
	if (shot === 3) {
		const fs = f - cD;
		const fBoom = W(11, 156) + 2 - cD; // "exploded"
		const rise = easeInOut(clamp(fs / fBoom));
		const burst = clamp((fs - fBoom) / 24);
		const k = easeInOut(clamp(fs / (cE - cD)));
		const shocked = fs > fBoom - 18;
		return (
			<Stage look={KITCHEN_EVE} sky={false} fog={false} focus={[-1, 2, 1]} shadowSize={9}>
				<KitchenSet things={false} mess={burst} />
				<group position={ON_TABLE(0, 0.2)}>
					<Plate r={1.7} />
					<group position={[0, 0.08, 0]}>
						<ExplodingCake rise={rise} burst={burst} />
					</group>
				</group>
				<FlourCloud k={burst} position={ON_TABLE(0, 0.2)} size={7} count={110} />
				<Character spec={burst > 0.15 ? FLOURY : ME} position={me} rotation={0} pose={shocked ? P.withPose(P.idle(t, 2), {lean: -0.18, armL: [-1.4, 0, 0.8], armR: [-1.4, 0, -0.8], head: [-0.2, 0, 0]}) : P.idle(t, 2)} expr={shocked ? 'shocked' : 'worried'} look={[0, 0.6]} />
				<CameraRig pos={[lerp(4.0, 3.4, k), lerp(5.2, 5.0, k), lerp(11.0, 10.0, k)]} target={[-1, 3.4, 0.9]} fov={40} sway={0.4} shake={burst > 0 && burst < 0.5 ? 0.6 * (1 - burst * 2) : 0} />
			</Stage>
		);
	}
	// night: covered in flour, tired, flour still floating in the lamp light
	const fs = f - cE;
	const k = easeInOut(clamp(fs / 67));
	const seat: V3 = [TABLE_POS[0] + 0.2, 0, TABLE_POS[2] - 2.3];
	return (
		<Stage look={KITCHEN_NIGHT} sky={false} fog={false} focus={[-1, 2, 1]} shadowSize={9}>
			<KitchenSet night mess={1} things={false} />
			<group position={seat} scale={0.72}>
				<KitchenChair />
			</group>
			<Character spec={FLOURY} position={[seat[0], 0, seat[2] + 0.15]} rotation={0} pose={P.withPose(P.sit(t, 4, 0), {lean: 0.22, head: [0.15, 0, 0.32], armL: [-1.45, 0, -0.35], armR: [-2.0, 0, 0.45]})} expr="tired" look={[0, 0.5]} />
			<GlowPoints
				count={120}
				additive={false}
				color="#fffaf0"
				fn={(i) => {
					const tt = f / 30;
					const x = TABLE_POS[0] + (hash(i, 1) - 0.5) * 12 + Math.sin(tt * 0.4 + i) * 0.4;
					const y = ((hash(i, 2) * 8 - tt * 0.18 * (0.4 + hash(i, 3))) % 8 + 8) % 8 + 0.3;
					const z = TABLE_POS[2] + (hash(i, 4) - 0.5) * 9;
					return [x, y, z, 0.12 + hash(i, 5) * 0.12, 0.55];
				}}
			/>
			<CameraRig pos={[lerp(2.4, 1.8, k), lerp(4.2, 4.0, k), lerp(7.8, 6.8, k)]} target={[seat[0], 3.0, seat[2] + 0.6]} fov={36} sway={0.4} />
		</Stage>
	);
};

// ===================================================================== S12
// "But on the 10th try, it was perfect." – from inside the oven: the door opens, golden light on my happy face
const S12: React.FC<SceneProps> = ({f, g, dur}) => {
	const t = f / 30;
	const open = easeInOut(clamp((f - 10) / 26));
	const kneel = P.withPose(P.idle(t, 3), {y: -1.05, lean: 0.12, legL: [1.25, 0, 0.05], legR: [1.25, 0, -0.05], head: [-0.05, 0, 0]});
	const cheerK = clamp((f - 52) / 10);
	const pose = cheerK > 0 ? P.mixPose(kneel, P.withPose(kneel, {armL: [-0.3, 0, 2.3], armR: [-0.3, 0, -2.3]}), easeOutBack(cheerK)) : P.withPose(kneel, {armL: [-0.6, 0, 0.3], armR: [-0.6, 0, -0.3]});
	const k = easeInOut(clamp(f / dur));
	const ox = OVEN_POS[0];
	const oz = OVEN_POS[2];
	return (
		<Stage look={KITCHEN_NIGHT} sky={false} fog={false} focus={[ox, 1, oz + 2]} shadowSize={8}>
			<KitchenSet night mess={0.4} things={false} oven={{open, glow: 1, children: (
				<group>
					<mesh geometry={cyl(1.0, 1.0, 0.26, 32, true)} material={plastic('#a8aab2', {metal: 0.8, rough: 0.3})} position={[0, 0.13, 0.05]} />
					<mesh geometry={cyl(0.94, 0.96, 0.78, 32)} material={plastic('#d99a45', {rough: 0.7})} position={[0, 0.39, 0.05]} castShadow />
					<mesh geometry={cyl(0.9, 0.94, 0.06, 32)} material={plastic('#ecbc6a', {rough: 0.6})} position={[0, 0.79, 0.05]} />
				</group>
			)}} />
			<Character spec={ME} position={[ox + 1.35, 0, oz + OVEN.d / 2 + 1.25]} rotation={lerp(-2.6, -1.25, easeInOut(clamp((f - 36) / 14)))} pose={pose} expr={f > 30 ? 'excited' : 'curious'} look={f > 40 ? [0, 0] : [0.5, 0.6]} />
			<pointLight position={[ox, 1.7, oz + OVEN.d / 2 + 0.6]} color="#ffb85a" intensity={26 * open} distance={7} decay={1.5} />
			{open > 0.5 ? <Sparkles frame={f} count={24} radius={1.4} height={2.0} position={[ox, 1.2, oz + 0.2]} color="#ffd98a" size={0.45} /> : null}
			<CameraRig pos={[ox + lerp(-5.4, -4.6, k), lerp(3.7, 3.5, k), oz + OVEN.d / 2 + lerp(6.6, 5.6, k)]} target={[ox + 0.75, lerp(1.9, 2.1, k), oz + OVEN.d / 2 + 0.2]} fov={40} sway={0.35} />
		</Stage>
	);
};

// ===================================================================== S13
// "Then I went to every house in town, and I whispered a secret plan."
const S13: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(13, 175) - 4; // "and I whispered a secret plan"
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	if (shot === 0) {
		const d = quietHouseDoor(5);
		const k = easeInOut(clamp(f / cB));
		const open = easeInOut(clamp((f - 40) / 14));
		return (
			<Stage look={SUNSET} focus={[d.p[0], 0, d.p[2]]} shadowSize={12}>
				<SunsetSky sunDir={SUNSET.sunDir} />
				<QuietStreet time="sunset" zFrom={40} zTo={-55} doorOpen={(i) => (i === 5 ? open : 0)} />
				<Character spec={ME} position={[d.p[0] + 0.2, 0.5, d.p[2] + 0.35]} rotation={Math.PI / 2} pose={P.knock(t, 0.15)} expr="determined" look={[0, -0.3]} />
				<CameraRig pos={[lerp(5.0, 6.0, k), lerp(4.3, 4.1, k), lerp(d.p[2] - 7.4, d.p[2] - 6.4, k)]} target={[d.p[0] + 1.0, 3.4, d.p[2] + 0.2]} fov={38} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cB;
	const k = easeInOut(clamp(fs / 66));
	const d = quietHouseDoor(6);
	const fPlan = W(13, 179) - cB; // "secret plan"
	const lit = fs > fPlan + 4;
	return (
		<Stage look={SUNSET} focus={[d.p[0], 0, d.p[2]]} shadowSize={10}>
			<SunsetSky sunDir={SUNSET.sunDir} />
			<QuietStreet time="sunset" zFrom={40} zTo={-55} doorOpen={(i) => (i === 6 ? 1 : 0)} trees={false} />
			<Character spec={townsperson(61)} position={[d.p[0] - 1.0, 0.5, d.p[2] + 0.2]} rotation={Math.PI / 2 - 0.5} pose={P.withPose(P.idle(t, 6), {lean: 0.22, head: [0.22, -0.25, 0.12]})} expr={lit ? 'bigSmile' : 'curious'} look={[0.5, 0.4]} />
			<Character spec={ME} position={[d.p[0] + 1.45, 0.15, d.p[2] + 0.45]} rotation={-Math.PI / 2 + 0.35} pose={P.withPose(P.whisperPose(t), {y: 0.15})} expr="whisper" talk={speaking(g, 176, 180) ? amp(g) * 0.7 : 0} />
			{lit ? <Sparkles frame={f} count={14} radius={0.9} height={1.2} position={[d.p[0] - 0.8, 4.4, d.p[2] + 0.2]} color="#ffe9a8" size={0.4} /> : null}
			<CameraRig pos={[lerp(-9.0, -9.6, k), lerp(4.5, 4.4, k), lerp(d.p[2] + 7.0, d.p[2] + 6.2, k)]} target={[d.p[0] + 0.1, 4.0, d.p[2] + 0.2]} fov={34} sway={0.4} />
		</Stage>
	);
};

// ===================================================================== S14
// "That night, I covered grandpa's eyes and walked him to the town square. Ready?"
/** my two hands over Grandpa's eyes (in his head space) */
export const HandsOverEyes: React.FC = () => {
	const m = plastic(ME.skin, {rough: 0.45});
	return (
		<group>
			{[-1, 1].map((sd) => (
				<group key={sd}>
					<mesh geometry={rbox(0.5, 0.44, 0.24, 0.08)} material={m} position={[sd * 0.25, 0.06, 0.78]} rotation={[0, sd * 0.25, sd * -0.35]} castShadow />
					<mesh geometry={rbox(0.36, 0.44, 0.7, 0.08)} material={plastic(ME.top, {rough: 0.5})} position={[sd * 0.66, 0.05, 0.5]} rotation={[0, sd * 0.55, 0]} castShadow />
				</group>
			))}
		</group>
	);
};

/** Grandpa walking slowly with my hands over his eyes and me right behind him */
export const BlindWalk: React.FC<{t: number; gp: V3; talk?: number; walking?: number; hands?: number; meExpr?: any; gpExpr?: any}> = ({t, gp, talk = 0, walking = 1, hands = 1, meExpr = 'bigSmile', gpExpr = 'warm'}) => {
	const gpPose = P.withPose(P.elderWalk(t, walking), {lean: 0.2});
	const meReach = lerp(0.5, 2.8, hands);
	const mePose = hands > 0.01 ? P.coverEyes(t + 0.3, walking, meReach) : P.walk(t + 0.3, 0.5, 0.4 * walking);
	return (
		<>
			<Character spec={GP} position={gp} rotation={Math.PI} pose={gpPose} expr={gpExpr} headExtra={hands > 0.5 ? <HandsOverEyes /> : undefined} holdR={<group position={[0, 0, 0]}><WalkingStick length={2.05} /></group>} holdRUpright />
			<Character spec={ME} position={[gp[0] + 1.25, 0.2 * hands, gp[2] + 0.85]} rotation={Math.PI - 0.25} pose={mePose} expr={meExpr} talk={talk} />
		</>
	);
};

const S14: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(14, 187) - 4; // "and walked him to the town square"
	const shot = shotIndex(f, [cB]);
	const t = f / 30;
	const gz = -24 - t * 0.85;
	const gp: V3 = [0.6, 0, gz];
	const talk = speaking(g, 194, 194) ? amp(g) : 0;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={NIGHT} focus={[0, 0, gz]} shadowSize={14}>
				<NightSky />
				<QuietStreet time="night" zFrom={40} zTo={-100} />
				<BlindWalk t={t} gp={gp} />
				<CameraRig pos={[lerp(-3.4, -2.8, k), lerp(3.0, 3.3, k), gz - lerp(11.5, 10.0, k)]} target={[0.4, 3.6, gz]} fov={38} sway={0.5} />
			</Stage>
		);
	}
	const fs = f - cB;
	const k = easeInOut(clamp(fs / 80));
	return (
		<Stage look={NIGHT} focus={[0, 0, gz]} shadowSize={10}>
			<NightSky />
			<QuietStreet time="night" zFrom={40} zTo={-100} />
			<BlindWalk t={t} gp={gp} talk={talk} meExpr={talk > 0.1 ? 'excited' : 'bigSmile'} gpExpr={g > wf(194) ? 'bigSmile' : 'warm'} />
			<CameraRig pos={[lerp(3.9, 3.4, k), lerp(4.3, 4.2, k), gz - lerp(6.2, 5.2, k)]} target={[1.15, 3.9, gz + 0.4]} fov={36} sway={0.35} />
		</Stage>
	);
};

export const SCENES_11_14: SceneDef[] = [{Comp: S11}, {Comp: S12, post: () => ({bloom: 1.0, threshold: 0.75})}, {Comp: S13}, {Comp: S14}];
