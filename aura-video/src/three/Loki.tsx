import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {Particles} from './Particles';
import {mulberry} from '../lib/math';

/**
 * Original trickster design (Norse myth, not any film/comic version):
 * tall thin figure, dark-blue hooded cloak with silver Elder-Futhark runes,
 * a silver fox mask with violet eye slits, violet fire in both hands.
 */

// Elder Futhark rune strokes in a 0..1 (x) by 0..1 (y) box
const RUNES: number[][][] = [
  [[0.2, 0, 0.2, 1], [0.2, 0.75, 0.75, 1], [0.2, 0.45, 0.75, 0.7]], // fehu
  [[0.2, 0, 0.2, 1], [0.2, 1, 0.8, 0.6], [0.8, 0.6, 0.8, 0]], // uruz
  [[0.25, 0, 0.25, 1], [0.25, 0.75, 0.75, 0.5], [0.75, 0.5, 0.25, 0.25]], // thurisaz
  [[0.2, 0, 0.2, 1], [0.2, 1, 0.75, 0.75], [0.2, 0.7, 0.75, 0.45]], // ansuz
  [[0.2, 0, 0.2, 1], [0.2, 1, 0.75, 0.75], [0.75, 0.75, 0.2, 0.5], [0.2, 0.5, 0.75, 0]], // raido
  [[0.7, 1, 0.25, 0.5], [0.25, 0.5, 0.7, 0]], // kaunan
  [[0.15, 0, 0.85, 1], [0.85, 0, 0.15, 1]], // gebo
  [[0.2, 0, 0.2, 1], [0.8, 0, 0.8, 1], [0.2, 0.65, 0.8, 0.35]], // hagalaz
  [[0.5, 0, 0.5, 1], [0.25, 0.65, 0.75, 0.35]], // naudiz
  [[0.5, 0, 0.5, 1]], // isaz
  [[0.5, 0, 0.5, 1], [0.5, 1, 0.85, 0.75], [0.5, 0, 0.15, 0.25]], // eihwaz
  [[0.5, 0, 0.5, 1], [0.5, 0.5, 0.15, 0.85], [0.5, 0.5, 0.85, 0.85]], // algiz
  [[0.75, 1, 0.25, 0.65], [0.25, 0.65, 0.75, 0.35], [0.75, 0.35, 0.25, 0]], // sowilo
  [[0.5, 0, 0.5, 1], [0.5, 1, 0.15, 0.7], [0.5, 1, 0.85, 0.7]], // tiwaz
  [[0.25, 0, 0.25, 1], [0.25, 1, 0.75, 0.75], [0.75, 0.75, 0.25, 0.5], [0.25, 0.5, 0.75, 0.25], [0.75, 0.25, 0.25, 0]], // berkanan
  [[0.15, 0, 0.15, 1], [0.85, 0, 0.85, 1], [0.15, 1, 0.5, 0.6], [0.5, 0.6, 0.85, 1]], // ehwaz
  [[0.3, 0, 0.3, 1], [0.3, 1, 0.75, 0.75]], // laguz
  [[0.5, 0, 0.15, 0.4], [0.15, 0.4, 0.5, 0.8], [0.5, 0.8, 0.85, 0.4], [0.85, 0.4, 0.5, 0]], // ingwaz
  [[0.15, 0, 0.15, 1], [0.85, 0, 0.85, 1], [0.15, 1, 0.85, 0], [0.15, 0, 0.85, 1]], // dagaz
  [[0.15, 0, 0.5, 0.45], [0.85, 0, 0.5, 0.45], [0.5, 0.45, 0.2, 0.75], [0.2, 0.75, 0.5, 1], [0.5, 1, 0.8, 0.75], [0.8, 0.75, 0.5, 0.45]], // othala
];

