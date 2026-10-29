import React from 'react';
import {
  C, FlameIcon, FogPanel, GROUND_Y, GroundLine, InsuranceDoc, Label, PegPerson, QuestionCircle, Sky, ThoughtBubble,
  pop, prog, pushIn,
} from '../../../../src/kit-flat';
import {A} from '../data.ts';

const YOU_X = 400;

/**
 * S1–S3: YOU kneeling at night with a flame thought bubble, the fire
 * insurance policy, then the big "?". `frame` is the reel frame.
 */
export const OpeningWorld: React.FC<{frame: number; still?: boolean}> = ({frame, still = false}) => {
  const z = still ? 1 : pushIn(frame, 0, A.storm, 1.06);
  // thought bubble: pops in, shrinks away when the "?" arrives
  const bubbleIn = still ? 0 : pop(frame, A.thoughtPop, 10);
  const bubbleOut = prog(frame, A.docOut, 8);
  const bubble = bubbleIn * (1 - bubbleOut);
  // document
  const dropT = prog(frame, A.docDrop, 12);
  const docY = 900 - (1 - dropT) * 1200;
  const docSettle = frame >= A.docLand && frame < A.docLand + 8 ? Math.sin(((frame - A.docLand) / 8) * Math.PI) * 6 : 0;
  const stampT = frame >= A.stamp ? prog(frame, A.stamp, 5) : 0;
  const thump = frame >= A.stamp + 4 && frame < A.stamp + 10 ? Math.sin(((frame - A.stamp - 4) / 6) * Math.PI) * 5 : 0;
  const docOpacity = 1 - prog(frame, A.docOut, 10);
  const q = pop(frame, A.qPop, 11);
  const youLabel = 1;

  return (
    <g transform={`translate(${YOU_X},1150) scale(${z}) translate(${-YOU_X},-1150)`}>
      <Sky kind="night" frame={frame} moon={{x: 850, y: 600, r: 100}} />
      <FogPanel />
      <GroundLine />
      <PegPerson x={YOU_X} y={GROUND_Y} scale={1.2} robe={C.youBlue} pose="pray" tremble={0.75} frame={frame} seed="you" />
      <Label x={YOU_X} y={742} text="YOU" tone="green" size={50} opacity={youLabel} />
      {bubble > 0 ? (
        <ThoughtBubble x={600} y={540} w={240} tip={{x: -170, y: 200}} scale={bubble}>
          <FlameIcon x={0} y={4} scale={0.85} frame={frame} />
        </ThoughtBubble>
      ) : null}
      {dropT > 0 && docOpacity > 0 ? (
        <g opacity={docOpacity}>
          <InsuranceDoc x={790} y={docY + docSettle + thump} rotate={-5 + (1 - dropT) * 14} scale={0.78} stamp={stampT} />
        </g>
      ) : null}
      {q > 0 ? <QuestionCircle x={470} y={560} scale={q * 0.95} /> : null}
    </g>
  );
};
