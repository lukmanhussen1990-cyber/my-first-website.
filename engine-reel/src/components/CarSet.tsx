/**
 * The punchline set: a clean stylized toy car on a bright minimalist road.
 * Lives far away from the workshop (CAR.setOrigin) — the whip-pan hides the cut.
 */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { CAR, EVENTS } from '../timeline';
import { bump, clamp, rand, randRange, smoothstep } from '../lib/math';

export const CAR_ORIGIN = new THREE.Vector3(...CAR.setOrigin);

/** Distance travelled down the road (car drives toward −z). */
export function carDistance(t: number) {
  const tau = Math.max(0, t - CAR.launchAt);
  return 0.5 * CAR.accel * tau * tau + (CAR.jerk * tau * tau * tau) / 6;
}
export const carOffset = (t: number) => new THREE.Vector3(0, 0, -carDistance(t));
/** Tailpipe tip in car-local coords. */
const TAILPIPE = new THREE.Vector3(0.5, 0.3, 2.28);

const WHEEL_R = 0.36;

// ── Car ─────────────────────────────────────────────────────────────────
const Car: React.FC<{ t: number }> = ({ t }) => {
  const g = useMemo(() => {
    const body = new THREE.Shape();
    body.moveTo(-1.98, 0.32);
    body.lineTo(-2.08, 0.5);
    body.quadraticCurveTo(-2.12, 0.8, -1.88, 0.86);
    body.lineTo(-0.75, 0.98);
    body.lineTo(1.65, 0.98);
    body.quadraticCurveTo(2.1, 0.97, 2.1, 0.7);
    body.lineTo(2.05, 0.34);
    body.quadraticCurveTo(2.02, 0.28, 1.9, 0.28);
    body.lineTo(1.73, 0.28);
    body.absarc(1.3, 0.36, 0.44, -0.18, Math.PI + 0.18, false);
    body.lineTo(-0.87, 0.28);
    body.absarc(-1.3, 0.36, 0.44, -0.18, Math.PI + 0.18, false);
    body.lineTo(-1.98, 0.32);
    const bodyGeo = new THREE.ExtrudeGeometry(body, {
      depth: 1.62,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelOffset: -0.04,
      bevelSegments: 5,
      curveSegments: 24,
    });
    bodyGeo.translate(0, 0, -0.81);
    bodyGeo.rotateY(-Math.PI / 2);

    const cabin = new THREE.Shape([
      new THREE.Vector2(-0.78, 0.94),
      new THREE.Vector2(-0.08, 1.5),
      new THREE.Vector2(1.06, 1.52),
      new THREE.Vector2(1.64, 0.94),
    ]);
    const cabinGeo = new THREE.ExtrudeGeometry(cabin, {
      depth: 1.32,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.09,
      bevelOffset: -0.02,
      bevelSegments: 4,
    });
    cabinGeo.translate(0, 0, -0.66);
    cabinGeo.rotateY(-Math.PI / 2);

    // window panes (slightly proud of the cabin surface)
    const sideA = new THREE.Shape([new THREE.Vector2(-0.6, 1.02), new THREE.Vector2(-0.06, 1.43), new THREE.Vector2(0.42, 1.44), new THREE.Vector2(0.42, 1.02)]);
    const sideB = new THREE.Shape([new THREE.Vector2(0.54, 1.02), new THREE.Vector2(0.54, 1.44), new THREE.Vector2(1.0, 1.45), new THREE.Vector2(1.47, 1.02)]);
    const side = (s: THREE.Shape, x: number) => {
      const geo = new THREE.ShapeGeometry(s);
      geo.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
      // after rotation, shape-x maps to ∓z: fix so that +u (rear) → +z
      if (x > 0) geo.scale(1, 1, -1);
      geo.translate(x, 0, 0);
      return geo;
    };
    const slant = (u0: number, v0: number, u1: number, v1: number, width: number, out: [number, number]) => {
      const len = Math.hypot(u1 - u0, v1 - v0) * 0.82;
      const geo = new THREE.PlaneGeometry(width, len);
      geo.rotateX(Math.atan2(u1 - u0, v1 - v0)); // lay the pane along the slope
      return { geo, pos: [0, (v0 + v1) / 2 + out[0], (u0 + u1) / 2 + out[1]] as [number, number, number] };
    };
    return {
      body: bodyGeo,
      cabin: cabinGeo,
      winL: side(sideA, -0.776),
      winL2: side(sideB, -0.776),
      winR: side(sideA, 0.776),
      winR2: side(sideB, 0.776),
      rear: slant(1.06, 1.52, 1.64, 0.94, 1.18, [0.075, 0.075]),
      front: slant(-0.08, 1.5, -0.78, 0.94, 1.18, [0.075, -0.06]),
      tire: new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.28, 28).rotateZ(Math.PI / 2),
      rim: new THREE.CylinderGeometry(0.22, 0.22, 0.29, 24).rotateZ(Math.PI / 2),
      spoke: new THREE.BoxGeometry(0.02, 0.36, 0.06),
      pipe: new THREE.CylinderGeometry(0.065, 0.07, 0.34, 20).rotateX(Math.PI / 2),
      pipeHole: new THREE.CircleGeometry(0.048, 20),
    };
  }, []);

  const m = useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({ color: '#ff4f5e', roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#1c3350', roughness: 0.06, metalness: 0.3, clearcoat: 1, side: THREE.DoubleSide }),
      tire: new THREE.MeshStandardMaterial({ color: '#25282c', roughness: 0.78 }),
      rim: new THREE.MeshStandardMaterial({ color: '#e7ebef', roughness: 0.2, metalness: 0.85 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2d3238', roughness: 0.5 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#f1f4f7', roughness: 0.12, metalness: 0.95 }),
      tail: new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff1a1a', emissiveIntensity: 1.6, roughness: 0.3 }),
      head: new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#fff2b8', emissiveIntensity: 1.2, roughness: 0.2 }),
      plate: new THREE.MeshStandardMaterial({ color: '#f7f7f2', roughness: 0.4 }),
      hole: new THREE.MeshBasicMaterial({ color: '#0d0d0f' }),
    }),
    [],
  );

  const dist = carDistance(t);
  const spin = -dist / WHEEL_R;
  const idle = t < CAR.launchAt ? 0.006 * Math.sin(t * Math.PI * 2 * 24) : 0;
  // happy little nose-up hop on launch, then a settle
  const pitch = 0.11 * bump(CAR.launchAt, CAR.launchAt + 0.22, CAR.launchAt + 0.9, t) - 0.03 * bump(CAR.launchAt + 0.8, CAR.launchAt + 1.05, CAR.launchAt + 1.5, t);
  const wheels: [number, number][] = [
    [-0.84, -1.3],
    [0.84, -1.3],
    [-0.84, 1.3],
    [0.84, 1.3],
  ];

  return (
    <group position={[0, 0, -dist]}>
      {/* pivot the hop around the rear axle */}
      <group position={[0, WHEEL_R, 1.3]} rotation={[pitch, 0, 0]}>
        <group position={[0, -WHEEL_R + idle, -1.3]}>
          <mesh geometry={g.body} material={m.paint} castShadow receiveShadow />
          <mesh geometry={g.cabin} material={m.paint} castShadow receiveShadow />
          {[g.winL, g.winL2, g.winR, g.winR2].map((geo, i) => (
            <mesh key={i} geometry={geo} material={m.glass} />
          ))}
          <mesh geometry={g.rear.geo} material={m.glass} position={g.rear.pos} />
          <mesh geometry={g.front.geo} material={m.glass} position={g.front.pos} />
          {/* lights, bumpers, plate */}
          {[-0.58, 0.58].map((x) => (
            <group key={x}>
              <RoundedBox args={[0.36, 0.13, 0.06]} radius={0.03} position={[x, 0.78, 2.17]} material={m.tail} />
              <RoundedBox args={[0.34, 0.14, 0.06]} radius={0.04} position={[x, 0.72, -2.17]} material={m.head} />
            </group>
          ))}
          <RoundedBox args={[1.86, 0.16, 0.16]} radius={0.06} position={[0, 0.36, 2.12]} material={m.dark} castShadow />
          <RoundedBox args={[1.86, 0.16, 0.16]} radius={0.06} position={[0, 0.38, -2.14]} material={m.dark} castShadow />
          <RoundedBox args={[0.5, 0.17, 0.03]} radius={0.02} position={[0, 0.57, 2.19]} material={m.plate} />
          <mesh geometry={g.pipe} material={m.chrome} position={[TAILPIPE.x, TAILPIPE.y, TAILPIPE.z - 0.17]} castShadow />
          <mesh geometry={g.pipeHole} material={m.hole} position={[TAILPIPE.x, TAILPIPE.y, TAILPIPE.z + 0.001]} />
        </group>
      </group>
      {wheels.map(([x, z], i) => (
        <group key={i} position={[x, WHEEL_R, z]} rotation={[spin, 0, 0]}>
          <mesh geometry={g.tire} material={m.tire} castShadow receiveShadow />
          <mesh geometry={g.rim} material={m.rim} />
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} geometry={g.spoke} material={m.dark} position={[Math.sign(x) * 0.15, 0, 0]} rotation={[(k / 5) * Math.PI * 2, 0, 0]} />
          ))}
        </group>
      ))}
    </group>
  );
};

