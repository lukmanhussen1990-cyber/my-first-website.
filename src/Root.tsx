import React from 'react';
import {Composition} from 'remotion';
import {FlushKing} from './Video';
import {CharTest} from './dev/CharTest';
import {TOTAL_FRAMES, FPS} from './timing';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition id="FlushKing" component={FlushKing} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{captions: true, sfx: true}} />
			<Composition id="CharTest" component={CharTest} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{view: 'kid' as const}} />
		</>
	);
};
