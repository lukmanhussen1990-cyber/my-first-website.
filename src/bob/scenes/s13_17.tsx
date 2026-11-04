// Scenes 13-17: the attic at night, the old photo album, the colourful town long ago, why it changed, the wild hat.
import React from 'react';
import * as THREE from 'three';
import {Stage, LOOKS, Look} from '../../lib/Stage';
import {CameraRig} from '../../lib/CameraRig';
import {Character} from '../../characters/Character';
import * as P from '../../characters/poses';
import {BobCrowd, BobInst} from '../BobCrowd';
import {BOB_KID, ME, GRANDPA_BOB} from '../cast';
import {robotWalk, ROBOT_SPEED, gasp} from '../moves';
import {LOOK_GREY, Shop} from '../world';
import {Classroom, seat, DESK_X, DESK_Z, ME_SEAT} from '../rooms';
import {Attic} from '../../birthday/world/Rooms';
import {CardBox, OldTrunk} from '../../birthday/props/Things';
import {WalkingStick} from '../../props/HandProps';
import {Dust, Sparkles} from '../../props/Effects';
import {Album, WildHat} from '../props';
import {RTPortal, useRT, vintageMaterial, FullScreenRT, Cam} from '../portal';
import {OldStreet, OldPersonView, oldPerson, OLD_LOOK, OldPerson} from '../oldtown';
import {StreetSet, walkerGrid, cam} from './common';
import {SceneDef, SceneProps} from '../kit';
import {W, shotIndex, amp, speaking, wf} from '../timing';
import {V3, clamp, lerp, easeInOut, easeOut, keys} from '../../lib/anim';
import {plastic, rbox, sphere, glowMat} from '../../lib/materials';
import {hash} from '../../lib/random';
import {Spot} from '../../birthday/Spot';

// ------------------------------------------------------------------ the attic at night
const ATTIC_NIGHT: Look = {...LOOKS.interiorNight, hemiSky: '#5a6a9a', hemiGround: '#2a2230', hemi: 0.4, ambient: 0.1, sun: 0.0, env: 0.2};
const GP_A: V3 = [-1.6, 0, -2.2];
const ME_A: V3 = [1.3, 0, -1.6];
const ALBUM_AT: V3 = [0, 1.62, -4.4];
const Lantern: React.FC<{on?: boolean}> = ({on = true}) => (
	<group position={[0, -0.55, 0.2]}>
		<mesh geometry={rbox(0.5, 0.7, 0.5, 0.08)} material={plastic('#3a3a40', {metal: 0.5, rough: 0.4})} />
		<mesh geometry={sphere(0.2, 12, 10)} material={glowMat('#ffd18a', 3.5)} />
		{on ? <pointLight color="#ffc77a" intensity={16} distance={14} decay={1.5} /> : null}
	</group>
);
const AtticSet: React.FC<{f: number; children?: React.ReactNode}> = ({f, children}) => (
	<>
		<Attic beamColor="#bcd2ff" windowColor="#cfe0ff" />
		<group position={[0, 0, -4.4]}>
			<CardBox w={2.6} h={1.6} d={2.0} seed={2} />
		</group>
		<group position={[-5.6, 0, -6.4]} rotation={[0, 0.4, 0]}>
			<CardBox w={2.4} h={1.8} d={2} seed={3} />
		</group>
		<group position={[5.0, 0, -7.6]} rotation={[0, -0.4, 0]}>
			<OldTrunk />
		</group>
		<Dust frame={f} count={200} box={[10, 8, 10]} position={[0, 0.2, -5]} color="#dfe8ff" size={0.08} />
		<Spot from={[0, 6.4, -11.6]} to={[0, 0.5, -3.5]} angle={0.42} intensity={70} color="#bcd2ff" />
		{children}
	</>
);
const photoCams: Cam[] = [
	{pos: [0, 5.2, 24], target: [0, 3.6, 0], fov: 36},
	{pos: [8, 6.5, 18], target: [-2, 3.2, -6], fov: 38},
];

