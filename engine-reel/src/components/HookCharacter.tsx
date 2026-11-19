/**
 * Scene 1 (variant): goofy low-poly guy in a pitch-black room, lit by one
 * creepy red lamp from below, hand bobbing on something just out of frame…
 * HARD CUT → daylight car interior: he's just cranking the ignition key.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { HOOK } from '../timeline';
import { rand, randRange } from '../lib/math';

export const HOOK_ORIGIN = new THREE.Vector3(-300, 0, 0);

// head ellipsoid
const HEAD_C = new THREE.Vector3(0, 1.56, 0.02);
const HEAD_R = 0.36;
const HEAD_S = new THREE.Vector3(1, 1.06, 0.94);
/** Point on the face surface at local (x, y) offset from the head centre. */
const onFace = (x: number, y: number, lift = 0.0) => {
  const yy = y / HEAD_S.y;
  const z = HEAD_S.z * Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - yy * yy));
  return new THREE.Vector3(x, y, z + lift);
};

/** The key sits in the ignition on the right of the steering column. */
export const KEY_POS = new THREE.Vector3(-0.2, 0.9, 0.66);
const SHOULDER_R = new THREE.Vector3(-0.33, 1.13, 0.0);

/** Hand motion: rhythmic bob + key twist — identical rhythm before & after the cut. */
export function handPose(t: number) {
  const w = Math.PI * 2 * HOOK.bobHz;
  const dark = t < HOOK.cut;
  const bob = (dark ? 0.09 : 0.025) * Math.sin(w * t);
  const twist = (dark ? 0.45 : 0.7) * Math.sin(w * t + (dark ? 0.6 : 0));
  return { bob, twist, phase: Math.sin(w * t) };
}

/** Two-bone IK: returns elbow position for shoulder S → hand H. */
function solveElbow(S: THREE.Vector3, H: THREE.Vector3, a: number, b: number, pole: THREE.Vector3) {
  const d = Math.min(a + b - 1e-3, S.distanceTo(H));
  const u = H.clone().sub(S).normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
  return S.clone().addScaledVector(u, a * cosA).addScaledVector(p, a * sinA);
}

