/**
 * The 4-stroke cutaway engine. Everything moving is driven by ONE number —
 * the crank angle θ — through real slider-crank kinematics, so the piston,
 * connecting rod, crank, valves and cams always agree with each other.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  CAM_Y,
  ENGINE as E,
  camRotation,
  crankPin,
  pistonPinY,
  rodAngle,
} from '../lib/kinematics';
import * as G from '../lib/engineGeometry';
import { HOUSING_MATS, MAT } from '../lib/materials';

const shadow = { castShadow: true, receiveShadow: true } as const;

// ── Static housing ──────────────────────────────────────────────────────
const Housing: React.FC = () => {
  const g = useMemo(() => {
    const pieces = G.buildHousing();
    const bore = G.buildBore();
    return {
      pieces,
      ...bore,
      roof: G.buildRoof(),
      intakePort: G.buildPortInterior(-1),
      exhaustPort: G.buildPortInterior(1),
      boss: new THREE.CylinderGeometry(0.22, 0.24, 0.14, 32).rotateX(Math.PI / 2),
      step: new THREE.RingGeometry(E.plugHoleR, E.plugWellR, 24, 1, 0, Math.PI).rotateX(-Math.PI / 2),
    };
  }, []);
  const n = g.pieces.length;
  return (
    <group>
      {g.pieces.map((geo, i) => (
        // last two pieces are interior back walls → skin material on both faces
        <mesh key={i} geometry={geo} material={i >= n - 3 && i !== n - 2 ? [MAT.housing, MAT.housing] : HOUSING_MATS} {...shadow} />
      ))}
      <mesh geometry={g.bore} material={MAT.bore} {...shadow} />
      <mesh geometry={g.plugHole} material={MAT.bore} receiveShadow />
      <mesh geometry={g.plugWell} material={MAT.bore} receiveShadow />
      <mesh geometry={g.step} material={MAT.roof} position={[0, E.plugWellY, 0]} receiveShadow />
      <mesh geometry={g.roof} material={MAT.roof} receiveShadow />
      <mesh geometry={g.intakePort} material={MAT.intakeInner} receiveShadow />
      <mesh geometry={g.exhaustPort} material={MAT.exhaustPortInner} receiveShadow />
      <mesh geometry={g.boss} material={MAT.housing} position={[0, 0, -0.55]} {...shadow} />
    </group>
  );
};

/** Liner lip — the "sleeve" the piston slides through. Full ring in the hook, cut ring afterwards. */
const LinerLip: React.FC<{ full: boolean }> = ({ full }) => {
  const geos = useMemo(() => {
    const prof = [
      new THREE.Vector2(0.586, E.linerBottom),
      new THREE.Vector2(0.586, 0.83),
      new THREE.Vector2(0.605, 0.79),
      new THREE.Vector2(0.66, 0.785),
      new THREE.Vector2(0.69, 0.815),
      new THREE.Vector2(0.69, E.linerBottom),
    ];
    return {
      full: new THREE.LatheGeometry(prof, 72),
      half: new THREE.LatheGeometry(prof, 36, Math.PI / 2, Math.PI),
    };
  }, []);
  const mat = useMemo(() => {
    const m = MAT.steel.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, []);
  return <mesh geometry={full ? geos.full : geos.half} material={mat} {...shadow} />;
};

// ── Crankshaft ──────────────────────────────────────────────────────────
const Crankshaft: React.FC<{ theta: number }> = ({ theta }) => {
  const g = useMemo(
    () => ({
      web: G.buildCrankWeb(),
      pin: new THREE.CylinderGeometry(0.12, 0.12, 0.3, 28).rotateX(Math.PI / 2),
      mainFront: new THREE.CylinderGeometry(0.13, 0.13, 0.22, 28).rotateX(Math.PI / 2),
      mainBack: new THREE.CylinderGeometry(0.13, 0.13, 0.4, 28).rotateX(Math.PI / 2),
      gear: G.buildGear(18, 0.2, 0.25, 0.07),
      nut: new THREE.CylinderGeometry(0.08, 0.08, 0.05, 6).rotateX(Math.PI / 2),
    }),
    [],
  );
  return (
    <group rotation={[0, 0, -theta]}>
      <mesh geometry={g.web} material={MAT.darkSteel} position={[0, 0, 0.18]} {...shadow} />
      <mesh geometry={g.web} material={MAT.darkSteel} position={[0, 0, -0.18]} {...shadow} />
      <mesh geometry={g.pin} material={MAT.steel} position={[0, E.crankR, 0]} {...shadow} />
      <mesh geometry={g.mainFront} material={MAT.steel} position={[0, 0, 0.34]} {...shadow} />
      <mesh geometry={g.mainBack} material={MAT.steel} position={[0, 0, -0.42]} {...shadow} />
      <mesh geometry={g.gear} material={MAT.bronze} position={[0, 0, 0.47]} {...shadow} />
      <mesh geometry={g.nut} material={MAT.chrome} position={[0, 0, 0.53]} castShadow />
    </group>
  );
};

// ── Connecting rod ─────────────────────────────────────────────────────
const ConRod: React.FC<{ theta: number }> = ({ theta }) => {
  const geo = useMemo(() => G.buildRod(), []);
  const [px, py] = crankPin(theta);
  return <mesh geometry={geo} material={MAT.steel} position={[px, py, 0]} rotation={[0, 0, rodAngle(theta)]} {...shadow} />;
};

// ── Piston ─────────────────────────────────────────────────────────────
const Piston: React.FC<{ theta: number }> = ({ theta }) => {
  const g = useMemo(
    () => ({
      body: G.buildPiston(),
      ring: new THREE.CylinderGeometry(E.pistonR + 0.003, E.pistonR + 0.003, 0.02, 72, 1, true),
      pin: new THREE.CylinderGeometry(0.062, 0.062, 1.06, 20).rotateX(Math.PI / 2),
      pinEnd: new THREE.CylinderGeometry(0.085, 0.085, 0.02, 24).rotateX(Math.PI / 2),
    }),
    [],
  );
  const ringMat = useMemo(() => {
    const m = MAT.gunmetal.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, []);
  const bodyMat = useMemo(() => {
    const m = MAT.chrome.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, []);
  return (
    <group position={[0, pistonPinY(theta), 0]}>
      <mesh geometry={g.body} material={bodyMat} {...shadow} />
      <mesh geometry={g.ring} material={ringMat} position={[0, 0.222, 0]} castShadow />
      <mesh geometry={g.ring} material={ringMat} position={[0, 0.162, 0]} castShadow />
      <mesh geometry={g.pin} material={MAT.steel} castShadow />
      <mesh geometry={g.pinEnd} material={MAT.gunmetal} position={[0, 0, E.pistonR - 0.006]} />
    </group>
  );
};

// ── Valves, springs, cams ───────────────────────────────────────────────
const Valve: React.FC<{ side: number; lift: number }> = ({ side, lift }) => {
  const g = useMemo(() => ({ valve: G.buildValve(), spring: G.buildSpring() }), []);
  const springLen = E.stemTopClosed - 0.0475 - lift - E.headTop;
  return (
    <group>
      <mesh geometry={g.valve} material={MAT.chrome} position={[side * E.valveX, E.roofY - lift, 0]} {...shadow} />
      <mesh geometry={g.spring} material={MAT.spring} position={[side * E.valveX, E.headTop, 0]} scale={[1, springLen, 1]} {...shadow} />
    </group>
  );
};

const Camshaft: React.FC<{ side: number; theta: number }> = ({ side, theta }) => {
  const kind = side < 0 ? 'intake' : 'exhaust';
  const g = useMemo(
    () => ({
      lobe: G.buildCamLobe(kind),
      shaft: new THREE.CylinderGeometry(0.05, 0.05, 0.95, 20).rotateX(Math.PI / 2),
      journal: new THREE.CylinderGeometry(0.075, 0.075, 0.08, 24).rotateX(Math.PI / 2),
    }),
    [kind],
  );
  return (
    <group position={[side * E.valveX, CAM_Y, 0]} rotation={[0, 0, camRotation(theta)]}>
      <mesh geometry={g.lobe} material={MAT.darkSteel} {...shadow} />
      <mesh geometry={g.shaft} material={MAT.steel} position={[0, 0, -0.38]} {...shadow} />
      <mesh geometry={g.journal} material={MAT.steel} position={[0, 0, -0.2]} castShadow />
      <mesh geometry={g.journal} material={MAT.steel} position={[0, 0, 0.12]} castShadow />
    </group>
  );
};

// ── Spark plug (static) ────────────────────────────────────────────────
export const PLUG_TIP = { center: new THREE.Vector3(0, E.roofY - 0.07, 0), ground: new THREE.Vector3(0, E.roofY - 0.105, 0) };

const SparkPlug: React.FC = () => {
  const g = useMemo(() => {
    const parts = G.buildPlugParts();
    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(0, 1.55, 0),
      new THREE.Vector3(0.05, 1.85, 0),
      new THREE.Vector3(0.35, 2.15, -0.1),
      new THREE.Vector3(0.75, 2.3, -0.3),
    ]);
    return {
      ...parts,
      hex: new THREE.CylinderGeometry(0.13, 0.13, 0.14, 6),
      body: new THREE.CylinderGeometry(0.1, 0.1, 0.035, 28),
      terminal: new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16),
      boot: new THREE.CylinderGeometry(0.065, 0.075, 0.2, 24),
      wire: new THREE.TubeGeometry(wireCurve, 60, 0.032, 10, false),
      center: new THREE.CylinderGeometry(0.012, 0.012, 0.04, 10),
      gV: new THREE.BoxGeometry(0.022, 0.125, 0.032),
      gH: new THREE.BoxGeometry(0.1, 0.02, 0.032),
    };
  }, []);
  const hexMat = useMemo(() => {
    const m = MAT.steel.clone();
    m.flatShading = true;
    return m;
  }, []);
  return (
    <group position={[0, E.roofY, 0]}>
      <mesh geometry={g.thread} material={MAT.steel} {...shadow} />
      <mesh geometry={g.hex} material={hexMat} position={[0, 0.43, 0]} {...shadow} />
      <mesh geometry={g.body} material={MAT.chrome} position={[0, 0.515, 0]} castShadow />
      <mesh geometry={g.insulator} material={MAT.ceramic} {...shadow} />
      <mesh geometry={g.terminal} material={MAT.chrome} position={[0, 1.1, 0]} castShadow />
      <mesh geometry={g.boot} material={MAT.rubber} position={[0, 1.2, 0]} castShadow />
      <mesh geometry={g.wire} material={MAT.wireRed} {...shadow} />
      <mesh geometry={g.nose} material={MAT.ceramic} />
      <mesh geometry={g.center} material={MAT.chrome} position={[0, -0.05, 0]} />
      <mesh geometry={g.gV} material={MAT.steel} position={[0.075, -0.0625, 0]} />
      <mesh geometry={g.gH} material={MAT.steel} position={[0.035, -0.115, 0]} />
    </group>
  );
};