// ── Exhaust puffs + smoke ring ─────────────────────────────────────────
const MAX_PUFFS = 70;
type Puff = { born: number; life: number; size: number; seed: number };

function puffSchedule(): Puff[] {
  const out: Puff[] = [];
  // idling puffs while we look at the tailpipe
  for (let tt = EVENTS.whipCut - 0.6; tt < CAR.launchAt; tt += 0.3) out.push({ born: tt, life: 1.2, size: 0.12, seed: out.length });
  // big "out the tailpipe" puff burst
  for (let k = 0; k < 4; k++) out.push({ born: EVENTS.tailpipePuff + k * 0.05, life: 1.6, size: 0.26 - k * 0.03, seed: 100 + k });
  // trailing puffs while driving off
  for (let tt = CAR.launchAt; tt < CAR.launchAt + 4.6; tt += 0.085) out.push({ born: tt, life: 0.95, size: 0.14, seed: out.length });
  return out.slice(0, MAX_PUFFS);
}

const Exhaust: React.FC<{ t: number }> = ({ t }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(puffSchedule, []);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9cfd5', roughness: 0.95, flatShading: true }), []);
  const ring = useMemo(() => new THREE.TorusGeometry(1, 0.42, 8, 18), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Euler() }), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    puffs.forEach((pf, i) => {
      const age = t - pf.born;
      const u = age / pf.life;
      if (u < 0 || u > 1) {
        tmp.m.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, tmp.m);
        return;
      }
      const birthPos = TAILPIPE.clone().add(new THREE.Vector3(0, 0, -carDistance(pf.born)));
      const spread = randRange(pf.seed, 1, -0.15, 0.15);
      tmp.p.copy(birthPos).add(new THREE.Vector3(spread * age * 2, 0.22 * age + 0.05 * age * age, 1.3 * age * (1 - 0.4 * u)));
      const s = pf.size * (0.35 + 1.6 * Math.sqrt(u)) * (1 - smoothstep(0.65, 1, u));
      tmp.e.set(pf.seed + age * 1.5, pf.seed * 2 + age, 0);
      tmp.q.setFromEuler(tmp.e);
      tmp.m.compose(tmp.p, tmp.q, tmp.s.set(s, s * 0.85, s));
      mesh.setMatrixAt(i, tmp.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [t, puffs, tmp]);

  // smoke ring on "tailpipe"
  const ra = t - EVENTS.tailpipePuff;
  const ringOn = ra > 0 && ra < 1.4;
  const ru = clamp(ra / 1.4);
  const rs = 0.08 + 0.32 * Math.sqrt(ru);

  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mat, puffs.length]} frustumCulled={false} castShadow />
      {ringOn && (
        <mesh
          geometry={ring}
          material={mat}
          position={[TAILPIPE.x + 0.05 * ru, TAILPIPE.y + 0.25 * ru, TAILPIPE.z + 0.15 + 1.6 * ru]}
          scale={[rs, rs, rs * (1 - smoothstep(0.7, 1, ru))]}
        />
      )}
    </group>
  );
};

