import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mulberry, clamp} from '../lib/math';
import {beamMaterial, makeRimMaterial} from './materials';
import {makeGlowTexture} from './textures';
import {Person, LOOKS} from './Person';
import {makeNewsWallTexture} from './textures';

/** Glowing violet ground cracks radiating from a centre. grow: 0..1 */
export const GroundCracks: React.FC<{center: [number, number, number]; grow: number; color?: string; seed?: number; radius?: number}> = ({
  center,
  grow,
  color = '#b26bff',
  seed = 3,
  radius = 7,
}) => {
  const segs = useMemo(() => {
    const r = mulberry(seed);
    const out: {x: number; z: number; len: number; ang: number; d0: number; w: number}[] = [];
    const branch = (x: number, z: number, ang: number, d: number, depth: number, w: number) => {
      let cx = x,
        cz = z,
        cd = d;
      const n = 6 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const len = 0.35 + r() * 0.55;
        ang += (r() - 0.5) * 0.9;
        out.push({x: cx, z: cz, len, ang, d0: cd, w});
        cx += Math.cos(ang) * len;
        cz += Math.sin(ang) * len;
        cd += len;
        if (cd > radius) break;
        if (depth < 2 && r() < 0.28) branch(cx, cz, ang + (r() > 0.5 ? 0.8 : -0.8), cd, depth + 1, w * 0.6);
      }
    };
    for (let i = 0; i < 9; i++) branch(0, 0, (i / 9) * Math.PI * 2 + r() * 0.4, 0, 0, 0.09);
    return out;
  }, [seed, radius]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({color, toneMapped: false}), [color]);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({color: '#141018', roughness: 1, flatShading: true}), []);
  const g = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const reach = grow * radius;
  const glowTex = useMemo(() => makeGlowTexture(), []);
  return (
    <group position={center}>
      {segs.map((s, i) => {
        if (s.d0 > reach) return null;
        const vis = clamp((reach - s.d0) / s.len);
        const L = s.len * vis;
        const mx = s.x + Math.cos(s.ang) * L * 0.5;
        const mz = s.z + Math.sin(s.ang) * L * 0.5;
        return (
          <group key={i} position={[mx, 0.03, mz]} rotation={[0, -s.ang, 0]}>
            <mesh geometry={g} material={dark} scale={[L, 0.04, s.w * 2.4]} />
            <mesh geometry={g} material={mat} scale={[L, 0.05, s.w * 0.9]} position={[0, 0.01, 0]} />
          </group>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <planeGeometry args={[radius * 1.6 * grow + 0.01, radius * 1.6 * grow + 0.01]} />
        <meshBasicMaterial map={glowTex} color={color} transparent opacity={0.55 * grow} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

/** Floating ground debris chunks that lift with `lift`. */
export const Debris: React.FC<{center: [number, number, number]; lift: number; t: number; count?: number; radius?: number}> = ({center, lift, t, count = 18, radius = 4}) => {
  const items = useMemo(() => {
    const r = mulberry(77);
    return Array.from({length: count}, () => ({a: r() * Math.PI * 2, d: 1 + r() * radius, s: 0.15 + r() * 0.4, h: 0.3 + r() * 1.6, sp: r()}));
  }, [count, radius]);
  const m = useMemo(() => new THREE.MeshStandardMaterial({color: '#4a4650', flatShading: true, roughness: 0.95}), []);
  return (
    <group position={center}>
      {items.map((it, i) => (
        <mesh
          key={i}
          material={m}
          position={[Math.cos(it.a) * it.d, 0.1 + lift * it.h + Math.sin(t * 0.08 + i) * 0.08 * lift, Math.sin(it.a) * it.d]}
          rotation={[t * 0.02 * it.sp * lift + i, t * 0.03 * lift + i * 2, i]}
          castShadow
        >
          <dodecahedronGeometry args={[it.s, 0]} />
        </mesh>
      ))}
    </group>
  );
};

/** Golden aura beam: tall additive cylinder. */
export const Beam: React.FC<{position: [number, number, number]; height: number; radius: number; color?: string; intensity?: number; t: number; quaternion?: THREE.Quaternion}> = ({
  position,
  height,
  radius,
  color = '#ffd27a',
  intensity = 1,
  t,
  quaternion,
}) => {
  const m1 = useMemo(() => beamMaterial(color), [color]);
  const m2 = useMemo(() => beamMaterial('#ffffff'), []);
  m1.uniforms.uIntensity.value = intensity * 1.6;
  m1.uniforms.uTime.value = t;
  m2.uniforms.uIntensity.value = intensity * 2.2;
  m2.uniforms.uTime.value = t;
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0), []);
  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={geo} material={m1} scale={[radius * 2.6, height, radius * 2.6]} />
      <mesh geometry={geo} material={m2} scale={[radius * 0.7, height, radius * 0.7]} />
    </group>
  );
};

/** Glow sprite (camera-facing). */
export const Glow: React.FC<{position: [number, number, number]; size: number; color: string; opacity?: number}> = ({position, size, color, opacity = 1}) => {
  const tex = useMemo(() => makeGlowTexture(), []);
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={tex} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
};

/** News studio set with an anchor at the desk. */
export const NewsStudio: React.FC<{t: number}> = ({t}) => {
  const wall = useMemo(() => makeNewsWallTexture(), []);
  const m = useMemo(
    () => ({
      desk: new THREE.MeshStandardMaterial({color: '#e8eef8', roughness: 0.25, metalness: 0.2, flatShading: true}),
      deskTrim: new THREE.MeshStandardMaterial({color: '#1f5fd1', emissive: '#2a6bff', emissiveIntensity: 1.6}),
      floor: new THREE.MeshStandardMaterial({color: '#101a33', roughness: 0.15, metalness: 0.6}),
      back: new THREE.MeshStandardMaterial({color: '#13306b', roughness: 0.5, emissive: '#0d2a6a', emissiveIntensity: 0.6, flatShading: true}),
      panel: new THREE.MeshStandardMaterial({color: '#2b63c9', emissive: '#3a7bff', emissiveIntensity: 1.2}),
      screen: new THREE.MeshBasicMaterial({map: wall, toneMapped: false}),
      frame: new THREE.MeshStandardMaterial({color: '#0b0f1a', roughness: 0.4}),
    }),
    [wall]
  );
  return (
    <group>
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
      </mesh>
      <mesh material={m.back} position={[0, 4, -5]}>
        <boxGeometry args={[20, 8, 0.3]} />
      </mesh>
      {[-6, -4.6, 4.6, 6].map((x) => (
        <mesh key={x} material={m.panel} position={[x, 3.4, -4.8]}>
          <boxGeometry args={[0.18, 6, 0.1]} />
        </mesh>
      ))}
      <mesh material={m.frame} position={[0, 2.9, -4.75]}>
        <boxGeometry args={[6.6, 4.2, 0.1]} />
      </mesh>
      <mesh material={m.screen} position={[0, 2.9, -4.68]}>
        <planeGeometry args={[6.3, 3.95]} />
      </mesh>
      {/* desk */}
      <mesh material={m.desk} position={[0, 0.55, 0.55]} castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.0, 1.1, 10, 1, false, -0.9, 1.8]} />
      </mesh>
      <mesh material={m.desk} position={[0, 1.12, 0.35]}>
        <boxGeometry args={[3.2, 0.06, 1.2]} />
      </mesh>
      <mesh material={m.deskTrim} position={[0, 0.9, 1.62]}>
        <boxGeometry args={[2.6, 0.06, 0.04]} />
      </mesh>
      <Person
        look={LOOKS.anchor}
        position={[0, 0.0, -0.45]}
        pose={{
          headYaw: Math.sin(t * 0.05) * 0.08,
          headPitch: -0.05,
          brow: 0.6,
          smile: 0.2,
          yawn: Math.max(0, Math.sin(t * 0.55)) * 0.35,
          armL: [-0.9, -0.15, -0.6],
          armR: [-0.9, 0.15, -0.6],
          legL: [-1.4, 1.4],
          legR: [-1.4, 1.4],
        }}
        rim="#7fb2ff"
        rimStrength={1.1}
      />
      <pointLight position={[0, 3, 3]} intensity={30} distance={14} color="#dfe9ff" />
      <pointLight position={[-4, 3, -3]} intensity={25} distance={12} color="#3a7bff" />
      <pointLight position={[4, 3, -3]} intensity={25} distance={12} color="#ff5b8a" />
    </group>
  );
};

