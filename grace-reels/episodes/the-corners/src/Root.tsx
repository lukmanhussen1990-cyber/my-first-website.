import {Composition, Still} from 'remotion';
import {TheCorners} from './Main';
import {TL} from './lib/timeline';
import {CastSheet} from './CastSheet';
import {FieldTest} from './FieldTest';
import {HandTest} from './HandTest';
import {Cover} from './Cover';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="TheCorners" component={TheCorners} durationInFrames={TL.durationInFrames} fps={TL.fps} width={1080} height={1920} defaultProps={{preview: false}} />
    <Still id="CastSheet" component={CastSheet} width={1080} height={1920} />
    <Still id="FieldTest" component={FieldTest as any} width={1080} height={1920} defaultProps={{shot: 'S1', t: 2.0}} />
    <Still id="Cover" component={Cover} width={1080} height={1920} />
    <Still id="HandTest" component={HandTest} width={1080} height={1920} />
  </>
);
