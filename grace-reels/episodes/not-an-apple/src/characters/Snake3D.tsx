import {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {faceted, flatMat, taperTube} from '../three/lowpoly';
import {clamp} from '../lib/anim';

const GREEN = new THREE.Color('#2F7A3A');
const GREEN_D = new THREE.Color('#215C2B');
const GOLD = new THREE.Color('#E2B43C');
const BELLY = new THREE.Color('#EBCB78');
const MAT = flatMat({roughness: 0.45, metalness: 0.05});
const EYE = new THREE.MeshStandardMaterial({color: '#F2C531', emissive: '#7A5A00', emissiveIntensity: 0.35, roughness: 0.3});
const PUPIL = new THREE.MeshBasicMaterial({color: '#0B0B08'});
const TONGUE = new THREE.MeshStandardMaterial({color: '#C2334A', roughness: 0.5});
const MOUTH = new THREE.MeshStandardMaterial({color: '#4A1420', roughness: 0.7});

const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

const headGeo = (() => {
  const g = new THREE.OctahedronGeometry(1, 1);
  g.scale(0.062, 0.04, 0.11);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z > 0) p.setX(i, p.getX(i) * (1 - z * 3.2)); // pointed snout
    if (z < 0) p.setY(i, p.getY(i) * 1.1);
  }
  return faceted(g, {seed: 4, jitter: 0.002, colorAt: (c) => (c.y > -0.008 ? (c.x > 0 ? GREEN : GREEN_D) : BELLY)});
})();
const jawGeo = (() => {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(0.05, 0.016, 0.09);
  return faceted(g, {seed: 5, colorAt: () => BELLY});
})();
const browGeo = new THREE.BoxGeometry(0.03, 0.008, 0.012);
const eyeGeo = new THREE.SphereGeometry(0.0125, 8, 6);
const slitGeo = new THREE.BoxGeometry(0.003, 0.016, 0.004);
const forkGeo = (() => {
  const g = new THREE.ConeGeometry(0.004, 0.045, 3);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, 0.022);
  return g;
})();

export type SnakeProps = {
  track: THREE.CatmullRomCurve3;
  head: number; // 0..1 arc position of the head on the track
  length: number; // body length as a fraction of the track
  t: number;
  waveFrom?: number; // track position from which the body waves (0 = everywhere)
  wave?: number;
  open?: number; // jaw 0..1
  tongue?: number; // 0..1
  tilt?: number; // head roll
  look?: [number, number]; // extra head yaw/pitch
};

export const Snake3D: React.FC<SnakeProps> = ({track, head, length, t, waveFrom = 0, wave = 0.05, open = 0, tongue = 0, tilt = 0, look = [0, 0]}) => {
  const N = 110;
  const {geo, headPos, headQuat} = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1); // 0 tail .. 1 head
      const s = clamp(head - length * (1 - u), 0, 1);
      const p = track.getPointAt(s);
      const tan = track.getTangentAt(s);
      const side = tan.clone().cross(up).normalize();
      const w = smooth(waveFrom, waveFrom + 0.05, s) * wave * Math.min(1, u * 2.5);
      p.addScaledVector(side, Math.sin((u * 3.2 - t * 0.9) * Math.PI * 2) * w);
      pts.push(p);
    }
    const radius = (u: number) => 0.012 + 0.044 * smooth(0, 0.4, u) * (1 - 0.22 * smooth(0.9, 1, u));
    const g = taperTube(pts, radius, 7, (u, a) => {
      if (a > 0.36 && a < 0.64) return BELLY; // underside
      const band = Math.floor(u * 34 + a * 3) + Math.floor(u * 34 - a * 3);
      return band % 2 === 0 ? GREEN : GOLD;
    }, false);
    const end = pts[N - 1];
    const dir = end.clone().sub(pts[N - 4]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    return {geo: g, headPos: end, headQuat: q};
  }, [track, head, length, t, waveFrom, wave]);
  useEffect(() => () => geo.dispose(), [geo]);

  const euler = new THREE.Euler().setFromQuaternion(headQuat);
  const flick = tongue > 0 ? Math.max(0, Math.sin(t * 22)) * tongue : 0;
  return (
    <group>
      <mesh geometry={geo} material={MAT} castShadow />
      <group position={headPos} rotation={euler}>
        <group rotation={[look[1], look[0], tilt]}>
          <mesh geometry={headGeo} material={MAT} position={[0, 0.004, 0.05]} castShadow />
          <group position={[0, -0.014, 0.0]} rotation={[open * 0.45, 0, 0]}>
            <mesh geometry={jawGeo} material={MAT} position={[0, -0.006, 0.05]} />
            {open > 0.05 && <mesh geometry={jawGeo} material={MOUTH} position={[0, 0.002, 0.05]} scale={[0.8, 0.5, 0.85]} />}
          </group>
          {[1, -1].map((side) => (
            <group key={side} position={[side * 0.034, 0.018, 0.04]}>
              <mesh geometry={eyeGeo} material={EYE} scale={[1, 0.62, 1]} />
              <mesh geometry={slitGeo} material={PUPIL} position={[side * 0.006, 0, 0.004]} />
              {/* narrow, clever brow ridge */}
              <mesh geometry={browGeo} material={MAT} position={[side * -0.002, 0.012, 0.004]} rotation={[0.2, 0, side * 0.35]} />
            </group>
          ))}
          {(tongue > 0 || open > 0.1) && (
            <group position={[0, -0.01, 0.15]} scale={[1, 1, 0.3 + flick * 0.9]}>
              <mesh geometry={forkGeo} material={TONGUE} rotation={[0, 0.25, 0]} />
              <mesh geometry={forkGeo} material={TONGUE} rotation={[0, -0.25, 0]} />
            </group>
          )}
        </group>
      </group>
    </group>
  );
};
