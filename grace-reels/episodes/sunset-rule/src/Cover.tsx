import React from 'react';
import * as THREE from 'three';
import {AbsoluteFill} from 'remotion';
import {Figure} from '../../../src/shared/three/Figure';
import {Coins, Dove, Table} from '../../../src/shared/three/props';
import {Dust} from '../../../src/shared/three/fx';
import {Sky, Clouds} from '../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../src/shared/three/world';
import {useShot} from '../../../src/shared/three/shot';
import {BRAND, SANS, SERIF} from '../../../src/shared/text/brand';
import {FontGate, Logo} from '../../../src/shared/text/Overlay';
import {TempleCourt} from './sets/Temple';
import {JESUS, P} from './cast';
import {coinBurst, doveBurst, flipAngle} from './action';
import {gradeFromSun, type SceneDef} from './sceneKit';
import {SceneView} from './Episode';

// Cover: Jesus beside a table going over, coins in the air, a big low sun behind.
const CoverContent: React.FC = () => {
	const shot = useShot();
	const tau = 0.62;
	const coins = coinBurst(tau, 11, [0.95, 0.84, 1.05], 70, 0.32);
	const doves = doveBurst(tau, 5, [-0.9, 1.1, -1.8], 11, 0.26, 0.5);
	const glint = shot.sunDir.clone().add(new THREE.Vector3(...shot.cam.pos).sub(new THREE.Vector3(1, 1.2, 0.8)).normalize()).normalize();
	return (
		<>
			<Sky />
			<Clouds clouds={[{az: 180, el: 9, size: 170, seed: 3}, {az: 160, el: 13, size: 120, seed: 8}, {az: 203, el: 6, size: 200, seed: 12}]} />
			<SunLight target={[0, 0, -2]} extent={16} dist={60} />
			<Atmosphere near={18} far={110} />
			<TempleCourt templeZ={-60} />
			<group position={[0.95, 0, 1.47]} rotation={[0, -0.75, 0]}>
				<group rotation={[flipAngle(tau, 0.1, 0.64), 0, 0]}>
					<Table seed={4} position={[0, 0, -0.42]} />
				</group>
			</group>
			<Coins coins={coins} glint={glint} />
			{doves.map((d, i) => (
				<Dove key={i} position={d.p} rotation={[0, d.yaw, 0]} flap={d.flap} bank={d.bank} scale={d.s} />
			))}
			<Figure look={JESUS} pose={{...P.whipLow, yaw: 0.55, gaze: [0.3, 0.05]}} at={[0, 0, 0]} res={2200} />
			<Dust box={[[-4, 0.2, -4], [4, 3.5, 3]]} count={140} size={0.035} opacity={0.6} />
		</>
	);
};

const COVER: SceneDef = {
	id: 'COVER',
	sunAz: 172, // low sun to the upper right, clear of His head (no halo)
	camera: () => ({pos: [0.55, 0.7, 6.6], target: [0.35, 2.3, 0], fov: 50}),
	post: (t, d, sun) => ({bloom: {intensity: 1.0, threshold: 0.75}, dof: {focusDistance: 6.6, focusRange: 2.6, bokehScale: 2.6}, vignette: {offset: 0.3, darkness: 0.55}, grade: gradeFromSun(sun, {contrast: 1.08, saturation: 1.12})}),
	Content: CoverContent,
};

export const SunsetRuleCover: React.FC = () => (
	<FontGate>
		<AbsoluteFill style={{background: BRAND.night}}>
			<SceneView def={COVER} t={0} d={1} T={0} sunT={0.6} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 330, height: 640, background: 'linear-gradient(180deg, rgba(20,16,13,0), rgba(20,16,13,0.5) 30%, rgba(20,16,13,0.45) 70%, rgba(20,16,13,0))'}} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 410, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, fontSize: 132, lineHeight: 0.98, color: '#FFFFFF', letterSpacing: '0.02em', textShadow: '0 8px 30px rgba(0,0,0,0.6)'}}>
				JESUS GOT
				<br />
				<span style={{color: BRAND.gold, fontSize: 158}}>ANGRY.</span>
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 770, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 82, color: BRAND.cream, textShadow: '0 6px 24px rgba(0,0,0,0.6)'}}>Is anger a sin?</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 1500, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, opacity: 0.85}}>
				<Logo size={36} />
				<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.2em', color: '#FFFFFF'}}>GRACE IN MOTION</span>
			</div>
		</AbsoluteFill>
	</FontGate>
);
