import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useRimMats} from './materials';
import {makeBusTexture} from './textures';

/** Original scruffy street dog (tan stray). Faces +Z. */
export const Dog: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  phase: number;
  trot?: number;
  sunglasses?: boolean;
  headYaw?: number;
  rim?: string;
  rimStrength?: number;
  t?: number;
}> = ({position, rotationY = 0, phase, trot = 1, sunglasses, headYaw = 0, rim = '#ffd9a0', rimStrength = 0.8, t = 0}) => {
  const M = useRimMats(
    {
      fur: {color: '#c8955a', roughness: 0.85},
      belly: {color: '#ecd2a6', roughness: 0.85},
      dark: {color: '#8a5a32', roughness: 0.85},
      nose: {color: '#1a1412', roughness: 0.3, rimStrength: 0},
      eye: {color: '#140d0a', roughness: 0.2, rimStrength: 0},
      lens: {color: '#050608', roughness: 0.05, metalness: 0.7, rimStrength: 0.5},
      glint: {color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2, rimStrength: 0},
    },
    rim,
    rimStrength
  );
  const s = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase)) * 0.025 * trot;
  const leg = (x: number, z: number, ph: number, front: boolean) => (
    <group position={[x, 0.27, z]} rotation={[Math.sin(ph) * 0.5 * trot, 0, 0]}>
      <mesh material={M.fur} position={[0, -0.03, 0]} scale={[1.1, 1.25, 1.2]}>
        <icosahedronGeometry args={[0.06, 1]} />
      </mesh>
      <mesh material={M.fur} position={[0, -0.12, 0]} castShadow>
        <cylinderGeometry args={[0.036, 0.03, 0.2, 7]} />
      </mesh>
      <mesh material={M.belly} position={[0, -0.235, 0.02]} scale={[1, 0.6, 1.3]}>
        <icosahedronGeometry args={[0.04, 1]} />
      </mesh>
    </group>
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, bob, 0]}>
        {leg(-0.08, 0.17, phase, true)}
        {leg(0.08, 0.17, phase + Math.PI, true)}
        {leg(-0.08, -0.17, phase + Math.PI, false)}
        {leg(0.08, -0.17, phase, false)}
        {/* body */}
        <mesh material={M.fur} position={[0, 0.36, 0]} rotation={[0.04 + s * 0.03 * trot, 0, 0]} scale={[0.8, 0.74, 1.35]} castShadow>
          <icosahedronGeometry args={[0.2, 1]} />
        </mesh>
        <mesh material={M.belly} position={[0, 0.34, 0.15]} scale={[0.62, 0.62, 0.7]} castShadow>
          <icosahedronGeometry args={[0.17, 1]} />
        </mesh>
        {/* neck */}
        <mesh material={M.fur} position={[0, 0.5, 0.22]} rotation={[0.6, 0, 0]} scale={[0.85, 1, 0.85]}>
          <cylinderGeometry args={[0.07, 0.09, 0.18, 7]} />
        </mesh>
        {/* tail curled up, wagging */}
        <group position={[0, 0.46, -0.27]} rotation={[0.7, Math.sin(t * 0.55) * 0.5, 0]}>
          <mesh material={M.fur} position={[0, 0.09, 0]} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.04, 0.2, 6]} />
          </mesh>
          <mesh material={M.belly} position={[0, 0.2, 0.06]} rotation={[1.2, 0, 0]}>
            <coneGeometry args={[0.032, 0.1, 6]} />
          </mesh>
        </group>
        {/* head */}
        <group position={[0, 0.58, 0.3]} rotation={[-0.05 + Math.sin(phase * 2) * 0.04 * trot, headYaw, 0]}>
          <mesh material={M.fur} scale={[1.05, 0.95, 1]} castShadow>
            <icosahedronGeometry args={[0.135, 1]} />
          </mesh>
          <mesh material={M.belly} position={[-0.075, -0.06, 0.05]} scale={[0.9, 0.75, 0.8]}>
            <icosahedronGeometry args={[0.065, 1]} />
          </mesh>
          <mesh material={M.belly} position={[0.075, -0.06, 0.05]} scale={[0.9, 0.75, 0.8]}>
            <icosahedronGeometry args={[0.065, 1]} />
          </mesh>
          <mesh material={M.belly} position={[0, -0.035, 0.1]} scale={[0.8, 0.62, 1.15]}>
            <icosahedronGeometry args={[0.075, 1]} />
          </mesh>
          <mesh material={M.nose} position={[0, -0.01, 0.185]} scale={[1.2, 0.8, 0.8]}>
            <icosahedronGeometry args={[0.022, 0]} />
          </mesh>
          <mesh material={M.nose} position={[0, -0.065, 0.15]}>
            <boxGeometry args={[0.04, 0.006, 0.01]} />
          </mesh>
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh material={M.dark} position={[0.08 * sd, 0.13, -0.02]} rotation={[-0.15, 0, -0.3 * sd]} scale={[1, 1, 0.45]}>
                <coneGeometry args={[0.058, 0.15, 5]} />
              </mesh>
              {!sunglasses && (
                <group position={[0.055 * sd, 0.035, 0.115]} rotation={[0, 0.35 * sd, 0]}>
                  <mesh material={M.eye} scale={[0.85, 1.1, 0.45]}>
                    <sphereGeometry args={[0.021, 10, 8]} />
                  </mesh>
                  <mesh material={M.glint} position={[0.006, 0.008, 0.009]}>
                    <sphereGeometry args={[0.0055, 6, 4]} />
                  </mesh>
                </group>
              )}
            </group>
          ))}
          {sunglasses && (
            <group position={[0, 0.04, 0.122]}>
              <mesh material={M.lens} position={[-0.05, 0, 0]}>
                <boxGeometry args={[0.075, 0.042, 0.016]} />
              </mesh>
              <mesh material={M.lens} position={[0.05, 0, 0]}>
                <boxGeometry args={[0.075, 0.042, 0.016]} />
              </mesh>
              <mesh material={M.lens} position={[0, 0.012, 0]}>
                <boxGeometry args={[0.04, 0.01, 0.012]} />
              </mesh>
              <mesh material={M.lens} position={[-0.092, 0.012, -0.05]}>
                <boxGeometry args={[0.008, 0.01, 0.1]} />
              </mesh>
              <mesh material={M.lens} position={[0.092, 0.012, -0.05]}>
                <boxGeometry args={[0.008, 0.01, 0.1]} />
              </mesh>
              <mesh material={M.glint} position={[-0.062, 0.01, 0.01]} rotation={[0, 0, 0.6]}>
                <boxGeometry args={[0.026, 0.005, 0.004]} />
              </mesh>
              <mesh material={M.glint} position={[0.04, 0.01, 0.01]} rotation={[0, 0, 0.6]}>
                <boxGeometry args={[0.016, 0.004, 0.004]} />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </group>
  );
};