/** people of long ago on the old street */
const OLD_PEOPLE: OldPerson[] = [
	oldPerson(1, [-3.0, 0, 6], 0.3),
	oldPerson(2, [-0.8, 0, 7.5], -0.1),
	oldPerson(3, [1.6, 0, 6.4], -0.35),
	oldPerson(4, [3.8, 0, 8.2], -0.5, true),
	oldPerson(5, [-5.6, 0.3, 3], 0.5),
	oldPerson(6, [5.8, 0.3, 2], -0.6),
	oldPerson(7, [-1.8, 0, 2.2], 0.1, true),
	oldPerson(8, [2.2, 0, 1.4], -0.2),
	oldPerson(9, [-6.4, 0.3, -6], 0.4),
	oldPerson(10, [0.4, 0, -4], 0),
	oldPerson(11, [6.5, 0.3, -7], -0.4),
];
export const OldScene: React.FC<{t: number; greyK?: (i: number) => number; townK?: number; laugh?: boolean}> = ({t, greyK, townK = 1, laugh = false}) => (
	<Stage look={OLD_LOOK} focus={[0, 0, 2]} shadowSize={18}>
		<OldStreet k={townK} />
		{OLD_PEOPLE.map((p, i) => {
			const k = greyK ? greyK(i) : 0;
			let pose = P.idle(t, i);
			let expr: any;
			let look: [number, number] | undefined;
			if (laugh && i === 0) {
				pose = P.laughPoint(t, 1);
				expr = 'laugh';
			}
			if (laugh && i === 1) {
				pose = P.withPose(P.idle(t, 2), {head: [0.3, 0, 0]});
				expr = 'sad';
			}
			if (k > 0.3) pose = P.withPose(P.idle(t * 0.6, i), {head: [0.28 * k, 0, 0]});
			return <OldPersonView key={i} p={i === 1 ? {...p, hat: 'tall', hatColor: '#8e44ad'} : p} k={k} pose={pose} expr={expr} t={t} look={look} />;
		})}
	</Stage>
);

// ===================================================================== S13
// "That night, Grandpa Bob took me up to the attic. He opened an old photo album, and I couldn't believe it."
const S13: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(13, 134) - 4; // He opened an old photo album
	const cC = W(13, 140) - 4; // and I couldn't believe it
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const rtL = useRT(800, 600);
	const rtR = useRT(800, 600);
	const matL = React.useMemo(() => vintageMaterial(rtL.texture, {sepia: 0.3}), [rtL]);
	const matR = React.useMemo(() => vintageMaterial(rtR.texture, {sepia: 0.3}), [rtR]);
	const open = shot === 0 ? 0 : easeInOut(clamp((f - cB - 6) / 22));
	const photos = (
		<>
			<RTPortal rt={rtL} cam={photoCams[0]}>
				<OldScene t={1.2} />
			</RTPortal>
			<RTPortal rt={rtR} cam={photoCams[1]}>
				<OldScene t={2.6} />
			</RTPortal>
		</>
	);
	const people = (gpPose: P.Pose, meExpr: any, meLook?: [number, number]) => (
		<>
			<Character spec={GRANDPA_BOB} position={GP_A} rotation={2.51} pose={gpPose} expr="warm" holdL={<Lantern />} holdR={<WalkingStick length={2.0} />} holdRUpright />
			<Character spec={ME} position={ME_A} rotation={-2.71} pose={P.idle(t, 2)} expr={meExpr} look={meLook} />
		</>
	);
	if (shot === 0) {
		// we come up into the dark attic, lantern light, moonlight beam
		const k = easeInOut(clamp(f / cB));
		const walkIn = clamp(f / 50);
		return (
			<Stage look={ATTIC_NIGHT} sky={false} fog={false} focus={[0, 0, -3]} shadowSize={10}>
				<AtticSet f={f}>
					<Character spec={GRANDPA_BOB} position={[GP_A[0], 0, GP_A[2] + (1 - walkIn) * 3]} rotation={walkIn < 1 ? Math.PI + 0.2 : 2.51} pose={walkIn < 1 ? P.elderWalk(t) : P.elderIdle(t)} expr="warm" holdL={<Lantern />} holdR={<WalkingStick length={2.0} />} holdRUpright />
					<Character spec={ME} position={[ME_A[0], 0, ME_A[2] + (1 - walkIn) * 3.6]} rotation={walkIn < 1 ? Math.PI - 0.3 : -2.71} pose={walkIn < 1 ? P.walk(t, 0.7, 0.7) : P.idle(t, 2)} expr="curious" />
				</AtticSet>
				<CameraRig pos={[lerp(2.6, 2.0, k), lerp(6.2, 5.6, k), lerp(8.5, 7.0, k)]} target={[0, 3.0, -3.5]} fov={46} sway={0.4} />
			</Stage>
		);
	}
	if (shot === 1) {
		// the album opens on the box
		const fs = f - cB;
		const k = easeInOut(clamp(fs / (cC - cB)));
		return (
			<Stage look={ATTIC_NIGHT} sky={false} fog={false} focus={[0, 0, -3]} shadowSize={8}>
				{photos}
				<AtticSet f={f}>
					{people(P.withPose(P.elderIdle(t), {armR: [-1.1, 0, 0.3], lean: 0.2}), 'curious', [0, 0.8])}
					<group position={ALBUM_AT}>
						<Album open={open} left={matL} right={matR} />
					</group>
					<pointLight position={[0, 3.4, -2.6]} color="#ffc77a" intensity={8} distance={6} decay={1.5} />
				</AtticSet>
				<CameraRig pos={[lerp(2.4, 1.8, k), lerp(5.6, 5.0, k), lerp(-2.0, -2.6, k)]} target={[ALBUM_AT[0], ALBUM_AT[1] + 0.2, ALBUM_AT[2]]} fov={40} sway={0.3} />
			</Stage>
		);
	}
	// I couldn't believe it: my amazed face
	const fs = f - cC;
	const k = easeInOut(clamp(fs / 55));
	return (
		<Stage look={ATTIC_NIGHT} sky={false} fog={false} focus={[0, 0, -3]} shadowSize={8}>
			{photos}
			<AtticSet f={f}>
				{people(P.elderIdle(t), 'awe', [-0.5, 0.8])}
				<group position={ALBUM_AT}>
					<Album open={1} left={matL} right={matR} />
				</group>
				<pointLight position={[ME_A[0] - 0.6, 4.2, ME_A[2] - 2]} color="#ffd9a0" intensity={7} distance={6} decay={1.5} />
				<Sparkles frame={f} count={16} radius={1.4} height={1.6} position={[ME_A[0], 3.2, ME_A[2]]} color="#ffe8a8" size={0.35} />
			</AtticSet>
			<CameraRig pos={[ME_A[0] + lerp(-0.2, -0.3, k), lerp(3.8, 3.75, k), ME_A[2] + lerp(-3.4, -2.8, k)]} target={[ME_A[0], 3.65, ME_A[2]]} fov={36} sway={0.25} />
		</Stage>
	);
};

