import React, {useMemo} from 'react';
import * as THREE from 'three';
import {buildTown, buildSchool} from './town';
import {makeSignTexture} from './textures';
import {lerp} from '../lib/math';

let TOWN_CACHE: ReturnType<typeof buildTown> | null = null;
let SCHOOL_CACHE: ReturnType<typeof buildSchool> | null = null;

/** night: 0 = day, 1 = full night (windows + lamps glow). */
export const Town: React.FC<{night: number; lampBoost?: number}> = ({night, lampBoost = 1}) => {
  const geo = useMemo(() => (TOWN_CACHE ??= buildTown()), []);
  const sch = useMemo(() => (SCHOOL_CACHE ??= buildSchool()), []);
  const mats = useMemo(
    () => ({
      solid: new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.88}),
      road: new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.95}),
      foliage: new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.8}),
      glass: new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.12, metalness: 0.4}),
      warm: new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.3, emissive: '#ffbe6b', emissiveIntensity: 0}),
      bulbs: new THREE.MeshStandardMaterial({vertexColors: true, emissive: '#ffe2a8', emissiveIntensity: 0}),
    }),
    []
  );
  mats.warm.emissiveIntensity = lerp(0.05, 1.6, night);
  mats.bulbs.emissiveIntensity = lerp(0.2, 6, night) * lampBoost;
  return (
    <group>
      <mesh geometry={geo.road} material={mats.road} receiveShadow />
      <mesh geometry={geo.solid} material={mats.solid} castShadow receiveShadow />
      <mesh geometry={geo.foliage} material={mats.foliage} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={mats.glass} />
      <mesh geometry={geo.warm} material={mats.warm} />
      <mesh geometry={geo.bulbs} material={mats.bulbs} />
      <mesh geometry={sch.solid} material={mats.solid} castShadow receiveShadow />
      <mesh geometry={sch.glass} material={mats.glass} />
      <mesh geometry={sch.warm} material={mats.warm} />
    </group>
  );
};

/** Gate arch sign: front reads SUNRISE SCHOOL, flips (rotates about X) to reveal HOLIDAY. */
export const GateSign: React.FC<{flip: number; glow: number}> = ({flip, glow}) => {
  const tex = useMemo(
    () => ({
      front: makeSignTexture('SUNRISE SCHOOL', '#1f2a44', '#f6ecd4', 'Lora', 700),
      back: makeSignTexture('HOLIDAY', '#f5ecff', '#1a0b33', 'Poppins', 800, '#b46bff'),
    }),
    []
  );
  const mFront = useMemo(() => new THREE.MeshStandardMaterial({map: tex.front, roughness: 0.6}), [tex]);
  const mBack = useMemo(
    () => new THREE.MeshStandardMaterial({map: tex.back, emissiveMap: tex.back, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.4}),
    [tex]
  );
  mBack.emissiveIntensity = glow;
  const frame = useMemo(() => new THREE.MeshStandardMaterial({color: '#6a3b29', flatShading: true, roughness: 0.7}), []);
  return (
    <group position={[0, 5.9, -89.55]}>
      <mesh material={frame}>
        <boxGeometry args={[7.4, 1.5, 0.12]} />
      </mesh>
      <group rotation={[flip * Math.PI, 0, 0]}>
        <mesh material={mFront} position={[0, 0, 0.08]}>
          <planeGeometry args={[7, 1.2]} />
        </mesh>
        <mesh material={mBack} position={[0, 0, -0.08]} rotation={[Math.PI, 0, 0]}>
          <planeGeometry args={[7, 1.2]} />
        </mesh>
        <mesh material={frame}>
          <boxGeometry args={[7.1, 1.3, 0.1]} />
        </mesh>
      </group>
    </group>
  );
};

/** Bell in the belfry; swings by itself. */
export const Bell: React.FC<{swing: number; ring: number}> = ({swing, ring}) => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({color: '#c8962e', metalness: 0.85, roughness: 0.3, flatShading: true, emissive: '#5a3a00', emissiveIntensity: 0.4}), []);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}),
    []
  );
  const prof = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.95, -0.05),
          new THREE.Vector2(0.85, 0.25),
          new THREE.Vector2(0.6, 0.8),
          new THREE.Vector2(0.55, 1.2),
          new THREE.Vector2(0.35, 1.45),
          new THREE.Vector2(0.0, 1.5),
        ],
        10
      ),
    []
  );
  return (
    <group position={[0, 18.3, -102.5]}>
      <group rotation={[0, 0, swing]}>
        <mesh geometry={prof} material={m} position={[0, -1.6, 0]} />
        <mesh material={m} position={[0, -1.75, 0]}>
          <icosahedronGeometry args={[0.2, 0]} />
        </mesh>
      </group>
      {ring > 0 &&
        [0, 0.33, 0.66].map((o, i) => {
          const p = (ring + o) % 1;
          ringMat.opacity = 1;
          return (
            <mesh key={i} position={[0, -0.9, 0.5]} scale={1 + p * 5} rotation={[0, 0, 0]}>
              <torusGeometry args={[1, 0.035 * (1 - p), 4, 32]} />
              <meshBasicMaterial color="#ffd27a" transparent opacity={(1 - p) * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          );
        })}
    </group>
  );
};