const Y = new THREE.Vector3(0, 1, 0);
/** A box "bone" spanning from A to B. */
const Limb: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; w: number; mat: THREE.Material }> = ({ a, b, w, mat }) => {
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(Y, b.clone().sub(a).normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return (
    <mesh position={mid.toArray()} quaternion={q} material={mat} castShadow receiveShadow>
      <boxGeometry args={[w, len + w * 0.6, w]} />
    </mesh>
  );
};

export const HookCharacter: React.FC<{ t: number; camPos: THREE.Vector3 }> = ({ t, camPos }) => {
  const dark = t < HOOK.cut;
  const m = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: '#f2a987', roughness: 0.55, flatShading: true }),
      skinDark: new THREE.MeshStandardMaterial({ color: '#e08f6d', roughness: 0.6, flatShading: true }),
      eye: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, clearcoat: 1 }),
      pupil: new THREE.MeshBasicMaterial({ color: '#0b0b0b' }),
      brow: new THREE.MeshStandardMaterial({ color: '#2a1b12', roughness: 0.8, flatShading: true }),
      hair: new THREE.MeshStandardMaterial({ color: '#2a1b12', roughness: 0.7, flatShading: true }),
      mouth: new THREE.MeshBasicMaterial({ color: '#3a120c' }),
      shirt: new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.7, flatShading: true }),
      pants: new THREE.MeshStandardMaterial({ color: '#34425e', roughness: 0.8, flatShading: true }),
      shoe: new THREE.MeshStandardMaterial({ color: '#22252a', roughness: 0.6 }),
      sweat: new THREE.MeshPhysicalMaterial({ color: '#59c8ff', roughness: 0.05, clearcoat: 1, emissive: '#1d6fa8', emissiveIntensity: 0.25 }),
    }),
    [],
  );
  const g = useMemo(() => {
    const mouthCurve = new THREE.CatmullRomCurve3([
      onFace(-0.11, -0.15, 0.006),
      onFace(-0.02, -0.165, 0.006),
      onFace(0.07, -0.155, 0.006),
      onFace(0.13, -0.115, 0.006),
      onFace(0.16, -0.085, 0.006),
    ]);
    const drop = new THREE.LatheGeometry(
      [0, 0.25, 0.5, 0.75, 1].map((u) => {
        const y = -u * 0.1;
        const r = 0.032 * Math.sin(Math.PI * Math.pow(u, 0.7)) + (u === 0 ? 0.0001 : 0);
        return new THREE.Vector2(Math.max(0.0001, r), y + 0.05);
      }),
      18,
    );
    return {
      head: new THREE.IcosahedronGeometry(HEAD_R, 2),
      mouth: new THREE.TubeGeometry(mouthCurve, 40, 0.014, 8, false),
      drop,
      hair: Array.from({ length: 9 }, (_, i) => ({
        pos: [randRange(i, 1, -0.22, 0.22), 0.3 + rand(i, 2) * 0.06, randRange(i, 3, -0.22, 0.12)] as [number, number, number],
        rot: [randRange(i, 4, -0.6, 0.6), randRange(i, 5, 0, 3), randRange(i, 6, -0.6, 0.6)] as [number, number, number],
        s: randRange(i, 7, 0.13, 0.19),
      })),
    };
  }, []);

  const { bob, twist, phase } = handPose(t);
  // exaggerated, awkward shoulder pump + stiff body bounce (delayed a touch)
  const shrug = 0.045 * phase;
  const bodyBounce = 0.012 * Math.sin(Math.PI * 2 * HOOK.bobHz * t - 0.5);
  const bodyRoll = 0.05 * phase;
  const headBob = 0.01 * Math.sin(Math.PI * 2 * HOOK.bobHz * t - 1.0);

  const S = SHOULDER_R.clone().add(new THREE.Vector3(0, shrug + bodyBounce, 0.02 * phase));
  const H = KEY_POS.clone().add(new THREE.Vector3(0.0, bob, 0.0));
  const E = solveElbow(S, H, 0.36, 0.38, new THREE.Vector3(-0.6, -1, -0.2));
  const SL = new THREE.Vector3(0.33, 1.12 - shrug * 0.3 + bodyBounce, 0);
  const HL = new THREE.Vector3(0.24, 0.62, 0.42);
  const EL = solveElbow(SL, HL, 0.36, 0.38, new THREE.Vector3(0.7, -1, -0.3));

  // pupils follow the camera — dead stare
  const headWorld = HEAD_C.clone().add(new THREE.Vector3(0, bodyBounce + headBob, 0));
  const look = camPos.clone().sub(HOOK_ORIGIN).sub(headWorld).normalize();
  const eyeL = onFace(-0.13, 0.05, -0.04);
  const eyeR = onFace(0.13, 0.06, -0.04);
  const eyeRad = 0.118;
  const pupilOff = look.clone().multiplyScalar(eyeRad * 0.96);
  pupilOff.z *= 0.55; // eye is flattened

  // sweat drop slowly slides down the temple, then a new one forms
  const sweatU = ((t - HOOK.sweatStart) / 1.6) % 1;
  const sweatPos = onFace(0.24, 0.16 - Math.max(0, sweatU) * 0.2, 0.012);
  const sweatScale = t < HOOK.sweatStart ? 0 : 0.7 + 0.5 * Math.min(1, sweatU * 3);

  const forearmDir = H.clone().sub(E).normalize();
  const handQ = new THREE.Quaternion().setFromUnitVectors(Y, forearmDir).multiply(new THREE.Quaternion().setFromAxisAngle(Y, twist));

  return (
    <group position={HOOK_ORIGIN.toArray()}>
      {/* torso */}
      <group position={[0, bodyBounce, 0]} rotation={[0, 0, bodyRoll * 0.4]}>
        <RoundedBox args={[0.7, 0.68, 0.38]} radius={0.07} position={[0, 0.84, 0]} material={m.shirt} castShadow receiveShadow />
        <mesh position={[0, 1.22, 0.02]} material={m.skinDark} castShadow>
          <cylinderGeometry args={[0.1, 0.11, 0.18, 8]} />
        </mesh>
      </group>

      {/* head */}
      <group position={[0, bodyBounce + headBob, 0]} rotation={[0.04 * phase, 0, -0.03 * phase]}>
        <group position={HEAD_C.toArray()}>
          <mesh geometry={g.head} material={m.skin} scale={HEAD_S.toArray()} castShadow receiveShadow />
          {/* ears */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.35, -0.01, -0.02]} scale={[0.45, 1, 0.8]} material={m.skinDark} castShadow>
              <icosahedronGeometry args={[0.075, 1]} />
            </mesh>
          ))}
          {/* hair blocks */}
          {g.hair.map((h, i) => (
            <mesh key={i} position={h.pos} rotation={h.rot} material={m.hair} castShadow>
              <boxGeometry args={[h.s, h.s * 0.7, h.s]} />
            </mesh>
          ))}
          {/* giant wide eyes + tiny pupils */}
          {[eyeL, eyeR].map((p, i) => (
            <group key={i} position={p.toArray()}>
              <mesh material={m.eye} scale={[1, 1.08, 0.55]}>
                <sphereGeometry args={[eyeRad, 24, 16]} />
              </mesh>
              <mesh material={m.pupil} position={pupilOff.toArray()}>
                <sphereGeometry args={[0.021, 12, 8]} />
              </mesh>
            </group>
          ))}
          {/* raised, crooked eyebrows */}
          <mesh position={onFace(-0.14, 0.215, 0.01).toArray()} rotation={[-0.25, 0.25, 0.32]} material={m.brow} castShadow>
            <boxGeometry args={[0.17, 0.04, 0.05]} />
          </mesh>
          <mesh position={onFace(0.15, 0.25, 0.01).toArray()} rotation={[-0.3, -0.25, -0.12]} material={m.brow} castShadow>
            <boxGeometry args={[0.17, 0.04, 0.05]} />
          </mesh>
          {/* nose */}
          <mesh position={onFace(0.0, -0.06, 0.0).toArray()} material={m.skinDark} scale={[1, 0.9, 1.2]}>
            <icosahedronGeometry args={[0.05, 1]} />
          </mesh>
          {/* guilty lop-sided smirk */}
          <mesh geometry={g.mouth} material={m.mouth} />
          {/* sweat drop */}
          <mesh geometry={g.drop} material={m.sweat} position={sweatPos.toArray()} scale={sweatScale} />
        </group>
      </group>

      {/* arms */}
      <Limb a={S} b={E} w={0.17} mat={m.shirt} />
      <Limb a={E} b={H} w={0.15} mat={m.skin} />
      <mesh position={H.toArray()} quaternion={handQ} material={m.skin} castShadow>
        <boxGeometry args={[0.17, 0.19, 0.13]} />
      </mesh>
      <Limb a={SL} b={EL} w={0.17} mat={m.shirt} />
      <Limb a={EL} b={HL} w={0.15} mat={m.skin} />
      <mesh position={HL.toArray()} material={m.skin} castShadow>
        <boxGeometry args={[0.15, 0.13, 0.17]} />
      </mesh>

      {/* legs (seated) */}
      {[-0.17, 0.17].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.52, 0.22]} material={m.pants} castShadow receiveShadow>
            <boxGeometry args={[0.24, 0.22, 0.6]} />
          </mesh>
          <mesh position={[x, 0.24, 0.52]} material={m.pants} castShadow>
            <boxGeometry args={[0.2, 0.5, 0.2]} />
          </mesh>
          <mesh position={[x, 0.04, 0.6]} material={m.shoe} castShadow>
            <boxGeometry args={[0.22, 0.1, 0.34]} />
          </mesh>
        </group>
      ))}

      {!dark && <IgnitionKey twist={twist} />}
    </group>
  );
};

