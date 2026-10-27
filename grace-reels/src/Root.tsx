import React from 'react';
import {Composition} from 'remotion';
import {PerfTest} from '../scratch/PerfTest';
import {Lab} from '../scratch/Lab';
import {SunsetRule} from '../episodes/sunset-rule/src/Episode';
import {TL} from '../episodes/sunset-rule/src/timeline';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="PerfTest" component={PerfTest} durationInFrames={60} fps={30} width={1080} height={1920} />
		<Composition id="PerfTestNoPost" component={PerfTest} defaultProps={{post: false}} durationInFrames={60} fps={30} width={1080} height={1920} />
		<Composition id="Fxsmaa" component={PerfTest} defaultProps={{fx: "smaa"}} durationInFrames={60} fps={30} width={1080} height={1920} />
		<Composition id="Fxbloom" component={PerfTest} defaultProps={{fx: "bloom"}} durationInFrames={60} fps={30} width={1080} height={1920} />
		<Composition id="Fxu8" component={PerfTest} defaultProps={{fx: "dof,bloom,u8"}} durationInFrames={60} fps={30} width={1080} height={1920} />
		<Composition id="Fxdof" component={PerfTest} defaultProps={{fx: "dof"}} durationInFrames={60} fps={30} width={1080} height={1920} />
		<Composition id="Lab" component={Lab} durationInFrames={1} fps={30} width={1080} height={1920} />
		<Composition id="SunsetRule" component={SunsetRule} durationInFrames={TL.durationInFrames} fps={30} width={1080} height={1920} />
	</>
);