// ── Road, verge, trees, city blocks ────────────────────────────────────
const Road: React.FC = () => {
  const dashRef = useRef<THREE.InstancedMesh>(null);
  const treeRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const bldRef = useRef<THREE.InstancedMesh>(null);
  const DASHES = 120;
  const TREES = 70;
  const BLDS = 60;
  const mats = useMemo(
    () => ({
      asphalt: new THREE.MeshStandardMaterial({ color: '#434a57', roughness: 0.85 }),
      line: new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.6 }),
      yellow: new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.55 }),
      curb: new THREE.MeshStandardMaterial({ color: '#e7e3da', roughness: 0.7 }),
      walk: new THREE.MeshStandardMaterial({ color: '#d9d2c3', roughness: 0.85 }),
      grass: new THREE.MeshStandardMaterial({ color: '#8fd37f', roughness: 0.95 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#5cbf62', roughness: 0.8, flatShading: true }),
      trunk: new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.9, flatShading: true }),
      bld: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }),
    }),
    [],
  );
  const geos = useMemo(
    () => ({
      dash: new THREE.BoxGeometry(0.16, 0.02, 1.4),
      cone: new THREE.ConeGeometry(0.9, 2.2, 7),
      trunk: new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6),
      box: new THREE.BoxGeometry(1, 1, 1),
    }),
    [],
  );

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    for (let i = 0; i < DASHES; i++) {
      m.makeTranslation(0, 0.012, 40 - i * 4.2);
      dashRef.current?.setMatrixAt(i, m);
    }
    const palette = ['#ff9f80', '#ffd166', '#7fd1c7', '#f7a8c4', '#9ec5ff', '#ffe3a3', '#c7a8ff'];
    for (let i = 0; i < TREES; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * randRange(i, 1, 6.6, 8.6);
      const z = 30 - Math.floor(i / 2) * 9 - rand(i, 2) * 4;
      const s = randRange(i, 3, 0.8, 1.25);
      m.compose(new THREE.Vector3(x, 0.9 * s + 1.0 * s, z), q, new THREE.Vector3(s, s, s));
      treeRef.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 0.45 * s, z), q, new THREE.Vector3(s, s, s));
      trunkRef.current?.setMatrixAt(i, m);
    }
    for (let i = 0; i < BLDS; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const w = randRange(i, 4, 4, 7);
      const h = randRange(i, 5, 5, 16);
      const d = randRange(i, 6, 5, 8);
      const x = side * (12 + w / 2 + rand(i, 7) * 3);
      const z = 25 - Math.floor(i / 2) * 9;
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d));
      bldRef.current?.setMatrixAt(i, m);
      bldRef.current?.setColorAt(i, c.set(palette[i % palette.length]));
    }
    [dashRef, treeRef, trunkRef, bldRef].forEach((r) => {
      if (!r.current) return;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    });
  }, []);

  const L = 620;
  const zc = 40 - L / 2;
  return (
    <group>
      <mesh material={mats.asphalt} position={[0, 0, zc]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, L]} />
      </mesh>
      {[-3.25, 3.25].map((x) => (
        <mesh key={x} material={mats.line} position={[x, 0.011, zc]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.14, L]} />
        </mesh>
      ))}
      {[-3.62, 3.62].map((x) => (
        <mesh key={x} material={mats.curb} position={[x, 0.07, zc]} receiveShadow castShadow>
          <boxGeometry args={[0.24, 0.14, L]} />
        </mesh>
      ))}
      {[-4.9, 4.9].map((x) => (
        <mesh key={x} material={mats.walk} position={[x, 0.1, zc]} receiveShadow>
          <boxGeometry args={[2.3, 0.2, L]} />
        </mesh>
      ))}
      <mesh material={mats.grass} position={[0, -0.01, zc]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, L]} />
      </mesh>
      <instancedMesh ref={dashRef} args={[geos.dash, mats.yellow, DASHES]} frustumCulled={false} receiveShadow />
      <instancedMesh ref={treeRef} args={[geos.cone, mats.leaf, TREES]} frustumCulled={false} castShadow receiveShadow />
      <instancedMesh ref={trunkRef} args={[geos.trunk, mats.trunk, TREES]} frustumCulled={false} castShadow />
      <instancedMesh ref={bldRef} args={[geos.box, mats.bld, BLDS]} frustumCulled={false} castShadow receiveShadow />
    </group>
  );
};

export const CarSet: React.FC<{ t: number }> = ({ t }) => (
  <group position={CAR_ORIGIN.toArray()}>
    <Road />
    <Car t={t} />
    <Exhaust t={t} />
  </group>
);
