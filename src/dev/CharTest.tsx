import React from 'react';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {Stage, LOOKS} from '../lib/Stage';
import {Post} from '../lib/Post';
import {CameraRig} from '../lib/CameraRig';
import {plastic, rbox, cyl, circle} from '../lib/materials';
import {Character} from '../characters/Character';
import {KID, GRANDPA, BUCKET_MAN, TEACHER, makePerson} from '../characters/presets';
import {Expression} from '../characters/faceTexture';
import * as P from '../characters/poses';
import {HangingBucket, Bucket} from '../props/Bucket';
import {HandBell, WalkingStick} from '../props/HandProps';
import {POPPINS} from '../lib/fonts';

export type CharTestView = 'walkTest' | 'kid' | 'grandpa' | 'bucketman' | 'kidClose' | 'grandpaClose' | 'bucketmanClose' | 'lineup' | 'faces' | 'faces2' | 'poses' | 'crowd';

const Ground: React.FC<{r?: number}> = ({r = 30}) => (
	<>
		<mesh geometry={circle(r, 64)} material={plastic('#7fd36a', {rough: 0.8})} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
		{Array.from({length: 9}).map((_, i) => (
			<group key={i} position={[-8 + i * 2, 0, -6]}>
				<mesh geometry={rbox(0.32, 1.6, 0.12, 0.04)} material={plastic('#ffffff')} position={[0, 0.8, 0]} castShadow receiveShadow />
				<mesh geometry={rbox(2.0, 0.18, 0.08, 0.03)} material={plastic('#ffffff')} position={[1, 1.15, -0.08]} castShadow receiveShadow />
				<mesh geometry={rbox(2.0, 0.18, 0.08, 0.03)} material={plastic('#ffffff')} position={[1, 0.5, -0.08]} castShadow receiveShadow />
			</group>
		))}
	</>
);

const Label: React.FC<{x: number; y: number; text: string; size?: number}> = ({x, y, text, size = 34}) => (
	<div style={{position: 'absolute', left: x - 200, top: y, width: 400, textAlign: 'center', fontFamily: POPPINS, fontWeight: 800, fontSize: size, color: 'white', textShadow: '0 0 6px rgba(0,0,0,0.9), 0 2px 3px rgba(0,0,0,0.9)'}}>
		{text}
	</div>
);

