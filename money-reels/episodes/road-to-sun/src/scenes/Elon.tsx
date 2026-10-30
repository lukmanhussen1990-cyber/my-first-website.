import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {HeatShimmer, OrbitRing, Smoke, Sparkle} from '../components/Fx';
import {RibbonRoad, spline} from '../components/RibbonRoad';
import {Sky, SpeedLines, Stars} from '../components/Sky';
import {Sprite} from '../components/Sprite';
import {SC, T, breathe, clamp, easeIn, easeOut, img, lerp, prog, rng, sway} from '../lib/anim';
import {Planet, travel} from './Ride';
import {StreetBG} from './Street';
import {SunRoad} from './SunRoad';

const CLOSE = 31.62;
const LIFT = 34.15;
const SUN_C = {x: 850, y: 470};

/** Sun diameter during the approach: tiny dot that grows exponentially until it fills the screen. */
const sunD = (t: number) => (t < 38.3 ? 0 : 60 * Math.exp(2.35 * (t - 38.3)));

const Rocket: React.FC<{x: number; y: number; h: number; rot: number; t: number; flame?: number}> = ({x, y, h, rot, t, flame = 1}) => (
  <>
    {flame > 0 ? (
      <div style={{position: 'absolute', left: x - h * 0.2, top: y - h * 0.2, width: h * 0.4, height: h * 0.4, borderRadius: '50%', transform: `rotate(${rot}deg) translateY(${h * 0.42}px) scale(${0.9 + 0.25 * Math.sin(t * 47)})`, background: 'radial-gradient(circle, rgba(255,255,220,0.95), rgba(255,170,40,0.6) 45%, rgba(255,90,0,0) 70%)'}} />
    ) : null}
    <Sprite name="16_rocket" x={x} y={y} h={h} anchor={[0.5, 0.5]} rot={rot + Math.sin(t * 31) * 0.8} sy={1 + 0.015 * Math.sin(t * 40)} />
  </>
);

