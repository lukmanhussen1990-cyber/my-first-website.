import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useRimMats, RimOpts} from './materials';
import {mulberry, clamp} from '../lib/math';

/** Low-poly stylised person rig with procedural, bouncy animation. Faces +Z in local space. */
export type PersonLook = {
  skin: string;
  hair: string;
  hairStyle: 'messy' | 'short' | 'bob' | 'buzz' | 'bun';
  shirt: string;
  sleeve?: string;
  pants: string;
  shoes: string;
  sole?: string;
  tie?: string;
  backpack?: string;
  toothpaste?: boolean;
  cap?: string;
  blazer?: string;
  build?: number; // width multiplier
  seed?: number;
};

export type PersonPose = {
  walkPhase?: number;
  walk?: number; // 0..1 walk cycle amount
  bounce?: number;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
  lean?: number; // torso pitch forward
  twist?: number; // torso yaw
  lid?: number; // 0 open .. 1 closed
  yawn?: number; // 0..1 mouth open
  smile?: number; // -1 frown .. 1 smirk
  brow?: number; // -1 angry/pain .. 1 raised
  armL?: [number, number, number]; // shoulder x, shoulder z, elbow
  armR?: [number, number, number];
  legL?: [number, number]; // thigh, knee overrides
  legR?: [number, number];
  seated?: number; // 0..1 (bike)
  pedal?: number; // radians crank
  wind?: number; // hair/tie flutter amount
  time?: number; // frame, for flutter
  capOn?: boolean;
  sunglasses?: boolean;
  crack?: number;
  eyeGlow?: number;
};

type Props = {
  look: PersonLook;
  pose: PersonPose;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  rim?: string;
  rimStrength?: number;
  override?: THREE.Material; // silhouette mode
  castShadow?: boolean;
  children?: React.ReactNode;
  headChildren?: React.ReactNode;
  rightHandChildren?: React.ReactNode;
};

