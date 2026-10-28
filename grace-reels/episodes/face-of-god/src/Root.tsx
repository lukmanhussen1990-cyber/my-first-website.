import {Composition} from 'remotion';
import {DURATION_FRAMES, FPS, TL} from './lib/timeline';
import {Reel} from './Reel';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Reel" component={Reel} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{lite: false}} />
		<Composition id="Animatic" component={Reel} durationInFrames={DURATION_FRAMES} fps={FPS} width={540} height={960} defaultProps={{lite: true}} />
		{/* the thumbnail: Moses on the stormy ledge, his hand raised into the light, with the title */}
		<Composition id="Cover" component={Reel} durationInFrames={1} fps={FPS} width={1080} height={1920} defaultProps={{lite: false, cover: true, atTime: 1.4, only: "HOOK"}} />
		{/* quick draft for sharing progress: half size, 15 fps, light effects */}
		<Composition id="Draft" component={Reel} durationInFrames={Math.round(TL.durationInSeconds * 15)} fps={15} width={540} height={960} defaultProps={{lite: true}} />
	</>
);