/** ELON: close-up zoom, rocket launch, hyperspeed past the Moon and the inner planets, into the Sun. */
export const Elon: React.FC<{t: number}> = ({t}) => {
  const [a] = SC.elon;

  // A) standing on the street, then the snap zoom into his face
  if (t < CLOSE) {
    const zp = easeIn(prog(t, T.elonZoom - 0.12, CLOSE));
    return (
      <AbsoluteFill style={{transform: `scale(${1 + 1.6 * zp})`, transformOrigin: '540px 560px', filter: zp > 0 ? `blur(${zp * 14}px)` : undefined}}>
        <StreetBG t={t} zoom={lerp(1.05, 1.12, prog(t, a, CLOSE))} />
        <Sprite name="01_elon_stand" x={540} y={1600} h={1180 * breathe(t)} rot={sway(t, 3, 0.8)} />
      </AbsoluteFill>
    );
  }

  // B) close-up smirk while the trillion lands
  if (t < T.elonIgnite) {
    const k = prog(t, CLOSE, T.elonIgnite);
    const r = rng(77);
    return (
      <AbsoluteFill>
        <StreetBG t={t} zoom={1.7} blur={16} />
        <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45))'}} />
        <Sprite name="04_elon_closeup" x={540} y={1920} h={1420 * (1 + 0.06 * easeOut(k)) * breathe(t)} rot={sway(t, 5, 0.7)} sy={1 + 0.006 * Math.sin(t * 3)} />
        {t > T.elonCash
          ? Array.from({length: 9}, (_, i) => {
              const k2 = t - T.elonCash - i * 0.07;
              if (k2 < 0 || k2 > 0.9) return null;
              return <Sparkle key={i} x={180 + r() * 720} y={500 + r() * 700} size={50 * Math.sin(Math.PI * (k2 / 0.9))} rot={k2 * 200} color={i % 2 ? '#fff6b0' : '#ffffff'} />;
            })
          : null}
      </AbsoluteFill>
    );
  }

  // C) rocket launch from the street, the road unrolls behind it
  if (t < T.elonRide) {
    const shake = t < LIFT ? Math.sin(t * 90) * 7 : 0;
    const up = 2400 * easeIn(prog(t, LIFT, T.elonRide));
    const cam = 1300 * easeIn(prog(t, LIFT + 0.22, T.elonRide));
    const ry = 1150 - up + cam;
    const ground = 1600 + cam;
    return (
      <AbsoluteFill style={{transform: `translateX(${shake}px)`}}>
        <AbsoluteFill style={{transform: `translateY(${cam}px)`}}>
          <StreetBG t={t} zoom={1.02} />
        </AbsoluteFill>
        {t > LIFT ? <RibbonRoad path={[[540, ry + 380], [540, ground]]} billLen={140} scroll={-up} glow={0.6} /> : null}
        <Rocket x={540} y={ry} h={900} rot={0} t={t} flame={1} />
        <Smoke x={540} y={ground - 20} t={t} start={T.elonIgnite + 0.05} seed={12} n={16} spread={520} />
        <SpeedLines t={t} intensity={prog(t, LIFT, T.elonRide) * 1.2} angle={90} seed={31} />
      </AbsoluteFill>
    );
  }

  // E/F) after the impact: the Sun close-up, then the thumbs-up callback on the road
  if (t >= T.elonSun) {
    if (t < T.elonThumb) {
      const k = t - T.elonSun;
      const sh = Math.exp(-k * 5) * 24;
      return (
        <HeatShimmer id="sun-fill" t={t} amount={1}>
          <AbsoluteFill style={{background: '#ffb02a', transform: `translate(${Math.sin(t * 80) * sh}px, ${Math.cos(t * 70) * sh}px)`}}>
            <Img src={img('21_sun')} style={{position: 'absolute', left: 540 - 1500, top: 760 - 1500, width: 3000, height: 3000, transform: `rotate(${t * 10}deg) scale(${1 + 0.05 * k})`}} />
            <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, rgba(255,255,230,0.6), rgba(255,200,80,0) 60%)'}} />
          </AbsoluteFill>
        </HeatShimmer>
      );
    }
    const k = prog(t, T.elonThumb, SC.elon[1]);
    return (
      <HeatShimmer id="sun-call" t={t} amount={0.35}>
        <SunRoad t={t} dist={lerp(8.6, 6.6, easeOut(k))} speed={4} sunScale={2.5} thumbAt={T.elonThumb + 0.08} sunY={600} warm={0.2} />
      </HeatShimmer>
    );
  }

  // D) the ride: hyperspeed past the Moon, Venus, Mercury, into the Sun
  const rise = travel(t, T.elonRide, T.musicCut, 4200, 0.01);
  const hyper = prog(t, T.elonHyper - 0.2, T.elonHyper + 0.5);
  const warm = Math.pow(prog(t, 37.1, T.musicCut), 1.4) * 0.92;
  const sd = sunD(t);
  const backlit = clamp((sd - 900) / 1400);
  // Earth falls away right after launch
  const ep = easeOut(prog(t, T.elonRide, T.elonRide + 0.9));
  // the Moon zips past in a third of a second
  const mp = prog(t, T.elonMoon - 0.15, T.elonMoon + 0.2);
  const rocketRot = 30;
  const rk = {x: 690 + Math.sin(t * 13) * 6, y: 800 + Math.cos(t * 11) * 6};
  const rr = (rocketRot * Math.PI) / 180;
  const tail: [number, number] = [rk.x - Math.sin(rr) * 270, rk.y + Math.cos(rr) * 270];
  const feet: [number, number] = [450, 1260];
  const path = spline([tail, [555, 1070], feet, [250, 1580], [40, 1900], [-180, 2220]], 18);
  return (
    <HeatShimmer id="approach" t={t} amount={prog(t, 39.0, T.musicCut) * 0.8}>
      <AbsoluteFill>
        <Sky alt={1} warm={warm} />
        <Stars seed={61} count={320} radial={0.25 + 1.4 * hyper} radialT={t * (1 + 2 * hyper)} cx={SUN_C.x} cy={SUN_C.y} opacity={1 - warm * 0.7} />
        {ep < 1 ? <Planet name="19_earth" x={420} y={lerp(1900, 2600, ep)} d={lerp(2400, 300, ep)} glow="rgba(120,190,255,0.9)" /> : null}
        {sd > 0 ? (
          <>
            <div style={{position: 'absolute', left: SUN_C.x - sd * 1.6, top: SUN_C.y - sd * 1.6, width: sd * 3.2, height: sd * 3.2, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,170,0.95) 0%, rgba(255,170,50,0.55) 25%, rgba(255,100,20,0.15) 45%, rgba(255,80,0,0) 60%)'}} />
            <Planet name="21_sun" x={SUN_C.x} y={SUN_C.y} d={sd} rot={t * 12} />
          </>
        ) : null}
        {mp > 0 && mp < 1 ? <Planet name="20_moon" x={lerp(1050, -150, mp)} y={lerp(260, 2000, mp)} d={lerp(260, 1500, mp)} blur={10} /> : null}
        <OrbitRing p={prog(t, T.elonVenus - 0.35, T.elonVenus + 0.5)} label="VENUS'S ORBIT" planet={<Img src={img('22_venus')} style={{width: 230}} />} />
        <OrbitRing p={prog(t, T.elonMercury - 0.35, T.elonMercury + 0.5)} label="MERCURY'S ORBIT" color="#ffd0a0" planet={<Img src={img('22_mercury')} style={{width: 150}} />} />
        <AbsoluteFill style={{filter: backlit > 0 ? `brightness(${1 - 0.75 * backlit}) saturate(${1 - backlit * 0.6})` : undefined}}>
          <RibbonRoad path={path} billLen={150} scroll={rise} glow={0.8} persp={0.3} seed={17} />
          <Rocket x={rk.x} y={rk.y} h={560} rot={rocketRot} t={t} />
          <Sprite name="02_elon_ride" x={feet[0]} y={feet[1] + 8} h={700 * (1 + 0.01 * Math.sin(t * 6))} rot={-12 + Math.sin(t * 9) * 1.5} />
        </AbsoluteFill>
        <SpeedLines t={t} intensity={0.5 + hyper * 1.1} radial cx={SUN_C.x} cy={SUN_C.y} color={warm > 0.4 ? '255,240,200' : '255,255,255'} />
        {t >= T.musicCut ? <AbsoluteFill style={{background: '#fff3c4', opacity: 0.35 + 0.65 * prog(t, T.musicCut, T.elonSun)}} /> : null}
      </AbsoluteFill>
    </HeatShimmer>
  );
};

