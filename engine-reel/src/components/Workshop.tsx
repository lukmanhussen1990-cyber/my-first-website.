/**
 * Matte teal-slate tiled workshop backdrop + floor, plus the warm mist that
 * drifts through the dark hook.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { EVENTS } from '../timeline';
import { ENGINE as E } from '../lib/kinematics';
import { rand, randRange, smoothstep } from '../lib/math';
import { floorTexture, glowTexture, tileTexture } from '../lib/textures';
import type { CamState } from './CameraRig';

const WALL_Z = -2.2;

export const Workshop: React.FC = () => {
  const mats = useMemo(() => {
    const wallTex = tileTexture().clone();
    wallTex.needsUpdate = true;
    wallTex.repeat.set(60 / 4, 28 / 4); // 8 tiles per texture → 0.5-unit tiles
    const floorTex = floorTexture().clone();
    floorTex.needsUpdate = true;
    floorTex.repeat.set(60 / 6, 50 / 6);
    return {
      wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.88, metalness: 0 }),
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.05 }),
      trim: new THREE.MeshStandardMaterial({ color: '#24413f', roughness: 0.6 }),
      stand: new THREE.MeshStandardMaterial({ color: '#2f3b40', roughness: 0.45, metalness: 0.4 }),
    };
  }, []);
  return (
    <group>
      <mesh material={mats.wall} position={[6, E.floorY + 14, WALL_Z]} receiveShadow>
        <planeGeometry args={[60, 28]} />
      </mesh>
      <mesh material={mats.floor} position={[6, E.floorY, WALL_Z + 25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 50]} />
      </mesh>
      {/* baseboard */}
      <mesh material={mats.trim} position={[6, E.floorY + 0.12, WALL_Z + 0.04]} receiveShadow castShadow>
        <boxGeometry args={[36, 0.24, 0.08]} />
      </mesh>
      {/* low display plinth the engine stands on */}
      <mesh material={mats.stand} position={[0, E.floorY - 0.02, -0.35]} receiveShadow>
        <boxGeometry args={[3.0, 0.08, 1.7]} />
      </mesh>
    </group>
  );
};

/** Warm mist drifting "up" the screen during the hook (camera is rolled, so we use its basis). */
export const HookMist: React.FC<{ t: number; cam: CamState }> = ({ t, cam }) => {
  const glow = glowTexture();
  const fade = 1 - smoothstep(EVENTS.lightSnap - 0.05, EVENTS.lightSnap, t);
  const sprites = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        x: randRange(i, 1, -0.9, 0.9),
        z: randRange(i, 2, -0.4, 0.6),
        speed: randRange(i, 3, 0.12, 0.28),
        phase: rand(i, 4),
        size: randRange(i, 5, 0.6, 1.4),
        color: ['#ff4a3c', '#ff2a8a', '#ffb04a', '#ff6a5a'][i % 4],
        op: randRange(i, 6, 0.1, 0.22),
      })),
    [],
  );
  if (fade <= 0) return null;
  const anchor = new THREE.Vector3(0, 0.85, 0.15);
  return (
    <group>
      {sprites.map((s, i) => {
        const cycle = (s.phase + t * s.speed) % 1; // 0..1 rise loop
        const up = -0.9 + cycle * 1.8;
        const p = anchor
          .clone()
          .addScaledVector(cam.right, s.x + Math.sin(t * 0.7 + i) * 0.08)
          .addScaledVector(cam.up, up)
          .addScaledVector(cam.forward, -s.z);
        const life = Math.sin(cycle * Math.PI);
        return (
          <sprite key={i} position={p.toArray()} scale={[s.size, s.size, 1]}>
            <spriteMaterial
              map={glow}
              color={s.color}
              transparent
              opacity={s.op * life * fade}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </sprite>
        );
      })}
    </group>
  );
};