/** Rune band wrapped around a cone/cylinder surface. */
const buildRuneBand = (radiusAt: (y: number) => number, y0: number, h: number, count: number, gapCenter = 0, gapWidth = 0, seed = 1) => {
  const r = mulberry(seed);
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    let da = Math.atan2(Math.sin(ang - gapCenter), Math.cos(ang - gapCenter));
    if (Math.abs(da) < gapWidth / 2) continue;
    const rune = RUNES[Math.floor(r() * RUNES.length)];
    const rad = radiusAt(y0 + h / 2) + 0.012;
    const w = h * 0.6;
    for (const [x1, yy1, x2, yy2] of rune) {
      const a = new THREE.Vector3((x1 - 0.5) * w, yy1 * h, 0);
      const b = new THREE.Vector3((x2 - 0.5) * w, yy2 * h, 0);
      const len = a.distanceTo(b);
      const g = new THREE.BoxGeometry(h * 0.08, len + h * 0.06, 0.008);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const rotZ = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
      g.rotateZ(rotZ);
      g.translate(mid.x, mid.y, 0);
      // place on surface facing outward
      const m = new THREE.Matrix4().makeRotationY(ang).multiply(new THREE.Matrix4().makeTranslation(0, y0, rad));
      g.applyMatrix4(m);
      geos.push(g.toNonIndexed());
    }
  }
  return mergeGeometries(geos, false);
};

