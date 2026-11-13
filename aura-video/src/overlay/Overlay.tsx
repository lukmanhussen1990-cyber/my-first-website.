import React from 'react';
import * as THREE from 'three';
import {AbsoluteFill, interpolate} from 'remotion';
import {
  AURA,
  B,
  CAPTION,
  FLASHES,
  FLOATERS,
  HUD_TITLE,
  MIN_START,
  RANK,
  SHOUTS,
  SWITCH_FLASH,
  SWITCH_INVERT_FROM,
  TITLE_END,
  END_CARD,
  DURATION,
  minuteAt,
} from '../timeline';
import {clamp, easeOut, easeOutBack, noise1, prog, smooth} from '../lib/math';
import {stateAt} from '../shots';

const W = 1080;
const H = 1920;
const SERIF = "'Lora', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";
const SHOUT = "'Poppins', 'Inter', sans-serif";

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// ---------------- HUD ----------------
const auraValue = (f: number) => {
  const m = Math.max(0, minuteAt(f));
  if (m === 8) return Infinity;
  const start = MIN_START[m] ?? 0;
  const from = m === 0 ? 100 : AURA[m - 1];
  const to = AURA[m];
  const k = m === 0 ? 1 : easeOut(prog(f, start, start + 13));
  return from + (to - from) * k;
};

const Hud: React.FC<{f: number}> = ({f}) => {
  const m = Math.max(0, minuteAt(f));
  const start = MIN_START[m] ?? 0;
  const pop = m > 0 && f >= start ? 1 + 0.16 * Math.exp(-(f - start) / 5) : 1;
  const counting = m > 0 && f >= start && f < start + 13;
  const val = auraValue(f);
  const glitch = f >= B[65] && f < MIN_START[8];
  const rank = RANK[m];
  const rankPop = m > 0 && RANK[m - 1].label !== rank.label ? easeOutBack(prog(f, start, start + 10)) : 1;
  let numText = val === Infinity ? '∞' : fmt(val);
  let numStyle: React.CSSProperties = {};
  if (glitch) {
    const g = Math.floor(f / 2);
    const r = (k: number) => Math.abs(Math.floor(noise1(g * 1.37 + k, k) * 99999));
    const opts = [fmt(12800 + r(1)), fmt(r(2) * 13 + 12800), 'ERR0R', '12,8̀0́0', fmt(r(3) * 997), '?????'];
    numText = opts[g % opts.length];
    numStyle = {
      textShadow: `${noise1(f, 3) * 10}px 0 0 rgba(255,40,80,0.9), ${noise1(f, 5) * -10}px 0 0 rgba(40,220,255,0.9)`,
      transform: `translate(${noise1(f * 2, 7) * 8}px, ${noise1(f * 2, 9) * 4}px) skewX(${noise1(f, 11) * 12}deg)`,
    };
  }
  const isInf = val === Infinity && !glitch;
  const loadingBar = m === 7;
  const loadP = clamp(prog(f, MIN_START[7], MIN_START[8] - 4));
  const titleText = glitch && Math.floor(f / 3) % 3 === 0 ? 'T00 MUCH F0R 0NE K1D' : HUD_TITLE[m];
  return (
    <div style={{position: 'absolute', left: 78, top: 292, color: 'white', textShadow: '0 2px 14px rgba(0,0,0,0.35)'}}>
      <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 25, letterSpacing: 5, opacity: 0.95}}>AURA</div>
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 400,
          fontSize: isInf ? 150 : 124,
          lineHeight: 1.0,
          marginTop: isInf ? -6 : 4,
          transform: `scale(${pop})`,
          transformOrigin: 'left center',
          color: counting ? '#fff3c4' : isInf ? '#efe4ff' : 'white',
          textShadow: isInf ? '0 0 28px rgba(178,107,255,0.9), 0 0 6px rgba(255,255,255,0.6)' : counting ? '0 0 30px rgba(255,214,102,0.85)' : '0 2px 14px rgba(0,0,0,0.35)',
          fontVariantNumeric: 'lining-nums',
          ...numStyle,
        }}
      >
        {numText}
      </div>
      <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 27, letterSpacing: 2.2, marginTop: 14}}>{titleText}</div>
      <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 23, letterSpacing: 2.5, marginTop: 6, opacity: 0.95}}>MINUTE {Math.max(0, m)}</div>
      <div style={{display: 'flex', gap: 12, marginTop: 14, alignItems: 'center'}}>
        <div style={{background: '#e3243b', color: 'white', fontFamily: SANS, fontWeight: 800, fontSize: 22, letterSpacing: 1.5, padding: '7px 14px 6px', borderRadius: 7}}>
          {'×'}2 EVERY MINUTE
        </div>
        <div
          style={{
            background: rank.bg,
            color: rank.fg,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: 1.5,
            padding: '7px 14px 6px',
            borderRadius: 7,
            transform: `scale(${rankPop})`,
            transformOrigin: 'left center',
            boxShadow: m === 8 ? '0 0 24px rgba(139,92,246,0.9)' : undefined,
          }}
        >
          {rank.label}
        </div>
      </div>
      {loadingBar && (
        <div style={{marginTop: 14}}>
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 19, letterSpacing: 2.2, opacity: 0.95}}>MINUTE 8 IS LOADING</div>
          <div style={{width: 230, height: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 4, marginTop: 7, overflow: 'hidden'}}>
            <div style={{width: `${loadP * 100}%`, height: '100%', background: 'linear-gradient(90deg,#f59a2b,#ffcd4a)', boxShadow: '0 0 12px #f59a2b'}} />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------- Caption ----------------
