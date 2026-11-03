// Scenes 7-11: school, "How To Hold It", the legendary teacher, Weird Bucket Boy.
import React from 'react';
import {Stage, LOOKS} from '../lib/Stage';
import {CameraRig} from '../lib/CameraRig';
import {Character, CharSpec} from '../characters/Character';
import {KID, TEACHER, makePerson} from '../characters/presets';
import * as P from '../characters/poses';
import {Classroom, seatPos, DESK_COLS, DESK_ROWS} from '../world/School';
import {Bucket} from '../props/Bucket';
import {ComicText, GlowPoints} from '../props/Effects';
import {SceneDef, SceneProps, shotIndex, W, amp} from './kit';
import {easeInOut, easeOut, clamp, lerp} from '../lib/anim';
import {hash} from '../lib/random';
import {registerWhip, wf, LEAD} from '../timing';

const LOOK = {...LOOKS.interiorDay, sunDir: [-0.7, 0.75, 0.25] as [number, number, number], sun: 2.2, hemi: 0.75, ambient: 0.18};

// 14 classmates + me in the middle (col 2, row 1)
type Seat = {col: number; row: number; spec: CharSpec; me: boolean};
const SEATS: Seat[] = [];
let n = 0;
for (let r = 0; r < DESK_ROWS.length; r++)
	for (let c = 0; c < DESK_COLS.length; c++) {
		const me = c === 2 && r === 1;
		SEATS.push({col: c, row: r, me, spec: me ? KID : makePerson(700 + n++, {kid: true})});
	}

const hipY = (s: CharSpec) => 1.55 - (s.legH ?? 2) * s.scale;
const sitPose = (t: number, seed: number) => P.withPose(P.sit(t, seed, 0), {armL: [-1.3, 0, -0.12], armR: [-1.3, 0, 0.12]});
const clapSit = (t: number, seed: number) => P.withPose(P.sit(t, seed, 0), {armL: P.clap(t, seed).armL, armR: P.clap(t, seed).armR});

type StudentMode = 'sit' | 'clap' | 'happy' | 'laugh';
const Students: React.FC<{t: number; mode: StudentMode; meExpr?: any; mePose?: P.Pose; lookAtMe?: boolean; buckets?: boolean; meTalk?: number}> = ({t, mode, meExpr = 'neutral', mePose, lookAtMe = false, buckets = true, meTalk = 0}) => {
	const me = seatPos(2, 1);
	return (
		<>
			{SEATS.map((s, i) => {
				const [x, , z] = seatPos(s.col, s.row);
				if (s.me) {
					return (
						<group key={i}>
							<Character spec={s.spec} position={[x, hipY(s.spec), z]} rotation={Math.PI} pose={mePose ?? sitPose(t, i)} expr={meExpr} talk={meTalk} />
							{buckets ? <Bucket position={[x + 0.6, 2.7, z - 2.0]} scale={0.55} handle={1.1} /> : null}
						</group>
					);
				}
				let rot = Math.PI;
				let pose = sitPose(t, i);
				let expr: any = hash(i, 3) > 0.5 ? 'happy' : 'bigSmile';
				if (mode === 'clap') pose = clapSit(t, i);
				if (mode === 'laugh' || lookAtMe) {
					rot = Math.atan2(me[0] - x, me[2] - z);
					pose = mode === 'laugh' ? P.withPose(P.sit(t, i, 0), {armR: P.laughPoint(t, i).armR, armL: P.laughPoint(t, i).armL, head: P.laughPoint(t, i).head, lean: -0.08}) : pose;
					expr = mode === 'laugh' ? (hash(i, 4) > 0.5 ? 'laugh' : 'bigSmile') : expr;
				}
				return (
					<group key={i}>
						<Character spec={s.spec} position={[x, hipY(s.spec), z]} rotation={rot} pose={pose} expr={expr} lod={s.row === 2 ? 'low' : 'high'} />
						{buckets ? <Bucket position={[x + 0.6, 2.7, z - 2.0]} scale={0.55} handle={1.1} /> : null}
					</group>
				);
			})}
		</>
	);
};