export const Loki: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  t: number;
  fire?: number; // 0..1 hand fire
  armsUp?: number; // 0 down .. 1 raised to sides
  headPitch?: number;
  runeGlow?: number;
  eyeGlow?: number;
  snapHand?: boolean;
  scale?: number;
}> = ({position, rotationY = 0, t, fire = 1, armsUp = 0.4, headPitch = 0, runeGlow = 1, eyeGlow = 1, scale = 1}) => {
  const M = useMemo(
    () => ({
      cloak: new THREE.MeshStandardMaterial({color: '#16224d', roughness: 0.55, metalness: 0.15, flatShading: true, side: THREE.DoubleSide}),
      lining: new THREE.MeshStandardMaterial({color: '#2a1050', roughness: 0.7, flatShading: true, side: THREE.DoubleSide}),
      robe: new THREE.MeshStandardMaterial({color: '#0b1029', roughness: 0.6, flatShading: true}),
      hood: new THREE.MeshStandardMaterial({color: '#1b2a5c', roughness: 0.55, flatShading: true, side: THREE.DoubleSide}),
      void: new THREE.MeshBasicMaterial({color: '#030208'}),
      silver: new THREE.MeshStandardMaterial({color: '#d4dbe6', metalness: 1, roughness: 0.22, flatShading: true, emissive: '#3b3f5a', emissiveIntensity: 0.25}),
      rune: new THREE.MeshStandardMaterial({color: '#e8eeff', emissive: '#cfd8ff', emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3}),
      glove: new THREE.MeshStandardMaterial({color: '#1d1f2b', roughness: 0.5, metalness: 0.3, flatShading: true}),
      eye: new THREE.MeshStandardMaterial({color: '#e9d5ff', emissive: '#b26bff', emissiveIntensity: 6}),
    }),
    []
  );
  M.rune.emissiveIntensity = 1.6 * runeGlow;
  M.eye.emissiveIntensity = 7 * eyeGlow;

  const geo = useMemo(() => {
    const cloak = new THREE.CylinderGeometry(0.3, 0.72, 1.95, 11, 3, true, 0.35, Math.PI * 2 - 0.7);
    const lining = new THREE.CylinderGeometry(0.29, 0.7, 1.93, 11, 1, true, 0.35, Math.PI * 2 - 0.7);
    const robe = new THREE.CylinderGeometry(0.17, 0.32, 1.9, 8);
    const mantle = new THREE.CylinderGeometry(0.2, 0.52, 0.42, 11, 1, true);
    const hood = new THREE.SphereGeometry(0.31, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.68).scale(1, 1.18, 1.12);
    const hoodTip = new THREE.ConeGeometry(0.16, 0.42, 6);
    const hemBand = buildRuneBand((y) => 0.72 - ((y + 0.975) / 1.95) * 0.42, -0.94, 0.17, 26, 0, 1.0, 3);
    const robeRunes = (() => {
      const g: THREE.BufferGeometry[] = [];
      const r = mulberry(8);
      for (let i = 0; i < 6; i++) {
        const rune = RUNES[Math.floor(r() * RUNES.length)];
        const h = 0.13;
        const y0 = 0.55 - i * 0.24;
        const rad = 0.17 + ((0.55 - y0) / 1.9) * 0.15 + 0.012;
        for (const [x1, yy1, x2, yy2] of rune) {
          const a = new THREE.Vector3((x1 - 0.5) * h * 0.6, yy1 * h, 0);
          const b = new THREE.Vector3((x2 - 0.5) * h * 0.6, yy2 * h, 0);
          const bx = new THREE.BoxGeometry(h * 0.09, a.distanceTo(b) + h * 0.06, 0.01);
          bx.rotateZ(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
          const mid = a.add(b).multiplyScalar(0.5);
          bx.translate(mid.x, mid.y + y0, rad);
          g.push(bx.toNonIndexed());
        }
      }
      return mergeGeometries(g, false);
    })();
    const mantleBand = buildRuneBand((y) => 0.52 - ((y + 0.21) / 0.42) * 0.32, -0.19, 0.1, 18, 0, 0, 5);
    return {cloak, lining, robe, mantle, hood, hoodTip, hemBand, robeRunes, mantleBand};
  }, []);

  const sway = Math.sin(t * 0.07) * 0.04;
  const billow = Math.sin(t * 0.11) * 0.05;

  const Arm = ({side}: {side: number}) => {
    const up = armsUp;
    return (
      <group position={[0.24 * side, 1.62, 0.02]} rotation={[-0.55 * up - 0.15, 0, side * (0.25 + up * 0.55)]}>
        <mesh material={M.cloak} position={[0, -0.32, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.15, 0.66, 7, 1, true]} />
        </mesh>
        <group position={[0, -0.62, 0]} rotation={[-0.6 * up - 0.3, 0, -side * 0.3 * up]}>
          <mesh material={M.glove} position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.04, 0.035, 0.2, 6]} />
          </mesh>
          <mesh material={M.glove} position={[0, -0.24, 0.0]} scale={[1, 1.2, 0.55]}>
            <icosahedronGeometry args={[0.06, 0]} />
          </mesh>
          <group position={[0, -0.26, 0.12]}>
            {fire > 0.01 && (
              <>
                <Particles kind="fire" t={t + side * 31} count={110} radius={0.12} height={0.75 * fire} size={0.2 * fire} color="#ffffff" color2="#8b2cff" seed={side > 0 ? 3 : 4} />
                <pointLight color="#9b4dff" intensity={fire * (6 + Math.sin(t * 0.9 + side) * 1.5)} distance={5} decay={2} />
              </>
            )}
          </group>
        </group>
      </group>
    );
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group rotation={[0, 0, sway]}>
        {/* inner robe + rune column */}
        <mesh geometry={geo.robe} material={M.robe} position={[0, 0.95, 0]} castShadow />
        <mesh geometry={geo.robeRunes} material={M.rune} position={[0, 0.95, 0]} />
        {/* cloak */}
        <group position={[0, 0.98, 0]} scale={[1 + billow, 1, 1 + billow * 0.5]}>
          <mesh geometry={geo.cloak} material={M.cloak} castShadow />
          <mesh geometry={geo.lining} material={M.lining} />
          <mesh geometry={geo.hemBand} material={M.rune} />
        </group>
        {/* mantle with rune trim */}
        <group position={[0, 1.66, 0]}>
          <mesh geometry={geo.mantle} material={M.hood} castShadow />
          <mesh geometry={geo.mantleBand} material={M.rune} />
        </group>
        <Arm side={-1} />
        <Arm side={1} />
        {/* head + hood */}
        <group position={[0, 2.02, 0.02]} rotation={[headPitch, 0, 0]}>
          <mesh geometry={geo.hood} material={M.hood} position={[0, -0.06, -0.03]} castShadow />
          <mesh geometry={geo.hoodTip} material={M.hood} position={[0, 0.16, -0.32]} rotation={[-1.9, 0, 0]} />
          <mesh material={M.void} position={[0, -0.05, 0.04]} scale={[0.85, 1, 0.7]}>
            <sphereGeometry args={[0.26, 8, 6]} />
          </mesh>
          <FoxMask M={M} />
        </group>
      </group>
      {/* violet aura at the feet */}
      <Particles kind="embers" t={t} count={80} radius={0.9} height={2.6} size={0.05} color="#d9b8ff" color2="#6d28d9" seed={9} />
    </group>
  );
};

