import {useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {faceted, taperTube, leafGeometry} from './lowpoly';
import {rand} from '../lib/random';

const BITES: [THREE.Vector3, number][] = [
  [new THREE.Vector3(0.98, 0.2, 0.42), 0.36],
  [new THREE.Vector3(1.02, -0.12, 0.28), 0.33],
  [new THREE.Vector3(0.9, 0.5, 0.3), 0.3],
];

const buildApple = () => {
  const prof: [number, number][] = [
    [0.0, 0.7], [0.12, 0.77], [0.3, 0.9], [0.55, 0.93], [0.8, 0.78], [0.96, 0.45], [1.0, 0.1],
    [0.95, -0.25], [0.82, -0.56], [0.6, -0.78], [0.36, -0.86], [0.16, -0.8], [0.0, -0.76],
  ];
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(56).map((p) => new THREE.Vector2(Math.max(0.0001, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, 72);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const bitten = new Uint8Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const low = Math.max(0, -v.y - 0.3);
    const lump = 1 + 0.035 * Math.cos(a * 5) * low + 0.012 * Math.sin(a * 3 + v.y * 4);
    v.x *= lump;
    v.z *= lump;
    for (const [c, r] of BITES) {
      const d = v.distanceTo(c);
      if (d < r) {
        v.copy(c).add(v.clone().sub(c).normalize().multiplyScalar(r)); // push onto the bite sphere: concave scoop
        bitten[i] = 1;
      }
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (bitten[i]) c.set('#F4E3BE').lerp(new THREE.Color('#E9CF95'), rand(3, i) * 0.4);
    else {
      const top = THREE.MathUtils.clamp((v.y + 0.2) / 1.1, 0, 1);
      c.set('#7E1410').lerp(new THREE.Color('#D3271F'), 0.35 + 0.5 * Math.abs(Math.sin(Math.atan2(v.z, v.x) * 2 + v.y)) * (1 - top * 0.4));
      c.lerp(new THREE.Color('#E8A23A'), top * top * 0.12 * (rand(4, i) > 0.5 ? 1 : 0.6));
      if (rand(5, i) > 0.985) c.lerp(new THREE.Color('#F2D08A'), 0.5); // freckles
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stem = taperTube([0, 1, 2, 3, 4, 5].map((k) => new THREE.Vector3(Math.sin(k * 0.3) * 0.05, 0.68 + k * 0.07, k * 0.01)), (u) => 0.045 - u * 0.02, 6, () => new THREE.Color('#5B3A1E'));
  const leaf = leafGeometry(0.42, 0.24, 0.35, 0.1, 7, '#4E8E2E');
  return {g, stem, leaf};
};

let cache: ReturnType<typeof buildApple> | null = null;

export const Apple3D: React.FC<{rotY: number; scale?: number; opacity?: number; dim?: number}> = ({rotY, scale = 1, opacity = 1, dim = 0}) => {
  const A = (cache ??= buildApple());
  const mats = useMemo(() => ({
    skin: new THREE.MeshPhysicalMaterial({vertexColors: true, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true}),
    stem: new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.8, transparent: true}),
  }), []);
  mats.skin.opacity = opacity;
  mats.stem.opacity = opacity;
  mats.skin.color.setScalar(1 - dim * 0.35);
  return (
    <group rotation={[0.12, rotY, -0.06]} scale={scale}>
      <mesh geometry={A.g} material={mats.skin} />
      <mesh geometry={A.stem} material={mats.stem} />
      <mesh geometry={A.leaf} material={mats.stem} position={[0.04, 0.98, 0.04]} rotation={[0.9, 0.6, -1.2]} />
    </group>
  );
};

// Studio lighting for the apple: soft key, warm rim left, cool rim right, and a generated room for reflections.
export const AppleLights: React.FC<{warm?: number}> = ({warm = 1}) => {
  const {gl, scene} = useThree();
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
  }, [gl, scene]);
  return (
    <group>
      <directionalLight position={[2.5, 2.8, 3.5]} intensity={1.3} color="#FFF1DE" />
      <directionalLight position={[-4, 1.5, -2.5]} intensity={6 * warm} color="#FFA04A" />
      <directionalLight position={[4, 0.6, -3]} intensity={2.6} color="#9CC4FF" />
      <pointLight position={[0, -2.2, 1.5]} intensity={2} color="#FF6A3A" distance={6} />
      <ambientLight intensity={0.08} />
    </group>
  );
};

export {faceted};