const Caption: React.FC<{f: number}> = ({f}) => {
  const m = minuteAt(f);
  if (m < 0) return null;
  const start = MIN_START[m];
  const end = m < 8 ? MIN_START[m + 1] : END_CARD;
  if (f >= end) return null;
  const a = smooth(prog(f, start + 6, start + 14));
  const out = 1 - smooth(prog(f, end - 3, end));
  const y = (1 - easeOut(prog(f, start + 6, start + 16))) * 18;
  return (
    <div
      style={{
        position: 'absolute',
        left: 78,
        top: 742,
        width: 760,
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: 46,
        lineHeight: 1.22,
        color: 'white',
        opacity: a * out,
        transform: `translateY(${y}px)`,
        textShadow: '0 2px 16px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.5)',
      }}
    >
      {CAPTION[m]}
    </div>
  );
};

// ---------------- Shouts ----------------
const Shouts: React.FC<{f: number}> = ({f}) => {
  const sh = SHOUTS.find((s) => f >= s.from && f < s.to);
  if (!sh) return null;
  const k = f - sh.from;
  const scale = 1 + 0.35 * Math.exp(-k / 2.5);
  const words = sh.text.split(' ');
  const isPain = sh.text.includes("CAN'T") || sh.text.startsWith('MY') || sh.text === 'I';
  const jitter = isPain ? noise1(f * 1.7, 2) * 5 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        width: W,
        top: sh.y ?? 1180,
        textAlign: 'center',
        fontFamily: SHOUT,
        fontWeight: 800,
        fontSize: sh.size ?? 84,
        letterSpacing: isPain ? 5 : 1,
        color: 'white',
        transform: `translate(${jitter}px, 0) scale(${scale})`,
        textShadow: '0 4px 0 rgba(0,0,0,0.25), 0 6px 26px rgba(0,0,0,0.55)',
        WebkitTextStroke: '1.5px rgba(0,0,0,0.25)',
      }}
    >
      {words.map((w, i) => (
        <span key={i} style={{color: sh.hl?.includes(w) ? '#ffd23f' : 'white'}}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
};

// ---------------- Title ----------------
const Title: React.FC<{f: number}> = ({f}) => {
  if (f >= TITLE_END) return null;
  const a = smooth(prog(f, 0, 5)) * (1 - smooth(prog(f, TITLE_END - 6, TITLE_END)));
  const lines: React.ReactNode[] = [
    <>What if your</>,
    <>
      <span style={{color: '#ffd23f'}}>aura</span> doubled
    </>,
    <>every minute on</>,
    <>the way to school?</>,
  ];
  return (
    <div style={{position: 'absolute', top: 640, left: 0, width: W, textAlign: 'center', opacity: a}}>
      {lines.map((l, i) => {
        const li = smooth(prog(f, i * 3, i * 3 + 9));
        return (
          <div
            key={i}
            style={{
              fontFamily: SERIF,
              fontSize: 96,
              lineHeight: 1.08,
              color: 'white',
              opacity: li,
              transform: `translateY(${(1 - li) * 24}px)`,
              textShadow: '0 4px 30px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.35)',
            }}
          >
            {l}
          </div>
        );
      })}
    </div>
  );
};

// ---------------- -200 AURA floaters ----------------
const project = (f: number, p: [number, number, number]) => {
  const s = stateAt(f);
  const cam = new THREE.PerspectiveCamera(s.cam.fov, W / H, 0.05, 900);
  cam.position.set(...s.cam.pos);
  cam.lookAt(...s.cam.target);
  if (s.cam.roll) cam.rotateZ(s.cam.roll);
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  return {x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, ok: v.z < 1};
};

const actorHead = (f: number, who: string): [number, number, number] | null => {
  const s = stateAt(f);
  if (who === 'bully' && s.bully) return [s.bully.pos[0], 2.1, s.bully.pos[2]];
  if (who.startsWith('npc')) {
    const n = s.npcs.find((x) => x.look === who);
    if (n) return [n.pos[0], n.pos[1] + 1.95, n.pos[2]];
  }
  return null;
};

const Floaters: React.FC<{f: number}> = ({f}) => {
  return (
    <>
      {FLOATERS.map((fl, i) => {
        const k = f - fl.from;
        if (k < 0 || k > 34) return null;
        const s = stateAt(f);
        if (s.id !== fl.shot) return null;
        const head = actorHead(f, fl.who);
        if (!head) return null;
        const p = project(f, head);
        if (!p.ok) return null;
        const rise = easeOut(k / 34) * 150;
        const a = smooth(prog(k, 0, 4)) * (1 - smooth(prog(k, 24, 34)));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y - rise,
              transform: `translate(-50%, -50%) scale(${1 + 0.3 * Math.exp(-k / 3)})`,
              fontFamily: SHOUT,
              fontWeight: 800,
              fontSize: 54,
              color: '#ff2d3f',
              opacity: a,
              whiteSpace: 'nowrap',
              textShadow: '0 0 18px rgba(255,30,60,0.55), 0 3px 0 rgba(80,0,10,0.6)',
              WebkitTextStroke: '1.5px rgba(90,0,10,0.5)',
            }}
          >
            -200 AURA
          </div>
        );
      })}
    </>
  );
};

