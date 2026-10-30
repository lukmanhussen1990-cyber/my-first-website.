// Style test: three painted sets with a character in each (frames 0, 1, 2).
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { CameraRig, Layer } from '../../kit-storybook/core/Camera';
import { EdenSet, GethSet, RoomSet } from '../../kit-storybook/sets/Sets';
import { EDEN_DUSK } from '../../kit-storybook/paint/sets';
import { Character } from '../../kit-storybook/gl/Character';
import { Dust } from '../../kit-storybook/fx/Particles';
import { GlowFruit } from '../../kit-storybook/fx/Props';
import { Vignette, GodRays } from '../../kit-storybook/fx/Light';
import { PAIR_REACH, JESUS_KNEEL, MAN, LOOK, manArm, ADAM_CU, EVE_CU, JESUS_CU } from './chars';
import { useFonts } from '../../kit-storybook/text/fonts';

export const StyleTest: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Sequence from={0} durationInFrames={1}>
        <CameraRig cam={{ x: 0, y: 0, zoom: 1, focus: 1, aperture: 10 }}>
          <EdenSet p={EDEN_DUSK} name="dusk" branchTip={[915, 605]} grass={1400}>
            <Layer depth={1}>
              <Character spec={PAIR_REACH} x={440} y={1900} h={1450} look={LOOK.dusk} blink={0} />
              <GlowFruit x={915} y={640} r={22} />
            </Layer>
          </EdenSet>
          <GodRays id="test-dusk" x={1150} y={850} angle={Math.PI * 0.86} spread={0.5} opacity={0.35} />
          <Dust seed={3} count={50} />
          <Vignette />
        </CameraRig>
      </Sequence>
      <Sequence from={1} durationInFrames={1}>
        <CameraRig cam={{ x: 0, y: 0, zoom: 1, focus: 1, aperture: 6 }}>
          <RoomSet time="night">
            <Layer depth={1}>
              <Character spec={MAN} x={443} y={1860} h={1352} anchor={[0.5, 0.955]} look={LOOK.night} bones={[manArm(-35)]} blink={0} />
            </Layer>
          </RoomSet>
          <Vignette strength={0.6} />
        </CameraRig>
      </Sequence>
      <Sequence from={2} durationInFrames={1}>
        <CameraRig cam={{ x: 0, y: 40, zoom: 1.05, focus: 0.95, aperture: 10 }}>
          <GethSet>
            <Layer depth={0.95}>
              <Character spec={JESUS_KNEEL} x={540} y={1690} h={980} look={LOOK.moon} blink={0} />
            </Layer>
          </GethSet>
          <Dust seed={9} count={30} color="190,205,255" />
          <Vignette strength={0.65} />
        </CameraRig>
      </Sequence>
      <Sequence from={3} durationInFrames={1}>
        <AbsoluteFill style={{ background: '#222' }}>
          {[ADAM_CU, EVE_CU, JESUS_CU].map((spec, i) => (
            <React.Fragment key={i}>
              <div style={{ position: 'absolute', left: 0, top: i * 640, width: 1080, height: 640, overflow: 'hidden' }}>
                <Character spec={spec} x={300} y={1450} h={1536} blink={0} />
                <Character spec={spec} x={800} y={1450} h={1536} blink={1} />
              </div>
            </React.Fragment>
          ))}
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
