/**
 * Everything inside the WebGL canvas. Time comes from Remotion's frame
 * counter, so every frame is deterministic and can render in parallel.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EVENTS, HOOK } from '../timeline';
import { crankRad, cycleDeg, exhaustLift, intakeLift } from '../lib/kinematics';
import { Engine } from './Engine';
import { ChargeParticles, SmokeParticles } from './Particles';
import { Combustion } from './Combustion';
import { CameraRig, cameraState } from './CameraRig';
import { Atmosphere, Lighting, Reflections } from './Lighting';
import { Workshop } from './Workshop';
import { CarInterior, DarkRoom, HookCharacter } from './HookCharacter';
import { CAR_ORIGIN, CarSet, carOffset } from './CarSet';

export const Scene3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const theta = crankRad(t);
  const cyc = cycleDeg(t);
  const hook = t < EVENTS.lightSnap;
  const onRoad = t >= EVENTS.whipCut;
  const cam = cameraState(t);
  const carPos = CAR_ORIGIN.clone().add(carOffset(t));

  return (
    <>
      <Atmosphere t={t} onRoad={onRoad} />
      <Reflections hook={hook} />
      <CameraRig t={t} />
      <Lighting t={t} focus={cam.target} carPos={carPos} onRoad={onRoad} />

      {/* Scene 1: goofy guy (dark room → daylight car interior) */}
      <group visible={t < HOOK.engineCut}>
        <HookCharacter t={t} camPos={cam.pos} />
        <group visible={hook}>
          <DarkRoom />
        </group>
        <group visible={!hook}>
          <CarInterior />
        </group>
      </group>

      <group visible={!onRoad && t >= HOOK.engineCut}>
        <Workshop />
        <Engine theta={theta} intakeLift={intakeLift(cyc)} exhaustLift={exhaustLift(cyc)} fullLip={hook} />
        <ChargeParticles t={t} />
        <SmokeParticles t={t} />
        <Combustion t={t} frame={frame} />
      </group>

      <group visible={onRoad}>
        <CarSet t={t} />
      </group>
    </>
  );
};
