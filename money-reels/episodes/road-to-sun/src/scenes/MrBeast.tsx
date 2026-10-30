import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import sprites from '../data/sprites.json';
import {DirBlur} from '../components/Fx';
import {RibbonRoad} from '../components/RibbonRoad';
import {Sprite, spriteMeta} from '../components/Sprite';
import {SpeedLines, Stars} from '../components/Sky';
import {SC, T, breathe, easeIn, easeOut, img, lerp, pop, prog, rng, squash, sway} from '../lib/anim';
import {ClimbSky, Planet, Rider, SpeedFx, travel} from './Ride';
import {StreetBG} from './Street';

const HAS_CLOSEUP = '07_mrbeast_closeup' in sprites;
const GUN = {x: 965, y: 105}; // muzzle in the money-gun sprite's own pixels
const M1 = {x: 470, y: 1560, h: 1050};
const WHIP = 26.78;
const INSERT = [29.62, 30.55];

/** MRBEAST: money gun fires the road, he rides it past Ronaldo and the Moon. */
export const MrBeast: React.FC<{t: number}> = ({t}) => {
  const [a] = SC.mrbeast;
  if (t < T.mbRide) {
    const m = spriteMeta('05_mrbeast_moneygun');
    const s = M1.h / (m.bbox[3] - m.bbox[1]);
    const ax = m.bbox[0] + (m.bbox[2] - m.bbox[0]) / 2;
    const muzzle = {x: M1.x + (GUN.x - ax) * s, y: M1.y - (m.bbox[3] - GUN.y) * s};
    const ps = pop(t, T.mbPop, 0.38);
    const [sx, sy] = t < T.mbFire ? squash(t, T.mbPop + 0.22, 0.14) : squash(t, T.mbFire, 0.1, 0.35);
    // the road shoots out of the gun
    const fp = prog(t, T.mbFire, T.mbFire + 0.45);
    const len = 2600 * easeOut(fp);
    const dir = [0.5, -0.866];
    const tip: [number, number] = [muzzle.x + dir[0] * len, muzzle.y + dir[1] * len];
    // camera whips up after the shot
    const wp = easeIn(prog(t, WHIP, T.mbRide));
    const r = rng(41);
    return (
      <DirBlur id="mb-whip" y={wp * 60}>
        <AbsoluteFill style={{transform: `translateY(${wp * 1500}px)`}}>
          <StreetBG t={t} zoom={lerp(1.12, 1.2, prog(t, a, WHIP))} />
          {t >= T.mbFire ? <RibbonRoad path={[tip, [muzzle.x, muzzle.y]]} billLen={130} scroll={-len} glow={0.5} /> : null}
          {t >= T.mbFire
            ? Array.from({length: 22}, (_, i) => {
                const k = t - T.mbFire - i * 0.025;
                if (k < 0 || k > 1.2) return null;
                const ang = -1.05 + (r() - 0.5) * 0.9, sp = 900 + r() * 900;
                const x = muzzle.x + Math.cos(ang) * sp * k;
                const y = muzzle.y + Math.sin(ang) * sp * k + 900 * k * k;
                return <Img key={i} src={img('15_bill')} style={{position: 'absolute', left: x - 45, top: y - 20, width: 90, transform: `rotate(${(r() - 0.5) * 720 * k}deg) scaleY(${Math.cos(k * 14 + i)})`}} />;
              })
            : null}
          {ps > 0 ? <Sprite name="05_mrbeast_moneygun" x={M1.x} y={M1.y} h={M1.h * ps * breathe(t)} sx={sx} sy={sy} rot={sway(t, 2, 0.8)} /> : null}
        </AbsoluteFill>
      </DirBlur>
    );
  }

  const rise = travel(t, T.mbRide, T.mbRoadEnd, 3400, 0.5) + 2200;
  const speed = t < T.mbRoadEnd ? 3400 * (1 - Math.max(0, (t - (T.mbRoadEnd - 0.5)) / 0.5)) : 0;
  const alt = lerp(0.55, 1, easeOut(prog(t, T.mbRide, T.mbRide + 0.7)));
  // Ronaldo waves from his road end as MrBeast passes (slow in the middle so it reads)
  const bp = prog(t, 27.4, 28.6);
  const bubbleY = lerp(-260, 2200, bp + 0.12 * Math.sin(2 * Math.PI * bp));
  // the Moon grows and slides past
  const mp = prog(t, 28.25, 29.5);
  const moonY = lerp(120, 2900, easeIn(mp));
  const moonD = lerp(150, 2000, easeIn(mp));
  const feet: [number, number] = [570, 1130];
  const insert = HAS_CLOSEUP && t >= INSERT[0] && t < INSERT[1];
  if (insert) {
    const k = prog(t, INSERT[0], INSERT[1]);
    return (
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, #2a3d9a, #090a24 70%)'}}>
        <Stars seed={52} radial={1.2} radialT={t} cx={540} cy={700} />
        <SpeedLines t={t} intensity={1.2} radial cx={540} cy={760} />
        <Sprite name="07_mrbeast_closeup" x={540} y={1920} h={1500 * (1.02 + 0.08 * k)} rot={Math.sin(t * 20) * 1.5} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <ClimbSky alt={alt} rise={rise} speed={speed} seed={9} />
      {mp > 0 && mp < 1 ? <Planet name="20_moon" x={860} y={moonY} d={moonD} glow="rgba(210,225,255,0.8)" blur={mp > 0.75 ? 4 : 0} /> : null}
      {bp > 0 && bp < 1 ? <RonaldoBubble x={250} y={bubbleY} t={t} /> : null}
      <Rider t={t} name="06_mrbeast_ride" feet={feet} tail={[[460, 1420], [180, 1800], [-120, 2150]]} h={690} scroll={rise} lean={-9} settleAt={T.mbRoadEnd} />
      <SpeedFx t={t} speed={speed} />
    </AbsoluteFill>
  );
};

const RonaldoBubble: React.FC<{x: number; y: number; t: number}> = ({x, y, t}) => {
  const d = 320;
  return (
    <div style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, transform: `rotate(${Math.sin(t * 9) * 7}deg)`}}>
      <div style={{width: d, height: d, borderRadius: '50%', overflow: 'hidden', border: '10px solid #fff', boxShadow: '0 0 0 6px #1E1E24, 0 0 40px rgba(255,255,255,0.6)', background: '#7fc4ff', boxSizing: 'border-box'}}>
        <Img src={img('10_ronaldo_closeup')} style={{width: d * 1.25, marginLeft: -d * 0.16, marginTop: -d * 0.05}} />
      </div>
      <div style={{marginTop: -24, textAlign: 'center'}}>
        <span style={{fontFamily: 'Lilita One', fontSize: 40, color: '#111', background: '#fff', border: '5px solid #1E1E24', borderRadius: 16, padding: '0 14px'}}>RONALDO</span>
      </div>
    </div>
  );
};