// ===================================================================== S14
// "Long ago, everyone in our town looked different. Hats, colors, crazy hair, different names."
const S14: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(14, 153) - 4; // Hats
	const cC = W(14, 154) - 4; // colors
	const cD = W(14, 155) - 4; // crazy hair
	const cE = W(14, 157) - 4; // different names
	const shot = shotIndex(f, [cB, cC, cD, cE]);
	const t = f / 30;
	const rtL = useRT(800, 600);
	const rtFull = useRT(1080, 1920);
	const matL = React.useMemo(() => vintageMaterial(rtL.texture, {sepia: 0.3}), [rtL]);
	if (shot === 0) {
		// push into the photo on the album page
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={ATTIC_NIGHT} sky={false} fog={false} focus={[0, 0, -3]} shadowSize={8}>
				<RTPortal rt={rtL} cam={photoCams[0]}>
					<OldScene t={1.2 + t * 0.2} />
				</RTPortal>
				<AtticSet f={f}>
					<group position={ALBUM_AT}>
						<Album open={1} left={matL} />
					</group>
					<pointLight position={[0, 3.4, -3.2]} color="#ffc77a" intensity={8} distance={6} decay={1.5} />
				</AtticSet>
				<CameraRig pos={[ALBUM_AT[0] - 1.1, ALBUM_AT[1] + lerp(2.6, 1.15, k), ALBUM_AT[2] + lerp(0.9, 0.18, k)]} target={[ALBUM_AT[0] - 1.1, ALBUM_AT[1] + 0.2, ALBUM_AT[2]]} fov={lerp(46, 50, k)} sway={0.2} />
			</Stage>
		);
	}
	// inside the photo: one quick look per word
	const fs = f - [0, cB, cC, cD, cE][shot];
	const k = clamp(fs / 30);
	const views: Cam[] = [
		{pos: [-2.2, 5.6, 11.2], target: [-1.2, 5.2, 6.4], fov: 40}, // hats
		{pos: [2.8, 3.4, 12.5], target: [1.2, 3.0, 6.2], fov: 44}, // colours
		{pos: [3.6, 4.6, 6.0], target: [2.8, 4.2, 1.6], fov: 40}, // crazy hair
		{pos: [-2.0, 6.8, 4.0], target: [-12, 7.6, 2], fov: 46}, // shop names
	];
	const v = views[shot - 1];
	const c: Cam = {pos: [v.pos[0] + k * 0.5, v.pos[1], v.pos[2] - k * 0.6], target: v.target, fov: v.fov};
	return (
		<>
			<RTPortal rt={rtFull} cam={c}>
				<OldScene t={1.2 + t} />
			</RTPortal>
			<FullScreenRT rt={rtFull} sepia={0.2} />
		</>
	);
};