// ---------------- News graphics (minute 5a) ----------------
const News: React.FC<{f: number}> = ({f}) => {
  const s = stateAt(f);
  if (s.id !== 'm5a') return null;
  const k = s.local;
  const inA = easeOut(prog(k, 2, 10));
  const ticker = 'SCHOOLBOY "DIDN\'T EVEN LOOK" • STRAY DOG NOW WEARS SUNGLASSES • SCHOOL BUS STOPS BY ITSELF • BULLY STILL LOOKING FOR CAP • ';
  return (
    <>
      <div style={{position: 'absolute', right: 56, top: 120, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, background: '#e3243b', color: 'white', fontFamily: SANS, fontWeight: 800, fontSize: 30, padding: '8px 18px', borderRadius: 6, letterSpacing: 2}}>
          <div style={{width: 14, height: 14, borderRadius: 7, background: 'white', opacity: Math.floor(f / 8) % 2 ? 1 : 0.35}} /> LIVE
        </div>
        <div style={{background: 'rgba(10,20,50,0.85)', color: 'white', fontFamily: SANS, fontWeight: 800, fontSize: 24, padding: '6px 14px', borderRadius: 4, letterSpacing: 2}}>AURA NEWS 24</div>
      </div>
      <div style={{position: 'absolute', left: 40, right: 40, top: 1440, transform: `translateX(${(1 - inA) * -1100}px)`}}>
        <div style={{display: 'inline-block', background: '#e3243b', color: 'white', fontFamily: SANS, fontWeight: 800, fontSize: 30, letterSpacing: 2, padding: '8px 18px'}}>BREAKING NEWS {'•'}</div>
        <div style={{background: 'white', color: '#0b1430', fontFamily: SANS, fontWeight: 800, fontSize: 43, lineHeight: 1.15, padding: '16px 22px', letterSpacing: 0.5}}>
          LOCAL SCHOOLBOY{"'"}S AURA VISIBLE FROM SPACE
        </div>
        <div style={{background: '#0b1430', color: 'white', fontFamily: SANS, fontWeight: 600, fontSize: 26, padding: '10px 0', overflow: 'hidden', whiteSpace: 'nowrap'}}>
          <div style={{transform: `translateX(${-k * 9}px)`, paddingLeft: 20}}>{ticker + ticker}</div>
        </div>
      </div>
      {/* TV scanlines + bezel */}
      <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 2px, transparent 2px, transparent 5px)', pointerEvents: 'none'}} />
    </>
  );
};

