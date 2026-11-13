import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mulberry} from '../lib/math';
import {particleMaterial} from './materials';

/**
 * Deterministic particle systems. Every particle position is a pure function of `t` (frame).
 * kinds: dust (floating motes), leaves (swirl around a centre), embers (rise), fire (hand flames), burst (smoke puff)
 */
type Kind = 'dust' | 'leaves' | 'embers' | 'fire' | 'burst' | 'sparks';
type Props = {
  kind: Kind;
  t: number;
  count?: number;
  center?: [number, number, number];
  radius?: number;
  height?: number;
  color?: string;
  color2?: string;
  size?: number;
  opacity?: number;
  speed?: number;
  seed?: number;
  start?: number; // burst start frame
};

export const Particles: React.FC<Props> = ({kind, t, count = 200, center = [0, 0, 0], radius = 6, height = 6, color = '#ffe0a0', color2, size = 1, opacity = 1, speed = 1, seed = 1, start = 0}) => {
  const base = useMemo(() => {
    const r = mulberry(seed * 977 + count);
    const arr: number[][] = [];
    for (let i = 0; i < count; i++) arr.push([r(), r(), r(), r(), r(), r()]);
    return arr;
  }, [count, seed]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(count), 1));
    return g;
  }, [count]);
  const mat = useMemo(() => particleMaterial(), []);
  const c1 = useMemo(() => new THREE.Color(), []);
  const c2 = useMemo(() => new THREE.Color(), []);
  c1.set(color);
  c2.set(color2 ?? color);
  const pos = geo.attributes.position.array as Float32Array;
  const col = geo.attributes.color.array as Float32Array;
  const sz = geo.attributes.size.array as Float32Array;
  const al = geo.attributes.alpha.array as Float32Array;
  const tmp = new THREE.Color();
  const tt = t * speed;
  for (let i = 0; i < count; i++) {
    const [a, b, c, d, e, f] = base[i];
    let x = 0,
      y = 0,
      z = 0,
      s = size,
      al0 = 1,
      mix = d;
    if (kind === 'dust') {
      x = (a - 0.5) * radius * 2 + Math.sin(tt * 0.02 + d * 6) * 0.4;
      y = b * height + Math.sin(tt * 0.015 + e * 6) * 0.3;
      z = (c - 0.5) * radius * 2 + Math.cos(tt * 0.018 + f * 6) * 0.4;
      s = size * (0.3 + e * 0.7);
      al0 = 0.35 + 0.65 * Math.abs(Math.sin(tt * 0.05 + f * 10));
    } else if (kind === 'leaves') {
      const ang = a * Math.PI * 2 + tt * (0.09 + b * 0.06);
      const rr = radius * (0.35 + c * 0.65);
      x = Math.cos(ang) * rr;
      z = Math.sin(ang) * rr;
      y = ((d * height + tt * 0.03 * (0.5 + e)) % height) + 0.2;
      s = size * (0.5 + f * 0.6);
      al0 = 0.9;
    } else if (kind === 'embers' || kind === 'sparks') {
      const life = 60 + d * 60;
      const ph = ((tt + a * life) % life) / life;
      x = (b - 0.5) * radius * 2 + Math.sin(ph * 6 + c * 9) * 0.3;
      z = (e - 0.5) * radius * 2 + Math.cos(ph * 5 + a * 9) * 0.3;
      y = ph * height;
      s = size * (0.4 + f * 0.8) * (1 - ph * 0.5);
      al0 = Math.sin(ph * Math.PI);
      mix = ph;
    } else if (kind === 'fire') {
      const life = 16 + d * 14;
      const ph = ((tt + a * life) % life) / life;
      const spread = radius * (1 - ph * 0.7);
      const ang = b * Math.PI * 2 + tt * 0.1;
      x = Math.cos(ang) * spread * c + Math.sin(tt * 0.4 + e * 9) * 0.03;
      z = Math.sin(ang) * spread * c;
      y = ph * height;
      s = size * (1.1 - ph) * (0.6 + f * 0.6);
      al0 = Math.sin(Math.min(1, ph * 1.4) * Math.PI) * 0.9;
      mix = ph;
    } else if (kind === 'burst') {
      const p = Math.max(0, tt - start) / 22;
      const k = 1 - Math.pow(1 - Math.min(1, p), 3);
      const th = a * Math.PI * 2;
      const ph2 = Math.acos(b * 2 - 1);
      const dist = radius * (0.4 + c * 0.6) * k;
      x = Math.sin(ph2) * Math.cos(th) * dist;
      y = Math.cos(ph2) * dist * 0.8 + height * k * d;
      z = Math.sin(ph2) * Math.sin(th) * dist;
      s = size * (0.6 + e) * (0.5 + k);
      al0 = p >= 1 ? 0 : (1 - p) * (p > 0 ? 1 : 0);
      mix = c;
    }
    pos[i * 3] = center[0] + x;
    pos[i * 3 + 1] = center[1] + y;
    pos[i * 3 + 2] = center[2] + z;
    tmp.copy(c1).lerp(c2, Math.min(1, Math.max(0, mix)));
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
    sz[i] = s;
    al[i] = al0;
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  geo.attributes.size.needsUpdate = true;
  geo.attributes.alpha.needsUpdate = true;
  mat.uniforms.uOpacity.value = opacity;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};

/** Low-poly leaves (actual little meshes) swirling around a point: the "wind only on him". */
export const Leaves: React.FC<{t: number; center: [number, number, number]; count?: number; radius?: number}> = ({t, center, count = 26, radius = 1.3}) => {
  const base = useMemo(() => {
    const r = mulberry(55);
    return Array.from({length: count}, () => [r(), r(), r(), r(), r()]);
  }, [count]);
  const mats = useMemo(
    () => ['#7cb84f', '#e0a83a', '#c9622f', '#a3c45a'].map((c) => new THREE.MeshStandardMaterial({color: c, flatShading: true, side: THREE.DoubleSide, roughness: 0.7})),
    []
  );
  const geo = useMemo(() => new THREE.ConeGeometry(0.06, 0.16, 3).rotateX(Math.PI / 2).scale(1, 0.25, 1), []);
  return (
    <group position={center}>
      {base.map(([a, b, c, d, e], i) => {
        const ang = a * Math.PI * 2 + t * (0.12 + b * 0.07);
        const rr = radius * (0.45 + c * 0.55);
        const y = ((d * 2.4 + t * 0.025 * (0.6 + e)) % 2.4) + 0.1;
        return (
          <mesh key={i} geometry={geo} material={mats[i % 4]} position={[Math.cos(ang) * rr, y, Math.sin(ang) * rr]} rotation={[t * 0.2 + a * 6, t * 0.15 + b * 6, c * 6]} castShadow />
        );
      })}
    </group>
  );
};