const IgnitionKey: React.FC<{ twist: number }> = ({ twist }) => {
  const m = useMemo(
    () => ({
      chrome: new THREE.MeshStandardMaterial({ color: '#eef2f5', metalness: 0.95, roughness: 0.15 }),
      black: new THREE.MeshStandardMaterial({ color: '#1d1f23', roughness: 0.4 }),
      fob: new THREE.MeshPhysicalMaterial({ color: '#ff4f5e', roughness: 0.3, clearcoat: 1 }),
    }),
    [],
  );
  // key points from the ignition (in the column) back toward the driver (−z)
  return (
    <group position={[KEY_POS.x, KEY_POS.y - 0.02, KEY_POS.z + 0.12]} rotation={[0, 0, twist]} scale={1.6}>
      <mesh position={[0.05, 0, 0.1]} material={m.black}>
        <boxGeometry args={[0.12, 0.08, 0.1]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.04]} material={m.chrome}>
        <cylinderGeometry args={[0.045, 0.05, 0.05, 20]} />
      </mesh>
      <mesh position={[0, 0, -0.04]} material={m.chrome}>
        <boxGeometry args={[0.018, 0.04, 0.09]} />
      </mesh>
      <RoundedBox args={[0.075, 0.09, 0.025]} radius={0.01} position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]} material={m.black} />
      <mesh position={[0, -0.07, -0.12]} rotation={[0.3, 0, 0]} material={m.chrome}>
        <torusGeometry args={[0.03, 0.006, 6, 16]} />
      </mesh>
      <RoundedBox args={[0.06, 0.09, 0.03]} radius={0.012} position={[0, -0.15, -0.12]} material={m.fob} />
    </group>
  );
};

