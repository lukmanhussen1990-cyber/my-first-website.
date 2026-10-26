import React, { useMemo, useRef } from 'react';
import { registerRoot, Composition, useCurrentFrame, AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const Spin = () => {
  const frame = useCurrentFrame();
  const fr = useRef(frame); fr.current = frame;
  const { gl } = useThree();
  const box = useMemo(() => new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#c49a3a', flatShading: true })), []);
  useMemo(() => { gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap; box.castShadow = true; }, [gl, box]);
  useFrame((state) => {
    box.rotation.y = fr.current * 0.1;
    state.gl.render(state.scene, state.camera);
    window.__info = { renderer: state.gl.getContext().getParameter(state.gl.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? 7937), frame: fr.current };
  }, 1);
  return (<>
    <primitive object={box} />
    <mesh rotation-x={-Math.PI / 2} position-y={-1.2} receiveShadow><planeGeometry args={[10, 10]} /><meshLambertMaterial color="#86853e" /></mesh>
    <directionalLight position={[3, 6, 2]} intensity={3} castShadow />
    <hemisphereLight args={['#fff3dc', '#8a7a4a', 1.2]} />
  </>);
};
const Test = () => (
  <AbsoluteFill style={{ background: '#222' }}>
    <ThreeCanvas width={1080} height={1920} camera={{ fov: 30, position: [0, 3, 9] }} shadows>
      <Spin />
    </ThreeCanvas>
    <div style={{ position: 'absolute', top: 200, left: 72, color: 'white', fontSize: 60 }}>Remotion + R3F test</div>
  </AbsoluteFill>
);
registerRoot(() => <Composition id="Test" component={Test} width={1080} height={1920} fps={30} durationInFrames={6} />);
