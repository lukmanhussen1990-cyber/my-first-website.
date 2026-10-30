import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {H, W, img} from '../lib/anim';
import {useImage} from '../lib/useImage';
import {spriteMeta} from './Sprite';

/** One bill lying on the ground plane (y up, -z forward). Sizes are in world units. */
export type Bill3D = {x: number; y: number; z: number; ry?: number; rx?: number; rz?: number; s?: number};
export type Cam3D = {pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number};

const MAX = 1400;
export const BILL_W = 1.4;
export const BILL_L = BILL_W * 2.36;

const billTexture = (image: HTMLImageElement) => {
  const [x0, y0, x1, y1] = spriteMeta('15_bill').bbox;
  const sw = x1 - x0, sh = y1 - y0;
  // rotate the landscape bill so its long side runs along the road
  const c = document.createElement('canvas');
  c.width = sh;
  c.height = sw;
  const ctx = c.getContext('2d')!;
  ctx.translate(sh / 2, sw / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(image, x0, y0, sw, sh, -sw / 2, -sh / 2, sw, sh);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

const glowTexture = () => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 8;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(61,255,58,0)');
  g.addColorStop(0.5, 'rgba(120,255,110,1)');
  g.addColorStop(1, 'rgba(61,255,58,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const Inner: React.FC<{bills: Bill3D[]; cam: Cam3D; glow: number; glowZ: [number, number]; fog?: [string, number, number]}> = ({bills, cam, glow, glowZ, fog}) => {
  const image = useImage(img('15_bill'));
  const {camera, scene, advance} = useThree();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const glowMesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => (image ? billTexture(image) : null), [image]);
  const gTex = useMemo(() => glowTexture(), []);
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(BILL_W, BILL_L);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({map: tex ?? null, transparent: true, alphaTest: 0.05, toneMapped: false, side: THREE.DoubleSide}),
    [tex],
  );
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = cam.fov ?? 50;
    c.aspect = W / H;
    c.near = 0.05;
    c.far = 3000;
    c.position.set(...cam.pos);
    c.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
    c.lookAt(...cam.look);
    c.updateProjectionMatrix();
    scene.fog = fog ? new THREE.Fog(fog[0], fog[1], fog[2]) : null;
    const m = mesh.current;
    if (m) {
      const o = new THREE.Object3D();
      const n = Math.min(bills.length, MAX);
      for (let i = 0; i < n; i++) {
        const b = bills[i];
        o.position.set(b.x, b.y, b.z);
        o.rotation.set(b.rx ?? 0, b.ry ?? 0, b.rz ?? 0, 'YXZ');
        o.scale.setScalar(b.s ?? 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    if (glowMesh.current) {
      const [z0, z1] = glowZ;
      glowMesh.current.position.set(0, -0.01, (z0 + z1) / 2);
      glowMesh.current.scale.set(1, Math.abs(z1 - z0), 1);
      (glowMesh.current.material as THREE.MeshBasicMaterial).opacity = glow;
      glowMesh.current.visible = glow > 0.01;
    }
    // render now: Remotion only advances R3F on frame changes, not when the texture arrives
    advance(performance.now());
  });
  if (!tex) return null;
  return (
    <>
      <mesh ref={glowMesh} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BILL_W * 3.2, 1]} />
        <meshBasicMaterial map={gTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <instancedMesh ref={mesh} args={[geom, mat, MAX]} frustumCulled={false} />
    </>
  );
};

/** Perspective road of bills rendered with Three.js on a transparent canvas. */
export const BillRoad3D: React.FC<{bills: Bill3D[]; cam: Cam3D; glow?: number; glowZ?: [number, number]; fog?: [string, number, number]; style?: React.CSSProperties}> = ({
  bills, cam, glow = 0, glowZ = [0, -100], fog, style,
}) => (
  <ThreeCanvas
    width={W}
    height={H}
    style={{position: 'absolute', inset: 0, ...style}}
    gl={{alpha: true, antialias: true, premultipliedAlpha: true}}
    camera={{fov: cam.fov ?? 50, position: cam.pos}}
  >
    <Inner bills={bills} cam={cam} glow={glow} glowZ={glowZ} fog={fog} />
  </ThreeCanvas>
);

/** Project a world point with the same camera, for placing DOM sprites on the 3D road. */
export const project = (cam: Cam3D, p: [number, number, number]) => {
  const c = new THREE.PerspectiveCamera(cam.fov ?? 50, W / H, 0.05, 3000);
  c.position.set(...cam.pos);
  c.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
  c.lookAt(...cam.look);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const v = new THREE.Vector3(...p).project(c);
  const depth = new THREE.Vector3(...p).applyMatrix4(c.matrixWorldInverse).z;
  const f = H / 2 / Math.tan(((cam.fov ?? 50) * Math.PI) / 360);
  return {x: (v.x + 1) * W / 2, y: (1 - v.y) * H / 2, scale: f / Math.max(-depth, 0.001), visible: depth < 0};
};