/** Silver fox mask: angular plate, snout, ears, glowing violet eye slits. */
const FoxMask: React.FC<{M: Record<string, THREE.Material>}> = ({M}) => (
  <group position={[0, -0.05, 0.17]}>
    <mesh material={M.silver} scale={[1, 0.95, 0.6]}>
      <icosahedronGeometry args={[0.2, 0]} />
    </mesh>
    <mesh material={M.silver} position={[0, -0.07, 0.13]} rotation={[Math.PI / 2 + 0.25, Math.PI / 4, 0]} scale={[1, 1, 0.85]}>
      <coneGeometry args={[0.1, 0.24, 4]} />
    </mesh>
    <mesh material={M.void} position={[0, -0.12, 0.245]}>
      <boxGeometry args={[0.035, 0.025, 0.02]} />
    </mesh>
    {[-1, 1].map((s) => (
      <group key={s}>
        <mesh material={M.silver} position={[0.13 * s, 0.2, -0.02]} rotation={[-0.15, 0, -0.35 * s]}>
          <coneGeometry args={[0.065, 0.22, 3]} />
        </mesh>
        <mesh material={M.eye} position={[0.075 * s, 0.035, 0.115]} rotation={[0, 0.3 * s, 0.38 * s]}>
          <boxGeometry args={[0.085, 0.022, 0.02]} />
        </mesh>
        <mesh material={M.rune} position={[0.11 * s, -0.04, 0.09]} rotation={[0, 0.5 * s, -0.9 * s]}>
          <boxGeometry args={[0.07, 0.008, 0.01]} />
        </mesh>
      </group>
    ))}
    <mesh material={M.rune} position={[0, 0.12, 0.11]}>
      <boxGeometry args={[0.012, 0.08, 0.01]} />
    </mesh>
  </group>
);

/** Silver-blue fox with a violet-flame tail (shape-shift form). Faces +Z. */
export const Fox: React.FC<{position: [number, number, number]; rotationY?: number; t: number; scale?: number}> = ({position, rotationY = 0, t, scale = 1}) => {
  const M = useMemo(
    () => ({
      fur: new THREE.MeshStandardMaterial({color: '#9fb3d6', roughness: 0.45, metalness: 0.4, flatShading: true, emissive: '#1b1440', emissiveIntensity: 0.4}),
      light: new THREE.MeshStandardMaterial({color: '#e6ecf8', roughness: 0.5, metalness: 0.3, flatShading: true}),
      eye: new THREE.MeshStandardMaterial({color: '#f0e0ff', emissive: '#b26bff', emissiveIntensity: 6}),
    }),
    []
  );
  const ph = t * 0.6;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {[[-0.1, 0.25], [0.1, 0.25], [-0.1, -0.25], [0.1, -0.25]].map(([x, z], i) => (
        <mesh key={i} material={M.fur} position={[x, 0.17, z]} rotation={[Math.sin(ph + (i % 3) * 2) * 0.3, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.028, 0.34, 5]} />
        </mesh>
      ))}
      <mesh material={M.fur} position={[0, 0.42, 0]} scale={[0.75, 0.7, 1.5]} castShadow>
        <icosahedronGeometry args={[0.22, 0]} />
      </mesh>
      <mesh material={M.light} position={[0, 0.36, 0.22]} scale={[0.6, 0.6, 0.6]}>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>
      <group position={[0, 0.6, 0.36]}>
        <mesh material={M.fur} scale={[1, 0.85, 1]} castShadow>
          <icosahedronGeometry args={[0.15, 0]} />
        </mesh>
        <mesh material={M.light} position={[0, -0.04, 0.15]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
          <coneGeometry args={[0.07, 0.2, 4]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh material={M.fur} position={[0.08 * s, 0.14, -0.02]} rotation={[0, 0, -0.25 * s]}>
              <coneGeometry args={[0.05, 0.16, 3]} />
            </mesh>
            <mesh material={M.eye} position={[0.06 * s, 0.03, 0.12]} rotation={[0, 0.3 * s, 0.3 * s]}>
              <boxGeometry args={[0.05, 0.016, 0.01]} />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[0, 0.5, -0.32]} rotation={[-0.9 + Math.sin(t * 0.4) * 0.15, Math.sin(t * 0.5) * 0.4, 0]}>
        <mesh material={M.fur} position={[0, 0.0, -0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.12, 0.5, 6]} />
        </mesh>
        <Particles kind="fire" t={t} count={60} radius={0.1} height={0.45} size={0.12} color="#ffffff" color2="#8b2cff" seed={12} center={[0, 0.0, -0.48]} />
      </group>
      <pointLight color="#9b4dff" intensity={4} distance={4} position={[0, 0.7, -0.6]} />
    </group>
  );
};

const WING_GEO = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.12);
  shape.lineTo(0.75, 0.05);
  shape.lineTo(0.62, -0.06);
  shape.lineTo(0.48, -0.03);
  shape.lineTo(0.36, -0.12);
  shape.lineTo(0, -0.14);
  return new THREE.ShapeGeometry(shape);
})();

