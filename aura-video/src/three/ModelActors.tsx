import React, {useMemo} from 'react';
import * as THREE from 'three';
import {ModelCharacter, BoneOffsets} from './ModelCharacter';
import type {PersonPose} from './Person';
import {Ball} from './Actors';
import {makeRimMaterial} from './materials';

/** Maps the old procedural pose description onto the CC0 model rigs. */
const WALK_LEN = 1.25; // seconds per walk cycle (2 steps) in the human clips
export const HUMAN_SCALE = 0.47;

const poseToClip = (pose: PersonPose, f: number) => {
  const walk = pose.walk ?? 0;
  if (pose.seated) return {clip: 'SitDown', time: 1.6};
  if (walk > 0.05) return {clip: 'Walk', time: (((pose.walkPhase ?? 0) / (Math.PI * 2)) * WALK_LEN) % WALK_LEN};
  return {clip: 'Idle', time: ((pose.time ?? f) / 30) % 4};
};

const poseBones = (pose: PersonPose): BoneOffsets => {
  const b: BoneOffsets = {
    Head: [pose.headPitch ?? 0, pose.headYaw ?? 0, -(pose.headRoll ?? 0)],
    Torso: [pose.lean ?? 0, pose.twist ?? 0, 0],
  };
  return b;
};

const HERO_COLORS = {Shirt: '#9fc8ec', Pants: '#22304f', Belt: '#1c1c1c', Face: '#1d130c', Skin: '#e3ad86', Hair: '#2b1a10'};

const Paste: React.FC = () => {
  const m = useMemo(() => makeRimMaterial({color: '#f6fffb', roughness: 0.3, emissive: '#e6fff7', emissiveIntensity: 0.35}), []);
  const b = useMemo(() => makeRimMaterial({color: '#3ec0e8', roughness: 0.3}), []);
  const g = useMemo(() => new THREE.IcosahedronGeometry(0.05, 1).scale(1.4, 0.8, 0.35), []);
  return (
    <group rotation={[0.05, 0, 0.35]}>
      <mesh geometry={g} material={m} />
      <mesh geometry={g} material={m} position={[0.05, -0.035, 0.005]} scale={0.7} rotation={[0, 0, 1]} />
      <mesh geometry={g} material={m} position={[-0.04, 0.03, 0.005]} scale={0.55} rotation={[0, 0, -0.6]} />
      <mesh material={b} position={[0.005, 0.0, 0.02]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.075, 0.014, 0.02]} />
      </mesh>
      <mesh material={b} position={[0.035, -0.025, 0.018]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.045, 0.012, 0.02]} />
      </mesh>
    </group>
  );
};

const Backpack: React.FC = () => {
  const m = useMemo(() => makeRimMaterial({color: '#e2553e', roughness: 0.7}), []);
  const d = useMemo(() => makeRimMaterial({color: '#a8372a', roughness: 0.7}), []);
  return (
    <group>
      <mesh material={m} castShadow>
        <boxGeometry args={[0.3, 0.36, 0.15]} />
      </mesh>
      <mesh material={d} position={[0, -0.08, -0.085]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
      </mesh>
      <mesh material={d} position={[-0.1, 0.05, 0.1]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.04, 0.3, 0.03]} />
      </mesh>
      <mesh material={d} position={[0.1, 0.05, 0.1]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.04, 0.3, 0.03]} />
      </mesh>
    </group>
  );
};

