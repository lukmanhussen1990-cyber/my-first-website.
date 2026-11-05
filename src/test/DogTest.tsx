import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {AssetGate} from '../AssetGate';
import {Dog, DogEmotion, DogPose} from '../characters/Dog';
import {V3} from '../lib/anim';
import {POPPINS} from '../lib/fonts';
import {Cam} from '../three/Cam';
import {Clouds, Lights, Sky} from '../three/prims';
import {noiseTex} from '../three/textures';
import {plastic} from '../three/cache';
import {Stage3D} from '../three/Stage3D';

export type DogTestProps = {emotion: DogEmotion; pose: DogPose; cam: 'face' | 'full' | 'side'; label: string; medal?: boolean};

const Scene: React.FC<DogTestProps> = ({emotion, pose, cam, medal}) => {
	const frame = useCurrentFrame();
	const t = frame / 30;
	const camPos: Record<string, [V3, V3, number]> = {
		face: [[0.8, 3.5, 11.5], [0, 2.75, 1.3], 34],
		full: [[5.5, 3.6, 9.5], [0, 1.9, 0.3], 36],
		side: [[9, 3.2, 3.5], [0, 1.6, 0.2], 36],
	};
	const [pos, target, fov] = camPos[cam];
	return (
		<>
			<Sky preset="day" />
			<Clouds n={12} radius={260} y={90} />
			<Lights preset="day" size={12} />
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('grass1', '#7cc95a', '#5fae45', 'grass', 30), rough: 0.95})}>
				<planeGeometry args={[400, 400]} />
			</mesh>
			<Dog t={t} pose={pose} emotion={emotion} medal={medal} />
			<Cam pos={pos} target={target} fov={fov} t={t} sway={0} />
		</>
	);
};

export const DogTest: React.FC<DogTestProps> = (props) => (
	<AbsoluteFill>
		<AssetGate>
			<Stage3D fx={{bg: '#8fd3ff'}}>
				<Scene {...props} />
			</Stage3D>
		</AssetGate>
		<div style={{position: 'absolute', top: 60, width: '100%', textAlign: 'center', fontFamily: POPPINS, fontWeight: 800, fontSize: 70, color: 'white', WebkitTextStroke: '10px black', paintOrder: 'stroke'}}>{props.label}</div>
	</AbsoluteFill>
);
