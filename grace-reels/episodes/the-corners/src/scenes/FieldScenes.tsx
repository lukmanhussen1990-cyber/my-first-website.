import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {FieldWorld} from '../three/FieldWorld';
import {Cam, Shot, fieldCam, personScale, project, s2FrontX} from '../three/fieldLayout';
import {Person} from '../chars/Person';
import * as C from '../chars/cast';
import {E, SC} from '../lib/timeline';
import {blink, clamp, easeInOut, easeOut, lerp, smooth} from '../lib/anim';
import {Dust, GrainFall} from './kit';
import {Label} from '../ui/Label';
import {GrainHead} from '../chars/props';

const place = (cam: Cam, x: number, z: number, h = 1.65) => {
  const p = project(cam, [x, 0, z]);
  return {x: p.x, y: p.y, s: personScale(p.pxPerM, h), depth: p.depth, pxPerM: p.pxPerM};
};
const head = (cam: Cam, x: number, z: number, h = 1.65) => project(cam, [x, h, z]);

/** 3D world + SVG overlay sharing one camera. */
const FieldStage: React.FC<{shot: Shot; t: number; preview?: boolean; blurX?: number; children?: React.ReactNode; overlay?: React.ReactNode}> = ({shot, t, preview, blurX = 0, children, overlay}) => (
  <AbsoluteFill style={{filter: blurX > 0.5 ? `url(#whip${Math.round(blurX)})` : undefined}}>
    {blurX > 0.5 && (
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={`whip${Math.round(blurX)}`} x="-10%" y="0" width="120%" height="100%">
          <feGaussianBlur stdDeviation={`${Math.round(blurX)} 0`} />
        </filter>
      </svg>
    )}
    <ThreeCanvas width={1080} height={1920} shadows={{type: 2}} gl={{antialias: false, preserveDrawingBuffer: true}}>
      <FieldWorld shot={shot} t={t} preview={preview} />
    </ThreeCanvas>
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{overflow: 'visible'}}>
        {children}
      </svg>
    </AbsoluteFill>
    {overlay}
  </AbsoluteFill>
);

// ------------------------------------------------------------------ S1: the opening (top-down)
export const S1Opening: React.FC<{t: number; preview?: boolean; shot?: Shot}> = ({t, preview, shot = 'S1'}) => <FieldStage shot={shot} t={t} preview={preview} />;

// ------------------------------------------------------------------ S2: the rule — reapers at work
const swingPose = (ph: number) => {
  // ph 0..1: wind-up (anticipation) → fast strike → follow-through → recover
  const windUp = smooth(clamp(ph / 0.55));
  const strike = easeOut(clamp((ph - 0.55) / 0.13));
  const rec = smooth(clamp((ph - 0.75) / 0.25));
  const shF = lerp(lerp(10, -55, windUp), 75, strike) * (1 - rec) + 10 * rec;
  return {lean: 30 + strike * 12 * (1 - rec), head: -10, hipF: 18, hipB: -16, kneeF: 22, kneeB: 8, shF, elF: lerp(30, 10, strike), shB: 48, elB: 20};
};
export const S2Rule: React.FC<{t: number; preview?: boolean}> = ({t, preview}) => {
  const cam = fieldCam('S2', t);
  const stop = t >= E.edgesGlow;
  const looks = smooth(clamp((t - E.edgesGlow - 0.1) / 0.5));
  const front = s2FrontX(t);
  const reapers = [C.REAPER_A, C.REAPER_B, C.REAPER_C].map((look, i) => {
    const x = Math.min(front, 4.85) - 0.7 - i * 0.45;
    const z = -7.8 - i * 2.4;
    const p = place(cam, x, z);
    const swings = (E.swishesS2 as number[]).filter((_, k) => k % 3 === i);
    const last = swings.filter((s) => s <= t + 0.45).pop() ?? SC.S2.start - 2;
    const ph = clamp((t - (last - 0.45)) / 1.0);
    let pose = stop ? C.mixPose(swingPose(ph), {...C.STAND, shF: i === 0 ? 40 : 4, elF: i === 0 ? 30 : 12}, looks) : swingPose(ph);
    if (stop && i !== 0) pose = C.mixPose(swingPose(ph), C.STAND, looks);
    return {look, p, pose, i};
  });
  return (
    <FieldStage shot="S2" t={t} preview={preview}>
      <Dust t={t} n={30} seed={21} area={[0, 700, 1080, 1500]} size={3.5} opacity={0.55} />
      {reapers
        .sort((a, b) => b.p.depth - a.p.depth)
        .map(({look, p, pose, i}) => (
          <Person key={i} look={look} pose={pose} t={t} seed={30 + i} x={p.x} y={p.y} scale={p.s}
            face={{brow: stop && i === 0 ? 'raised' : 'kind', mouth: stop ? 'smile' : 'soft', eyes: blink(30 + i, t), lookX: 1}}
            front={{kind: 'sickle', angle: 180 - ((pose.shF ?? 0) + (pose.elF ?? 0))}} back={{kind: 'grain', angle: 180 - ((pose.shB ?? 0) + (pose.elB ?? 0))}} />
        ))}
    </FieldStage>
  );
};

