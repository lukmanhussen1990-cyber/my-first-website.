import {Composition} from 'remotion';
import {Sheet} from './Sheet';
import {Test} from './Test';
import {Reel} from './Reel';
import {DURATION_FRAMES} from './lib/timeline';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Sheet" component={Sheet} durationInFrames={1} fps={30} width={2400} height={1500} />
		<Composition id="Test" component={Test} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{which: 'FIELD'}} />
		<Composition id="TestNoWheat" component={Test} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{which: 'NOWHEAT'}} />
		<Composition id="TestNight" component={Test} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{which: 'NIGHT'}} />
		<Composition id="Reel" component={Reel} durationInFrames={DURATION_FRAMES} fps={30} width={1080} height={1920} defaultProps={{lite: false, muted: true}} />
		<Composition id="Draft" component={Reel} durationInFrames={DURATION_FRAMES} fps={30} width={1080} height={1920} defaultProps={{lite: false, muted: true, noText: true}} />
		<Composition id="SheetClose" component={Sheet} durationInFrames={1} fps={30} width={2400} height={900} defaultProps={{close: true}} />
	</>
);
