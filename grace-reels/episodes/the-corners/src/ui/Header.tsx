import React from 'react';
import {SANS, TEXT} from '../lib/theme';
import {Logo} from './Logo';

export const Header: React.FC<{opacity: number}> = ({opacity}) => {
  const text: React.CSSProperties = {
    fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: TEXT,
    textShadow: '0 1px 6px rgba(0,0,0,0.45)',
  };
  return (
    <div style={{position: 'absolute', left: 72, right: 120, top: 150 - 16, height: 32, opacity: opacity * 0.75, display: 'flex', alignItems: 'center'}}>
      <Logo size={30} />
      <span style={{...text, marginLeft: 12}}>Grace In Motion</span>
      <span style={{...text, marginLeft: 'auto'}}>The Corners</span>
    </div>
  );
};