// ---------------- End card ----------------
const EndCard: React.FC<{f: number}> = ({f}) => {
  if (f < END_CARD) return null;
  const k = f - END_CARD;
  const a = smooth(prog(k, 0, 10));
  const big = easeOutBack(prog(k, 4, 18));
  const sub = smooth(prog(k, 0, 8));
  return (
    <>
      <AbsoluteFill style={{background: `rgba(6,2,16,${0.55 * a})`}} />
      <div style={{position: 'absolute', top: 1020, width: W, textAlign: 'center'}}>
        <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 40, letterSpacing: 14, color: '#e9ddff', opacity: sub, marginBottom: 6}}>SCHOOL IS</div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 150,
            lineHeight: 1,
            color: '#c9a2ff',
            transform: `scale(${0.6 + 0.4 * big})`,
            opacity: clamp(big * 1.5),
            textShadow: '0 0 40px rgba(155,77,255,0.85), 0 0 10px rgba(255,255,255,0.4)',
          }}
        >
          CANCELLED.
        </div>
      </div>
    </>
  );
};

// ---------------- Flashes / invert / glow lines ----------------
const Flash: React.FC<{f: number}> = ({f}) => {
  let o = 0;
  for (const e of FLASHES) if (f >= e && f < e + 12) o = Math.max(o, 1 - (f - e) / 12);
  if (f >= SWITCH_FLASH && f < SWITCH_INVERT_FROM) o = Math.max(o, 1 - ((f - SWITCH_FLASH) / (SWITCH_INVERT_FROM - SWITCH_FLASH)) * 0.4);
  if (f >= B[81] && f < B[81] + 6) o = Math.max(o, 0.6 * (1 - (f - B[81]) / 6));
  if (f >= B[79] && f < B[79] + 5) o = Math.max(o, 0.45 * (1 - (f - B[79]) / 5));
  if (o <= 0) return null;
  return <AbsoluteFill style={{background: 'white', opacity: o}} />;
};

const SwitchText: React.FC<{f: number}> = ({f}) => {
  if (f < SWITCH_INVERT_FROM || f >= MIN_START[8]) return null;
  const k = f - SWITCH_INVERT_FROM;
  return (
    <div
      style={{
        position: 'absolute',
        top: 1060,
        width: W,
        textAlign: 'center',
        fontFamily: SHOUT,
        fontWeight: 800,
        fontSize: 170,
        color: 'white',
        letterSpacing: 4,
        transform: `scale(${1 + 0.25 * Math.exp(-k / 2)})`,
        WebkitTextStroke: '5px #0d0d1a',
        textShadow: '0 10px 0 #0d0d1a',
      }}
    >
      SWITCH!
    </div>
  );
};

const GlowLines: React.FC<{f: number}> = ({f}) => {
  if (f < MIN_START[7]) return null;
  const a = smooth(prog(f, MIN_START[7], MIN_START[7] + 12)) * (0.75 + 0.25 * Math.sin(f * 0.3));
  const line = (top: boolean) => (
    <div
      style={{
        position: 'absolute',
        left: '8%',
        right: '8%',
        [top ? 'top' : 'bottom']: 0,
        height: 4,
        background: 'linear-gradient(90deg, transparent, #b26bff 30%, #e9d5ff 50%, #b26bff 70%, transparent)',
        boxShadow: '0 0 24px 6px rgba(155,77,255,0.7)',
        opacity: a,
      }}
    />
  );
  return (
    <>
      {line(true)}
      {line(false)}
    </>
  );
};

export const isInverted = (f: number) => f >= SWITCH_INVERT_FROM && f < MIN_START[8];

export const Overlay: React.FC<{f: number}> = ({f}) => (
  <AbsoluteFill>
    <News f={f} />
    <Floaters f={f} />
    <Title f={f} />
    <Caption f={f} />
    <Shouts f={f} />
    <EndCard f={f} />
    <Hud f={f} />
    <GlowLines f={f} />
    <SwitchText f={f} />
  </AbsoluteFill>
);

export const TopFlash: React.FC<{f: number}> = ({f}) => <Flash f={f} />;
export const _d = DURATION + interpolate(0, [0, 1], [0, 1]);
