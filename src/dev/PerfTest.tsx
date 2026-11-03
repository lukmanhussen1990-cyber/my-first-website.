import React from 'react';
import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {Stage, LOOKS} from '../lib/Stage';
import {Post} from '../lib/Post';
import {CameraRig} from '../lib/CameraRig';
import {plastic, rbox, glowMat, sphere, box} from '../lib/materials';
import {hash} from '../lib/random';

export const PerfTest: React.FC<{post: boolean}> = ({post}) => {
	const {width, height} = useVideoConfig();
	const frame = useCurrentFrame();
	const cols = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45'];
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<ThreeCanvas width={width} height={height} shadows={{enabled: true, type: THREE.PCFShadowMap}} gl={{antialias: false}}>
				<Stage look={LOOKS.morning} shadowSize={14}>
					<mesh geometry={box(80, 0.2, 80)} material={plastic('#9bd36b')} position={[0, -0.1, 0]} receiveShadow />
					{Array.from({length: 200}).map((_, i) => (
						<mesh key={i} geometry={rbox(1, 1 + hash(i, 1) * 2, 1, 0.1)} material={plastic(cols[i % cols.length])}
							position={[(hash(i, 2) - 0.5) * 20, 1, (hash(i, 3) - 0.5) * 20 - 4]} rotation={[0, frame * 0.05 + i, 0]} castShadow receiveShadow />
					))}
					{Array.from({length: 12}).map((_, i) => (
						<mesh key={'g' + i} geometry={sphere(0.25)} material={glowMat('#ffd27a', 3)} position={[(i - 6) * 1.2, 3.5, 2]} />
					))}
				</Stage>
				<CameraRig pos={[0, 5, 14]} target={[0, 1.5, 0]} fov={50} />
				{post ? <Post /> : null}

			</ThreeCanvas>
		</AbsoluteFill>
	);
};
