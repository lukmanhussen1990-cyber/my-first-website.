import {Composition} from 'remotion';
import {DURATION_FRAMES, FPS} from './lib/timeline';
import {Reel} from './Reel';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Reel" component={Reel} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{lite: false}} />
		<Composition id="Animatic" component={Reel} durationInFrames={DURATION_FRAMES} fps={FPS} width={540} height={960} defaultProps={{lite: true}} />
	</>
);
