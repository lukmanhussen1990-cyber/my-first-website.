import React from 'react';
import * as THREE from 'three';
import {AbsoluteFill} from 'remotion';
import {Figure} from '../../../src/shared/three/Figure';
import {Coins, Table, type CoinXf} from '../../../src/shared/three/props';
import {Dust} from '../../../src/shared/three/fx';
import {Sky} from '../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../src/shared/three/world';
import {useShot, type Vec3} from '../../../src/shared/three/shot';
import {BRAND, SANS, SERIF} from '../../../src/shared/text/brand';
import {FontGate, Logo} from '../../../src/shared/text/Overlay';
import {TempleCourt} from './sets/Temple';
import {JESUS, P} from './cast';
import {coinBurst, flipAngle} from './action';
import {gradeFromSun, type SceneDef} from './sceneKit';
import {SceneView} from './Episode';

// Cover: a long-lens shot at sunset. Jesus beside a table He has just sent over,
// coins thrown up against a big low sun, the temple hazy behind Him.
const TAU = 0.66; // action time of the frozen moment
const TABLE_YAW = 0.9; // the table goes over toward camera-right, away from Him
const TABLE_CENTER: Vec3 = [0.5, 0, 0.1];
const PIVOT: Vec3 = [TABLE_CENTER[0] + 0.42 * Math.sin(TABLE_YAW), 0, TABLE_CENTER[2] + 0.42 * Math.cos(TABLE_YAW)];

// coins off the table top, thrown along the flip direction
const coverCoins = (): CoinXf[] => {
	const c = Math.cos(TABLE_YAW);
	const s = Math.sin(TABLE_YAW);
	return coinBurst(TAU, 11, [0, 0.84, 0], 70, 0.3).map((k, i) => {
		const [x, y, z] = k.p;
		return {...k, p: [TABLE_CENTER[0] + x * c + z * s, y, TABLE_CENTER[2] - x * s + z * c], bronze: i % 3 !== 1};
	});
};

const CoverContent: React.FC = () => {
	const shot = useShot();
	// glints toward the lens (a poster cheat: against the sun the coins would read as dark specks)
	const glint = new THREE.Vector3(...shot.cam.pos).sub(new THREE.Vector3(0.7, 1.4, 0.4)).normalize().add(new THREE.Vector3(0, 0.25, 0)).normalize();
	return (
		<>
			<Sky />
			<SunLight target={[0, 0, -2]} extent={16} dist={60} />
			<Atmosphere near={30} far={320} />
			<TempleCourt templeZ={-150} templeX={-14} animals="none" stalls={false} />
			<group position={PIVOT} rotation={[0, TABLE_YAW, 0]}>
				<group rotation={[flipAngle(TAU, 0.1, 0.64), 0, 0]}>
					<Table seed={4} position={[0, 0, -0.42]} />
				</group>
			</group>
			<Coins coins={coverCoins()} glint={glint} size={1.35} />
			{/* warm bounce from the sunlit court, so the coins and the table read toward the lens */}
			<pointLight position={[1.0, 2.6, 2.6]} color="#FFC27A" intensity={10} distance={5.5} decay={1.2} />
			<Figure look={JESUS} pose={{...P.whipLow, lean: 0.06, near: {sh: -0.25, el: 0.35, hand: 'fist'}, far: {sh: 1.25, el: 0.12, hand: 'flat'}, hold: {item: 'whip', swing: -0.55}, yaw: 0.5, gaze: [0.35, 0.1]}} at={[-0.5, 0, 0]} res={2200} />
			<Dust box={[[-2, 0.2, -2], [2.5, 2.6, 2]]} count={140} size={0.03} opacity={0.6} />
		</>
	);
};

const COVER: SceneDef = {
	id: 'COVER',
	sunAz: 176, // just right of frame centre, well clear of His head (no halo)
	camera: () => ({pos: [0, 0.95, 7.6], target: [0, 1.67, 0], fov: 30}),
	post: (t, d, sun) => ({
		bloom: {intensity: 1.1, threshold: 0.7},
		dof: {focusDistance: 7.6, focusRange: 2.4, bokehScale: 3},
		vignette: {offset: 0.3, darkness: 0.6},
		grade: gradeFromSun(sun, {contrast: 1.06, saturation: 1.1}),
	}),
	Content: CoverContent,
};

// the reel's sun-on-a-line mark, as a divider
const SunRule: React.FC = () => {
	const rays = [-150, -120, -90, -60, -30].map((a) => {
		const r = (a * Math.PI) / 180;
		return `M${210 + 25 * Math.cos(r)} ${32 + 25 * Math.sin(r)} L${210 + 33 * Math.cos(r)} ${32 + 33 * Math.sin(r)}`;
	});
	return (
		<svg width={420} height={40} viewBox="0 0 420 40" style={{display: 'block', margin: '0 auto'}}>
			<path d={`M10 32 H180 M240 32 H410 ${rays.join(' ')}`} stroke={BRAND.gold} strokeWidth={3} strokeLinecap="round" fill="none" />
			<path d="M192 32 A18 18 0 0 1 228 32 Z" fill={BRAND.gold} />
		</svg>
	);
};

export const SunsetRuleCover: React.FC = () => (
	<FontGate>
		<AbsoluteFill style={{background: BRAND.night}}>
			<SceneView def={COVER} t={0} d={1} T={0} sunT={0.815} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 330, height: 640, background: 'linear-gradient(180deg, rgba(20,16,13,0), rgba(20,16,13,0.5) 28%, rgba(20,16,13,0.45) 72%, rgba(20,16,13,0))'}} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 430, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, fontSize: 132, lineHeight: 0.98, color: '#FFFFFF', letterSpacing: '0.02em', textShadow: '0 8px 30px rgba(0,0,0,0.6)'}}>
				JESUS GOT
				<br />
				<span style={{color: BRAND.gold, fontSize: 158}}>ANGRY.</span>
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 735}}>
				<SunRule />
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 778, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 70, letterSpacing: '0.05em', color: BRAND.cream, textShadow: '0 6px 24px rgba(0,0,0,0.6)'}}>IS ANGER A SIN?</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 1500, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, opacity: 0.85}}>
				<Logo size={36} />
				<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.2em', color: '#FFFFFF'}}>GRACE IN MOTION</span>
			</div>
		</AbsoluteFill>
	</FontGate>
);