const Cap: React.FC<{color: string}> = ({color}) => {
  const m = useMemo(() => makeRimMaterial({color, roughness: 0.55}), [color]);
  return (
    <group rotation={[-0.1, Math.PI, 0]}>
      <mesh material={m} castShadow>
        <sphereGeometry args={[0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      </mesh>
      <mesh material={m} position={[0, 0, 0.45]} scale={[1, 1, 1.25]}>
        <cylinderGeometry args={[0.42, 0.42, 0.05, 10, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
    </group>
  );
};

export const DogGlasses: React.FC = () => {
  const lens = useMemo(() => new THREE.MeshStandardMaterial({color: '#050608', roughness: 0.05, metalness: 0.8}), []);
  const glint = useMemo(() => new THREE.MeshBasicMaterial({color: '#ffffff'}), []);
  return (
    <group>
      <mesh material={lens} position={[-0.27, 0, 0]}>
        <boxGeometry args={[0.42, 0.24, 0.08]} />
      </mesh>
      <mesh material={lens} position={[0.27, 0, 0]}>
        <boxGeometry args={[0.42, 0.24, 0.08]} />
      </mesh>
      <mesh material={lens} position={[0, 0.06, 0]}>
        <boxGeometry args={[0.2, 0.05, 0.06]} />
      </mesh>
      <mesh material={glint} position={[-0.33, 0.05, 0.05]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.14, 0.025, 0.01]} />
      </mesh>
      <mesh material={glint} position={[0.2, 0.05, 0.05]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.08, 0.02, 0.01]} />
      </mesh>
    </group>
  );
};

export const HeroModel: React.FC<{
  pos: [number, number, number];
  rotY: number;
  pose: PersonPose;
  f: number;
  rim: string;
  rimStrength: number;
  ballInHand?: boolean;
  catchPose?: number;
  override?: THREE.Material;
  extraBones?: BoneOffsets;
  clipOverride?: {clip: string; time: number};
}> = ({pos, rotY, pose, f, rim, rimStrength, ballInHand, catchPose = 0, override, extraBones, clipOverride}) => {
  const {clip, time} = clipOverride ?? poseToClip(pose, f);
  const bones = {...poseBones(pose), ...(extraBones ?? {})};
  return (
    <ModelCharacter
      model="boy"
      clip={clip}
      time={time}
      partial={catchPose > 0 ? {clip: 'Victory', time: 0.6, weight: catchPose, bones: ['ShoulderR', 'UpperArmR', 'LowerArmR', 'FistR']} : undefined}
      position={pos}
      rotationY={rotY}
      scale={HUMAN_SCALE}
      colors={HERO_COLORS}
      rim={rim}
      rimStrength={rimStrength}
      crack={pose.crack ?? 0}
      crackMats={['Skin']}
      emissive={pose.eyeGlow ? {Face: ['#c084fc', 4 * pose.eyeGlow]} : undefined}
      override={override}
      bones={bones}
      attach={
        override
          ? undefined
          : {
              Torso: (
                <>
                  <group position={[-0.17, 0.18, 0.4]} scale={2.3}>
                    <Paste />
                  </group>
                  <group position={[0, 0.05, -0.46]} scale={2.3}>
                    <Backpack />
                  </group>
                </>
              ),
              ...(ballInHand ? {FistR: <group scale={2.6}><Ball position={[0, 0.06, 0]} spin={0.3} /></group>} : {}),
            }
      }
    />
  );
};

export const NpcModel: React.FC<{look: string; pos: [number, number, number]; rotY: number; pose: PersonPose; f: number; rim: string; rimStrength: number}> = ({look, pos, rotY, pose, f, rim, rimStrength}) => {
  const palette: Record<string, Record<string, string>> = {
    npc0: {Shirt: '#e98a6b', Pants: '#3d4b6e', Face: '#1d130c', Skin: '#f0c4a2', Hair: '#7a4b2a'},
    npc1: {Shirt: '#f2d16b', Pants: '#2f3a52', Face: '#1d130c', Skin: '#b97c56', Hair: '#141010'},
    npc2: {Shirt: '#7fb4a8', Pants: '#47404f', Face: '#1d130c', Skin: '#e8b892', Hair: '#d0a35a'},
    npc3: {Shirt: '#c45b7a', Pants: '#28304a', Face: '#1d130c', Skin: '#8d5b3d', Hair: '#191311'},
    anchor: {Shirt: '#1f3c72', Pants: '#1f2a44', Face: '#1d130c', Skin: '#e7b996', Hair: '#3b2416', Belt: '#111'},
  };
  const {clip, time} = poseToClip(pose, f);
  return (
    <ModelCharacter
      model={look === 'npc1' || look === 'npc3' ? 'boy' : 'boy2'}
      clip={clip}
      time={time}
      position={pos}
      rotationY={rotY}
      scale={0.52}
      colors={palette[look] ?? palette.npc0}
      rim={rim}
      rimStrength={rimStrength}
      bones={poseBones(pose)}
    />
  );
};

export const BullyModel: React.FC<{pose: PersonPose; f: number; rim: string; rimStrength: number}> = ({pose, f, rim, rimStrength}) => {
  const pc = pose.pedal ?? 0;
  return (
    <ModelCharacter
      model="boy2"
      clip="Idle"
      time={(f / 30) % 4}
      position={[0, 0.3, -0.02]}
      scale={0.5}
      colors={{Shirt: '#5f7d3b', Pants: '#5b5f66', Face: '#1d130c', Skin: '#c98f6a', Hair: '#1b130e', Belt: '#222'}}
      rim={rim}
      rimStrength={rimStrength}
      bones={{
        Head: [pose.headPitch ?? 0, (pose.headYaw ?? 0) * 0.6, 0],
        Torso: [0.12 + Math.sin(pc) * 0.03, (pose.headYaw ?? 0) * 0.4, Math.sin(pc) * 0.05],
      }}
      attach={pose.capOn !== false ? {Head: <group position={[0, 0.95, 0.02]} scale={1.05}><Cap color="#d22b2b" /></group>} : undefined}
    />
  );
};

export const LooseCapModel: React.FC<{position: [number, number, number]; rotation: [number, number, number]}> = ({position, rotation}) => (
  <group position={position} rotation={rotation} scale={0.5}>
    <Cap color="#d22b2b" />
  </group>
);

export const DogModel: React.FC<{pos: [number, number, number]; rotY: number; phase: number; trot: number; sunglasses: boolean; headYaw: number; rim: string; rimStrength: number; f: number}> = ({
  pos,
  rotY,
  phase,
  trot,
  sunglasses,
  headYaw,
  rim,
  rimStrength,
  f,
}) => {
  const walking = trot > 0.05;
  const time = walking ? ((phase / (Math.PI * 2)) * 1.0667) % 1.0667 : (f / 30) % 3;
  return (
    <ModelCharacter
      model="dog"
      clip={walking ? 'Walk' : 'Idle'}
      time={time}
      position={pos}
      rotationY={rotY}
      scale={0.17}
      colors={{Main: '#c98a4e', Main_Light: '#f1dcb6', Black: '#2a1c14'}}
      rim={rim}
      rimStrength={rimStrength}
      bones={{Head: [0, 0, -headYaw]}}
      attach={sunglasses ? {Head: <group position={[0, 0.62, 0.32]} rotation={[-Math.PI / 2 + 0.25, 0, 0]}><DogGlasses /></group>} : undefined}
    />
  );
};

export const FoxModel: React.FC<{pos: [number, number, number]; rotY: number; scale: number; f: number}> = ({pos, rotY, scale, f}) => (
  <ModelCharacter
    model="fox"
    clip="Idle"
    time={(f / 30) % 3}
    position={pos}
    rotationY={rotY}
    scale={0.2 * scale}
    colors={{Main: '#a9bde0', Main_Light: '#eef2fb', Black: '#1a1530', Grey: '#5d6687'}}
    emissive={{Eyes: ['#c084fc', 6], Main: ['#2a1660', 0.35]}}
    metal={{Main: [0.5, 0.35], Main_Light: [0.3, 0.4]}}
    rim="#c9a6ff"
    rimStrength={1.8}
  />
);