const G = {
  thigh: new THREE.CylinderGeometry(0.075, 0.062, 0.36, 8).translate(0, -0.18, 0),
  shin: new THREE.CylinderGeometry(0.06, 0.05, 0.34, 8).translate(0, -0.17, 0),
  shoe: new THREE.SphereGeometry(0.075, 8, 6).scale(0.85, 0.62, 1.7).translate(0, -0.03, 0.05),
  sole: new THREE.CylinderGeometry(0.065, 0.065, 0.025, 8).scale(1, 1, 2.0).translate(0, -0.07, 0.05),
  pelvis: new THREE.CylinderGeometry(0.16, 0.15, 0.16, 7).scale(1, 1, 0.66),
  torso: new THREE.LatheGeometry(
    [[0.0, 0.0], [0.165, 0.0], [0.17, 0.08], [0.18, 0.2], [0.2, 0.32], [0.205, 0.39], [0.17, 0.44], [0.07, 0.46], [0.0, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)),
    10
  ).scale(1, 1, 0.64),
  collarL: new THREE.ConeGeometry(0.05, 0.09, 3).rotateZ(Math.PI).scale(1, 1, 0.3),
  upper: new THREE.CylinderGeometry(0.066, 0.056, 0.28, 8).translate(0, -0.13, 0),
  fore: new THREE.CylinderGeometry(0.045, 0.037, 0.26, 8).translate(0, -0.12, 0),
  hand: new THREE.IcosahedronGeometry(0.058, 1).scale(0.95, 1.1, 0.78),
  neck: new THREE.CylinderGeometry(0.058, 0.064, 0.14, 6),
  head: new THREE.LatheGeometry(
    [
      [0.0, -0.215], [0.06, -0.21], [0.115, -0.18], [0.15, -0.13], [0.175, -0.06], [0.19, 0.02], [0.192, 0.08], [0.18, 0.15], [0.15, 0.2], [0.1, 0.232], [0.0, 0.245],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    12
  ).scale(0.95, 1, 1.02),
  jaw: new THREE.IcosahedronGeometry(0.11, 1).scale(1.2, 0.55, 0.9),
  cheek: new THREE.IcosahedronGeometry(0.06, 0).scale(1, 0.8, 0.6),
  ear: new THREE.IcosahedronGeometry(0.045, 0).scale(0.5, 1, 0.8),
  nose: new THREE.ConeGeometry(0.026, 0.07, 4).rotateX(Math.PI / 2 + 0.35).rotateZ(Math.PI / 4).scale(0.8, 1, 0.8),
  eyeW: new THREE.SphereGeometry(0.024, 10, 6).scale(1.45, 0.82, 0.35),
  iris: new THREE.SphereGeometry(0.03, 14, 10).scale(0.7, 1.12, 0.3),
  glintBig: new THREE.SphereGeometry(0.0095, 8, 6).scale(1, 1, 0.5),
  fringe: new THREE.IcosahedronGeometry(0.075, 1).scale(1.3, 0.62, 0.8),
  hairTop: new THREE.IcosahedronGeometry(0.2, 2).scale(1.06, 0.62, 1.08),
  cowlick: new THREE.ConeGeometry(0.045, 0.16, 5).scale(1, 1, 0.55),
  thumb: new THREE.ConeGeometry(0.022, 0.07, 5),
  lash: new THREE.BoxGeometry(0.07, 0.009, 0.012),
  glint: new THREE.SphereGeometry(0.0045, 6, 4),
  brow: new THREE.BoxGeometry(0.078, 0.021, 0.02),
  mouth: new THREE.SphereGeometry(0.034, 10, 6).scale(1, 1, 0.3),
  hairCap: new THREE.SphereGeometry(0.222, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  hairBack: new THREE.SphereGeometry(0.205, 10, 6, Math.PI * 0.25, Math.PI * 1.5, Math.PI * 0.3, Math.PI * 0.42),
  clump: new THREE.IcosahedronGeometry(0.075, 0),
  spike: new THREE.ConeGeometry(0.045, 0.13, 4),
  bob: new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.72),
  bun: new THREE.IcosahedronGeometry(0.09, 0),
  tie: new THREE.BoxGeometry(0.05, 0.2, 0.012).translate(0, -0.1, 0),
  tieKnot: new THREE.BoxGeometry(0.06, 0.04, 0.02),
  collar: new THREE.TorusGeometry(0.075, 0.025, 4, 8),
  pack: new THREE.BoxGeometry(0.3, 0.36, 0.14),
  packPocket: new THREE.BoxGeometry(0.22, 0.14, 0.05),
  strap: new THREE.BoxGeometry(0.04, 0.3, 0.02),
  paste: new THREE.IcosahedronGeometry(0.05, 0).scale(1.3, 0.8, 0.35),
  pasteStripe: new THREE.BoxGeometry(0.07, 0.014, 0.02),
  capDome: new THREE.SphereGeometry(0.225, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5),
  capBrim: new THREE.CylinderGeometry(0.15, 0.15, 0.018, 8, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.2),
  lens: new THREE.BoxGeometry(0.085, 0.05, 0.015),
  bridge: new THREE.BoxGeometry(0.04, 0.012, 0.012),
  lapel: new THREE.BoxGeometry(0.06, 0.24, 0.02),
};

export const Person: React.FC<Props> = ({
  look,
  pose,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  rim = '#ffd9a0',
  rimStrength = 0.9,
  override,
  castShadow = true,
  children,
  headChildren,
  rightHandChildren,
}) => {
  const defs: Record<string, RimOpts> = useMemo(
    () => ({
      skin: {color: look.skin, roughness: 0.65},
      hair: {color: look.hair, roughness: 0.8},
      shirt: {color: look.shirt, roughness: 0.85},
      sleeve: {color: look.sleeve ?? look.shirt, roughness: 0.85},
      pants: {color: look.pants, roughness: 0.9},
      shoes: {color: look.shoes, roughness: 0.6},
      sole: {color: look.sole ?? '#f2f2f2', roughness: 0.6},
      tie: {color: look.tie ?? '#8e1b2b', roughness: 0.6},
      pack: {color: look.backpack ?? '#e0533d', roughness: 0.75},
      paste: {color: '#f4fffb', roughness: 0.3, emissive: '#dffaf2', emissiveIntensity: 0.25, rimStrength: 0.2},
      pasteBlue: {color: '#4cc3e6', roughness: 0.3, rimStrength: 0.2},
      eyeW: {color: '#f6f2ea', roughness: 0.4, rimStrength: 0},
      iris: {color: '#23160f', roughness: 0.2, rimStrength: 0},
      glint: {color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.5, rimStrength: 0},
      mouth: {color: '#5a1d1d', roughness: 0.6, rimStrength: 0},
      cap: {color: look.cap ?? '#d12d2d', roughness: 0.6},
      lens: {color: '#06070a', roughness: 0.08, metalness: 0.6, rimStrength: 0.4},
      blazer: {color: look.blazer ?? look.shirt, roughness: 0.75},
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const rimMats = useRimMats(defs, rim, rimStrength, pose.crack ?? 0, ['skin']);
  const M: Record<string, THREE.Material> = override
    ? new Proxy({}, {get: () => override}) as any
    : (rimMats as any);
  const glow = pose.eyeGlow ?? 0;

  const spikes = useMemo(() => {
    const r = mulberry(look.seed ?? 7);
    const out: {p: [number, number, number]; rot: [number, number, number]; s: number; kind: 'fringe' | 'cowlick'}[] = [];
    if (look.hairStyle === 'messy' || look.hairStyle === 'short') {
      const messy = look.hairStyle === 'messy';
      // chunky swept fringe across the forehead
      const xs = [-0.12, -0.06, 0.0, 0.06, 0.115];
      xs.forEach((x, i) => {
        out.push({
          p: [x, 0.165 - x * x * 2.2 - x * 0.12, 0.135 - x * x * 2.0],
          rot: [0.55 + (r() - 0.5) * 0.15, x * 1.4, -0.38 + (r() - 0.5) * 0.12],
          s: 0.95 + r() * 0.2,
          kind: 'fringe',
        });
      });
      // side pieces over the ears
      for (const sd of [-1, 1]) out.push({p: [0.172 * sd, 0.07, 0.0], rot: [0.1, 0, 1.35 * sd], s: 0.85, kind: 'fringe'});
      // bed-head cowlicks at the crown
      const nT = messy ? 4 : 0;
      for (let i = 0; i < nT; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.55 + (r() - 0.5) * 0.2;
        out.push({
          p: [Math.cos(a) * 0.07, 0.235, Math.sin(a) * 0.07 - 0.04],
          rot: [-0.7 - r() * 0.5, r() * 3, (i - 1.5) * 0.35],
          s: 0.9 + r() * 0.45,
          kind: 'cowlick',
        });
      }
    }
    return out;
  }, [look.hairStyle, look.seed]);

  const ph = pose.walkPhase ?? 0;
  const w = pose.walk ?? 0;
  const t = pose.time ?? 0;
  const wind = pose.wind ?? 0;
  const seated = pose.seated ?? 0;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const bob = Math.abs(Math.cos(ph)) * 0.055 * w * (pose.bounce ?? 1) - 0.02 * w;
  const squash = 1 + Math.sin(ph * 2) * 0.025 * w * (pose.bounce ?? 1);

  // legs
  let thighL = -0.5 * s * w;
  let thighR = 0.5 * s * w;
  let kneeL = (0.08 + 0.85 * Math.pow(Math.max(0, c), 1.4)) * w;
  let kneeR = (0.08 + 0.85 * Math.pow(Math.max(0, -c), 1.4)) * w;
  if (seated > 0) {
    const pc = pose.pedal ?? 0;
    thighL = -1.25 + Math.sin(pc) * 0.35;
    thighR = -1.25 + Math.sin(pc + Math.PI) * 0.35;
    kneeL = 1.35 + Math.cos(pc) * 0.3;
    kneeR = 1.35 + Math.cos(pc + Math.PI) * 0.3;
  }
  if (pose.legL) [thighL, kneeL] = pose.legL;
  if (pose.legR) [thighR, kneeR] = pose.legR;
  const armL = pose.armL ?? [0.42 * s * w + 0.02, -0.08, -0.25 - 0.25 * Math.max(0, s) * w];
  const armR = pose.armR ?? [-0.42 * s * w + 0.02, 0.08, -0.25 - 0.25 * Math.max(0, -s) * w];

  const lid = clamp(pose.lid ?? 0);
  const yawn = clamp(pose.yawn ?? 0);
  const smile = pose.smile ?? 0;
  const brow = pose.brow ?? 0;
  const build = look.build ?? 1;
  const sh = castShadow;

  const flutter = (k: number) => Math.sin(t * 0.9 + k * 1.7) * 0.5 + Math.sin(t * 1.7 + k) * 0.3;

  const Leg = ({side, thigh, knee}: {side: number; thigh: number; knee: number}) => (
    <group position={[0.088 * side * build, 0.76, 0]} rotation={[thigh, 0, 0]}>
      <mesh geometry={G.thigh} material={M.pants} castShadow={sh} />
      <group position={[0, -0.36, 0]} rotation={[knee, 0, 0]}>
        <mesh geometry={G.shin} material={M.pants} castShadow={sh} />
        <group position={[0, -0.34, 0]} rotation={[-(thigh + knee) * 0.6, 0, 0]}>
          <mesh geometry={G.shoe} material={M.shoes} castShadow={sh} />
          <mesh geometry={G.sole} material={M.sole} castShadow={sh} />
        </group>
      </group>
    </group>
  );

  const Arm = ({side, a, hand}: {side: number; a: [number, number, number]; hand?: React.ReactNode}) => (
    <group position={[0.215 * side * build, 0.39, 0]} rotation={[a[0], 0, a[1]]}>
      <mesh geometry={G.upper} material={M.sleeve} castShadow={sh} />
      <group position={[0, -0.27, 0]} rotation={[a[2], 0, 0]}>
        <mesh geometry={G.fore} material={look.blazer ? M.blazer : M.skin} castShadow={sh} />
        <group position={[0, -0.27, 0]}>
          <mesh geometry={G.hand} material={M.skin} castShadow={sh} />
          <mesh geometry={G.thumb} material={M.skin} position={[-0.035 * side, -0.005, 0.03]} rotation={[0.4, 0, 0.5 * side]} />
          {hand}
        </group>
      </group>
    </group>
  );

  const eyeScaleY = Math.max(0.1, 1 - lid * 0.85);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group position={[0, bob - seated * 0.02, 0]} scale={[1, squash, 1]}>
        <Leg side={-1} thigh={thighL} knee={kneeL} />
        <Leg side={1} thigh={thighR} knee={kneeR} />
        <mesh geometry={G.pelvis} material={M.pants} position={[0, 0.78, 0]} scale={[build, 1, 1]} castShadow={sh} />
        <group position={[0, 0.8, 0]} rotation={[pose.lean ?? 0.04 * w, (pose.twist ?? 0) + s * 0.06 * w, 0]}>
          <mesh geometry={G.torso} material={look.blazer ? M.blazer : M.shirt} scale={[build, 1, 1]} castShadow={sh} />
          {look.blazer && (
            <>
              <mesh geometry={G.torso} material={M.shirt} scale={[0.45, 0.98, 1.04]} position={[0, 0.005, 0.01]} />
              <mesh geometry={G.lapel} material={M.blazer} position={[-0.06, 0.26, 0.125]} rotation={[0, 0, 0.25]} />
              <mesh geometry={G.lapel} material={M.blazer} position={[0.06, 0.26, 0.125]} rotation={[0, 0, -0.25]} />
            </>
          )}
          {look.tie && (
            <group position={[0, 0.41, 0.124]} rotation={[-0.08 - wind * (0.5 + flutter(1) * 0.5), 0, wind * flutter(2) * 0.4]}>
              <mesh geometry={G.tieKnot} material={M.tie} />
              <mesh geometry={G.tie} material={M.tie} position={[0, -0.01, 0]} />
            </group>
          )}
          {look.toothpaste && (
            <group position={[-0.075, 0.27, 0.128]} rotation={[0.1, 0, 0.3]}>
              <mesh geometry={G.paste} material={M.paste} />
              <mesh geometry={G.paste} material={M.paste} position={[0.045, -0.03, 0.004]} scale={0.7} rotation={[0, 0, 1]} />
              <mesh geometry={G.paste} material={M.paste} position={[-0.035, 0.025, 0.004]} scale={0.55} rotation={[0, 0, -0.6]} />
              <mesh geometry={G.pasteStripe} material={M.pasteBlue} position={[0.005, 0.002, 0.018]} rotation={[0, 0, 0.2]} />
              <mesh geometry={G.pasteStripe} material={M.pasteBlue} position={[0.03, -0.022, 0.016]} rotation={[0, 0, 0.5]} scale={0.6} />
            </group>
          )}
          {look.backpack && (
            <group position={[0, 0.22, -0.16]} rotation={[0.08 + Math.sin(ph * 2) * 0.04 * w, 0, 0]}>
              <mesh geometry={G.pack} material={M.pack} castShadow={sh} />
              <mesh geometry={G.packPocket} material={M.pack} position={[0, -0.08, -0.08]} />
              <mesh geometry={G.strap} material={M.pack} position={[-0.11, 0.06, 0.2]} rotation={[0.25, 0, 0]} />
              <mesh geometry={G.strap} material={M.pack} position={[0.11, 0.06, 0.2]} rotation={[0.25, 0, 0]} />
            </group>
          )}
          <Arm side={-1} a={armL} />
          <Arm side={1} a={armR} hand={rightHandChildren} />
          <mesh geometry={G.neck} material={M.skin} position={[0, 0.49, 0]} />
          {look.tie && (
            <>
              <mesh geometry={G.collarL} material={M.shirt} position={[-0.045, 0.43, 0.105]} rotation={[0.3, 0, -0.5]} />
              <mesh geometry={G.collarL} material={M.shirt} position={[0.045, 0.43, 0.105]} rotation={[0.3, 0, 0.5]} />
            </>
          )}
          {/* head */}
          <group
            position={[0, 0.66 + Math.sin(ph * 2 + 0.6) * 0.012 * w, 0.01]}
            rotation={[pose.headPitch ?? 0, pose.headYaw ?? 0, pose.headRoll ?? 0]}
            scale={1.12}
          >
            <mesh geometry={G.head} material={M.skin} castShadow={sh} />
            <mesh geometry={G.ear} material={M.skin} position={[-0.185, 0, -0.01]} />
            <mesh geometry={G.ear} material={M.skin} position={[0.185, 0, -0.01]} />
            <mesh geometry={G.nose} material={M.skin} position={[0, -0.035, 0.188]} scale={0.7} />
            {/* eyes */}
            {[-1, 1].map((sd) => (
              <group key={sd} position={[0.071 * sd, 0.03 - lid * 0.008, 0.176]} rotation={[0, 0.3 * sd, 0]}>
                <group scale={[1, eyeScaleY, 1]}>
                  <mesh geometry={G.iris} material={glow > 0 ? M.glint : M.iris} />
                  <mesh geometry={G.glintBig} material={M.glint} position={[0.008, 0.013, 0.008]} />
                  <mesh geometry={G.glint} material={M.glint} position={[-0.007, -0.011, 0.008]} />
                </group>
                {lid > 0.25 && <mesh geometry={G.lash} material={M.hair} position={[0, 0.03 * eyeScaleY, 0.006]} scale={[0.55, 1, 1]} />}
              </group>
            ))}
            {/* brows */}
            {[-1, 1].map((sd) => (
              <mesh
                key={sd}
                geometry={G.brow}
                material={M.hair}
                position={[0.072 * sd, 0.092 + brow * 0.018 - lid * 0.01, 0.174]}
                rotation={[0, 0.3 * sd, (brow < 0 ? -0.35 * brow : -brow * 0.12) * sd + lid * 0.12 * sd]}
              />
            ))}
            {/* mouth */}
            <mesh
              geometry={G.mouth}
              material={M.mouth}
              position={[0.01 * smile, -0.105 - yawn * 0.018, 0.168]}
              rotation={[0, 0, smile * 0.22]}
              scale={[0.85 - yawn * 0.2, 0.14 + yawn * 1.3, 1]}
            />
            {/* hair */}
            {(look.hairStyle === 'messy' || look.hairStyle === 'short') && (
              <>
                <mesh geometry={G.hairCap} material={M.hair} position={[0, 0.05, -0.012]} rotation={[-0.14, 0, 0]} castShadow={sh} />
                <mesh geometry={G.hairBack} material={M.hair} position={[0, 0.02, -0.02]} castShadow={sh} />
                <mesh geometry={G.hairTop} material={M.hair} position={[0, 0.17, -0.01]} rotation={[-0.1, 0, 0.06]} castShadow={sh} />
              </>
            )}
            {look.hairStyle === 'buzz' && <mesh geometry={G.hairCap} material={M.hair} position={[0, 0.03, -0.01]} scale={0.99} rotation={[-0.35, 0, 0]} />}
            {look.hairStyle === 'bob' && (
              <>
                <mesh geometry={G.hairCap} material={M.hair} position={[0, 0.05, -0.015]} scale={1.08} rotation={[-0.3, 0, 0]} castShadow={sh} />
                <mesh geometry={G.bob} material={M.hair} position={[0, 0.03, -0.06]} rotation={[-0.15, 0, 0]} scale={[0.98, 0.92, 0.9]} castShadow={sh} />
              </>
            )}
            {look.hairStyle === 'bun' && (
              <>
                <mesh geometry={G.hairCap} material={M.hair} position={[0, 0.045, -0.015]} scale={1.03} rotation={[-0.32, 0, 0]} />
                <mesh geometry={G.bun} material={M.hair} position={[0, 0.17, -0.16]} />
              </>
            )}
            {spikes.map((sp, i) => (
              <mesh
                key={i}
                geometry={sp.kind === 'cowlick' ? G.cowlick : G.fringe}
                material={M.hair}
                position={sp.p}
                rotation={[sp.rot[0] + wind * flutter(i) * 0.25, sp.rot[1], sp.rot[2] + wind * flutter(i + 3) * 0.2]}
                scale={[sp.s, sp.s * (1 + wind * 0.15), sp.s]}
                castShadow={sh}
              />
            ))}
            {look.cap && pose.capOn !== false && (
              <group position={[0, 0.04, 0]} rotation={[-0.12, Math.PI, 0]}>
                <mesh geometry={G.capDome} material={M.cap} castShadow={sh} />
                <mesh geometry={G.capBrim} material={M.cap} position={[0, 0.0, 0.16]} />
              </group>
            )}
            {pose.sunglasses && (
              <group position={[0, 0.03, 0.2]}>
                <mesh geometry={G.lens} material={M.lens} position={[-0.068, 0, 0]} />
                <mesh geometry={G.lens} material={M.lens} position={[0.068, 0, 0]} />
                <mesh geometry={G.bridge} material={M.lens} />
              </group>
            )}
            {headChildren}
          </group>
        </group>
      </group>
      {children}
    </group>
  );
};

/** Separately-rendered cap used when the bully's cap flies off. */
export const LooseCap: React.FC<{position: [number, number, number]; rotation: [number, number, number]; color: string}> = ({
  position,
  rotation,
  color,
}) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({color, roughness: 0.6, flatShading: true}), [color]);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={G.capDome} material={mat} castShadow />
      <mesh geometry={G.capBrim} material={mat} position={[0, 0, 0.16]} castShadow />
    </group>
  );
};

