import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BigHand} from './chars/BigHand';

export const HandTest: React.FC = () => (
  <AbsoluteFill style={{background: '#D9A866'}}>
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      {[0, 0.35, 0.7, 1].map((o, i) => (
        <g key={i} transform={`translate(560 ${260 + i * 450}) scale(1.1)`}>
          <BigHand open={o} skin="#B47A52" skinShade="#93603F" sleeve="#E2D3B0" sleeveShade="#C2B08A" grains />
        </g>
      ))}
    </svg>
  </AbsoluteFill>
);
