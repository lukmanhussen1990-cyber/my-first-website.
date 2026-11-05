import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {AssetGate} from '../AssetGate';
import {GIRL, MOM, OLD_MAYOR, OWNER, REPORTER, townsperson} from '../characters/cast';
import {Expr} from '../characters/faces';
import {Look, Person} from '../characters/Person';
import {V3} from '../lib/anim';
import {POPPINS} from '../lib/fonts';
import {plastic} from '../three/cache';
import {Cam} from '../three/Cam';
import {Clouds, Lights, Sky} from '../three/prims';
import {noiseTex} from '../three/textures';
import {Stage3D} from '../three/Stage3D';

export type PeopleTestProps = {who: 'owner' | 'mayor' | 'girl' | 'mom' | 'reporter' | 'crowd'; expr: Expr; label: string; cam: 'face' | 'full'; talking?: boolean};

const LOOKS: Record<string, Look> = {owner: OWNER, mayor: OLD_MAYOR, girl: GIRL, mom: MOM, reporter: REPORTER};

const Scene: React.FC<PeopleTestProps> = ({who, expr, cam, talking}) => {
	const frame = useCurrentFrame();
	const t = frame / 30;
	const isGirl = who === 'girl';
	const tall = who === 'mayor' ? 1.12 : isGirl ? 0.66 : 1;
	const faceY = 4.75 * tall;
	const camPos: Record<string, [V3, V3, number]> = {
		face: [[1.2, faceY + 0.5, 7.5 * (isGirl ? 0.8 : 1)], [0, faceY - 0.5, 0], 36],
		full: [[3.5, 4.2 * tall, 15 * (isGirl ? 0.75 : 1)], [0, 2.7 * tall, 0], 38],
	};
	const [pos, target, fov] = who === 'crowd' ? ([[0, 6, 22], [0, 3, 0], 40] as [V3, V3, number]) : camPos[cam];
	return (
		<>
			<Sky preset="day" />
			<Clouds n={12} radius={260} y={90} />
			<Lights preset="day" size={14} />
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('grass1', '#7cc95a', '#5fae45', 'grass', 30), rough: 0.95})}>
				<planeGeometry args={[400, 400]} />
			</mesh>
			{who === 'crowd' ? (
				Array.from({length: 7}).map((_, i) => <Person key={i} look={townsperson(i + 1)} t={t} seed={i + 3} expr={(['happy', 'laugh', 'bored', 'shocked', 'worried', 'sleep', 'cryHappy'] as Expr[])[i]} position={[(i - 3) * 2.6, 0, -Math.abs(i - 3) * 0.8]} />)
			) : (
				<Person look={LOOKS[who]} t={t} expr={expr} talking={talking} hold={isGirl ? 'teddy' : null} pose={isGirl ? {armL: [-0.9, 0, 0.5], armR: [-0.9, 0, -0.5]} : undefined} scale={isGirl ? 0.66 : 1} />
			)}
			<Cam pos={pos} target={target} fov={fov} t={t} sway={0} />
		</>
	);
};

export const PeopleTest: React.FC<PeopleTestProps> = (props) => (
	<AbsoluteFill>
		<AssetGate>
			<Stage3D fx={{bg: '#8fd3ff'}}>
				<Scene {...props} />
			</Stage3D>
		</AssetGate>
		<div style={{position: 'absolute', top: 60, width: '100%', textAlign: 'center', fontFamily: POPPINS, fontWeight: 800, fontSize: 70, color: 'white', WebkitTextStroke: '10px black', paintOrder: 'stroke'}}>{props.label}</div>
	</AbsoluteFill>
);