// ------------------------------------------------------------------ S3: leave them — families fill baskets at the glowing corner
export const S3Leave: React.FC<{t: number; preview?: boolean}> = ({t, preview}) => {
  const cam = fieldCam('S3', t);
  const wk = E.familiesWalk;
  const people = [
    {look: C.MOTHER, x1: 4.6, z: -9.25, delay: 0.0, sc: 1.6, basket: true, child: true},
    {look: C.OLD_MAN, x1: 6.5, z: -9.7, delay: 0.25, sc: 1.62, basket: true},
    {look: C.TRAVELER, x1: 8.3, z: -9.4, delay: 0.45, sc: 1.68, basket: true, bundle: true},
  ];
  const happy = smooth(clamp((t - E.happy) / 0.5));
  const items = people.map((pp, i) => {
    const k = clamp((t - wk.start - pp.delay) / (wk.end - wk.start - 0.2));
    const x = lerp(pp.x1 - 6.5, pp.x1, easeOut(k));
    const walking = k < 1;
    const dist = 6.5 * easeOut(k);
    const phase = (dist / 1.25) * Math.PI * 2;
    const pickT = (E.pours as number[])[i];
    const bend = !walking ? smooth(clamp((t - (wk.end + 0.1 + i * 0.2)) / 0.4)) * (1 - smooth(clamp((t - pickT - 0.9) / 0.4))) : 0;
    let pose = walking ? C.walkPose(phase, 0.8) : C.mixPose(C.STAND, C.BEND, bend * 0.75);
    if (happy > 0) pose = C.mixPose(pose, {...C.STAND, shF: 30, elF: 60}, happy);
    const fill = clamp((t - pickT) / 0.9) * 0.6 + (t > pickT + 1 ? 0.4 * clamp((t - pickT - 1) / 1) : 0);
    return {pp, p: place(cam, x, pp.z, pp.sc), pose, fill, walking, phase, i, bend};
  });
  return (
    <FieldStage shot="S3" t={t} preview={preview}>
      <Dust t={t} n={36} seed={31} area={[300, 500, 1080, 1450]} size={4} opacity={0.7} />
      {items
        .sort((a, b) => b.p.depth - a.p.depth)
        .map(({pp, p, pose, fill, walking, phase, i, bend}) => (
          <g key={i}>
            {pp.child && (
              <Person look={C.CHILD} pose={walking ? C.walkPose(phase + 1, 0.8) : C.STAND} t={t} seed={44} x={p.x - 120 * p.s} y={p.y + 4} scale={p.s * 0.6}
                face={{brow: happy > 0.5 ? 'happy' : 'worried', mouth: happy > 0.5 ? 'bigSmile' : 'soft', eyes: blink(44, t)}} walk={phase} />
            )}
            <Person look={pp.look} pose={pose} t={t} seed={40 + i} x={p.x} y={p.y} scale={p.s} walk={walking ? phase : 0}
              face={{brow: happy > 0.5 ? 'happy' : bend > 0.3 ? 'kind' : 'worried', mouth: happy > 0.5 ? 'bigSmile' : 'soft', eyeStyle: happy > 0.7 ? 'happy' : 'normal', eyes: blink(40 + i, t)}}
              front={{kind: 'basket', fill, angle: 0}} onBack={pp.bundle ? {kind: 'bundle'} : undefined} />
          </g>
        ))}
      {items.map(({p, i}) => {
        const pt = (E.pours as number[])[i];
        return <GrainFall key={i} t={t} t0={pt} t1={pt + 0.8} from={[p.x + 70 * p.s, p.y - 470 * p.s]} to={[p.x + 60 * p.s, p.y - 250 * p.s]} n={14} seed={60 + i} spread={14} size={5} />;
      })}
    </FieldStage>
  );
};