/** Crow with violet eyes (shape-shift form). Faces +Z. */
export const Crow: React.FC<{position: [number, number, number]; rotationY?: number; t: number; scale?: number}> = ({position, rotationY = 0, t, scale = 1}) => {
  const M = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({color: '#141420', roughness: 0.35, metalness: 0.3, flatShading: true, emissive: '#120a2a', emissiveIntensity: 0.6}),
      beak: new THREE.MeshStandardMaterial({color: '#3a3b44', roughness: 0.4, metalness: 0.5, flatShading: true}),
      eye: new THREE.MeshStandardMaterial({color: '#f0e0ff', emissive: '#b26bff', emissiveIntensity: 7}),
    }),
    []
  );
  const flap = Math.sin(t * 0.85) * 0.9;
  const wingMat = useMemo(() => new THREE.MeshStandardMaterial({color: '#141420', side: THREE.DoubleSide, flatShading: true, roughness: 0.4, metalness: 0.3}), []);
  const wing = (s: number) => (
    <group position={[0.06 * s, 0.05, 0]} rotation={[Math.PI / 2, 0, s > 0 ? flap : Math.PI - flap]}>
      <mesh geometry={WING_GEO} material={wingMat} castShadow />
    </group>
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh material={M.body} scale={[0.75, 0.75, 1.5]} castShadow>
        <icosahedronGeometry args={[0.16, 0]} />
      </mesh>
      <mesh material={M.body} position={[0, 0.1, 0.22]} castShadow>
        <icosahedronGeometry args={[0.11, 0]} />
      </mesh>
      <mesh material={M.beak} position={[0, 0.08, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.035, 0.14, 4]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.eye} position={[0.06 * s, 0.13, 0.29]}>
          <boxGeometry args={[0.025, 0.018, 0.01]} />
        </mesh>
      ))}
      <mesh material={M.body} position={[0, -0.02, -0.3]} rotation={[-Math.PI / 2 - 0.2, 0, 0]}>
        <coneGeometry args={[0.1, 0.25, 3]} />
      </mesh>
      {wing(1)}
      {wing(-1)}
    </group>
  );
};

/** Close-up gloved hand that snaps. snap: 0 = ready, 1 = snapped. */
export const SnapHand: React.FC<{snap: number; position: [number, number, number]; rotation?: [number, number, number]}> = ({snap, position, rotation = [0, 0, 0]}) => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({color: '#23263a', roughness: 0.45, metalness: 0.35, flatShading: true}), []);
  const trim = useMemo(() => new THREE.MeshStandardMaterial({color: '#e8eeff', emissive: '#cfd8ff', emissiveIntensity: 1.4}), []);
  const s = Math.min(1, Math.max(0, snap));
  const finger = (x: number, len: number, curl: number) => (
    <group position={[x, 0.24, 0]} rotation={[curl, 0, 0]}>
      <mesh material={m} position={[0, len * 0.25, 0]}>
        <boxGeometry args={[0.055, len * 0.5, 0.055]} />
      </mesh>
      <group position={[0, len * 0.5, 0]} rotation={[curl * 0.9, 0, 0]}>
        <mesh material={m} position={[0, len * 0.22, 0]}>
          <boxGeometry args={[0.05, len * 0.45, 0.05]} />
        </mesh>
      </group>
    </group>
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh material={m} position={[0, 0.1, 0]}>
        <boxGeometry args={[0.26, 0.28, 0.09]} />
      </mesh>
      <mesh material={trim} position={[0, -0.06, 0.05]}>
        <boxGeometry args={[0.27, 0.025, 0.01]} />
      </mesh>
      <mesh material={m} position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.3, 7]} />
      </mesh>
      {/* index, middle (snapping), ring, pinky */}
      {finger(-0.09, 0.26, 1.4)}
      {finger(-0.03, 0.29, -0.2 + s * 1.9)}
      {finger(0.035, 0.27, 1.5)}
      {finger(0.095, 0.22, 1.5)}
      {/* thumb */}
      <group position={[-0.14, 0.05, 0.03]} rotation={[0.3, 0, 0.9 - s * 0.5]}>
        <mesh material={m} position={[0, 0.1, 0]}>
          <boxGeometry args={[0.06, 0.2, 0.06]} />
        </mesh>
      </group>
    </group>
  );
};
