import React from 'react';
import {Composition} from 'remotion';
import {FlushKing} from './Video';
import {CharTest} from './dev/CharTest';
import {TOTAL_FRAMES, FPS} from './timing';
import {Birthday} from './birthday/Birthday';
import {TOTAL_FRAMES as BDAY_FRAMES} from './birthday/timing';
import {BobVideo} from './bob/BobVideo';
import {TOTAL_FRAMES as BOB_FRAMES} from './bob/timing';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition id="FlushKing" component={FlushKing} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{captions: true, sfx: true}} />
			<Composition id="Birthday" component={Birthday} durationInFrames={BDAY_FRAMES} fps={30} width={1080} height={1920} defaultProps={{captions: true, voice: true}} />
			<Composition id="Bob" component={BobVideo} durationInFrames={BOB_FRAMES} fps={30} width={1080} height={1920} defaultProps={{captions: true, voice: true}} />
			<Composition id="CharTest" component={CharTest} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{view: 'kid' as const}} />
		</>
	);
};