// ------------------------------------------------------------------ S7: the corner — Ruth gathers leftovers (low shot)
export const S7Corner: React.FC<{t: number; preview?: boolean}> = ({t, preview}) => {
  const cam = fieldCam('S7', t);
  const r = place(cam, 6.05, -9.05);
  const picks = E.pickups as number[];
  // reach down → grab → lift to the basket, on each pickup cue
  const last = picks.filter((p) => p <= t + 0.35).pop();
  const ph = last === undefined ? 1 : clamp((t - (last - 0.35)) / 1.0);
  const reach = Math.sin(clamp(ph / 0.7) * Math.PI);
  const pose = {...C.BEND, shF: lerp(-6, 8, reach), elF: lerp(46, 4, reach), lean: 58 + reach * 6, head: -22};
  const fill = clamp(picks.filter((p) => p < t).length / 3) * 0.7;
  const bg1 = place(cam, 1.2, -12.6), bg2 = place(cam, -1.6, -13.4);
  return (
    <FieldStage shot="S7" t={t} preview={preview}>
      {/* far workers tying sheaves */}
      <Person look={C.REAPER_B} pose={{...C.BEND, lean: 40}} t={t} seed={71} x={bg2.x} y={bg2.y} scale={bg2.s} face={{mouth: 'soft', eyes: blink(71, t)}} front={{kind: 'grain', angle: 170}} />
      <Person look={C.REAPER_A} pose={{...C.STAND, shF: 20, elF: 60}} t={t} seed={72} x={bg1.x} y={bg1.y} scale={bg1.s} face={{mouth: 'soft', eyes: blink(72, t)}} front={{kind: 'sickle', angle: 120}} />
      {/* leftover heads of grain on the stubble */}
      {Array.from({length: 7}).map((_, i) => {
        const gx = r.x + (130 + i * 44 + Math.sin(i * 2.7) * 18) * r.s;
        const taken = picks.filter((p) => p < t).length > i % 3 && i < 3;
        return taken ? null : <GrainHead key={i} x={gx} y={r.y - 4 + Math.cos(i * 1.9) * 16} a={70 + ((i * 47) % 60)} s={r.s * 1.05} lw={3} />;
      })}
      <Person look={C.RUTH} pose={pose} t={t} seed={7} x={r.x} y={r.y} scale={r.s} sway={1.2}
        face={{brow: 'kind', mouth: 'soft', eyeStyle: 'down', eyes: blink(7, t)}} front={reach > 0.4 ? {kind: 'grain', angle: 180 - ((pose.shF ?? 0) + (pose.elF ?? 0))} : undefined}
        back={{kind: 'basket', fill, angle: 0}} />
      <Dust t={t} n={60} seed={77} area={[0, 300, 1080, 1700]} size={5} opacity={0.85} />
    </FieldStage>
  );
};

