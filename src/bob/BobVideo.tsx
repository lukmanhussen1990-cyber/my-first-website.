// The Bob short: one WebGL canvas, the active scene is picked from the frame number.
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {Post} from '../lib/Post';
import {setQuality} from '../lib/quality';
import {SCENES, sceneIndexAt, whipAt} from './timing';
import {SCENE_DEFS} from './scenes';
import {BobCaptions} from './Captions';
import {poppins, POPPINS} from '../lib/fonts';
import {caveat, CAVEAT} from '../birthday/fonts';

const Fonts: React.FC<{children: React.ReactNode}> = ({children}) => {
	const ok = () => typeof document !== 'undefined' && document.fonts.check(`800 20px ${POPPINS}`) && document.fonts.check(`700 20px ${CAVEAT}`);
	const [ready, setReady] = useState(ok);
	const [handle] = useState(() => (ready ? null : delayRender('Waiting for fonts before drawing text textures')));
	useEffect(() => {
		if (ready || handle === null) return;
		Promise.all([poppins.waitUntilDone(), caveat.waitUntilDone()]).then(() => {
			setReady(true);
			continueRender(handle);
		});
	}, [ready, handle]);
	return ready ? <>{children}</> : null;
};

export const BobVideo: React.FC<{captions?: boolean; voice?: boolean; previewScale?: number}> = ({captions = true, voice = true, previewScale}) => {
	setQuality(previewScale ? {dpr: previewScale, shadowMap: 1024, whips: false} : {dpr: 1, shadowMap: 2048, whips: false});
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const idx = sceneIndexAt(frame);
	const S = SCENES[idx];
	const def = SCENE_DEFS[idx];
	const f = frame - S.from;
	const post = def.post ? def.post(f) : {};
	const whip = whipAt(frame);
	const Comp = def.Comp;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<AbsoluteFill style={{transform: whip.blur > 0.3 ? `translateX(${whip.x}px) scale(1.06)` : undefined, filter: whip.blur > 0.3 ? `blur(${whip.blur.toFixed(1)}px)` : undefined}}>
				<ThreeCanvas width={width} height={height} dpr={previewScale ?? 1} shadows={previewScale ? false : {enabled: true, type: THREE.PCFShadowMap}} gl={{antialias: false, powerPreference: 'high-performance'}}>
					<Fonts>
						<Comp key={idx} f={f} dur={S.dur} g={frame} />
						<Post bloom={0.7} threshold={0.86} vignette={0.36} {...post} />
					</Fonts>
				</ThreeCanvas>
			</AbsoluteFill>
			{def.overlay ? def.overlay(f, S.dur) : null}
			{captions ? <BobCaptions /> : null}
			{voice ? <Audio src={staticFile('bob/voiceover.mp3')} /> : null}
		</AbsoluteFill>
	);
};
