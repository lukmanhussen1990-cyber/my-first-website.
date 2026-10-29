import {Composition, Still} from 'remotion';
import {FontGate} from './lib/fonts';
import {Reel} from './Reel';
import {Cover} from './Cover';
import {timeline} from './lib/time';

const withFonts = (C: React.FC) => () => <FontGate><C /></FontGate>;

export const Root = () => (
  <>
    <Composition id="Reel" component={withFonts(Reel)} durationInFrames={timeline.durationInFrames} fps={30} width={1080} height={1920} />
    <Still id="Cover" component={withFonts(Cover)} width={1080} height={1920} />
  </>
);
