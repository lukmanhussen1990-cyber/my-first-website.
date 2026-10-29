import React from 'react';
import {
  AnswerButtons, C, CrossLogo, DottedPath, FearLoveMeter, FogPanel, GROUND_Y, Glow, GroundLine, Heart, Hill, PaperPlane,
  PegPerson, RainCloud, Sky, Sparkles, clamp, pop, prog, progInOut, pushIn,
} from '../../../../src/kit-flat';
import {FONT_CAPTION, FONT_SERIF, FONT_UI} from '../../../../src/kit-flat/fonts';
import {A} from '../data.ts';
import {meterState} from '../anchors.ts';

// --- S17 call to action -------------------------------------------------------

export const COMMENT = 'Love 🙏 (still learning)';
export const TYPE_FRAMES = 30;
export const typedChars = (f: number) => clamp((f - A.typing) / TYPE_FRAMES) * Array.from(COMMENT).length;

export const CtaWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.cta, A.send - A.cta, 1.04);
  const m = meterState(A, f);
  const pressed = f >= A.btnLove ? 'LOVE' : f >= A.btnFear ? 'FEAR' : null;
  const pressAt = pressed === 'LOVE' ? A.btnLove : A.btnFear;
  const pulse = pressed ? Math.max(0, 1 - (f - pressAt) / 10) : 0;
  const typedDone = A.typing + TYPE_FRAMES + 2;
  return (
    <g transform={`translate(540,900) scale(${z}) translate(-540,-900)`}>
      <Sky kind="night" frame={f} moon={{x: 820, y: 460, r: 95}} />
      <FogPanel />
      <GroundLine />
      <FearLoveMeter x={540} y={650} width={560} value={m.value} frame={f} scale={1.3 * pop(f, A.cta + 4, 12)} labelsAbove />
      <AnswerButtons x={540} y={850} pressed={pressed} pulse={pulse} scale={pop(f, A.cta + 10, 12)} />
      {f >= typedDone ? (
        <>
          <Heart x={400} y={960} frame={f} start={typedDone} size={1.4} float={200} />
          <Heart x={540} y={940} frame={f} start={typedDone + 6} size={1.8} float={240} />
          <Heart x={680} y={960} frame={f} start={typedDone + 12} size={1.4} float={200} />
        </>
      ) : null}
    </g>
  );
};

/** HTML part of S17 (the comment box). */
export const CtaHtml: React.FC<{f: number; opacity: number}> = ({f, opacity}) => {
  const s = pop(f, A.typing - 12, 10);
  if (s <= 0 || opacity <= 0) return null;
  const chars = typedChars(f);
  const shown = Array.from(COMMENT).slice(0, Math.floor(chars)).join('');
  const cursor = Math.floor(f / 15) % 2 === 0 || chars < Array.from(COMMENT).length;
  return (
    <div
      style={{
        position: 'absolute',
        left: 540,
        top: 1050,
        width: 660,
        transform: `translate(-50%,-50%) scale(${s})`,
        opacity,
        background: '#FFFDF8',
        border: `5px solid ${C.ink}`,
        borderRadius: 34,
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        boxSizing: 'border-box',
      }}
    >
      <div style={{width: 66, height: 66, borderRadius: 33, background: C.youBlue, border: `4px solid ${C.ink}`, flexShrink: 0}} />
      <div style={{display: 'flex', flexDirection: 'column'}}>
        <div style={{fontFamily: FONT_UI, fontWeight: 600, fontSize: 24, color: '#8B8790'}}>you · now</div>
        <div style={{fontFamily: FONT_CAPTION, fontWeight: 700, fontSize: 44, color: C.captionInk, minHeight: 58, whiteSpace: 'nowrap'}}>
          {shown}
          <span style={{opacity: cursor ? 1 : 0, color: C.gold, fontWeight: 400}}>|</span>
        </div>
      </div>
    </div>
  );
};

// --- S18 send -----------------------------------------------------------------

const P0 = {x: 205, y: 650};
const P1 = {x: 500, y: 430};
const P2 = {x: 770, y: 700};
const bez = (t: number) => ({
  x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x,
  y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t * t * P2.y,
});
const bezAngle = (t: number) => {
  const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
  const dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

export const SendWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.send, A.endCard - A.send, 1.05);
  const flight = Math.max(20, A.planeArrive - A.plane);
  const t = progInOut(f, A.plane, flight);
  const p = bez(t);
  const melt = prog(f, A.melt, 26);
  return (
    <g transform={`translate(540,1000) scale(${z}) translate(-540,-1000)`}>
      <Sky kind="dawn" frame={f} />
      <Glow x={900} y={GROUND_Y - 40} r={460} color="#FFC46E" opacity={0.65} />
      <FogPanel tint={C.dawnLow} tintAmount={0.7} />
      <Glow x={800} y={GROUND_Y - 200} r={420 * (0.4 + melt)} color="#FFE29A" opacity={melt} />
      <GroundLine />
      <Hill x={420} y={GROUND_Y} w={560} h={330} />
      <PegPerson x={130} y={GROUND_Y - 330 + 2} scale={0.78} robe={C.youBlue} pose={f >= A.plane - 4 && f < A.planeArrive ? 'point' : 'stand'} armSwing={0.3} frame={f} seed="you" />
      <PegPerson x={800} y={GROUND_Y} scale={0.86} robe={C.robeGrey} pose={melt > 0.6 ? 'armsUp' : 'stand'} frame={f} seed="lonely" />
      <RainCloud x={800} y={GROUND_Y - 0.86 * 400 - 80} frame={f} melt={melt} />
      {f >= A.plane - 2 ? (
        <DottedPath
          d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
          len={700}
          progress={t}
          arrow={null}
        />
      ) : null}
      {f >= A.plane && melt < 0.4 ? <PaperPlane x={p.x} y={p.y} rotate={bezAngle(t)} scale={1.2 * (1 - melt * 2)} /> : null}
      <Sparkles x={800} y={GROUND_Y - 420} frame={f} start={A.melt + 6} count={14} radius={200} />
      {f >= A.melt + 14 ? <Heart x={800} y={GROUND_Y - 470} frame={f} start={A.melt + 14} size={1.6} fill="#F6D9A0" /> : null}
    </g>
  );
};

// --- End card -----------------------------------------------------------------

export const EndCardWorld: React.FC<{f: number}> = ({f}) => {
  const t0 = A.endCard;
  const draw = progInOut(f, t0 + 4, 34);
  const title = pop(f, t0 + 26, 12);
  return (
    <g>
      <Sky kind="night" frame={f} moon={{x: 540, y: 420, r: 92}} />
      <FogPanel />
      <GroundLine />
      <Glow x={540} y={790} r={260} color="#FFD27A" opacity={0.45 * draw} />
      <CrossLogo x={560} y={790} scale={1.25} draw={draw} />
      <g transform={`translate(540,990) scale(${title})`}>
        <text x={0} y={0} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={84} letterSpacing={3}
          fill={C.ink} stroke={C.ink} strokeWidth={14} strokeLinejoin="round">
          GRACE IN MOTION
        </text>
        <text x={0} y={0} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={84} letterSpacing={3} fill={C.cream}>
          GRACE IN MOTION
        </text>
      </g>
      <text x={540} y={1070} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={40} fill={C.gold} opacity={prog(f, t0 + 34, 12)}>
        @GraceINMotion616
      </text>
    </g>
  );
};

export const endTagOpacity = (f: number) => prog(f, A.endCard + 40, 12);
