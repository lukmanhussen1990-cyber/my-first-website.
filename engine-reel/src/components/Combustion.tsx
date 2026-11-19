/**
 * Spark arc, flame kernel, layered fireball and the quick combustion flashes
 * that strobe in the chamber while the engine is spinning fast in the reveal.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { CRANK, EVENTS, FPS } from '../timeline';
import { ENGINE as E, crankRad, crownY, cycleDeg } from '../lib/kinematics';
import { EASE, clamp, hash, smoothstep } from '../lib/math';
import { glowTexture } from '../lib/textures';
import { PLUG_TIP } from './Engine';

function lumpyBall(seed: number, detail = 3) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n =
      0.16 * Math.sin(5.1 * v.x + seed) * Math.sin(4.3 * v.y + seed * 1.7) * Math.sin(6.2 * v.z + seed * 0.6) +
      0.09 * Math.sin(9.0 * v.x + 3.0 * v.y + seed * 2.3) +
      0.06 * Math.sin(11.0 * v.z - 7.0 * v.y + seed);
    v.multiplyScalar(1 + n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const basic = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false, depthWrite: opacity >= 1 });

/** Jagged electric arc from the centre electrode to the ground strap (+ a few tendrils). */
function sparkLines(frame: number) {
  const a = PLUG_TIP.center;
  const b = PLUG_TIP.ground;
  const jag = (from: THREE.Vector3, to: THREE.Vector3, segs: number, amp: number, salt: number) => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const off = i === 0 || i === segs ? 0 : (hash(frame * 13.1 + i * 7.7 + salt) - 0.5) * 2 * amp;
      pts.push([from.x + (to.x - from.x) * u + off, from.y + (to.y - from.y) * u + off * 0.4, from.z + (to.z - from.z) * u + 0.03]);
    }
    return pts;
  };
  const main = jag(a, b, 6, 0.018, 1);
  const tendrils = [0, 1, 2, 3].map((k) => {
    const ang = hash(frame * 3.3 + k * 1.9) * Math.PI * 2;
    const len = 0.07 + hash(frame * 5.1 + k) * 0.09;
    const mid = a.clone().lerp(b, 0.5);
    const end = mid.clone().add(new THREE.Vector3(Math.cos(ang) * len, Math.sin(ang) * len * 0.6 - 0.02, 0.02));
    return jag(mid, end, 4, 0.02, 10 + k);
  });
  return { main, tendrils };
}