/** Pitch-black room: just a dark wall to catch the bouncing red shadow. */
export const DarkRoom: React.FC = () => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3a3a', roughness: 1 }), []);
  return (
    <group position={HOOK_ORIGIN.toArray()}>
      <mesh material={mat} position={[0, 1.6, -0.95]} receiveShadow>
        <planeGeometry args={[8, 6]} />
      </mesh>
      <mesh material={mat} position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
      </mesh>
    </group>
  );
};

/** Daylight car interior: seat, wheel, column + ignition, dash, windshield, view outside. */
export const CarInterior: React.FC = () => {
  const m = useMemo(
    () => ({
      seat: new THREE.MeshStandardMaterial({ color: '#3a3f4a', roughness: 0.85 }),
      dash: new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.6 }),
      trim: new THREE.MeshPhysicalMaterial({ color: '#ff4f5e', roughness: 0.3, clearcoat: 1 }),
      wheel: new THREE.MeshStandardMaterial({ color: '#1f2227', roughness: 0.45 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#eef2f5', metalness: 0.95, roughness: 0.15 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#cfefff', roughness: 0.02, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
      grass: new THREE.MeshStandardMaterial({ color: '#8fd37f', roughness: 0.95 }),
      road: new THREE.MeshStandardMaterial({ color: '#434a57', roughness: 0.85 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#5cbf62', roughness: 0.8, flatShading: true }),
      trunk: new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.9 }),
      gauge: new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.4, emissive: '#fff4d0', emissiveIntensity: 0.3 }),
    }),
    [],
  );
  const trees = useMemo(
    () => Array.from({ length: 14 }, (_, i) => [randRange(i, 1, -14, 14), randRange(i, 2, 7, 30), randRange(i, 3, 0.8, 1.6)] as [number, number, number]),
    [],
  );
  return (
    <group position={HOOK_ORIGIN.toArray()}>
      {/* seat */}
      <RoundedBox args={[0.72, 0.16, 0.66]} radius={0.06} position={[0, 0.36, 0.05]} material={m.seat} castShadow receiveShadow />
      <RoundedBox args={[0.72, 0.95, 0.16]} radius={0.06} position={[0, 0.86, -0.3]} rotation={[-0.15, 0, 0]} material={m.seat} castShadow receiveShadow />
      <RoundedBox args={[0.4, 0.24, 0.14]} radius={0.05} position={[0, 1.5, -0.42]} rotation={[-0.15, 0, 0]} material={m.seat} castShadow />
      {/* steering column + wheel */}
      <mesh position={[-0.02, 0.9, 0.78]} rotation={[1.05, 0, 0]} material={m.dash} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.42, 16]} />
      </mesh>
      <group position={[-0.02, 1.02, 0.56]} rotation={[-0.55, 0, 0]}>
        <mesh material={m.wheel} castShadow>
          <torusGeometry args={[0.22, 0.028, 10, 36]} />
        </mesh>
        <mesh material={m.wheel} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.05, 16]} />
        </mesh>
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.11, -Math.cos(a) * 0.11, 0]} rotation={[0, 0, a]} material={m.wheel}>
            <boxGeometry args={[0.03, 0.2, 0.02]} />
          </mesh>
        ))}
      </group>
      {/* dashboard */}
      <RoundedBox args={[2.1, 0.32, 0.6]} radius={0.08} position={[0.45, 1.0, 1.08]} material={m.dash} castShadow receiveShadow />
      <RoundedBox args={[2.1, 0.06, 0.08]} radius={0.02} position={[0.45, 1.13, 0.8]} material={m.trim} />
      {[-0.13, 0.09].map((x) => (
        <mesh key={x} position={[x, 1.1, 0.79]} material={m.gauge}>
          <circleGeometry args={[0.06, 20]} />
        </mesh>
      ))}
      {/* windshield + pillars + roof */}
      <mesh position={[0.45, 1.55, 1.18]} rotation={[-0.55, 0, 0]} material={m.glass}>
        <planeGeometry args={[2.0, 0.9]} />
      </mesh>
      {[-0.55, 1.45].map((x) => (
        <mesh key={x} position={[x, 1.55, 1.15]} rotation={[-0.55, 0, 0]} material={m.trim} castShadow>
          <boxGeometry args={[0.08, 0.95, 0.08]} />
        </mesh>
      ))}
      <RoundedBox args={[2.2, 0.08, 1.6]} radius={0.03} position={[0.45, 1.98, 0.25]} material={m.dash} castShadow />
      {/* door on his left */}
      <RoundedBox args={[0.1, 0.6, 1.2]} radius={0.04} position={[0.55, 0.75, 0.25]} material={m.trim} castShadow receiveShadow />
      {/* outside world */}
      <mesh position={[0, -0.05, 15]} rotation={[-Math.PI / 2, 0, 0]} material={m.grass} receiveShadow>
        <planeGeometry args={[80, 60]} />
      </mesh>
      <mesh position={[0.4, -0.04, 15]} rotation={[-Math.PI / 2, 0, 0]} material={m.road} receiveShadow>
        <planeGeometry args={[4, 60]} />
      </mesh>
      {trees.map(([x, z, s], i) => (
        <group key={i} position={[x < 0 ? x - 2.5 : x + 2.5, 0, z]} scale={s}>
          <mesh position={[0, 0.45, 0]} material={m.trunk}>
            <cylinderGeometry args={[0.12, 0.16, 0.9, 6]} />
          </mesh>
          <mesh position={[0, 1.9, 0]} material={m.leaf}>
            <coneGeometry args={[0.9, 2.2, 7]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
