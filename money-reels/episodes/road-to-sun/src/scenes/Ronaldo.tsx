import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Smoke} from '../components/Fx';
import {RibbonRoad} from '../components/RibbonRoad';
import {Sprite} from '../components/Sprite';
import {SC, T, breathe, easeIn, easeInOut, easeOut, lerp, pop, prog, squash} from '../lib/anim';
import {Airplane, ClimbSky, Planet, Rider, SpeedFx, travel} from './Ride';
import {StreetBG} from './Street';

const RIDE = 19.45;
const MOON = {x: 830, y: 330};
const EARTH_TOP_END = 1560;

/** RONALDO: celebration on the street, launch, ride to almost halfway to the Moon. */
export const Ronaldo: React.FC<{t: number}> = ({t}) => {
  const [a] = SC.ronaldo;
  if (t < RIDE) {
    const zoom = lerp(1.06, 1.14, prog(t, a, T.ronLaunch));
    const jp = prog(t, T.ronJump, T.ronLand);
    const jumpY = -280 * Math.sin(Math.PI * jp);
    const [sx, sy] = squash(t, T.ronLand, 0.22, 0.55);
    // launch: a column of bills shoots up under his feet and the street drops away
    const lp = prog(t, T.ronLaunch, RIDE);
    const lift = 520 * easeOut(lp);
    const drop = 900 * easeIn(lp);
    const feetY = 1540 - lift;
    const groundY = 1540 + drop;
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{transform: `translateY(${drop}px)`}}>
          <StreetBG t={t} zoom={zoom} />
        </AbsoluteFill>
        <Smoke x={540} y={1540} t={t} start={T.ronLand} seed={8} n={10} spread={300} />
        {lp > 0 ? (
          <RibbonRoad path={[[540, feetY], [540, groundY]]} billLen={150} scroll={-lift} glow={0.5} flutter={false} />
        ) : null}
        <Sprite name="08_ronaldo_celebrate" x={540} y={feetY + jumpY} h={1000 * breathe(t)} sx={sx} sy={sy} rot={jp > 0 && jp < 1 ? -4 * Math.sin(Math.PI * jp) : 0} />
        <SpeedFx t={t} speed={lp * 3000} />
      </AbsoluteFill>
    );
  }

  const alt = easeInOut(prog(t, RIDE, 22.7));
  const rise = travel(t, RIDE, T.ronRoadEnd, 2600, 0.6);
  const speed = t < T.ronRoadEnd ? 2600 * (1 - Math.max(0, (t - (T.ronRoadEnd - 0.6)) / 0.6)) : 0;
  // Earth rises into view below and shrinks
  const ep = easeOut(prog(t, 21.5, T.ronRoadEnd + 0.2));
  const earthD = lerp(4200, 640, ep);
  const earthTop = lerp(2050, EARTH_TOP_END, ep);
  const earthOn = t > 21.5;
  // the rider drifts to the halfway point between Earth and Moon
  const hp = easeInOut(prog(t, 22.4, T.ronRoadEnd + 0.1));
  const feet: [number, number] = [lerp(560, (540 + MOON.x) / 2, hp), lerp(1150, (EARTH_TOP_END + MOON.y) / 2 + 40, hp)];
  const tailEnd: [number, number] = earthOn ? [540, earthTop + 14] : [380, 2200];
  const moonO = prog(t, 22.4, 23.0);
  const half = pop(t, T.ronRoadEnd, 0.4);
  const planeP = prog(t, T.ronPlane, T.ronPlane + 1.3);
  return (
    <AbsoluteFill>
      <ClimbSky alt={alt} rise={rise} speed={speed} seed={4} />
      {planeP > 0 && planeP < 1 ? <Airplane x={lerp(-200, 1300, planeP)} y={lerp(420, 980, planeP)} s={0.9} rot={-4} /> : null}
      {moonO > 0 ? <Planet name="20_moon" x={MOON.x} y={MOON.y} d={170} glow="rgba(200,220,255,0.8)" /> : null}
      {earthOn ? <Planet name="19_earth" x={540} y={earthTop + earthD / 2} d={earthD} glow="rgba(120,190,255,0.9)" rot={-t * 3} /> : null}
      {half > 0 ? (
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: Math.min(1, half)}}>
          <line x1={feet[0]} y1={feet[1]} x2={MOON.x} y2={MOON.y + 85} stroke="#fff" strokeWidth={7} strokeDasharray="4 22" strokeLinecap="round" />
        </svg>
      ) : null}
      {half > 0 ? (
        <>
          <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: Math.min(1, half)}}>
            <line x1={150} y1={feet[1] + 6} x2={930} y2={feet[1] + 6} stroke="#ffe14a" strokeWidth={7} strokeDasharray="22 16" strokeLinecap="round" />
          </svg>
          <div style={{position: 'absolute', left: 150, top: feet[1] - 66, transform: `scale(${half})`, transformOrigin: '0 100%', fontFamily: 'Lilita One', fontSize: 50, color: '#ffe14a', WebkitTextStroke: '9px #1E1E24', paintOrder: 'stroke fill', whiteSpace: 'nowrap'}}>
            HALFWAY
          </div>
        </>
      ) : null}
      <Rider t={t} name="09_ronaldo_ride" feet={feet} tail={[[(feet[0] + tailEnd[0]) / 2 - 70, (feet[1] + tailEnd[1]) / 2], tailEnd]} h={640} scroll={rise} settleAt={T.ronRoadEnd} />
      <SpeedFx t={t} speed={speed} />
    </AbsoluteFill>
  );
};