/** BMX bike. Faces +Z. Wheels rotate with `roll`. */
export const Bike: React.FC<{roll: number; pedal: number}> = ({roll, pedal}) => {
  const m = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({color: '#1f6fd1', metalness: 0.5, roughness: 0.35, flatShading: true}),
      tire: new THREE.MeshStandardMaterial({color: '#141414', roughness: 0.9, flatShading: true}),
      chrome: new THREE.MeshStandardMaterial({color: '#c9cdd2', metalness: 0.9, roughness: 0.25}),
      seat: new THREE.MeshStandardMaterial({color: '#202020', roughness: 0.7}),
    }),
    []
  );
  const wheel = (z: number) => (
    <group position={[0, 0.3, z]} rotation={[roll, 0, 0]}>
      <mesh material={m.tire} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.28, 0.035, 6, 18]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} material={m.chrome} rotation={[(i / 6) * Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.54, 3]} />
        </mesh>
      ))}
      <mesh material={m.chrome} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 6]} />
      </mesh>
    </group>
  );
  const tube = (a: [number, number, number], b: [number, number, number], r = 0.022, mat = m.frame) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const len = va.distanceTo(vb);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return (
      <mesh material={mat} position={mid} quaternion={q} castShadow>
        <cylinderGeometry args={[r, r, len, 5]} />
      </mesh>
    );
  };
  return (
    <group>
      {wheel(0.5)}
      {wheel(-0.45)}
      {tube([0, 0.3, -0.45], [0, 0.33, 0.05])}
      {tube([0, 0.33, 0.05], [0, 0.68, -0.18])}
      {tube([0, 0.68, -0.18], [0, 0.3, -0.45])}
      {tube([0, 0.33, 0.05], [0, 0.72, 0.4])}
      {tube([0, 0.68, -0.18], [0, 0.72, 0.4])}
      {tube([0, 0.3, 0.5], [0, 0.82, 0.38], 0.02, m.chrome)}
      {tube([-0.28, 0.9, 0.36], [0.28, 0.9, 0.36], 0.018, m.chrome)}
      {tube([0, 0.82, 0.38], [0, 0.9, 0.36], 0.02, m.chrome)}
      <mesh material={m.seat} position={[0, 0.78, -0.2]} castShadow>
        <boxGeometry args={[0.12, 0.05, 0.24]} />
      </mesh>
      <group position={[0, 0.33, 0.05]} rotation={[pedal, 0, 0]}>
        {tube([-0.1, 0, 0], [-0.1, -0.15, 0], 0.012, m.chrome)}
        {tube([0.1, 0, 0], [0.1, 0.15, 0], 0.012, m.chrome)}
      </group>
    </group>
  );
};