// ===================================================================== S15
// "What happened, I asked."
const S15: React.FC<SceneProps> = ({f, g, dur}) => {
	const t = f / 30;
	const k = easeInOut(clamp(f / dur));
	const talk = speaking(g, 159, 162) ? amp(g) : 0;
	return (
		<Stage look={ATTIC_NIGHT} sky={false} fog={false} focus={[0, 0, -3]} shadowSize={8}>
			<AtticSet f={f}>
				<Character spec={GRANDPA_BOB} position={GP_A} rotation={1.37} pose={P.elderIdle(t)} expr="sad" holdL={<Lantern />} holdR={<WalkingStick length={2.0} />} holdRUpright />
				<Character spec={ME} position={ME_A} rotation={-1.77} pose={P.withPose(P.idle(t, 2), {head: [-0.2, 0, 0]})} expr="worried" talk={talk} look={[0, -0.8]} />
			</AtticSet>
			<CameraRig pos={[lerp(-1.0, -0.6, k), lerp(5.5, 5.3, k), lerp(-2.6, -2.3, k)]} target={[ME_A[0], 3.7, ME_A[2]]} fov={36} sway={0.25} />
		</Stage>
	);
};

// ===================================================================== S16
// "One day, someone laughed at someone for being different. And after that, everyone was scared to stand out."
const S16: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(16, 165) - 4; // someone laughed at someone
	const cC = W(16, 172) - 4; // And after that
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const rtFull = useRT(1080, 1920);
	let c: Cam;
	let greyK: ((i: number) => number) | undefined;
	let townK = 1;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		c = {pos: [lerp(5, 4, k), 9, lerp(26, 23, k)], target: [0, 3, 0], fov: 42};
	} else if (shot === 1) {
		const k = easeInOut(clamp((f - cB) / (cC - cB)));
		c = {pos: [lerp(-1.4, -1.0, k), 4.3, lerp(16.0, 14.6, k)], target: [-1.9, 3.9, 6.6], fov: 38};
	} else {
		// colours drain away, one person at a time, then the town
		const fs = f - cC;
		const k = easeInOut(clamp(fs / 100));
		c = {pos: [lerp(2, 3, k), lerp(6.5, 10, k), lerp(17, 24, k)], target: [0, 3.2, 1], fov: 42};
		greyK = (i: number) => easeInOut(clamp((fs - 6 - ((i * 7) % 11) * 5.5) / 16));
		townK = 1 - easeInOut(clamp((fs - 60) / 34));
	}
	return (
		<>
			<RTPortal rt={rtFull} cam={c}>
				<OldScene t={t} laugh={shot >= 1} greyK={greyK} townK={townK} />
			</RTPortal>
			<FullScreenRT rt={rtFull} sepia={0.25} />
		</>
	);
};