// ── Intake runner, funnel, injector ─────────────────────────────────────
export const INJECTOR_TIP = new THREE.Vector3(-1.15, 3.07, -0.02);

const IntakeSystem: React.FC = () => {
  const g = useMemo(
    () => ({
      runner: G.buildExternalPipe(G.INTAKE_CTRL, 160, E.portR, E.portR + 0.04),
      funnel: G.buildFunnel(),
      injBody: new THREE.CylinderGeometry(0.055, 0.055, 0.3, 20),
      injTip: new THREE.CylinderGeometry(0.035, 0.012, 0.08, 16),
      injCap: new THREE.BoxGeometry(0.15, 0.1, 0.12),
      oring: new THREE.TorusGeometry(0.057, 0.012, 8, 20).rotateX(Math.PI / 2),
    }),
    [],
  );
  const funnelMat = useMemo(() => {
    const m = MAT.chrome.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, []);
  return (
    <group>
      <mesh geometry={g.runner} material={[MAT.intakeInner, MAT.intakePaint, MAT.intakePaint]} {...shadow} />
      <mesh geometry={g.funnel} material={funnelMat} position={[G.FUNNEL_BASE.x, G.FUNNEL_BASE.y, 0]} {...shadow} />
      <group position={INJECTOR_TIP.toArray()} rotation={[0, 0, Math.PI / 6]}>
        <mesh geometry={g.injTip} material={MAT.chrome} position={[0, 0.04, 0]} castShadow />
        <mesh geometry={g.injBody} material={MAT.plasticDark} position={[0, 0.23, 0]} {...shadow} />
        <mesh geometry={g.oring} material={MAT.intakePaint} position={[0, 0.12, 0]} />
        <mesh geometry={g.injCap} material={MAT.rubber} position={[0, 0.42, 0]} {...shadow} />
      </group>
    </group>
  );
};

// ── Exhaust header + long pipe ─────────────────────────────────────────
const ExhaustSystem: React.FC = () => {
  const g = useMemo(
    () => ({
      pipe: G.buildExternalPipe(G.EXHAUST_CTRL, 320, E.portR, E.portR + 0.04),
      post: new THREE.CylinderGeometry(0.04, 0.04, 1.0, 12),
      foot: new THREE.CylinderGeometry(0.16, 0.18, 0.05, 24),
      saddle: new THREE.BoxGeometry(0.1, 0.05, 0.36),
    }),
    [],
  );
  const posts = [4.2, 7.4, 10.6];
  const postH = 1.9 - 0.19 - E.floorY;
  return (
    <group>
      <mesh geometry={g.pipe} material={[MAT.exhaustInner, MAT.chrome, MAT.chrome]} {...shadow} />
      {posts.map((x) => (
        <group key={x} position={[x, E.floorY, -0.12]}>
          <mesh geometry={g.post} material={MAT.steel} position={[0, postH / 2, 0]} scale={[1, postH, 1]} {...shadow} />
          <mesh geometry={g.foot} material={MAT.darkSteel} position={[0, 0.025, 0]} {...shadow} />
          <mesh geometry={g.saddle} material={MAT.darkSteel} position={[0, postH - 0.02, 0.06]} castShadow />
        </group>
      ))}
    </group>
  );
};

// ── Assembly ────────────────────────────────────────────────────────────
export const Engine: React.FC<{ theta: number; intakeLift: number; exhaustLift: number; fullLip: boolean }> = ({
  theta,
  intakeLift,
  exhaustLift,
  fullLip,
}) => {
  return (
    <group>
      <Housing />
      <LinerLip full={fullLip} />
      <Crankshaft theta={theta} />
      <ConRod theta={theta} />
      <Piston theta={theta} />
      <Valve side={-1} lift={intakeLift} />
      <Valve side={1} lift={exhaustLift} />
      <Camshaft side={-1} theta={theta} />
      <Camshaft side={1} theta={theta} />
      <SparkPlug />
      <IntakeSystem />
      <ExhaustSystem />
    </group>
  );
};
