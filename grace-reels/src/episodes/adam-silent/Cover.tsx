// Cover (1080 x 1920). Everything important sits inside y 240-1680 (the 3:4 grid crop).
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CameraRig, Layer } from '../../kit-storybook/core/Camera';
import { EdenSet } from '../../kit-storybook/sets/Sets';
import { EDEN_DUSK } from '../../kit-storybook/paint/sets';
import { Character } from '../../kit-storybook/gl/Character';
import { GlowFruit } from '../../kit-storybook/fx/Props';
import { GodRays, Vignette } from '../../kit-storybook/fx/Light';
import { Dust, Bokeh } from '../../kit-storybook/fx/Particles';
import { CREAM, GOLD, SERIF, useFonts } from '../../kit-storybook/text/fonts';
import { PAIR_REACH, LOOK } from './chars';

const SHADOW = '0 0 30px rgba(0,0,0,0.65), 0 3px 10px rgba(0,0,0,0.55)';

export const Cover: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <CameraRig cam={{ x: 30, y: -170, zoom: 1.0, focus: 1, aperture: 8 }}>
        <EdenSet p={EDEN_DUSK} name="dusk" branchTip={[915, 605]} grass={1340} grassDepth={1}>
          <Layer depth={1}>
            <Character spec={PAIR_REACH} x={440} y={1900} h={1450} look={LOOK.dusk} blink={0} seed={2} />
            <GlowFruit x={915} y={640} r={24} intensity={1.25} />
          </Layer>
        </EdenSet>
        <GodRays id="cover" x={1180} y={860} angle={Math.PI * 0.88} spread={0.5} opacity={0.32} />
        <Bokeh seed={4} count={10} opacity={0.6} />
        <Dust seed={5} count={50} />
      </CameraRig>
      <Vignette strength={0.45} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,6,16,0.7) 0%, rgba(10,6,16,0.35) 22%, rgba(10,6,16,0) 34%)' }} />
      <div style={{ position: 'absolute', top: 262, left: 60, width: 960, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, lineHeight: 1.0 }}>
        <div style={{ fontSize: 90, letterSpacing: '0.05em', color: CREAM, textShadow: SHADOW }}>WHY DIDN&apos;T ADAM</div>
        <div style={{ fontSize: 122, letterSpacing: '0.05em', color: GOLD, marginTop: 10, textShadow: `0 0 34px rgba(226,178,90,0.55), ${SHADOW}` }}>STOP HER?</div>
      </div>
      <div style={{ position: 'absolute', top: 1596, left: 60, width: 960, textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: 36, letterSpacing: '0.24em', color: 'rgba(243,236,223,0.88)', textShadow: SHADOW }}>
        ✦&nbsp;&nbsp;GENESIS 3:6&nbsp;&nbsp;✦
      </div>
    </AbsoluteFill>
  );
};
