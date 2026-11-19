/**
 * Air / fuel charge + exhaust fumes.
 *
 * Remotion renders frames out of order and in parallel, so nothing here is
 * simulated step-by-step: every particle position is a pure function of time
 * (paths + chamber-relative coordinates that ride along with the piston).
 */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DURATION_SEC, EVENTS } from '../timeline';
import { ENGINE as E, GAP_MAX, GAP_MIN, crankRad, crownY, cycleDeg, exhaustLift, intakeLift } from '../lib/kinematics';
import { EASE, clamp, lerp, rand, randRange, smoothstep } from '../lib/math';
import { EXHAUST_CTRL, INTAKE_CTRL, FUNNEL_BASE, leftNormals, samplePath } from '../lib/engineGeometry';
import { INJECTOR_TIP, PLUG_TIP } from './Engine';

const N_AIR = 64;
const N_FUEL = 30;
const N_CHARGE = N_AIR + N_FUEL;
const N_SMOKE = 26;

// ── Chamber tumble (integrated once into a lookup table) ────────────────
const SW_DT = 1 / 120;
function tumbleRate(t: number) {
  if (t < EVENTS.airStreamStart) return 0;
  if (t < EVENTS.lazyStart) return 2.3;
  if (t < EVENTS.compressionHeatStart) return lerp(2.3, 0.18, smoothstep(EVENTS.lazyStart, EVENTS.lazyFull, t));
  if (t < EVENTS.bang) return 0.18 + 0.9 * heatAt(t);
  return 0.75;
}
let swirlTable: Float32Array | null = null;
function swirlAt(t: number) {
  if (!swirlTable) {
    const n = Math.ceil(DURATION_SEC / SW_DT) + 2;
    swirlTable = new Float32Array(n);
    for (let i = 1; i < n; i++) swirlTable[i] = swirlTable[i - 1] + tumbleRate(i * SW_DT) * SW_DT;
  }
  const f = clamp(t / SW_DT, 0, swirlTable.length - 2);
  const i = Math.floor(f);
  return lerp(swirlTable[i], swirlTable[i + 1], f - i);
}

/** 0 → 1 as the piston squeezes the charge (only after the intake valve shuts). */
export function heatAt(t: number) {
  if (t < EVENTS.compressionHeatStart) return 0;
  const gap = E.roofY - crownY(crankRad(t));
  return smoothstep(GAP_MAX * 0.97, GAP_MIN, gap);
}

type ChamberSlot = { rho: number; ang: number; zf: number; speed: number; seed: number };
const _v = new THREE.Vector3();

/** Position inside the (moving) combustion chamber — normalised to the current gap. */
function chamberPos(out: THREE.Vector3, p: ChamberSlot, t: number, extra = 0) {
  const crown = crownY(crankRad(t));
  const gap = E.roofY - crown;
  const hy = Math.max(0.035, gap / 2 - 0.065);
  const mid = crown + gap / 2;
  const a = p.ang + swirlAt(t) * p.speed;
  const x = p.rho * Math.cos(a) * (E.boreR - 0.09);
  let y = mid + p.rho * Math.sin(a) * hy;
  const zMax = Math.sqrt(Math.max(0, (E.boreR - 0.08) ** 2 - x * x));
  const z = 0.02 - p.zf * zMax;
  // "won't do much on its own": go limp — sink a little and bob lazily
  const lazy = t < EVENTS.compressionHeatStart ? smoothstep(EVENTS.lazyStart, EVENTS.lazyFull, t) : 1 - smoothstep(EVENTS.compressionHeatStart, EVENTS.compressionHeatStart + 1.2, t);
  y += lazy * (-0.07 * (0.5 + 0.5 * p.rho) + 0.035 * Math.sin(t * 1.3 + p.seed * 6.0));
  y += extra;
  y = clamp(y, crown + 0.05, E.roofY - 0.05);
  return out.set(x, y, z);
}

const slot = (i: number, salt: number): ChamberSlot => ({
  rho: Math.sqrt(randRange(i, salt, 0.05, 1)) * 0.95,
  ang: rand(i, salt + 1) * Math.PI * 2,
  zf: randRange(i, salt + 2, 0.05, 0.95),
  speed: randRange(i, salt + 3, 0.6, 1.25),
  seed: rand(i, salt + 4),
});

/** Turn a 2D path (z = 0 plane) into 3D points with a cross-stream offset. */
function offsetPath2D(pts: THREE.Vector2[], across: number, z: number) {
  const ns = leftNormals(pts);
  return pts.map((p, i) => new THREE.Vector3(p.x + ns[i].x * across, p.y + ns[i].y * across, z));
}