export const Combustion: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const g = useMemo(() => ({ outer: lumpyBall(1.3), mid: lumpyBall(4.1), core: lumpyBall(7.7, 2) }), []);
  const m = useMemo(
    () => ({
      outer: basic('#ff4a1c', 0.82),
      mid: basic('#ff9a1f'),
      core: basic('#fff0a0'),
      kernel: basic('#fff6c8'),
    }),
    [],
  );
  const glow = glowTexture();

  const theta = crankRad(t);
  const crown = crownY(theta);
  const gap = E.roofY - crown;
  const mid = crown + gap / 2;

  // ── spark ──
  const sparkFrame0 = Math.round(EVENTS.sparkFire * FPS);
  const sparkOn = frame >= sparkFrame0 && frame < sparkFrame0 + EVENTS.sparkFrames;
  const spark = sparkOn ? sparkLines(frame) : null;

  // ── flame kernel between spark and bang ──
  const kernelOn = t >= EVENTS.sparkFire && t < EVENTS.bang + 0.1;
  const kernelR = kernelOn ? 0.02 + 0.07 * smoothstep(EVENTS.sparkFire, EVENTS.bang, t) * (0.85 + 0.15 * Math.sin(t * 47)) : 0;

  // ── main fireball ──
  const tb = t - EVENTS.bang;
  let fire = 0; // expansion 0..~1.15
  let fade = 0; // 0 visible → 1 gone
  if (tb >= 0) {
    fire = EASE.outBack(clamp(tb / 0.22));
    fade = smoothstep(EVENTS.smokeForm - EVENTS.bang - 0.1, EVENTS.smokeForm - EVENTS.bang + 0.75, tb);
  }
  // ── quick flashes each power stroke while the engine spins in the reveal ──
  let mini = 0;
  if (t > EVENTS.lightSnap && t < CRANK.stopAt) {
    const c = cycleDeg(t);
    if (c > 358 && c < 450) mini = Math.sin((Math.PI * (c - 358)) / 92);
  }
  const showFire = (fire > 0 && fade < 1) || mini > 0.02;
  const amount = fire > 0 && fade < 1 ? fire * (1 - fade) : mini;
  const bulge = fire > 0 ? 1 + 0.6 * Math.max(0, fire - 1) * 6 : 1;
  const flick = 1 + 0.05 * Math.sin(t * 53) + 0.04 * Math.sin(t * 31 + 1);
  const sx = (E.boreR - 0.05) * amount * flick;
  const sy = Math.max(0.02, (gap / 2) * 0.95) * Math.min(1, amount * 1.1);
  const sz = 0.38 * amount * bulge;
  const cool = fade; // shift colours toward deep red as it dies
  m.core.color.set('#fff3b0').lerp(new THREE.Color('#ff7a1a'), cool);
  m.mid.color.set('#ffa424').lerp(new THREE.Color('#d8321a'), cool);
  m.outer.color.set('#ff4a1c').lerp(new THREE.Color('#7a2418'), cool);
  m.outer.opacity = 0.82 * (1 - fade * 0.6);

  // ── lights ──
  const bangLight = tb >= 0 ? 70 * Math.exp(-2.6 * tb) * (1 - fade) : 0;
  const kernelLight = kernelOn ? 0.5 + 1.2 * smoothstep(EVENTS.sparkFire, EVENTS.bang, t) : 0;
  const sparkLight = sparkOn ? 0.5 : 0;
  const glowSize = tb >= 0 ? 3.2 * Math.exp(-2.2 * tb) * (1 - fade) + 0.6 * (1 - fade) : 0;

  return (
    <group>
      {spark && (
        <group>
          <Line points={spark.main} color="#9ff8ff" lineWidth={5} toneMapped={false} />
          <Line points={spark.main} color="#38d6ff" lineWidth={16} transparent opacity={0.35} toneMapped={false} />
          {spark.tendrils.map((pts, i) => (
            <Line key={i} points={pts} color="#b5fbff" lineWidth={2.5} toneMapped={false} />
          ))}
          <sprite position={PLUG_TIP.ground.toArray()} scale={[0.16, 0.16, 1]}>
            <spriteMaterial map={glow} color="#5fe6ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      )}
      <pointLight position={[0, E.roofY - 0.1, 0.7]} color="#7fe9ff" intensity={sparkLight} distance={0} decay={2} />

      {kernelOn && (
        <group position={[0, E.roofY - 0.12, 0]}>
          <mesh geometry={g.core} material={m.kernel} scale={kernelR} />
          <sprite scale={[kernelR * 5, kernelR * 5, 1]}>
            <spriteMaterial map={glow} color="#ffb347" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} opacity={0.8} />
          </sprite>
        </group>
      )}
      <pointLight position={[0, E.roofY - 0.15, 0.7]} color="#ffaa4a" intensity={kernelLight} distance={0} decay={2} />

      {showFire && (
        <group position={[0, mid, -0.1]}>
          <mesh geometry={g.outer} material={m.outer} scale={[sx, sy, sz]} rotation={[0, t * 1.4, t * 0.7]} />
          <mesh geometry={g.mid} material={m.mid} scale={[sx * 0.8, sy * 0.8, sz * 0.8]} rotation={[t * 1.1, 0, -t * 0.9]} />
          <mesh geometry={g.core} material={m.core} scale={[sx * 0.55, sy * 0.6, sz * 0.55]} rotation={[0, -t * 2.0, 0]} />
        </group>
      )}
      {glowSize > 0.01 && (
        <sprite position={[0, mid, 0.35]} scale={[glowSize, glowSize, 1]}>
          <spriteMaterial map={glow} color="#ff9b3d" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} opacity={0.85} />
        </sprite>
      )}
      <pointLight position={[0, mid, 0.5]} color="#ff8f3a" intensity={bangLight + mini * 10} distance={0} decay={2} />
    </group>
  );
};