// ------------------------------------------------------------------ S9: Boaz notices; workers drop extra grain on purpose
export const S9Boaz: React.FC<{t: number; preview?: boolean}> = ({t, preview}) => {
  const cam = fieldCam('S9', t);
  const wp = E.whipPan;
  const panK = clamp((t - wp.start) / (wp.end - wp.start));
  const blurX = Math.sin(panK * Math.PI) * 38;
  const b = place(cam, -3.3, -9.0, 1.72);
  const w0 = place(cam, -2.1, -9.7);
  const notice = smooth(clamp((t - E.boazNotice) / 0.4));
  const whisper = smooth(clamp((t - E.whisper) / 0.25));
  const boazPose = whisper > 0
    ? C.mixPose({...C.STAND, shF: 110, elF: 110}, {...C.STAND, lean: 10, head: 10, shF: 20, elF: 140}, whisper)
    : C.mixPose(C.STAND, {...C.STAND, shF: 110, elF: 110}, notice);
  const ruth = place(cam, 6.8, -9.6);
  const wa = place(cam, 5.5, -10.7), wb = place(cam, 8.4, -11.2);
  const amazed = smooth(clamp((t - E.ruthAmazed) / 0.3));
  const drops = E.drops as number[];
  const ruthPose = C.mixPose(C.BEND, {...C.STAND, shF: 40, elF: 70, shB: -20, elB: 80}, amazed);
  const dropPose = (k: number) => ({...C.STAND, shB: lerp(-10, -40, k), elB: lerp(20, 0, k), head: -6});
  return (
    <FieldStage shot="S9" t={t} preview={preview} blurX={blurX} overlay={
      <Label text="ON PURPOSE · RUTH 2:16" t={t} tin={E.ruth216Label} tout={SC.S9.end + 0.1} at={{x: 470, y: 900}} target={{x: wa.x - 20 * wa.s, y: wa.y - 470 * wa.s}} />
    }>
      <Dust t={t} n={30} seed={91} area={[0, 600, 1080, 1500]} size={4} opacity={0.6} />
      {/* Boaz + a worker he whispers to */}
      <Person look={C.REAPER_A} pose={{...C.STAND, head: -4}} flip t={t} seed={92} x={w0.x} y={w0.y} scale={w0.s} face={{brow: whisper > 0.5 ? 'raised' : 'kind', mouth: whisper > 0.5 ? 'sly' : 'soft', eyes: blink(92, t), lookX: 1}} front={{kind: 'sickle', angle: 150}} />
      <Person look={C.BOAZ} pose={boazPose} t={t} seed={93} x={b.x} y={b.y} scale={b.s} flip={whisper > 0.5 ? false : false}
        face={{brow: whisper > 0.5 ? 'sly' : notice > 0.5 ? 'kind' : 'neutral', mouth: whisper > 0.5 ? 'whisper' : 'smile', eyes: blink(93, t), lookX: 1}} />
      {/* near Ruth: the workers secretly let grain fall in her path */}
      {[{p: wa, look: C.REAPER_B, k: 0, seed: 94}, {p: wb, look: C.REAPER_C, k: 1, seed: 95}].map(({p, look, k, seed}) => {
        const dk = smooth(clamp((t - drops[k] + 0.2) / 0.25));
        return (
          <Person key={seed} look={look} pose={dropPose(dk)} t={t} seed={seed} x={p.x} y={p.y} scale={p.s} flip={k === 1}
            face={{brow: 'sly', mouth: 'sly', eyes: blink(seed, t), lookX: -1}} back={dk < 0.8 ? {kind: 'grain', angle: 170} : undefined} />
        );
      })}
      {drops.map((d, i) => {
        const src = i === 1 ? wb : wa;
        return <GrainFall key={i} t={t} t0={d} t1={d + 0.25} from={[src.x + (i === 1 ? 50 : -50) * src.s, src.y - 300 * src.s]} to={[ruth.x + (i - 1) * 60, ruth.y - 8]} n={10} seed={96 + i} spread={30} size={6} />;
      })}
      <Person look={C.RUTH} pose={ruthPose} t={t} seed={7} x={ruth.x} y={ruth.y} scale={ruth.s}
        face={{brow: amazed > 0.5 ? 'raised' : 'kind', mouth: amazed > 0.5 ? 'open' : 'soft', eyeStyle: amazed > 0.5 ? 'wide' : 'down', eyes: blink(7, t)}}
        back={{kind: 'basket', fill: 0.4 + amazed * 0.6, angle: 0}} />
    </FieldStage>
  );
};
void head; void easeInOut;