// ── Shared glowing-instance material (emissive follows instance colour) ─
function glowMaterial(params: THREE.MeshStandardMaterialParameters) {
  const m = new THREE.MeshStandardMaterial({ emissive: '#ffffff', ...params });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#if defined( USE_COLOR )\n totalEmissiveRadiance *= vColor.rgb;\n#endif',
    );
  };
  return m;
}

const C = {
  air: new THREE.Color('#5cb9ff'),
  fuel: new THREE.Color('#ffc634'),
  hot1: new THREE.Color('#ff5a00'),
  hot2: new THREE.Color('#ff1e00'),
  burn: new THREE.Color('#fff1b0'),
};

// ════════════════════════════════════════════════════════════════════════
//  Fresh charge: air (blue) + fuel droplets (gold)
// ════════════════════════════════════════════════════════════════════════
type ChargeP = ChamberSlot & { kind: 0 | 1; size: number; spawn: number; travel: number; arrive: number; path: THREE.CatmullRomCurve3 };

function buildCharge(): ChargeP[] {
  const intake2D = samplePath(INTAKE_CTRL, 60).reverse(); // funnel → seat
  const portStart = intake2D.findIndex((p) => p.x > -0.82); // where the fuel joins
  const out: ChargeP[] = [];
  for (let i = 0; i < N_CHARGE; i++) {
    const kind: 0 | 1 = i < N_AIR ? 0 : 1;
    const j = kind === 0 ? i : i - N_AIR;
    const s = slot(i, 11);
    const travel = kind === 0 ? randRange(i, 21, 1.15, 1.45) : randRange(i, 21, 0.8, 1.0);
    const window =
      kind === 0
        ? [EVENTS.airStreamStart, EVENTS.airStreamEnd - travel]
        : [EVENTS.fuelSprayStart, EVENTS.fuelSprayEnd];
    const n = kind === 0 ? N_AIR : N_FUEL;
    const spawn = lerp(window[0], window[1], (j + rand(i, 22) * 0.8) / n);
    const arrive = spawn + travel;
    const across = randRange(i, 23, -0.075, 0.075);
    const z = randRange(i, 24, -0.11, 0.0);
    const side = rand(i, 25) > 0.5 ? 1 : -1;
    const dest = chamberPos(new THREE.Vector3(), s, arrive);
    const seatPts = [
      new THREE.Vector3(-E.valveX + across * 0.5, E.roofY + 0.06, z * 0.6),
      new THREE.Vector3(-E.valveX + side * 0.2, E.roofY - 0.07, z * 0.5),
    ];
    let pts: THREE.Vector3[];
    if (kind === 0) {
      const top = new THREE.Vector3(FUNNEL_BASE.x + randRange(i, 26, -0.3, 0.3), 4.85 + rand(i, 27) * 0.35, randRange(i, 28, -0.2, 0.05));
      const mouth = new THREE.Vector3(FUNNEL_BASE.x + across * 2, FUNNEL_BASE.y + 0.3, z);
      const along = offsetPath2D(intake2D.filter((_, k) => k % 4 === 0), across, z);
      pts = [top, mouth, ...along.slice(0, -1), ...seatPts, dest];
    } else {
      const spray = INJECTOR_TIP.clone().add(new THREE.Vector3(0.12 + across, -0.12 + across * 0.5, z * 0.5));
      const along = offsetPath2D(intake2D.slice(portStart).filter((_, k) => k % 3 === 0), across * 0.7, z);
      pts = [INJECTOR_TIP.clone(), spray, ...along.slice(1, -1), ...seatPts, dest];
    }
    out.push({ ...s, kind, size: kind === 0 ? randRange(i, 29, 0.038, 0.05) : randRange(i, 29, 0.026, 0.036), spawn, travel, arrive, path: new THREE.CatmullRomCurve3(pts, false, 'centripetal') });
  }
  return out;
}

