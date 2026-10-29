import { Environment, Lightformer } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  ConeGeometry,
  Vector2,
  Vector3,
  RepeatWrapping,
  type Texture,
} from 'three';
import { createBrushedMaps, createFloorMaps } from '../../lib/textures';

export const FLOOR_Y = -1.35;
const WALL_RADIUS = 13;

/**
 * Image-based lighting used only for reflections: a few studio softboxes and
 * strip lights, rendered once into a cube map. Scenery uses a tiny
 * envMapIntensity so it stays near-black until the torch lights it.
 */
export function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1} background={false}>
      <color attach="background" args={['#000000']} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 5.5, 0.5]} rotation-x={Math.PI / 2} scale={[7, 2.6, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#f4f7ff" position={[-4.5, 1.6, 3.2]} rotation-y={Math.PI * 0.8} scale={[0.55, 7, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[4.8, 1.2, -2.6]} rotation-y={-Math.PI * 0.3} scale={[0.45, 7, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#dfe7ff" position={[0, 2.4, -6]} scale={[9, 1.1, 1]} />
      <Lightformer form="rect" intensity={0.55} color="#ffb547" position={[1.5, -2.6, 4.2]} rotation-x={-Math.PI * 0.3} scale={[5, 0.9, 1]} />
      <Lightformer form="ring" intensity={0.9} color="#ffffff" position={[6, 0.4, 4]} scale={1.6} target={[0, 0, 0]} />
    </Environment>
  );
}

function fluteColumn(radius: number, height: number, flutes: number) {
  const geo = new CylinderGeometry(radius, radius, height, flutes * 8, 1, false);
  const pos = geo.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r < radius * 0.5) continue; // cap centre
    const a = Math.atan2(v.z, v.x);
    const k = 1 - 0.07 * Math.pow(0.5 + 0.5 * Math.cos(a * flutes), 3);
    v.x *= k;
    v.z *= k;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.translate(0, height / 2, 0);
  return geo;
}

function useStudioResources() {
  const res = useMemo(() => {
    const floor = createFloorMaps(512, 71);
    const brushed = createBrushedMaps(512, 29);
    const tile = (t: Texture, x: number, y: number) => {
      const c = t.clone();
      c.wrapS = c.wrapT = RepeatWrapping;
      c.repeat.set(x, y);
      c.needsUpdate = true;
      return c;
    };
    const floorColor = tile(floor.color, 14, 14);
    const floorRough = tile(floor.roughness, 14, 14);
    const floorNormal = tile(floor.normal, 14, 14);
    const wallRough = tile(floor.roughness, 20, 4);
    const wallNormal = tile(floor.normal, 20, 4);
    const steelRough = tile(brushed.roughness, 1, 3);
    const steelNormal = tile(brushed.normal, 1, 3);

    const materials = {
      floor: new MeshStandardMaterial({
        name: 'studio-floor',
        color: '#1a1a1c',
        map: floorColor,
        roughness: 0.86,
        roughnessMap: floorRough,
        normalMap: floorNormal,
        normalScale: new Vector2(0.35, 0.35),
        envMapIntensity: 0.006,
      }),
      wall: new MeshStandardMaterial({
        name: 'cyclorama',
        color: '#2a2a2d',
        roughness: 0.95,
        roughnessMap: wallRough,
        normalMap: wallNormal,
        normalScale: new Vector2(0.5, 0.5),
        side: BackSide,
        envMapIntensity: 0.004,
      }),
      steel: new MeshPhysicalMaterial({
        name: 'brushed-steel',
        color: '#8a8e96',
        metalness: 1,
        roughness: 0.34,
        roughnessMap: steelRough,
        normalMap: steelNormal,
        normalScale: new Vector2(0.2, 0.2),
        anisotropy: 0.55,
        envMapIntensity: 0.014,
      }),
      chrome: new MeshStandardMaterial({ name: 'chrome', color: '#e9eaed', metalness: 1, roughness: 0.07, envMapIntensity: 0.02 }),
      aluminium: new MeshPhysicalMaterial({
        name: 'satin-aluminium',
        color: '#c9ccd1',
        metalness: 1,
        roughness: 0.28,
        roughnessMap: steelRough,
        anisotropy: 0.4,
        envMapIntensity: 0.014,
      }),
      concrete: new MeshStandardMaterial({
        name: 'concrete',
        color: '#47474a',
        roughness: 0.93,
        roughnessMap: floorRough,
        normalMap: floorNormal,
        normalScale: new Vector2(0.6, 0.6),
        envMapIntensity: 0.005,
      }),
      anodized: new MeshPhysicalMaterial({ name: 'dark-anodized', color: '#1d1e21', metalness: 0.6, roughness: 0.42, envMapIntensity: 0.012 }),
      gloss: new MeshPhysicalMaterial({ name: 'black-gloss', color: '#060606', metalness: 0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.016 }),
    };

    const geometries = {
      floor: new CylinderGeometry(42, 42, 0.02, 96, 1),
      wall: new CylinderGeometry(WALL_RADIUS, WALL_RADIUS, 16, 160, 1, true),
      sphere: new SphereGeometry(0.62, 96, 64),
      monolith: new BoxGeometry(1.3, 4.8, 0.38),
      torus: new TorusGeometry(1.25, 0.075, 32, 192),
      column: fluteColumn(0.5, 8, 24),
      stepA: new BoxGeometry(2.6, 0.5, 1.5),
      stepB: new BoxGeometry(1.9, 1.0, 1.1),
      stepC: new BoxGeometry(1.2, 1.55, 0.7),
      fin: new BoxGeometry(0.05, 5.2, 1.05),
      obelisk: new ConeGeometry(0.62, 2.2, 4, 1),
    };

    return {
      materials,
      geometries,
      dispose: () => {
        Object.values(materials).forEach((m) => m.dispose());
        Object.values(geometries).forEach((g) => g.dispose());
        [floorColor, floorRough, floorNormal, wallRough, wallNormal, steelRough, steelNormal].forEach((t) => t.dispose());
        floor.dispose();
        brushed.dispose();
      },
    };
  }, []);
  useEffect(() => () => res.dispose(), [res]);
  return res;
}

