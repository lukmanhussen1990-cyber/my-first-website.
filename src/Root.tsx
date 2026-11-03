import React from 'react';
import {Composition} from 'remotion';
import {PerfTest} from './dev/PerfTest';
import {CharTest} from './dev/CharTest';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition id="PerfTest" component={PerfTest} durationInFrames={120} fps={30} width={1080} height={1920} defaultProps={{post: true}} />
			<Composition id="CharTest" component={CharTest} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{view: 'kid' as const}} />
		</>
	);
};
