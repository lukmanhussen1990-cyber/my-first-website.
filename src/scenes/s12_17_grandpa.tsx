// Scenes 12-17: night at Grandpa's, the dream, the curtains, the whispered legend, the Golden Throne vision.
import React from 'react';
import * as THREE from 'three';
import {Stage, LOOKS, mixLooks} from '../lib/Stage';
import {CameraRig} from '../lib/CameraRig';
import {Character} from '../characters/Character';
import {KID, GRANDPA} from '../characters/presets';
import * as P from '../characters/poses';
import {GrandpaHome, ThoughtBubble, BED_POS, CHAIR_POS, CHAIR_ROT, WINDOW_POS} from '../world/GrandpaHome';
import {GoldenThrone, StoneStand, STAND_TOP} from '../props/GoldenThrone';
import {SleepZ, LightRays, MagicSwirl, Sparkles, Dust, GlowPoints} from '../props/Effects';
import {WalkingStick} from '../props/HandProps';
import {Cloud, GlowSprite} from '../world/Nature';
import {plastic, rbox, cyl, sphere, glowMat} from '../lib/materials';
import {SceneDef, SceneProps, shotIndex, W, amp} from './kit';
import {easeInOut, easeOut, easeOutBack, clamp, lerp, keys} from '../lib/anim';
import {registerWhip, wf, LEAD} from '../timing';
import {AbsoluteFill} from 'remotion';

const NIGHT = {...LOOKS.interiorNight, hemi: 0.55, ambient: 0.14, sun: 0.7};
const MORN = {...LOOKS.interiorDay, sunDir: [0.1, 0.7, -0.9] as [number, number, number], sun: 1.8};

