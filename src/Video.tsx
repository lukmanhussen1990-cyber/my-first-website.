// The full short: one WebGL canvas, the active scene is picked from the frame number.
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {Post} from './lib/Post';
import {setQuality} from './lib/quality';
import {SCENES, sceneIndexAt, whipState} from './timing';
import {SCENE_DEFS} from './scenes';
import {Captions} from './Captions';
import {SFX} from './SFX';
import {poppins, POPPINS} from './lib/fonts';

/** wait for Poppins before drawing any text onto canvases */
export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
	const [ready, setReady] = useState(() => typeof document !== 'undefined' && document.fonts.check(`800 20px ${POPPINS}`));
	const [handle] = useState(() => (ready ? null : delayRender('Waiting for Poppins before drawing text textures')));
	useEffect(() => {
		if (ready || handle === null) return;
		poppins.waitUntilDone().then(() => {
			setReady(true);
			continueRender(handle);
		});
	}, [ready, handle]);
	return ready ? <>{children}</> : null;
};

export const FlushKing: React.FC<{captions?: boolean; sfx?: boolean; previewScale?: number}> = ({captions = true, sfx = true, previewScale}) => {
	setQuality(previewScale ? {dpr: previewScale, shadowMap: 1024} : {dpr: 1, shadowMap: 2048});
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const idx = sceneIndexAt(frame);
	const S = SCENES[idx];
	const def = SCENE_DEFS[idx];
	const f = frame - S.from;
	const post = def.post ? def.post(f) : {};
	const whip = whipState(frame);
	const Comp = def.Comp;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<AbsoluteFill style={{filter: whip.blur > 0.4 ? `blur(${whip.blur.toFixed(2)}px)` : undefined}}>
				<ThreeCanvas width={width} height={height} dpr={previewScale ?? 1} shadows={previewScale ? false : {enabled: true, type: THREE.PCFShadowMap}} gl={{antialias: false, powerPreference: 'high-performance'}}>
					<FontGate>
						<Comp key={idx} f={f} dur={S.dur} g={frame} />
						<Post {...post} />
					</FontGate>
				</ThreeCanvas>
			</AbsoluteFill>
			{def.overlay ? def.overlay(f, S.dur) : null}
			{captions ? <Captions /> : null}
			<Audio src={staticFile('voiceover.mp3')} />
			{sfx ? <SFX /> : null}
		</AbsoluteFill>
	);
};
