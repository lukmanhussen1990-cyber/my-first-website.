import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {BILL_L, Bill3D, BillRoad3D, Cam3D, project} from '../components/BillRoad3D';
import {Sparkle} from '../components/Fx';
import {Stars} from '../components/Sky';
import {Sprite} from '../components/Sprite';
import {H, W, breathe, clamp, img, pop, rng, squash} from '../lib/anim';

const ELON_Z = -400;
const CAM_H = 2.2;
const HORIZON = 700;
const ELON_H = 3.4;

/**
 * The glowing money road through space that ends at Elon in front of a giant Sun.
 * Used by the hook, the Sun callback and the looping last frames.
 */
export const SunRoad: React.FC<{
  t: number; dist: number; speed: number; sunScale?: number; thumbAt?: number; sunY?: number; warm?: number;
}> = ({t, dist, speed, sunScale = 1, thumbAt, sunY = HORIZON - 40, warm = 0}) => {
  const camZ = ELON_Z + dist;
  const f = H / 2 / Math.tan((50 * Math.PI) / 360);
  const pitch = Math.atan((H / 2 - HORIZON) / f);
  const cam: Cam3D = {pos: [0, CAM_H, camZ], look: [0, CAM_H - Math.tan(pitch) * 100, camZ - 100], fov: 50};

  const bills: Bill3D[] = [];
  const step = BILL_L * 0.97;
  for (let k = 0; ; k++) {
    const z = ELON_Z + 1.2 + k * step;
    if (z > camZ - 1.2) break;
    const r = rng(9000 + k);
    bills.push({x: (r() - 0.5) * 0.1, y: 0.002 * (k % 3), z, ry: (r() - 0.5) * 0.05});
  }

  const e = project(cam, [0, 0, ELON_Z]);
  const elonH = ELON_H * e.scale;
  const [sx, sy] = thumbAt !== undefined ? squash(t, thumbAt, 0.12, 0.45) : [1, 1];
  const spark = thumbAt !== undefined ? pop(t, thumbAt, 0.3) * clamp(1 - (t - thumbAt) / 0.9) : 0;
  const sunD = 760 * sunScale;

  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#03030c 0%,#0a0b2a 50%,#160c34 100%)'}}>
      <Stars seed={11} count={300} radial={Math.min(1.2, speed / 40)} radialT={t} cx={W / 2} cy={sunY} opacity={0.9} />
      <div style={{position: 'absolute', left: W / 2 - sunD * 1.4, top: sunY - sunD * 1.4, width: sunD * 2.8, height: sunD * 2.8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,224,110,0.9) 0%, rgba(255,160,50,0.42) 22%, rgba(255,90,20,0.1) 40%, rgba(255,60,0,0) 52%)'}} />
      <Img src={img('21_sun')} style={{position: 'absolute', left: W / 2 - sunD / 2, top: sunY - sunD / 2, width: sunD, height: sunD, transform: `rotate(${t * 6}deg) scale(${1 + 0.012 * Math.sin(t * 5)})`}} />
      <BillRoad3D bills={bills} cam={cam} glow={0.85} glowZ={[ELON_Z, camZ + 2]} fog={['#ffb85c', 70, 330]} />
      {e.visible && elonH > 4 ? (
        <Sprite name="03_elon_spacesuit" x={e.x} y={e.y + elonH * 0.01} h={elonH * breathe(t)} sx={sx} sy={sy} rot={Math.sin(t * 1.7) * 1.2}
          filter={`drop-shadow(0 0 ${elonH * 0.03}px rgba(255,200,90,0.9))`} />
      ) : null}
      {spark > 0 ? (
        <>
          <Sparkle x={e.x - elonH * 0.235} y={e.y - elonH * 0.83} size={elonH * 0.11 * spark} rot={t * 90} />
          <Sparkle x={e.x + elonH * 0.03} y={e.y - elonH * 0.9} size={elonH * 0.07 * spark} rot={-t * 120} color="#fff6c0" />
        </>
      ) : null}
      {warm > 0 ? <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 35%, rgba(255,230,150,0.5), rgba(255,120,30,0.25) 60%, rgba(120,20,0,0.2))', opacity: warm}} /> : null}
    </AbsoluteFill>
  );
};

/** Distance to Elon during the hook (world units): fast at first, easing in as we arrive. */
export const hookDist = (t: number) => (t < 0 ? 200 - (191 * 1.6 / 4.45) * t : 9 + 191 * Math.pow(1 - clamp(t / 4.45), 1.6));
export const hookSpeed = (t: number) => (hookDist(t - 0.03) - hookDist(t + 0.03)) / 0.06;