// grandpa sitting in his armchair (world placement)
const yaw = CHAIR_ROT;
const seatLocal = (lx: number, lz: number): [number, number, number] => [CHAIR_POS[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), 0.1, CHAIR_POS[2] - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
const GP_SEAT = seatLocal(0, -0.3);
const GP_HEAD: [number, number, number] = [GP_SEAT[0] + Math.sin(yaw) * 0.15, 0.1 + (2 + 2 + 0.68) * 0.95, GP_SEAT[2] + Math.cos(yaw) * 0.15];

const sleepPose = (t: number) => P.withPose(P.sit(t, 3, 0), {head: [-0.22 + Math.sin(t * 1.4) * 0.03, 0.15, 0.28], lean: -0.1, armL: [-0.5, 0, 0.18], armR: [-0.5, 0, -0.18]});

const SleepingGrandpa: React.FC<{t: number; talk: number; frame: number}> = ({t, talk, frame}) => (
	<>
		<Character spec={GRANDPA} position={GP_SEAT} rotation={yaw} pose={sleepPose(t)} expr="sleeping" talk={talk} blink={false} />
		<group position={[CHAIR_POS[0] + 1.9, 0, CHAIR_POS[2] + 1.0]} rotation={[0, 0, 0.18]}>
			<group position={[0, 2.2, 0]}>
				<WalkingStick length={2.15} />
			</group>
		</group>
		<SleepZ frame={frame} position={[GP_HEAD[0] + 0.6, GP_HEAD[1] + 0.8, GP_HEAD[2]]} scale={1.1} />
	</>
);

// me lying in bed (on my back, head on the pillow), awake
const LyingKid: React.FC<{expr: any; look?: [number, number]}> = ({expr, look}) => (
	<>
		<group position={[BED_POS[0], 2.2, BED_POS[2] + 0.75]} rotation={[-Math.PI / 2, 0, 0]}>
			<Character spec={KID} pose={P.REST} expr={expr} look={look} />
		</group>
		{/* duvet over me */}
		<mesh geometry={rbox(4.0, 0.7, 4.9, 0.3)} material={plastic('#5b8cff', {rough: 0.85})} position={[BED_POS[0], 2.75, BED_POS[2] + 1.35]} castShadow receiveShadow />
		<mesh geometry={rbox(4.05, 0.72, 0.6, 0.25)} material={plastic('#ffffff', {rough: 0.85})} position={[BED_POS[0], 2.77, BED_POS[2] - 1.0]} castShadow />
	</>
);

// ===================================================================== S12
// "But one night, I heard Grandpa talking in his sleep."
const S12: React.FC<SceneProps> = ({f, g}) => {
	const cut = W(12, 93) - 4; // "Grandpa"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	const mumble = Math.max(0, Math.sin(t * 7) * 0.5 + Math.sin(t * 3.1) * 0.3) * (f > cut ? 1 : 0);
	if (shot === 0) {
		const look: [number, number] = f < 18 ? [0, 0] : [1, -0.5];
		const k = easeInOut(clamp(f / cut));
		return (
			<Stage look={NIGHT} sky={false} fog={false} focus={[-4, 0, -3]} shadowSize={14}>
				<GrandpaHome night />
				<LyingKid expr="worried" look={look} />
				<SleepingGrandpa t={t} talk={0} frame={f} />
				<CameraRig pos={[lerp(BED_POS[0] + 0.4, BED_POS[0] + 0.2, k), lerp(5.8, 5.2, k), BED_POS[2] - 0.2 + 0.8]} target={[BED_POS[0], 2.4, BED_POS[2] - 2.6]} fov={50} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeInOut(clamp(fs / 40));
	return (
		<Stage look={NIGHT} sky={false} fog={false} focus={[3, 0, -2]} shadowSize={14}>
			<GrandpaHome night />
			<LyingKid expr="worried" look={[1, -0.5]} />
			<SleepingGrandpa t={t} talk={mumble} frame={f} />
			<CameraRig pos={[lerp(-2.5, 1.0, k), lerp(5.0, 4.6, k), lerp(4.5, 3.6, k)]} target={[lerp(-3, GP_HEAD[0], k), lerp(3, GP_HEAD[1] - 0.4, k), lerp(-4, GP_HEAD[2], k)]} fov={46} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== S13
// "The Golden Throne... the Golden Throne..." dream bubble above sleeping Grandpa
const S13: React.FC<SceneProps> = ({f, g}) => {
	const cut = W(13, 101) - 4; // second "the Golden Throne"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	const pop = easeOutBack(clamp((f - 2) / 9), 2.2);
	const bubblePos: [number, number, number] = [GP_HEAD[0] - 2.4, GP_HEAD[1] + 3.6, GP_HEAD[2] + 0.6];
	const bubble = (
		<group position={bubblePos} rotation={[0, 0.25, 0]}>
			<ThoughtBubble k={pop} scale={1.05} trail={[0.9, -1.4, 0]}>
				<group position={[0, -1.05, 0.2]} rotation={[0.22, 0.5 + Math.sin(t * 1.2) * 0.5, 0]} scale={0.62}>
					<GoldenThrone frame={f} glow={1} light={false} sparkles />
				</group>
				<GlowSprite position={[0, 0, -0.2]} size={4.5} color="#ffd24a" opacity={0.55} />
			</ThoughtBubble>
		</group>
	);
	if (shot === 0) {
		const k = easeOut(clamp(f / cut));
		return (
			<Stage look={NIGHT} sky={false} fog={false} focus={[5, 0, -2]} shadowSize={12}>
				<GrandpaHome night />
				<SleepingGrandpa t={t} talk={amp(g)} frame={f} />
				{bubble}
				<pointLight position={[bubblePos[0], bubblePos[1], bubblePos[2] + 2]} intensity={14 * pop} distance={10} color="#ffd27a" />
				<CameraRig pos={[lerp(bubblePos[0] + 2.2, bubblePos[0] + 1.6, k), lerp(7.4, 7.6, k), lerp(bubblePos[2] + 13.5, bubblePos[2] + 12, k)]} target={[bubblePos[0] + 0.6, (bubblePos[1] + GP_HEAD[1]) / 2 + 0.2, bubblePos[2]]} fov={44} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeInOut(clamp(fs / 40));
	return (
		<Stage look={NIGHT} sky={false} fog={false} focus={[5, 0, -2]} shadowSize={12}>
			<GrandpaHome night />
			<SleepingGrandpa t={t} talk={amp(g)} frame={f} />
			{bubble}
			<pointLight position={[bubblePos[0], bubblePos[1], bubblePos[2] + 2]} intensity={16} distance={10} color="#ffd27a" />
			<CameraRig pos={[lerp(bubblePos[0] + 0.9, bubblePos[0] + 0.4, k), lerp(bubblePos[1] + 0.6, bubblePos[1] + 0.3, k), lerp(bubblePos[2] + 9, bubblePos[2] + 6.6, k)]} target={[bubblePos[0] + 0.2, bubblePos[1] - 0.45, bubblePos[2]]} fov={42} sway={0.5} />
		</Stage>
	);
};

// ===================================================================== S14
// "The next morning, I asked him about it. Grandpa closed the curtains, looked around... and whispered:"
const GP_STAND: [number, number, number] = [0.5, 0, -7.6];
const S14: React.FC<SceneProps> = ({f, g}) => {
	const cB = W(14, 112) - 3; // "Grandpa closed the curtains"
	const cC = W(14, 116) - 3; // "looked around"
	const cD = W(14, 118) - 2; // "and whispered"
	const shot = shotIndex(f, [cB, cC, cD]);
	const t = f / 30;
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		const me: [number, number, number] = [3.4, 0, 2.2];
		const meYaw = Math.atan2(GP_SEAT[0] - me[0], GP_SEAT[2] - me[2]);
		return (
			<Stage look={MORN} sky={false} fog={false} focus={[4, 0, -1]} shadowSize={14}>
				<GrandpaHome night={false} curtains={0} />
				<Character spec={GRANDPA} position={GP_SEAT} rotation={yaw} pose={P.withPose(P.sit(t, 2, 0), {armL: [-0.5, 0, 0.18], armR: [-0.5, 0, -0.18], head: [0.05, 0.25, 0]})} expr="neutral" look={[-1, 0]} />
				<Character spec={KID} position={me} rotation={meYaw} pose={P.withPose(P.idle(t), {armR: [-0.9 + Math.sin(t * 6) * 0.15, 0, -0.3], armL: [-0.6, 0, 0.3]})} expr="excited" talk={amp(g) * 0.8} />
				<CameraRig pos={[lerp(10.6, 10.2, k), 5.3, lerp(-4.2, -3.6, k)]} target={[me[0] + 0.6, 3.3, me[2]]} fov={46} sway={0.8} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const close = easeInOut(clamp((fs - 6) / 30));
		const look = mixLooks(MORN, {...NIGHT, hemi: 0.75, ambient: 0.2}, close * 0.85);
		return (
			<Stage look={look} sky={false} fog={false} focus={[0, 0, -7]} shadowSize={10}>
				<GrandpaHome night={false} curtains={close} lamp />
				<Character spec={GRANDPA} position={GP_STAND} rotation={Math.PI} pose={P.pullCurtains(close)} expr="neutral" />
				<CameraRig pos={[6.2, 4.6, 1.6]} target={[0.3, 4.6, -8.6]} fov={50} sway={0.8} />
			</Stage>
		);
	}
	const dim = {...NIGHT, hemi: 0.75, ambient: 0.22};
	if (shot === 2) {
		const fs = f - cC;
		const lx = keys(fs, [[0, 0], [4, -1], [12, -1], [16, 1], [24, 1], [28, 0]], easeInOut);
		return (
			<Stage look={dim} sky={false} fog={false} focus={[0, 0, -7]} shadowSize={8}>
				<GrandpaHome night={false} curtains={1} />
				<Character spec={GRANDPA} position={[GP_STAND[0], 0, GP_STAND[2] + 1.2]} rotation={0} pose={P.withPose(P.idle(t), {head: [0.05, lx * 0.35, 0]})} expr="smug" face={{brows: 'angry'}} look={[lx, 0]} blink={false} />
				<CameraRig pos={[0.5, 4.75, -1.8]} target={[GP_STAND[0], 4.55, GP_STAND[2] + 1.2]} fov={40} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cD;
	const k = easeOut(clamp(fs / 20));
	return (
		<Stage look={dim} sky={false} fog={false} focus={[0, 0, -6]} shadowSize={8}>
			<GrandpaHome night={false} curtains={1} />
			<Character spec={GRANDPA} position={[GP_STAND[0], 0, GP_STAND[2] + 1.2]} rotation={0} pose={P.whisperPose(t)} expr="whisper" talk={amp(g) * 0.7} />
			<CameraRig pos={[-0.6, 4.5, lerp(-1.0, -2.0, k)]} target={[GP_STAND[0], 4.2, GP_STAND[2] + 1.2]} fov={44} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== S15
// "Long ago, there was a magic seat. You sit. You go." dramatic close-up, warm gold light on his face
const S15: React.FC<SceneProps> = ({f, g}) => {
	const cut = W(15, 127) - 3; // "You sit"
	const shot = shotIndex(f, [cut]);
	const t = f / 30;
	const dark = {...LOOKS.castle, hemi: 0.3, ambient: 0.06, fog: '#0d0a14', fogNear: 10, fogFar: 40};
	const gpPos: [number, number, number] = [GP_STAND[0], 0, GP_STAND[2] + 1.2];
	const head: [number, number, number] = [gpPos[0], 4.55, gpPos[2]];
	const flicker = 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.04;
	const goldLights = (
		<>
			<pointLight position={[head[0] + 0.6, head[1] - 1.2, head[2] + 2.0]} intensity={15 * flicker} distance={8} color="#ffb43a" decay={1.6} />
			<pointLight position={[head[0] - 2.5, head[1] + 1.5, head[2] - 2]} intensity={10} distance={8} color="#7a8cff" decay={1.6} />
			<Dust frame={f} count={60} box={[6, 4, 4]} position={[head[0], head[1] - 2, head[2] + 0.5]} color="#ffcf6a" size={0.08} />
		</>
	);
	if (shot === 0) {
		const k = easeInOut(clamp(f / cut));
		return (
			<Stage look={dark} sky={false} fog focus={[0, 0, -6]} shadowSize={8}>
				<GrandpaHome night={false} curtains={1} lamp={false} stringLights={false} />
				<Character spec={GRANDPA} position={gpPos} rotation={-0.15} pose={P.withPose(P.whisperPose(t), {lean: 0.18})} expr="whisper" talk={amp(g) * 0.75} />
				{goldLights}
				<CameraRig pos={[lerp(1.9, 1.3, k), 4.3, lerp(-0.6, -1.8, k)]} target={[head[0], head[1] - 0.45, head[2] + 0.5]} fov={42} sway={0.6} />
			</Stage>
		);
	}
	const fs = f - cut;
	const k = easeInOut(clamp(fs / 45));
	return (
		<Stage look={dark} sky={false} fog focus={[0, 0, -6]} shadowSize={8}>
			<GrandpaHome night={false} curtains={1} lamp={false} stringLights={false} />
			<Character spec={GRANDPA} position={gpPos} rotation={0.2} pose={P.withPose(P.idle(t), {lean: 0.15, head: [-0.12, 0, 0], armR: [-1.6, 0, 0.3], armL: [-1.2, 0, -0.3]})} expr="whisper" face={{eyes: 'wide', brows: 'raised'}} talk={amp(g) * 0.8} />
			{goldLights}
			<CameraRig pos={[lerp(-1.6, -1.2, k), lerp(3.3, 3.5, k), lerp(-0.9, -1.9, k)]} target={[head[0], head[1] - 0.2, head[2] + 0.4]} fov={44} sway={0.6} />
		</Stage>
	);
};

// ===================================================================== S16
// "And with one push of a button... WHOOSH. It's gone. Forever." throne on a stone stand, rays, magic swirl
const DREAM = {...LOOKS.dream};
const S16: React.FC<SceneProps> = ({f}) => {
	const cB = W(16, 134) - 3; // "push of a button"
	const cC = W(16, 138) - 3; // "WHOOSH"
	const cD = W(16, 139) - 2; // "It's gone. Forever."
	const shot = shotIndex(f, [cB, cC, cD]);
	const t = f / 30;
	const press = keys(f, [[W(16, 137) - 2, 0], [W(16, 137) + 3, 1], [cD + 4, 1], [cD + 14, 0]], easeOut);
	const swirlK = clamp((f - cC) / 55);
	const base = (glow: number) => (
		<>
			<StoneStand position={[0, 0, 0]} />
			<GoldenThrone frame={f} position={[0, STAND_TOP, 0]} glow={glow} press={press} />
			<LightRays frame={f} position={[0, 4.5, -4]} size={34} opacity={0.4 + glow * 0.2} color="#ffd77a" speed={0.18} />
			{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
				<Cloud key={i} position={[Math.cos(i * 0.8 + 0.3) * 30, -6 - (i % 3) * 1.5, Math.sin(i * 0.8 + 0.3) * 26 - 14]} scale={3.0} seed={i + 10} color="#fff1d6" />
			))}
			<mesh geometry={cyl(60, 60, 0.5, 48)} material={plastic('#fde7c4', {rough: 1, emissive: '#ffe2b0', emissiveIntensity: 0.3})} position={[0, -7.5, -10]} receiveShadow />
			<Sparkles frame={f} count={50} radius={7} height={9} position={[0, 0, 0]} seed={4} />
		</>
	);
	if (shot === 0) {
		const k = easeInOut(clamp(f / cB));
		return (
			<Stage look={DREAM} focus={[0, 0, 0]} shadowSize={10}>
				{base(1)}
				<CameraRig pos={[lerp(2.0, 1.4, k), lerp(1.9, 2.2, k), lerp(8.4, 7.0, k)]} target={[0, 3.9, 0]} fov={50} sway={0.6} />
			</Stage>
		);
	}
	if (shot === 1) {
		const fs = f - cB;
		const k = easeOut(clamp(fs / 25));
		return (
			<Stage look={DREAM} focus={[0, 3, 0]} shadowSize={6}>
				{base(1)}
				<CameraRig pos={[lerp(0.9, 0.5, k), lerp(5.7, 5.4, k), lerp(1.4, 0.4, k)]} target={[0, STAND_TOP + 2.95, -1.12]} fov={44} sway={0.5} />
			</Stage>
		);
	}
	if (shot === 2) {
		const fs = f - cC;
		const k = easeOut(clamp(fs / 21));
		return (
			<Stage look={DREAM} focus={[0, 0, 0]} shadowSize={10}>
				{base(1.6)}
				<MagicSwirl k={swirlK} position={[0, STAND_TOP + 0.8, 0]} radius={2.6} height={9} count={220} />
				<CameraRig pos={[lerp(5.5, 6.5, k), lerp(3.0, 2.4, k), lerp(9.5, 11.5, k)]} target={[0, 4.2, 0]} fov={50} sway={0.5} shake={0.25} />
			</Stage>
		);
	}
	const fs = f - cD;
	const k = easeInOut(clamp(fs / 50));
	return (
		<Stage look={DREAM} focus={[0, 0, 0]} shadowSize={12}>
			{base(1.1)}
			<MagicSwirl k={swirlK} position={[0, STAND_TOP + 0.8, 0]} radius={2.6} height={9} count={220} />
			<CameraRig pos={[lerp(-3, -6, k), lerp(4, 7, k), lerp(10, 15, k)]} target={[0, 3.5, 0]} fov={48} sway={0.5} />
		</Stage>
	);
};

const flashOverlay = (from: number, len: number, color = '#fff6d8') => (f: number) => {
	const k = clamp((f - from) / len);
	if (k <= 0 || k >= 1) return null;
	const a = Math.sin(k * Math.PI) * (k < 0.3 ? 1 : 0.85);
	return <AbsoluteFill style={{background: color, opacity: a * 0.55, mixBlendMode: 'screen'}} />;
};

// ===================================================================== S17
// "Where is it?!" huge excited eyes
const S17: React.FC<SceneProps> = ({f, g}) => {
	const t = f / 30;
	const punch = easeOut(clamp(f / 8));
	return (
		<Stage look={{...NIGHT, hemi: 0.85, ambient: 0.25}} sky={false} fog={false} focus={[0, 0, -4]} shadowSize={8}>
			<GrandpaHome night={false} curtains={1} />
			<Character spec={KID} position={[0.6, 0, -3.2]} rotation={Math.PI - 0.1} pose={P.withPose(P.jumpJoy(t), {y: 0, legL: [0, 0, 0.05], legR: [0, 0, -0.05]})} expr="excited" talk={amp(g)} />
			<pointLight position={[0.6, 3.8, -5.8]} intensity={18} distance={8} color="#ffd27a" />
			<CameraRig pos={[0.4, 3.75, lerp(-7.6, -6.2, punch)]} target={[0.6, 3.55, -3.2]} fov={44} sway={0.5} shake={0.3} />
		</Stage>
	);
};
registerWhip(wf(142) - LEAD, 1); // S16 -> S17

export const GRANDPA_SCENES: SceneDef[] = [
	{Comp: S12, post: () => ({bloom: 0.85, threshold: 0.8, vignette: 0.5})},
	{Comp: S13, post: () => ({bloom: 0.95, threshold: 0.8, vignette: 0.5})},
	{Comp: S14, post: () => ({bloom: 0.6, threshold: 0.85, vignette: 0.42})},
	{Comp: S15, post: () => ({bloom: 0.75, threshold: 0.8, vignette: 0.62})},
	{Comp: S16, post: (f) => ({bloom: f >= W(16, 138) - 3 && f < W(16, 139) + 10 ? 1.15 : 0.9, threshold: 0.8, vignette: 0.4}), overlay: flashOverlay(W(16, 138) - 2, 9)},
	{Comp: S17, post: () => ({bloom: 0.6, threshold: 0.85, vignette: 0.45})},
];