// ===================================================================== S7
// "At school, we have a class called How To Hold It." classroom, then the chalkboard
const S7: React.FC<SceneProps> = ({f}) => {
	const cut = W(7, 49) - 3; // "How To Hold It"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cut));
		return (
			<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 0]} shadowSize={20}>
				<Classroom />
				<Students t={t} mode="sit" />
				<Character spec={TEACHER} position={[-3.5, 0, -10.6]} rotation={0.2} pose={P.withPose(P.idle(t), {armR: [-1.9, 0, -0.3]})} expr="proud" />
				<CameraRig pos={[lerp(13, 11, k), lerp(10.5, 9.5, k), lerp(17, 15, k)]} target={[-1, 3.5, -5]} fov={52} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeOut(clamp(fs / 40));
	return (
		<Stage look={LOOK} sky={false} fog={false} focus={[0, 4, -12]} shadowSize={12}>
			<Classroom />
			<Character spec={TEACHER} position={[-6.6, 0, -11.2]} rotation={0.5} pose={P.withPose(P.idle(t), {armR: [-2.2, 0, -0.6]})} expr="proud" />
			<CameraRig pos={[lerp(0.9, 0.3, k), 6.6, lerp(5.5, 3.8, k)]} target={[0, 6.4, -13.6]} fov={50} sway={0.5} />
		</Stage>
	);
};

// ===================================================================== S8
// "Our teacher can hold it for three whole days. She's a legend."
const crossedLegs: Partial<P.Pose> = {legL: [0.05, 0, -0.2], legR: [-0.08, 0, 0.22]};
const S8: React.FC<SceneProps> = ({f}) => {
	const cutB = W(8, 62) - 3; // "She's a legend"
	const cutC = W(8, 64) - 6; // "legend"
	const shot = shotIndex(f, [cutB, cutC]);
	const t = f / 30;
	const wobble = Math.sin(t * 9) * 0.02;
	const teacherPose = P.withPose(P.idle(t), {...crossedLegs, tilt: wobble, armL: [0.15, 0, 0.35], armR: [0.15, 0, -0.35]});
	if (shot === 0) {
		const k = easeOut(clamp(f / cutB));
		return (
			<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, -8]} shadowSize={14}>
				<Classroom />
				<Character spec={TEACHER} position={[-0.5, 0, -9.4]} rotation={0.1} pose={teacherPose} expr="proud" face={{sweat: true}} />
				<CameraRig pos={[lerp(2.2, 1.6, k), lerp(1.2, 1.5, k), lerp(-3.2, -4.2, k)]} target={[-0.5, 3.3, -9.4]} fov={54} sway={0.8} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cutB;
		return (
			<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 4]} shadowSize={18}>
				<Classroom />
				<Students t={t} mode="clap" meExpr="neutral" mePose={clapSit(t, 99)} />
				<CameraRig pos={[0.5, 7.6, -10.5]} target={[0, 2.6, 6]} fov={50} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cutC;
	const sparkle = Math.max(Math.sin(clamp(fs / 10) * Math.PI), Math.sin(clamp((fs - 9) / 10) * Math.PI) * 0.8);
	const headY = 4.0 * 0.98 + 0.64 * 0.98;
	return (
		<Stage look={LOOK} sky={false} fog={false} focus={[0, 4, -9]} shadowSize={8}>
			<Classroom />
			<Character spec={TEACHER} position={[-0.5, 0, -9.4]} rotation={0.18} pose={P.withPose(teacherPose, {head: [-0.1, 0.12, 0.05]})} expr="smug" face={{sweat: true}} />
			<GlowPoints count={1} tex="star" color="#ffffff" size={1} fn={() => [-0.5 + 0.38, headY + 0.2, -9.4 + 0.95, 2.2 * sparkle + 0.01, sparkle]} />
			<CameraRig pos={[0.4, headY + 0.1, -5.4]} target={[-0.45, headY, -9.4]} fov={42} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== S9
// "Everyone thinks buckets are normal. Everyone except me."
const S9: React.FC<SceneProps> = ({f}) => {
	const cut = W(9, 70) - 3; // "Everyone except me"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	if (shot === 0) {
		const k = f / cut;
		return (
			<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 0]} shadowSize={18}>
				<Classroom />
				<Students t={t} mode="happy" meExpr="neutral" />
				<CameraRig pos={[lerp(-11, -3, k), 3.6, -4.6]} target={[lerp(-8, 0, k), 2.7, 2]} fov={48} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeOut(clamp(fs / 50));
	const me = seatPos(2, 1);
	return (
		<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 5]} shadowSize={14}>
			<Classroom />
			<Students t={t} mode="happy" meExpr="frown" />
			<CameraRig pos={[lerp(2.2, 0.9, k), lerp(4.6, 4.0, k), lerp(-3.4, 0.4, k)]} target={[me[0], 3.4, me[2]]} fov={44} sway={0.8} />
		</Stage>
	);
};