const FIN_COUNT = 12;

export function Studio() {
  const { materials: m, geometries: g } = useStudioResources();
  const finsRef = useRef<InstancedMesh>(null!);

  useLayoutEffect(() => {
    const fins = finsRef.current;
    const o = new Object3D();
    const start = new Vector3(6.4, FLOOR_Y + 2.6, -4.6);
    const end = new Vector3(8.6, FLOOR_Y + 2.6, 3.6);
    for (let i = 0; i < FIN_COUNT; i++) {
      o.position.lerpVectors(start, end, i / (FIN_COUNT - 1));
      o.rotation.set(0, 0.62, 0);
      o.updateMatrix();
      fins.setMatrixAt(i, o.matrix);
    }
    fins.instanceMatrix.needsUpdate = true;
    fins.computeBoundingSphere();
  }, []);

  const monolith = useMemo(() => new Matrix4().compose(new Vector3(-6.0, FLOOR_Y + 2.4, -1.7), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1.18), new Vector3(1, 1, 1)), []);

  return (
    <group>
      <mesh geometry={g.floor} material={m.floor} position={[0, FLOOR_Y - 0.01, 0]} receiveShadow />
      <mesh geometry={g.wall} material={m.wall} position={[0, FLOOR_Y + 8, 0]} receiveShadow />

      <mesh geometry={g.sphere} material={m.chrome} position={[-3.45, FLOOR_Y + 0.62, -0.42]} castShadow receiveShadow />
      <mesh geometry={g.monolith} material={m.steel} matrix={monolith} matrixAutoUpdate={false} castShadow receiveShadow />
      <mesh geometry={g.torus} material={m.aluminium} position={[-4.9, FLOOR_Y + 1.33, 1.9]} rotation={[0, 1.2, 0]} castShadow receiveShadow />
      <mesh geometry={g.column} material={m.anodized} position={[-2.1, FLOOR_Y, -7.6]} castShadow receiveShadow />

      <group position={[-5.4, FLOOR_Y, -4.9]} rotation={[0, 0.75, 0]}>
        <mesh geometry={g.stepA} material={m.concrete} position={[0, 0.25, 0]} castShadow receiveShadow />
        <mesh geometry={g.stepB} material={m.concrete} position={[0.25, 0.5 + 0.5, -0.15]} castShadow receiveShadow />
        <mesh geometry={g.stepC} material={m.concrete} position={[0.5, 1.5 + 0.775, -0.3]} castShadow receiveShadow />
      </group>

      <mesh geometry={g.obelisk} material={m.gloss} position={[2.0, FLOOR_Y + 1.1, -5.3]} rotation={[0, 0.4, 0]} castShadow receiveShadow />

      <instancedMesh ref={finsRef} args={[g.fin, m.steel, FIN_COUNT]} castShadow receiveShadow />
    </group>
  );
}
