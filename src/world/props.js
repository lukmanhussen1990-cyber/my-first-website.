// Props: mop, phone (live viewfinder render target + camera UI), keys.
import * as THREE from 'three';
import { mesh, group, rbox, canvasTexture, mulberry32 } from './util.js';
import * as TX from './textures.js';

export function makeMop() {
  const root = new THREE.Group();
  root.name = 'mop';
  // local frame: origin at the mop head on the floor, handle along +Y
  const handle = new THREE.MeshStandardMaterial({ color: 0xb7c0c6, metalness: 0.8, roughness: 0.35 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x1f6f75, roughness: 0.6 });
  mesh(new THREE.CylinderGeometry(0.013, 0.013, 1.42, 10), handle, { y: 0.78, parent: root });
  mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.2, 10), grip, { y: 1.42, parent: root });
  mesh(rbox(0.12, 0.05, 0.05, 0.015), new THREE.MeshStandardMaterial({ color: 0xe6a51c, roughness: 0.5 }), { y: 0.09, parent: root });
  const strings = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.009, 0.2, 3, 6), new THREE.MeshStandardMaterial({ color: 0xcfcbc0, roughness: 0.9 }), 46);
  const rng = mulberry32(7);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.02 + rng() * 0.05;
    const tilt = 0.9 + rng() * 0.55;
    q.setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt));
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0.06, Math.sin(a) * r * 0.6), q, new THREE.Vector3(1, 1, 1));
    m.multiply(new THREE.Matrix4().makeTranslation(0, -0.11, 0));
    strings.setMatrixAt(i, m);
  }
  strings.castShadow = true;
  root.add(strings);
  return { root, gripTop: new THREE.Vector3(0, 1.38, 0), gripLow: new THREE.Vector3(0, 0.95, 0) };
}

export function makePhone(renderer) {
  const root = new THREE.Group();
  root.name = 'phone';
  // local frame: screen faces +Z (towards the holder), long axis along Y
  mesh(rbox(0.074, 0.152, 0.009, 0.009), new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.4, roughness: 0.3 }), { parent: root });
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 }), { x: -0.022, y: 0.058, z: -0.006, rx: Math.PI / 2, parent: root });
  const rt = new THREE.WebGLRenderTarget(300, 616, { type: THREE.HalfFloatType });
  const [uiCanvas, uiCtx] = TX.phoneUICanvas();
  const uiTex = canvasTexture(uiCanvas, { mipmaps: false });
  const mat = new THREE.ShaderMaterial({
    uniforms: { tView: { value: rt.texture }, tUI: { value: uiTex }, uGain: { value: 1.25 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tView; uniform sampler2D tUI; uniform float uGain; varying vec2 vUv;
      void main(){
        vec3 v = texture2D(tView, vUv).rgb * uGain;
        vec4 ui = texture2D(tUI, vUv);
        gl_FragColor = vec4(mix(v, ui.rgb * 1.3, ui.a), 1.0);
      }`,
  });
  const screen = mesh(new THREE.PlaneGeometry(0.068, 0.146), mat, { z: 0.0047, parent: root, cast: false, receive: false });
  const cam = new THREE.PerspectiveCamera(32, 300 / 616, 0.05, 120);
  cam.name = 'phoneCam';
  return {
    root,
    screen,
    rt,
    cam,
    render(rendererArg, scene, t) {
      TX.drawPhoneUI(uiCtx, t);
      uiTex.needsUpdate = true;
      // camera sits at the lens and looks out of the back of the phone
      root.updateMatrixWorld(true);
      cam.position.setFromMatrixPosition(root.matrixWorld);
      cam.quaternion.setFromRotationMatrix(root.matrixWorld);
      cam.updateMatrixWorld(true);
      const prev = rendererArg.getRenderTarget();
      rendererArg.setRenderTarget(rt);
      rendererArg.clear();
      rendererArg.render(scene, cam);
      rendererArg.setRenderTarget(prev);
    },
  };
  void renderer;
}

export function makeKeys() {
  const root = new THREE.Group();
  root.name = 'keys';
  const brass = new THREE.MeshStandardMaterial({ color: 0xd2a54f, metalness: 1, roughness: 0.25 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd0d6da, metalness: 1, roughness: 0.22 });
  // local frame: the active key's blade points along -Z (into the lock), bow at origin
  const active = group(root);
  mesh(rbox(0.026, 0.03, 0.004, 0.008), brass, { parent: active });
  mesh(new THREE.BoxGeometry(0.008, 0.004, 0.034), brass, { z: -0.024, rx: 0, parent: active });
  mesh(new THREE.TorusGeometry(0.017, 0.0022, 8, 24), silver, { y: 0.03, parent: root });
  const dangle = group(root, { y: 0.03 });
  for (let k = 0; k < 2; k++) {
    const kg = group(dangle, { rz: 0.4 + k * 0.5 });
    mesh(rbox(0.022, 0.026, 0.004, 0.007), k ? silver : brass, { y: -0.03, parent: kg });
    mesh(new THREE.BoxGeometry(0.007, 0.032, 0.0035), k ? silver : brass, { y: -0.058, parent: kg });
  }
  mesh(rbox(0.03, 0.045, 0.012, 0.01), new THREE.MeshStandardMaterial({ color: 0x0f5a62, roughness: 0.5 }), { x: 0.02, y: -0.01, rz: 0.6, parent: dangle });
  return { root, active, dangle };
}
