import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BRAND, SANS, SERIF} from '../../../src/shared/text/brand';
import {FontGate, Logo} from '../../../src/shared/text/Overlay';
import {SceneView, H} from './View';
import {S08L, S08R} from './scenes/S08to12';
import {BLUE} from './texts';

// Cover: a split. Daniel kneeling in gold light with "3"; the phone in cold blue with "100+".
const Big: React.FC<{text: string; color: string; glow: string; x: number}> = ({text, color, glow, x}) => (
	<div style={{position: 'absolute', left: x, width: 540, top: 300, textAlign: 'center'}}>
		<div style={{height: 290, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontWeight: 700, fontSize: text.length > 2 ? 200 : 290, lineHeight: 1, fontVariantNumeric: 'lining-nums', color, textShadow: `0 0 60px ${glow}, 0 12px 40px rgba(0,0,0,0.55)`}}>{text}</div>
		<div style={{marginTop: 18, fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: '0.3em', color: '#FFFFFF', textShadow: '0 1px 10px rgba(0,0,0,0.7)'}}>TIMES A DAY</div>
	</div>
);

export const ThreeTimesADayCover: React.FC = () => (
	<FontGate>
		<AbsoluteFill style={{background: BRAND.night}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 540, height: H, overflow: 'hidden'}}>
				<SceneView def={S08L} t={2.4} d={5.1} T={40} width={540} height={H} />
			</div>
			<div style={{position: 'absolute', left: 540, top: 0, width: 540, height: H, overflow: 'hidden'}}>
				<SceneView def={S08R} t={2.4} d={5.1} T={40} width={540} height={H} />
			</div>
			<div style={{position: 'absolute', left: 538, top: 0, width: 4, height: H, background: `linear-gradient(180deg, rgba(242,181,68,0), ${BRAND.gold} 22%, ${BLUE} 78%, rgba(111,168,255,0))`}} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 220, height: 560, background: 'linear-gradient(180deg, rgba(20,16,13,0), rgba(20,16,13,0.45) 30%, rgba(20,16,13,0.45) 70%, rgba(20,16,13,0))'}} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 1240, height: 520, background: 'linear-gradient(180deg, rgba(20,16,13,0), rgba(20,16,13,0.6) 30%, rgba(20,16,13,0.6) 75%, rgba(20,16,13,0))'}} />
			<Big text="3" color={BRAND.gold} glow="rgba(242,181,68,0.8)" x={0} />
			<Big text="100+" color={BLUE} glow="rgba(111,168,255,0.8)" x={540} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 1335, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, fontSize: 104, lineHeight: 1.06, letterSpacing: '0.03em', textShadow: '0 8px 34px rgba(0,0,0,0.7)'}}>
				<div style={{color: '#FFFFFF'}}>WHY IS PRAYER</div>
				<div style={{color: BRAND.gold}}>SO HARD NOW?</div>
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 1610, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, opacity: 0.85}}>
				<Logo size={36} />
				<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.2em', color: '#FFFFFF'}}>GRACE IN MOTION</span>
			</div>
		</AbsoluteFill>
	</FontGate>
);
