import {useLayoutEffect} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {quality, useRemotionLite} from '../lib/lite';

export type Cam = {pos: [number, number, number]; target: [number, number, number]; fov: number; roll?: number};

const CameraRig: React.FC<{cam: Cam}> = ({cam}) => {
  const {camera} = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(...cam.pos);
    c.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
    c.lookAt(...cam.target);
    c.fov = cam.fov;
    c.near = 0.05;
    c.far = 600;
    c.updateProjectionMatrix();
  });
  return null;
};

export const Stage: React.FC<{
  cam: Cam;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  shadows?: boolean;
  exposure?: number;
  children: React.ReactNode;
}> = ({cam, width = 1080, height = 1920, style, shadows = true, exposure = 1, children}) => {
  const lite = useRemotionLite();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{position: 'absolute', left: 0, top: 0, ...style}}
      shadows={shadows && !lite ? 'soft' : false}
      dpr={quality().dpr}
      gl={{antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true}}
      onCreated={({gl}) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = exposure;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      camera={{fov: cam.fov, position: cam.pos, near: 0.05, far: 600}}
    >
      <CameraRig cam={cam} />
      {children}
    </ThreeCanvas>
  );
};

// Project a world point to pixels with the same camera the canvas uses.
const projCam = new THREE.PerspectiveCamera();
export const project = (cam: Cam, p: [number, number, number], width = 1080, height = 1920) => {
  projCam.aspect = width / height;
  projCam.fov = cam.fov;
  projCam.near = 0.05;
  projCam.far = 600;
  projCam.position.set(...cam.pos);
  projCam.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
  projCam.lookAt(...cam.target);
  projCam.updateMatrixWorld();
  projCam.updateProjectionMatrix();
  const v = new THREE.Vector3(...p).project(projCam);
  return {x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, visible: v.z < 1};
};

export const lerpCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as [number, number, number],
  target: a.target.map((v, i) => v + (b.target[i] - v) * k) as [number, number, number],
  fov: a.fov + (b.fov - a.fov) * k,
  roll: (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * k,
});