export const CharTest: React.FC<{view: CharTestView}> = ({view}) => {
	const {width, height} = useVideoConfig();
	const frame = useCurrentFrame();
	const t = frame / 30;

	if (view === 'faces' || view === 'faces2') {
		type Row = [string, Expression, typeof KID, number?];
		const exprs: Row[] =
			view === 'faces'
				? [
						['happy', 'happy', KID], ['big smile', 'bigSmile', KID], ['shocked', 'shocked', KID], ['sad', 'sad', KID],
						['crying', 'crying', KID], ['sleeping', 'sleeping', KID], ['whispering', 'whisper', KID], ['proud / smug', 'smug', KID],
						['disgusted', 'disgusted', KID], ['tired', 'tired', KID], ['excited', 'excited', KID], ['shouting', 'shout', KID],
						['happy tears', 'happyCry', KID], ['laughing', 'laugh', KID], ['talking', 'happy', KID, 0.9], ['blink', 'neutral', KID, -1],
					]
				: [
						['happy', 'happy', GRANDPA], ['whispering', 'whisper', GRANDPA], ['sleeping', 'sleeping', GRANDPA], ['crying', 'crying', GRANDPA],
						['big smile', 'bigSmile', BUCKET_MAN], ['shouting', 'shout', BUCKET_MAN], ['smug', 'smug', BUCKET_MAN], ['talking', 'happy', BUCKET_MAN, 0.9],
						['proud', 'proud', TEACHER], ['tired', 'tired', TEACHER], ['shocked', 'shocked', TEACHER], ['happy', 'happy', TEACHER],
					];
		const cols = 4;
		const rows = Math.ceil(exprs.length / cols);
		const zoom = 168;
		const cellW = width / cols;
		const cellH = (height - 80) / rows;
		return (
			<AbsoluteFill style={{background: '#000'}}>
				<ThreeCanvas width={width} height={height} orthographic camera={{zoom, position: [0, 0, 60], near: 0.1, far: 200}} shadows={{enabled: true, type: THREE.PCFShadowMap}} gl={{antialias: false}}>
					<Stage look={LOOKS.interiorDay} sky={false} fog={false} shadowSize={14}>
						<mesh geometry={rbox(40, 40, 0.2, 0.01, 1)} material={plastic('#9fd8ff', {rough: 0.9})} position={[0, 0, -4]} receiveShadow />
						{exprs.map(([, e, spec, talk], i) => {
							const px = cellW * (i % cols) + cellW / 2;
							const py = 40 + cellH * Math.floor(i / cols) + cellH * 0.42;
							const wx = (px - width / 2) / zoom;
							const wy = (height / 2 - py) / zoom;
							const hs = (spec.headSize ?? 1) * spec.scale;
							const headCenter = (1.22 * (spec.headSize ?? 1)) / 2 + 0.03;
							return (
								<group key={i} position={[wx, wy, 0]} scale={1 / (spec.scale * (spec.headSize ?? 1)) * 0.92}>
									<Character spec={spec} headOnly expr={e} talk={talk && talk > 0 ? talk : 0} blink={false}
										face={talk === -1 ? {eyes: 'blink'} : undefined} position={[0, -headCenter * spec.scale, 0]} rotation={0.1 * ((i % cols) - 1.5)}
										pose={{...P.REST, head: [0.04, 0, 0]}} />
								</group>
							);
						})}
					</Stage>
					<Post bloom={0.3} vignette={0} />
				</ThreeCanvas>
				{exprs.map(([label, , spec], i) => (
					<Label key={i} x={cellW * (i % cols) + cellW / 2} y={40 + cellH * Math.floor(i / cols) + cellH * 0.42 + 160} text={view === 'faces2' && i % 4 === 0 ? `${label}` : label} size={32} />
				))}
				{view === 'faces2'
					? ['GRANDPA', 'BUCKET MAN', 'TEACHER'].map((t, r) => <Label key={t} x={width / 2} y={40 + cellH * r + 6} text={t} size={30} />)
					: null}
			</AbsoluteFill>
		);
	}

	if (view === 'poses') {
		const poses: [string, P.Pose, React.ReactNode?][] = [
			['idle', P.idle(t)], ['walk', P.walk(t + 0.3)], ['run', P.run(t + 0.1)],
			['jump for joy', P.jumpJoy(t + 0.18)], ['hug', P.hug(t)], ['drag (heavy)', P.drag(t + 0.2)],
			['sit', P.sit(t, 0, 1.45)], ['raise hand', P.raiseHand(t)], ['cheer', P.cheer(t + 0.4)],
			['hold nose', P.holdNoseWalk(t + 0.2)], ['shrug', P.shrug(1)], ['hold up bucket', P.holdUp(t)],
		];
		const cols = 3;
		const zoom = 78;
		const cw = width / cols / zoom;
		const ch = (height / zoom - 1.5) / 4;
		return (
			<AbsoluteFill style={{background: '#000'}}>
				<ThreeCanvas width={width} height={height} orthographic camera={{zoom, position: [14, 9, 60], near: 0.1, far: 300}} shadows={{enabled: true, type: THREE.PCFShadowMap}} gl={{antialias: false}}>
					<Stage look={LOOKS.day} sky={false} fog={false} shadowSize={16}>
						<mesh geometry={rbox(60, 60, 0.2, 0.01, 1)} material={plastic('#bfe7ff', {rough: 0.9})} position={[0, 0, -8]} receiveShadow />
						{poses.map(([, pose], i) => {
							const cx = (-width / 2 / zoom) + cw * (i % cols) + cw / 2;
							const by = (height / 2 / zoom) - 0.9 - (Math.floor(i / cols) + 1) * ch + 0.35;
							const isHold = i === 11;
							const isSit = i === 6;
							return (
								<group key={i} position={[cx, by, 0]}>
									<mesh geometry={cyl(1.6, 1.6, 0.12, 32)} material={plastic('#7fd36a', {rough: 0.8})} position={[0, -0.06, 0]} receiveShadow />
									{isSit ? <mesh geometry={rbox(2.2, 1.2, 2.0, 0.08)} material={plastic('#ff9d4a')} position={[0, 0.6, -0.3]} castShadow receiveShadow /> : null}
									<Character spec={KID} pose={pose} expr={i === 9 ? 'disgusted' : i === 3 || i === 8 ? 'bigSmile' : i === 5 ? 'tired' : 'happy'} rotation={[1, 2, 5, 9].includes(i) ? 1.15 : i === 6 ? 0.6 : 0.3}
										holdR={isHold ? <group position={[0.7, -0.3, 0.0]}><Bucket position={[0, -0.2, 0]} handle={0} /></group> : undefined} />
								</group>
							);
						})}
					</Stage>
					<Post bloom={0.3} vignette={0} />
				</ThreeCanvas>
				{poses.map(([label], i) => (
					<Label key={i} x={(width / cols) * (i % cols) + width / cols / 2} y={(Math.floor(i / cols) + 1) * ch * zoom + 0.9 * zoom - 10} text={label} size={30} />
				))}
			</AbsoluteFill>
		);
	}

	// ---------- portrait / lineup scenes
	let cam = {pos: [0, 3, 10] as [number, number, number], target: [0, 2.2, 0] as [number, number, number], fov: 38};
	let content: React.ReactNode = null;
	if (view === 'kid' || view === 'kidClose') {
		cam = view === 'kid' ? {pos: [3.2, 2.8, 11.5], target: [0, 2.1, 0], fov: 36} : {pos: [0.9, 3.75, 4.2], target: [0, 3.55, 0], fov: 36};
		content = (
			<Character spec={KID} pose={P.withPose(P.idle(t), {armR: [-0.3, 0, -0.1]})} expr={view === 'kid' ? 'happy' : 'bigSmile'} rotation={0.22}
				holdR={<Bucket position={[0, -1.45, 0.05]} handle={0} />} holdRUpright />
		);
	} else if (view === 'grandpa' || view === 'grandpaClose') {
		cam = view === 'grandpa' ? {pos: [-3.0, 3.1, 12.5], target: [0, 2.45, 0], fov: 36} : {pos: [-0.9, 4.75, 4.6], target: [0, 4.55, 0], fov: 36};
		content = (
			<Character spec={GRANDPA} pose={P.withPose(P.idle(t), {armR: [-0.42, 0, -0.1]})} expr="happy" rotation={-0.2} holdR={<group rotation={[0.42, 0, 0]}><WalkingStick length={2.15} /></group>} />
		);
	} else if (view === 'bucketman' || view === 'bucketmanClose') {
		cam = view === 'bucketman' ? {pos: [-5.0, 4.6, 17.5], target: [-0.9, 3.9, -0.8], fov: 40} : {pos: [-1.4, 6.6, 6.2], target: [0, 6.2, 0], fov: 36};
		content = (
			<Character spec={BUCKET_MAN} pose={P.withPose(P.idle(t), P.ringBell(t))} expr={view === 'bucketman' ? 'bigSmile' : 'happy'} rotation={view === 'bucketman' ? -0.85 : -0.25}
				holdR={<HandBell swing={Math.sin(t * 18) * 0.5} />} />
		);
	} else if (view === 'walkTest') {
		const z = t * 2.2;
		cam = {pos: [0.4, 4.4, z + 22], target: [0, 3.2, z - 1], fov: 42};
		const amp = Math.max(0, Math.sin(t * 9) * 0.7 + Math.sin(t * 5.3) * 0.5);
		content = (
			<>
				<Character spec={GRANDPA} position={[-3.0, 0, z - 1.2]} pose={P.withPose(P.walk(t, 0.9), {armR: [-0.4 + Math.sin(t * Math.PI * 2 * 0.95 * 0.9) * 0.15, 0, -0.1]})} expr="happy" holdR={<group rotation={[0.42, 0, 0]}><WalkingStick length={2.15} /></group>} />
				<Character spec={KID} position={[0.2, 0, z + 1.0]} pose={P.walk(t + 0.2, 1.15)} expr="happy" talk={amp} holdR={<Bucket position={[0, -1.45, 0.05]} handle={0} />} holdRUpright />
				<Character spec={BUCKET_MAN} position={[3.4, 0, z - 2.5]} pose={P.withPose(P.walk(t + 0.5, 0.8), P.ringBell(t))} expr="bigSmile" holdR={<HandBell swing={Math.sin(t * 18) * 0.5} />} />
				{Array.from({length: 12}).map((_, i) => (
					<Bucket key={i} position={[(i % 2 ? 5.5 : -5.5), 0, i * 3 - 6]} />
				))}
			</>
		);
	} else if (view === 'lineup') {
		cam = {pos: [0, 4.8, 27], target: [0, 3.3, 0], fov: 36};
		content = (
			<>
				<Character spec={BUCKET_MAN} position={[0.7, 0, -2.6]} rotation={-0.15} pose={P.withPose(P.idle(t, 3), P.ringBell(t))} expr="happy" holdR={<HandBell swing={Math.sin(t * 18) * 0.5} />} />
				<Character spec={GRANDPA} position={[-2.9, 0, 1.0]} rotation={0.3} pose={P.withPose(P.idle(t, 1), {armR: [-0.42, 0, -0.1]})} expr="smug" holdR={<group rotation={[0.42, 0, 0]}><WalkingStick length={2.15} /></group>} />
				<Character spec={KID} position={[0.1, 0, 3.0]} rotation={0} pose={P.withPose(P.idle(t, 2), {armR: [-0.3, 0, -0.1]})} expr="bigSmile" holdR={<Bucket position={[0, -1.45, 0.05]} handle={0} />} holdRUpright />
				<Character spec={TEACHER} position={[3.0, 0, 0.8]} rotation={-0.35} pose={P.idle(t, 4)} expr="proud" />
			</>
		);
	} else if (view === 'crowd') {
		cam = {pos: [0, 5.5, 26], target: [0, 2.6, 0], fov: 40};
		content = (
			<>
				{Array.from({length: 15}).map((_, i) => {
					const spec = makePerson(100 + i, {kid: i % 3 === 0, pajamas: i >= 10, elder: i === 4});
					const row = Math.floor(i / 5);
					const x = ((i % 5) - 2) * 2.9 + (row % 2) * 1.2;
					const z = -row * 3.2;
					return <Character key={i} spec={spec} position={[x, 0, z]} rotation={-x * 0.03} pose={P.cheer(t, i)} expr={i % 2 ? 'bigSmile' : 'happy'} lod={row > 0 ? 'low' : 'high'} />;
				})}
			</>
		);
	}

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<ThreeCanvas width={width} height={height} shadows={{enabled: true, type: THREE.PCFShadowMap}} gl={{antialias: false}}>
				<Stage look={LOOKS.morning} shadowSize={12}>
					<Ground />
					{content}
				</Stage>
				<CameraRig pos={cam.pos} target={cam.target} fov={cam.fov} sway={0} />
				<Post bloom={0.5} />
			</ThreeCanvas>
		</AbsoluteFill>
	);
};