export const ChargeParticles: React.FC<{ t: number }> = ({ t }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(buildCharge, []);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const mat = useMemo(() => glowMaterial({ roughness: 0.22, metalness: 0.1 }), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const H = heatAt(t);
    const iLift = intakeLift(cycleDeg(t));
    const ignite = t >= EVENTS.sparkFire;
    const flameR = ignite ? (t - EVENTS.sparkFire) * 0.34 : -1;
    const consumed = smoothstep(EVENTS.bang, EVENTS.bang + 0.2, t);
    const jitterAmp = 0.018 * Math.pow(H, 1.4);
    mat.emissiveIntensity = 0.3 + 1.1 * H;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      let scale = p.size;
      if (t < p.spawn || t > EVENTS.bang + 0.25) {
        scale = 0;
        _v.set(0, -50, 0);
      } else if (t < p.arrive) {
        const u = (t - p.spawn) / p.travel;
        p.path.getPointAt(EASE.inOutSine(clamp(u)) * 0.6 + clamp(u) * 0.4, _v);
        scale *= smoothstep(0, 0.12, u);
        // squeeze through the valve gap only while the valve is actually open
        if (u > 0.75 && iLift < 0.02) scale *= 0.6;
      } else {
        chamberPos(_v, p, t);
        if (jitterAmp > 0) {
          _v.x += jitterAmp * Math.sin(t * 71 + p.seed * 40);
          _v.y += jitterAmp * Math.sin(t * 83 + p.seed * 23) * 0.7;
          _v.z += jitterAmp * Math.sin(t * 59 + p.seed * 31) * 0.5;
        }
      }
      // colour: cool → hot (compression) → white-hot (ignition)
      col.copy(p.kind === 0 ? C.air : C.fuel);
      if (H > 0) {
        const h1 = smoothstep(0.0, 0.6, H);
        const h2 = smoothstep(0.55, 1.0, H);
        col.lerp(C.hot1, h1).lerp(C.hot2, h2 * 0.8);
      }
      if (ignite) {
        const d = _v.distanceTo(PLUG_TIP.center);
        const burning = smoothstep(flameR, flameR - 0.12, d);
        if (burning > 0) {
          const flick = 0.85 + 0.15 * Math.sin(t * 60 + p.seed * 20);
          col.lerp(C.burn, burning).multiplyScalar(1 + 0.6 * burning * flick);
          scale *= 1 + 0.35 * burning;
        }
      }
      scale *= 1 - consumed;
      m4.compose(_v, q, new THREE.Vector3(scale, scale, scale));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [t, parts, mat, m4, q, col]);

  return <instancedMesh ref={ref} args={[geo, mat, N_CHARGE]} frustumCulled={false} castShadow />;
};

// ════════════════════════════════════════════════════════════════════════
//  Burnt gas: gray fume puffs that ride the piston down, then get blown out
// ════════════════════════════════════════════════════════════════════════
type SmokeP = ChamberSlot & { size: number; born: number; exit: number; path: THREE.CatmullRomCurve3 };

function buildSmoke(): SmokeP[] {
  const ex2D = samplePath(EXHAUST_CTRL, 140); // seat → far end of the pipe
  const out: SmokeP[] = [];
  for (let i = 0; i < N_SMOKE; i++) {
    const s = slot(i, 51);
    const exit = lerp(EVENTS.exhaustExitStart, EVENTS.exhaustExitEnd, (i + rand(i, 52) * 0.7) / N_SMOKE);
    const across = randRange(i, 53, -0.05, 0.05);
    const z = randRange(i, 54, -0.09, -0.03);
    const start = chamberPos(new THREE.Vector3(), s, exit);
    const along = offsetPath2D(ex2D.filter((_, k) => k % 5 === 0), across, z);
    const pts = [
      start,
      new THREE.Vector3(E.valveX + (rand(i, 55) > 0.5 ? 0.2 : -0.2), E.roofY - 0.07, z),
      new THREE.Vector3(E.valveX + across, E.roofY + 0.08, z),
      ...along.slice(1),
    ];
    out.push({
      ...s,
      size: randRange(i, 56, 0.07, 0.11),
      born: EVENTS.smokeForm + rand(i, 57) * 0.6,
      exit,
      path: new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
    });
  }
  return out;
}

export const SmokeParticles: React.FC<{ t: number }> = ({ t }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(buildSmoke, []);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a7adb3', roughness: 0.9, metalness: 0, flatShading: true }), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const eLift = exhaustLift(cycleDeg(t));
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      let s = p.size * smoothstep(p.born, p.born + 0.5, t);
      if (t < p.born || t > p.exit + EVENTS.pipeTravelSec || t > EVENTS.whipCut + 0.2) {
        s = 0;
        _v.set(0, -50, 0);
      } else if (t < p.exit || eLift < 0.01) {
        chamberPos(_v, p, t, 0);
      } else {
        const u = clamp((t - p.exit) / EVENTS.pipeTravelSec);
        p.path.getPointAt(EASE.inQuad(u) * 0.55 + u * 0.45, _v);
        s *= 1.15 - 0.35 * smoothstep(0.1, 0.3, u) - 0.8 * smoothstep(0.85, 1, u);
      }
      // still-hot fumes glow a touch right after the bang
      const warm = 1 - smoothstep(EVENTS.smokeForm, EVENTS.smokeForm + 1.2, t);
      col.set('#ffffff').lerp(new THREE.Color('#ffb27a'), warm * 0.8);
      q.setFromEuler(new THREE.Euler(p.seed * 6 + t * 0.6, p.seed * 3 + t * 0.4, 0));
      m4.compose(_v, q, scl.set(s, s * 0.9, s));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [t, parts, m4, q, col, scl]);

  return <instancedMesh ref={ref} args={[geo, mat, N_SMOKE]} frustumCulled={false} castShadow receiveShadow />;
};
