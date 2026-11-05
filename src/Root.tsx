import {Composition} from 'remotion';
import {TOTAL_FRAMES} from './lib/timing';
import {DogTest, DogTestProps} from './test/DogTest';
import {PeopleTest, PeopleTestProps} from './test/PeopleTest';
import {Video} from './Video';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="DogMayor" component={Video} width={1080} height={1920} fps={30} durationInFrames={TOTAL_FRAMES} defaultProps={{captions: true, audio: true}} />
		{/* QA flip-book: every 6th frame, low resolution, no audio */}
		<Composition id="Check" component={Video} width={1080} height={1920} fps={30} durationInFrames={Math.ceil(TOTAL_FRAMES / 6)} defaultProps={{captions: true, audio: false, preview: true, step: 6}} />
		<Composition
			id="DogTest"
			component={DogTest}
			width={1080}
			height={1920}
			fps={30}
			durationInFrames={90}
			defaultProps={{emotion: 'normal', pose: 'stand', cam: 'face', label: 'normal'} as DogTestProps}
		/>
		<Composition
			id="PeopleTest"
			component={PeopleTest}
			width={1080}
			height={1920}
			fps={30}
			durationInFrames={90}
			defaultProps={{who: 'owner', expr: 'neutral', label: 'me', cam: 'full'} as PeopleTestProps}
		/>
	</>
);