/** Night-side planet with city lights, atmosphere and a golden beam rising from "the town". */
export const Planet: React.FC<{t: number; beamGrow: number}> = ({t, beamGrow}) => {
  const R = 60;
  const {geo, lights} = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(R, 5).toNonIndexed();
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const r = mulberry(4);
    const land = (x: number, y: number, z: number) =>
      Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07) + Math.sin(y * 0.11 + z * 0.05) * 0.8 + Math.sin(x * 0.21 - y * 0.13) * 0.35;
    const lp: number[] = [];
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const isLand = land(cx, cy, cz) > 0.25;
      c.set(isLand ? (r() > 0.5 ? '#1e3320' : '#2a3a24') : '#0a1a3a');
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
      if (isLand && r() > 0.55) lp.push(cx * 1.002, cy * 1.002, cz * 1.002);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    return {geo: g, lights: lg};
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.8}), []);
  const atmo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.35,0.6,1.0)*f*1.8, f); }`,
      }),
    []
  );
  const lightMat = useMemo(() => new THREE.PointsMaterial({color: '#ffcf7a', size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false}), []);
  // beam origin on the surface facing the camera
  const dir = useMemo(() => new THREE.Vector3(0.18, 1, 0.32).normalize(), []);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir]);
  const base = dir.clone().multiplyScalar(R);
  return (
    <group position={[0, -R, 0]} rotation={[0, t * 0.0015, 0]}>
      <mesh geometry={geo} material={mat} />
      <points geometry={lights} material={lightMat} />
      <mesh material={atmo} scale={1.06}>
        <sphereGeometry args={[R, 48, 32]} />
      </mesh>
      <Beam position={[base.x, base.y, base.z]} quaternion={q} height={120 * beamGrow} radius={0.9} t={t} intensity={1.2} />
      <Glow position={[base.x, base.y + 0.5, base.z]} size={14 * (0.5 + beamGrow)} color="#ffd27a" opacity={0.9} />
    </group>
  );
};

export const silhouetteMaterial = () => new THREE.MeshBasicMaterial({color: '#05030c', transparent: true, opacity: 0.88, depthWrite: false, fog: false});
export const _unused = makeRimMaterial;
