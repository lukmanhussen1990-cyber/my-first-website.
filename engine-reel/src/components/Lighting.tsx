/**
 * Lighting + atmosphere.
 *  • Hook: pitch dark, only moody red / magenta / amber rim spots + fog.
 *  • Snap: flat, bright studio light with crisp directional shadows.
 *  • Road: sunny daylight that follows the car.
 * Every light stays mounted the whole time (intensities just change), so the
 * shaders never recompile mid-render.
 */
import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EVENTS } from '../timeline';
import { bump } from '../lib/math';

type Props = { t: number; focus: THREE.Vector3; carPos: THREE.Vector3; onRoad: boolean };

const useTarget = (pos: [number, number, number]) => {
  const scene = useThree((s) => s.scene);
  const obj = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    scene.add(obj);
    return () => {
      scene.remove(obj);
    };
  }, [scene, obj]);
  obj.position.set(...pos);
  obj.updateMatrixWorld();
  return obj;
};

export const Lighting: React.FC<Props> = ({ t, focus, carPos, onRoad }) => {
  const hook = t < EVENTS.lightSnap;
  const studio = !hook && !onRoad;

  // spotlight targets (the "sleeve")
  const sleeve = useTarget([0, 0.9, 0]);
  const keyTarget = useTarget(onRoad ? [carPos.x, 0, carPos.z - 2] : [focus.x, 1.2, 0]);

  // rhythmic breathing of the mood lights in the hook
  const breathe = 0.85 + 0.15 * Math.sin(t * Math.PI * 2 * 0.7);
  const hookK = hook ? breathe : 0;
  // dim the studio a touch for the combustion close-up so the fire pops
  const fireDim = 1 - 0.35 * bump(22.4, 23.0, 29.4, t);

  const keyPos: [number, number, number] = onRoad
    ? [carPos.x - 9, 16, carPos.z + 10]
    : [focus.x - 4.5, 8.5, 7.5];

  return (
    <>
      {/* ── HOOK: moody rim spots ── */}
      <ambientLight color="#2a0712" intensity={hook ? 0.06 : 0} />
      <spotLight position={[-1.7, 2.3, -1.5]} target={sleeve} color="#ff2bd0" intensity={hookK * 38} angle={0.55} penumbra={0.85} decay={2} distance={0} />
      <spotLight position={[2.4, 0.4, -0.6]} target={sleeve} color="#ff1f3d" intensity={hookK * 30} angle={0.5} penumbra={0.9} decay={2} distance={0} />
      <spotLight position={[0.4, 3.0, 2.0]} target={sleeve} color="#ffa040" intensity={hookK * 14} angle={0.32} penumbra={1} decay={2} distance={0} />
      <pointLight position={[0.2, 0.1, 1.0]} color="#ff3a2a" intensity={hook ? 0.5 : 0} decay={2} distance={0} />

      {/* ── STUDIO / ROAD ── */}
      <hemisphereLight
        color={onRoad ? '#dff3ff' : '#f2fbff'}
        groundColor={onRoad ? '#7fae6a' : '#4c5f64'}
        intensity={studio ? 1.15 * fireDim : onRoad ? 1.1 : 0}
      />
      <directionalLight
        position={keyPos}
        target={keyTarget}
        color={onRoad ? '#fff3df' : '#fff6ea'}
        intensity={studio ? 2.7 * fireDim : onRoad ? 3.0 : 0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-camera-left={onRoad ? -12 : -6}
        shadow-camera-right={onRoad ? 12 : 6}
        shadow-camera-top={onRoad ? 12 : 6}
        shadow-camera-bottom={onRoad ? -12 : -4}
      />
      <directionalLight position={[focus.x + 6, 3, 5]} color="#d6ecff" intensity={studio ? 0.7 * fireDim : onRoad ? 0.4 : 0} />
      <directionalLight position={[focus.x + 2, 6, -6]} color="#ffffff" intensity={studio ? 1.1 : onRoad ? 0.6 : 0} />
    </>
  );
};

/** Background colour, fog and environment-reflection strength per section. */
export const Atmosphere: React.FC<{ t: number; onRoad: boolean }> = ({ t, onRoad }) => {
  const scene = useThree((s) => s.scene);
  const bg = useMemo(() => new THREE.Color(), []);
  const fog = useMemo(() => new THREE.Fog('#000000', 10, 100), []);
  useLayoutEffect(() => {
    const hook = t < EVENTS.lightSnap;
    if (hook) {
      bg.set('#050207');
      fog.color.set('#07030a');
      fog.near = 2.2;
      fog.far = 7.5;
    } else if (onRoad) {
      bg.set('#9fdcf7');
      fog.color.set('#bfe8fa');
      fog.near = 35;
      fog.far = 150;
    } else {
      bg.set('#4f8a89');
      fog.color.set('#4f8a89');
      fog.near = 60;
      fog.far = 120;
    }
    scene.background = bg;
    scene.fog = fog;
    scene.environmentIntensity = hook ? 0.18 : 1;
  }, [t, onRoad, scene, bg, fog]);
  return null;
};

/** Procedural reflection environments (no HDR downloads). Remounts on change. */
export const Reflections: React.FC<{ hook: boolean }> = ({ hook }) =>
  hook ? (
    <Environment key="hook" resolution={128} frames={1}>
      <color attach="background" args={['#120409']} />
      <Lightformer form="rect" intensity={2.2} color="#ff2bd0" position={[-4, 2, -2]} scale={[2, 6, 1]} rotation-y={Math.PI / 2} />
      <Lightformer form="rect" intensity={2.0} color="#ff2a3a" position={[4, 0.5, 2]} scale={[2, 5, 1]} rotation-y={-Math.PI / 2} />
      <Lightformer form="ring" intensity={1.4} color="#ffa040" position={[0, 5, 3]} scale={2} />
    </Environment>
  ) : (
    <Environment key="studio" resolution={256} frames={1}>
      <color attach="background" args={['#71878b']} />
      <Lightformer form="rect" intensity={3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 5, 1]} />
      <Lightformer form="rect" intensity={2.2} position={[-6, 2.5, 2]} rotation-y={Math.PI / 2} scale={[1.6, 7, 1]} />
      <Lightformer form="rect" intensity={2.2} position={[6, 2.5, 2]} rotation-y={-Math.PI / 2} scale={[1.6, 7, 1]} />
      <Lightformer form="rect" intensity={1.1} position={[0, 2, 7]} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#6fb3b0" position={[0, 1, -7]} rotation-y={Math.PI} scale={[14, 6, 1]} />
      <Lightformer form="rect" intensity={0.5} color="#8fd0ff" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
    </Environment>
  );