export const LOOKS: Record<string, PersonLook> = {
  hero: {
    skin: '#d9a17c',
    hair: '#2e1d13',
    hairStyle: 'messy',
    shirt: '#a9d0ee',
    pants: '#26324f',
    shoes: '#f3f3f3',
    sole: '#d6493a',
    tie: '#9b1f33',
    backpack: '#e2553e',
    toothpaste: true,
    seed: 11,
  },
  bully: {
    skin: '#c98f6a',
    hair: '#1b130e',
    hairStyle: 'buzz',
    shirt: '#5f7d3b',
    pants: '#5b5f66',
    shoes: '#1d1d1f',
    sole: '#efefef',
    cap: '#d22b2b',
    build: 1.22,
    seed: 3,
  },
  npc0: {skin: '#f0c4a2', hair: '#7a4b2a', hairStyle: 'bob', shirt: '#e98a6b', pants: '#3d4b6e', shoes: '#2a2a2a', seed: 5},
  npc1: {skin: '#b97c56', hair: '#141010', hairStyle: 'short', shirt: '#f2d16b', pants: '#2f3a52', shoes: '#ececec', seed: 9, tie: undefined},
  npc2: {skin: '#e8b892', hair: '#d0a35a', hairStyle: 'bun', shirt: '#7fb4a8', pants: '#47404f', shoes: '#ececec', seed: 21},
  npc3: {skin: '#8d5b3d', hair: '#191311', hairStyle: 'short', shirt: '#c45b7a', pants: '#28304a', shoes: '#ececec', seed: 31},
  anchor: {
    skin: '#e7b996',
    hair: '#3b2416',
    hairStyle: 'bob',
    shirt: '#f4efe6',
    blazer: '#1f3c72',
    pants: '#1f2a44',
    shoes: '#141414',
    seed: 41,
  },
};