// ===================================================================== S17
// "So the next day, I wore the wildest hat in the world to school. The whole class gasped."
const DOOR: V3 = [10, 0, 14.6];
const S17: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(17, 193) - 4; // to school
	const cC = W(17, 195) - 3; // The whole class gasped
	const shot = shotIndex(f, [cB, cC]);
	const t = f / 30;
	const hatT = t;
	if (shot === 0) {
		// low angle: walking to school in the wildest hat, between grey kids walking in sync
		const k = easeInOut(clamp(f / cB));
		const mz = -4 - t * 1.7;
		const pose = robotWalk(t);
		const kids = walkerGrid([-6.2, -3.4, 3.4, 6.2], 6, mz + 6, 4.4, -1).map((p) => ({...p, pos: [p.pos[0], p.pos[1], p.pos[2] - ROBOT_SPEED * 0.85 * t] as V3}));
		return (
			<StreetSet focus={[0, 0, mz]} shadow={18}>
				<Shop name="BOB SCHOOL" position={[0, 0, -40]} rotation={0} k={0} seed={3} />
				<BobCrowd spec={BOB_KID} people={kids} pose={() => pose} />
				<Character spec={ME} position={[0, 0, mz]} rotation={Math.PI} pose={P.walk(t, 0.85, 1)} expr="proud" headExtra={<WildHat t={hatT} wobble={0.4} />} />
				<CameraRig pos={[lerp(2.6, 2.2, k), lerp(1.1, 1.3, k), mz - lerp(6.2, 5.4, k)]} target={[0, lerp(5.0, 5.4, k), mz]} fov={52} sway={0.4} />
			</StreetSet>
		);
	}
	if (shot === 1) {
		// I appear at the classroom door
		const fs = f - cB;
		const k = easeOut(clamp(fs / (cC - cB)));
		const kids = DESK_X.flatMap((x, c) => DESK_Z.map((z, r) => ({c, r}))).filter((s) => !(s.c === ME_SEAT.c && s.r === ME_SEAT.r)).map((s) => ({pos: seat(s.c, s.r), yaw: Math.PI}));
		return (
			<Stage look={{...LOOK_GREY, sunDir: [-0.7, 0.6, 0.3]}} sky={false} fog={false} focus={[4, 0, 8]} shadowSize={14}>
				<Classroom />
				<mesh geometry={rbox(3.0, 5.4, 0.3, 0.06)} material={plastic('#7f766c', {rough: 0.5})} position={[DOOR[0] - 1.6, 2.7, DOOR[2] + 1.2]} rotation={[0, -1.2, 0]} />
				<BobCrowd spec={BOB_KID} people={kids} pose={() => P.withPose(P.sit(t, 0, 0), {armL: [-1.2, 0, -0.12], armR: [-1.2, 0, 0.12]})} />
				<Character spec={ME} position={[DOOR[0], 0, DOOR[2] - k * 1.2]} rotation={Math.PI} pose={P.walk(t, 0.6, 0.6 * (1 - k))} expr="proud" headExtra={<WildHat t={hatT} wobble={0.6} />} />
				<CameraRig pos={[DOOR[0] - 1.0, 2.6, DOOR[2] - 7.0]} target={[DOOR[0], 5.2, DOOR[2]]} fov={48} sway={0.3} />
			</Stage>
		);
	}
	// the whole class turns and gasps at the same time
	const fs = f - cC;
	const turn = easeOut(clamp(fs / 5));
	const gk = clamp((fs - 2) / 5);
	const kids = DESK_X.flatMap((x, c) => DESK_Z.map((z, r) => ({c, r}))).filter((s) => !(s.c === ME_SEAT.c && s.r === ME_SEAT.r)).map((s) => {
		const p = seat(s.c, s.r);
		const toDoor = Math.atan2(DOOR[0] - p[0], DOOR[2] - p[2]);
		let d = toDoor - Math.PI;
		while (d > Math.PI) d -= Math.PI * 2;
		while (d < -Math.PI) d += Math.PI * 2;
		return {pos: p, yaw: Math.PI + d * turn};
	});
	const k = easeOut(clamp(fs / 50));
	return (
		<Stage look={{...LOOK_GREY, sunDir: [-0.7, 0.6, 0.3]}} sky={false} fog={false} focus={[0, 0, 4]} shadowSize={14}>
			<Classroom />
			<BobCrowd spec={BOB_KID} people={kids} pose={() => gasp(gk, P.sit(t, 0, 0))} faces={[gk > 0.4 ? 'gasp' : 'bob']} blink={false} />
			<Character spec={ME} position={[DOOR[0], 0, DOOR[2] - 1.2]} rotation={Math.PI + 0.4} pose={P.idle(t, 1)} expr="happy" headExtra={<WildHat t={hatT} wobble={0.3} />} />
			<CameraRig pos={[lerp(7.4, 7.0, k), lerp(4.6, 4.8, k), lerp(14.0, 13.4, k)]} target={[-2, 3.0, 0]} fov={48} sway={0.3} shake={fs > 2 && fs < 9 ? 0.4 : 0} />
		</Stage>
	);
};

export const SCENES_13_17: SceneDef[] = [{Comp: S13}, {Comp: S14}, {Comp: S15}, {Comp: S16}, {Comp: S17}];