/** Yellow school bus, faces +Z (front). Length ~9m. */
export const Bus: React.FC<{position: [number, number, number]; rotationY?: number; door: number; wheelRoll: number; lights?: number}> = ({
  position,
  rotationY = 0,
  door,
  wheelRoll,
  lights = 1,
}) => {
  const tex = useMemo(() => makeBusTexture(), []);
  const m = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({color: '#f2b81d', roughness: 0.45, metalness: 0.1, flatShading: true}),
      black: new THREE.MeshStandardMaterial({color: '#1b1b1b', roughness: 0.6, flatShading: true}),
      glass: new THREE.MeshStandardMaterial({color: '#1f2a36', roughness: 0.05, metalness: 0.6, emissive: '#ffcf80', emissiveIntensity: 0.05}),
      chrome: new THREE.MeshStandardMaterial({color: '#d7d9dc', metalness: 0.9, roughness: 0.25}),
      head: new THREE.MeshStandardMaterial({color: '#fff6dc', emissive: '#fff1c4', emissiveIntensity: 3}),
      red: new THREE.MeshStandardMaterial({color: '#c4271c', emissive: '#ff2a1a', emissiveIntensity: 1.5}),
      sign: new THREE.MeshStandardMaterial({map: tex, roughness: 0.5}),
      seat: new THREE.MeshStandardMaterial({color: '#4b5f7a', roughness: 0.8}),
    }),
    [tex]
  );
  m.head.emissiveIntensity = 3 * lights;
  const wheel = (x: number, z: number) => (
    <group position={[x, 0.55, z]} rotation={[wheelRoll, 0, 0]}>
      <mesh material={m.black} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.38, 10]} />
      </mesh>
      <mesh material={m.chrome} rotation={[0, 0, Math.PI / 2]} position={[x > 0 ? 0.2 : -0.2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 8]} />
      </mesh>
    </group>
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh material={m.body} position={[0, 1.85, -0.4]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 2.5, 8.2]} />
      </mesh>
      <mesh material={m.body} position={[0, 1.15, 4.15]} castShadow>
        <boxGeometry args={[2.3, 1.2, 1.4]} />
      </mesh>
      <mesh material={m.black} position={[0, 1.15, 4.86]}>
        <boxGeometry args={[1.3, 0.7, 0.05]} />
      </mesh>
      <mesh material={m.chrome} position={[0, 0.6, 4.95]}>
        <boxGeometry args={[2.5, 0.25, 0.25]} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} material={m.head} position={[x, 1.25, 4.87]}>
          <cylinderGeometry args={[0.16, 0.16, 0.06, 10]} />
        </mesh>
      ))}
      <mesh material={m.glass} position={[0, 2.4, 3.71]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[2.3, 1.1, 0.06]} />
      </mesh>
      <mesh material={m.sign} position={[0, 3.25, 3.72]}>
        <planeGeometry args={[2.2, 0.34]} />
      </mesh>
      {/* stripes + windows both sides */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh material={m.black} position={[1.26 * sd, 1.35, -0.4]}>
            <boxGeometry args={[0.02, 0.1, 8.2]} />
          </mesh>
          <mesh material={m.black} position={[1.26 * sd, 1.0, -0.4]}>
            <boxGeometry args={[0.02, 0.1, 8.2]} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} material={m.glass} position={[1.26 * sd, 2.35, 2.2 - i * 1.25 - (sd > 0 && i === 0 ? 0 : 0)]}>
              <boxGeometry args={[0.03, 0.85, 1.05]} />
            </mesh>
          ))}
          <mesh material={m.red} position={[1.0 * sd, 2.95, -4.52]}>
            <boxGeometry args={[0.25, 0.25, 0.04]} />
          </mesh>
        </group>
      ))}
      {/* empty driver seat */}
      <mesh material={m.seat} position={[0.6, 1.5, 3.1]}>
        <boxGeometry args={[0.6, 0.9, 0.15]} />
      </mesh>
      {/* folding door on the +X side (kerb side) */}
      <group position={[-1.27, 1.55, 3.15]}>
        <mesh material={m.glass} position={[0, 0, -0.28]} rotation={[0, -door * 1.3, 0]}>
          <boxGeometry args={[0.04, 2.1, 0.55]} />
        </mesh>
        <mesh material={m.glass} position={[0, 0, 0.28]} rotation={[0, door * 1.3, 0]}>
          <boxGeometry args={[0.04, 2.1, 0.55]} />
        </mesh>
      </group>
      {wheel(-1.15, 3.4)}
      {wheel(1.15, 3.4)}
      {wheel(-1.15, -3.0)}
      {wheel(1.15, -3.0)}
    </group>
  );
};

export const Ball: React.FC<{position: [number, number, number]; spin: number}> = ({position, spin}) => {
  const m = useMemo(() => [new THREE.MeshStandardMaterial({color: '#f4f4f4', flatShading: true, roughness: 0.5}), new THREE.MeshStandardMaterial({color: '#1d1d1d', flatShading: true})], []);
  return (
    <group position={position} rotation={[spin, spin * 0.7, 0]}>
      <mesh material={m[0]} castShadow>
        <icosahedronGeometry args={[0.11, 1]} />
      </mesh>
      <mesh material={m[1]} scale={1.005}>
        <icosahedronGeometry args={[0.11, 0]} />
      </mesh>
    </group>
  );
};
