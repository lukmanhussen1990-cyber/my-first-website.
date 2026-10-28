import {Composition} from 'remotion';
import {Sheet} from './Sheet';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Sheet" component={Sheet} durationInFrames={1} fps={30} width={2400} height={1500} />
		<Composition id="SheetClose" component={Sheet} durationInFrames={1} fps={30} width={2400} height={900} defaultProps={{close: true}} />
	</>
);
