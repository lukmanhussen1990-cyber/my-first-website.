import {Composition} from 'remotion';
import {Spike} from './spike/Spike';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Spike" component={Spike} durationInFrames={60} fps={30} width={1080} height={1920} />
	</>
);
