/**
 * Everything inside the WebGL canvas. Time comes from Remotion's frame
 * counter, so every frame is deterministic and can render in parallel.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { EVENTS } from '../timeline';
import { crankRad, cycleDeg, exhaustLift, intakeLift } from '../lib/kinematics';
import { Engine } from './Engine';
import { ChargeParticles, SmokeParticles } from './Particles';
import { Combustion } from './Combustion';
import { CameraRig, cameraState } from './CameraRig';
import { Atmosphere, Lighting, Reflections } from './Lighting';
import { HookMist, Workshop } from './Workshop';
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

      <group visible={!onRoad}>
        <group visible={!hook}>
          <Workshop />
        </group>
        <Engine theta={theta} intakeLift={intakeLift(cyc)} exhaustLift={exhaustLift(cyc)} fullLip={hook} />
        <ChargeParticles t={t} />
        <SmokeParticles t={t} />
        <Combustion t={t} frame={frame} />
        {hook && <HookMist t={t} cam={cam} />}
      </group>

      <group visible={onRoad}>
        <CarSet t={t} />
      </group>
    </>
  );
};
