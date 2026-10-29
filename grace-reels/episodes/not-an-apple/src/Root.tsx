import {Composition} from 'remotion';
import {FontGate} from './lib/fonts';
import {TestEden, TestFace} from './scenes/TestEden';

const withFonts = (C: React.FC) => () => <FontGate><C /></FontGate>;

export const Root = () => (
  <>
    <Composition id="TestFace" component={withFonts(TestFace)} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="TestEden" component={withFonts(TestEden)} durationInFrames={60} fps={30} width={1080} height={1920} />
  </>
);
