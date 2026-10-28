import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Person} from './chars/Person';
import * as C from './chars/cast';

export const CastSheet: React.FC = () => {
  const t = useCurrentFrame() / 30;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(#E9C48A, #C98E4E)'}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        <g>
          <Person look={C.RUTH} pose={C.walkPose(1.2, 0.7)} face={{brow: 'sad', mouth: 'sad', eyeStyle: 'down'}} x={130} y={560} scale={0.75} t={t} front={{kind: 'basket', fill: 0}} />
          <Person look={C.RUTH} pose={{...C.STAND, shF: 30, elF: 70}} face={{brow: 'brave', mouth: 'talk', mouthOpen: 0.6}} x={330} y={560} scale={0.75} t={t} />
          <Person look={C.RUTH} pose={C.BEND} face={{brow: 'kind', mouth: 'soft', eyeStyle: 'down'}} x={560} y={560} scale={0.75} t={t} front={{kind: 'grain'}} />
          <Person look={C.RUTH} pose={{...C.STAND, shF: -40, elF: 60, shB: 40, elB: 60}} face={{brow: 'raised', mouth: 'bigSmile', eyeStyle: 'wide'}} x={790} y={560} scale={0.75} t={t} />
          <Person look={C.RUTH} pose={C.STAND} face={{brow: 'happy', mouth: 'smile', eyeStyle: 'happy'}} cradle={{kind: 'baby'}} x={960} y={560} scale={0.75} t={t} />
        </g>
        <g>
          <Person look={C.NAOMI} pose={C.walkPose(0.3, 0.6, 9)} face={{brow: 'sad', mouth: 'sad', eyeStyle: 'down'}} x={110} y={1060} scale={0.7} t={t} />
          <Person look={C.NAOMI} pose={C.SIT} face={{brow: 'kind', mouth: 'soft'}} x={290} y={1060} scale={0.7} t={t} flip />
          <Person look={C.BOAZ} pose={{...C.STAND, shF: 150, elF: 20}} face={{brow: 'kind', mouth: 'smile'}} x={480} y={1060} scale={0.78} t={t} />
          <Person look={C.BOAZ} pose={{...C.STAND, lean: 10, head: 8, shF: 20, elF: 140}} face={{brow: 'sly', mouth: 'whisper'}} x={680} y={1060} scale={0.78} t={t} flip />
          <Person look={C.REAPER_A} pose={{...C.walkPose(0.5, 0.5, 20), shF: -60, elF: 40}} face={{brow: 'neutral', mouth: 'soft'}} x={830} y={1060} scale={0.72} t={t} front={{kind: 'sickle', angle: -40}} />
          <Person look={C.REAPER_B} pose={{...C.STAND, shB: -30, elB: 10}} face={{brow: 'sly', mouth: 'sly', lookX: -1}} x={990} y={1060} scale={0.72} t={t} back={{kind: 'grain'}} />
        </g>
        <g>
          <Person look={C.MOTHER} pose={C.walkPose(0.9, 0.6)} face={{brow: 'worried', mouth: 'soft'}} x={110} y={1560} scale={0.7} t={t} front={{kind: 'basket', fill: 0.2}} />
          <Person look={C.CHILD} pose={C.walkPose(2.0, 0.7)} face={{brow: 'happy', mouth: 'smile'}} x={210} y={1560} scale={0.42} t={t} />
          <Person look={C.OLD_MAN} pose={{...C.STAND, lean: 10}} face={{brow: 'kind', mouth: 'smile'}} x={330} y={1560} scale={0.7} t={t} front={{kind: 'stick'}} />
          <Person look={C.TRAVELER} pose={C.walkPose(1.6, 0.8)} face={{brow: 'happy', mouth: 'smile'}} x={470} y={1560} scale={0.7} t={t} onBack={{kind: 'bundle'}} front={{kind: 'basket', fill: 1}} />
          <Person look={C.JESUS} pose={C.CROSS} face={{brow: 'kind', mouth: 'smile', lookX: 1}} x={600} y={1560} scale={0.7} t={t} front={{kind: 'breadHalf'}} />
          <Person look={C.DAVID} pose={C.STAND} face={{brow: 'happy', mouth: 'smile'}} x={760} y={1560} scale={0.55} t={t} front={{kind: 'staff'}} back={{kind: 'harp'}} />
          <Person look={C.HELPER} pose={C.CROUCH} face={{brow: "kind", mouth: "smile"}} x={780} y={1560} scale={0.7} t={t} front={{kind: 'mealbox'}} />
          <Person look={C.IN_NEED} pose={C.CROSS} face={{brow: 'raised', mouth: 'smile'}} x={1000} y={1560} scale={0.7} t={t} flip />
        </g>
        <Person look={C.JESSE} pose={C.STAND} face={{brow: 'kind', mouth: 'smile'}} x={120} y={1880} scale={0.5} t={t} front={{kind: 'staff'}} />
        <Person look={C.OBED_MAN} pose={C.STAND} face={{brow: 'kind', mouth: 'smile'}} x={260} y={1880} scale={0.5} t={t} />
        <Person look={C.POOR_MAN} pose={C.CROSS} face={{brow: 'worried', mouth: 'soft'}} x={420} y={1880} scale={0.5} t={t} flip />
        <Person look={C.RUTH_BRIDE} pose={C.STAND} face={{brow: 'happy', mouth: 'smile', eyeStyle: 'happy'}} x={560} y={1880} scale={0.5} t={t} />
      </svg>
    </AbsoluteFill>
  );
};