// ===================================================================== S10
// "I keep asking, Isn't there something better?" I raise my hand
const S10: React.FC<SceneProps> = ({f, g}) => {
	const cut = W(10, 76) - 3; // "Isn't there something better"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	const me = seatPos(2, 1);
	const hand = P.withPose(P.sit(t, 1, 0), {armR: [-2.95, 0, 0.1 + Math.sin(t * 9) * 0.1], armL: [-1.3, 0, -0.12], tilt: 0.08, y: 0.06 + Math.abs(Math.sin(t * 9)) * 0.05});
	if (shot === 0) {
		const k = easeOut(clamp(f / cut));
		return (
			<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 5]} shadowSize={14}>
				<Classroom />
				<Students t={t} mode="sit" meExpr="excited" mePose={hand} />
				<CameraRig pos={[lerp(4.0, 3.5, k), 2.9, lerp(0.0, 0.6, k)]} target={[me[0] + 0.3, 4.5, me[2]]} fov={60} sway={0.8} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeOut(clamp(fs / 40));
	return (
		<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 5]} shadowSize={10}>
			<Classroom />
			<Students t={t} mode="sit" meExpr="worried" mePose={hand} meTalk={amp(g)} />
			<CameraRig pos={[lerp(1.4, 0.8, k), 3.75, lerp(1.6, 2.4, k)]} target={[me[0], 3.55, me[2]]} fov={42} sway={0.7} />
		</Stage>
	);
};

// ===================================================================== S11
// "So the kids call me Weird Bucket Boy." kids point and laugh, I look sad
const S11: React.FC<SceneProps> = ({f}) => {
	const cut = W(11, 85) - 2; // "Weird Bucket Boy"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	const me = seatPos(2, 1);
	if (shot === 0) {
		// kids gather round my desk, pointing and laughing (seen from my seat, looking up)
		const gang = [0, 1, 2, 3].map((i) => makePerson(760 + i, {kid: true}));
		const spots: [number, number][] = [[-2.6, 1.9], [-0.9, 1.2], [0.9, 1.3], [2.6, 2.0]];
		return (
			<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 2]} shadowSize={14}>
				<Classroom />
				<Students t={t} mode="sit" meExpr="sad" />
				{gang.map((s, i) => (
					<Character key={i} spec={s} position={[spots[i][0], 0, spots[i][1]]} rotation={Math.atan2(me[0] - spots[i][0], me[2] - spots[i][1])} pose={P.laughPoint(t, i)} expr={i % 2 ? 'laugh' : 'bigSmile'} />
				))}
				<ComicText text="HA HA!" position={[-2.6, 6.0, 1.0]} scale={1.0} rot={0.15} color="#ffffff" />
				<ComicText text="HA!" position={[2.4, 5.7, 1.2]} scale={0.85} rot={-0.2} color="#ffffff" />
				<CameraRig pos={[0.15, 3.3, 4.45]} target={[0, 4.2, 0.5]} fov={62} sway={1} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeOut(clamp(fs / 50));
	return (
		<Stage look={LOOK} sky={false} fog={false} focus={[0, 0, 5]} shadowSize={10}>
			<Classroom />
			<Students t={t} mode="laugh" meExpr="sad" mePose={P.withPose(P.sit(t, 1, 0), {head: [0.25, 0, 0], lean: 0.12, armL: [-1.2, 0, -0.1], armR: [-1.2, 0, 0.1]})} />
			<CameraRig pos={[0.6, lerp(4.0, 3.8, k), lerp(0.6, 1.4, k)]} target={[me[0], 3.4, me[2]]} fov={46} sway={0.7} />
		</Stage>
	);
};
registerWhip(wf(80) - LEAD, -1); // S10 -> S11

export const SCHOOL_SCENES: SceneDef[] = [
	{Comp: S7, post: () => ({bloom: 0.45, threshold: 0.9})},
	{Comp: S8, post: () => ({bloom: 0.55, threshold: 0.88})},
	{Comp: S9, post: () => ({bloom: 0.45, threshold: 0.9})},
	{Comp: S10, post: () => ({bloom: 0.45, threshold: 0.9})},
	{Comp: S11, post: () => ({bloom: 0.45, threshold: 0.9, vignette: 0.45})},
];
