// Assembles the set, characters and props; owns the extra render passes
// (shadows once per frame, floor/street mirror, fridge mirror, phone viewfinder, CCTV).
import * as THREE from 'three';
import { PlanarReflection } from './reflect.js';
import { buildRestaurant, LAYOUT } from './restaurant.js';
import { buildStreet, STREET } from './street.js';
import { makeBoy, makeHer } from './characters.js';
import { makeMop, makePhone, makeKeys } from './props.js';
import { makeCanvas, canvasTexture } from './util.js';

export { LAYOUT, STREET };

export class World {
  constructor(renderer, { W, H }) {
    this.renderer = renderer;
    this.W = W;
    this.H = H;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x05080f);
    scene.fog = new THREE.FogExp2(0x0a1222, 0.021);
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.03, 140);

    this.floorRefl = new PlanarReflection({ width: Math.round(W * 0.5), height: Math.round(H * 0.5), normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3(0, 0, 0) });
    this.fridgeRefl = new PlanarReflection({
      width: Math.round(W * 0.7),
      height: Math.round(H * 0.7),
      normal: new THREE.Vector3(0, 0, 1),
      point: new THREE.Vector3(LAYOUT.fridge.x, 1, LAYOUT.fridge.frontZ + 0.006),
    });

    this.R = buildRestaurant(scene, { floorRefl: this.floorRefl, fridgeRefl: this.fridgeRefl });
    this.S = buildStreet(scene, { floorRefl: this.floorRefl });
    this.floorRefl.hide.push(this.R.floor, ...this.S.mirrorSurfaces);
    this.fridgeRefl.hide.push(this.R.fridgeDoor);

    this.boy = makeBoy();
    this.her = makeHer();
    this.mop = makeMop();
    this.phone = makePhone(renderer);
    this.keys = makeKeys();
    scene.add(this.boy.root, this.her.root, this.mop.root, this.phone.root, this.keys.root);
    for (const obj of [this.boy.root, this.her.root, this.mop.root, this.phone.root, this.keys.root]) {
      obj.traverse((o) => {
        if (o.isMesh && o.castShadow !== false) o.castShadow = true;
      });
    }
    // soft cold fill on her face when she is outside (positioned by the director, off otherwise)
    this.herFill = new THREE.PointLight(0xd8e6ff, 0, 3.2, 2);
    scene.add(this.herFill);
    this.herMaterials = [];
    this.her.root.traverse((o) => o.isMesh && this.herMaterials.push(o.material));

    this.setupCCTV();
  }

  // Live black & white security feed on the monitor next to the register.
  setupCCTV() {
    const rt = new THREE.WebGLRenderTarget(320, 240, { type: THREE.HalfFloatType });
    const cam = new THREE.PerspectiveCamera(72, 320 / 240, 0.1, 60);
    cam.position.set(6.6, 2.95, 4.6);
    cam.lookAt(-0.8, 0.7, -0.6);
    const [c, ctx] = makeCanvas(320, 240);
    const ui = canvasTexture(c, { mipmaps: false });
    const mat = new THREE.ShaderMaterial({
      uniforms: { tView: { value: rt.texture }, tUI: { value: ui }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tView; uniform sampler2D tUI; uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*61.7) * 43758.5453); }
        void main(){
          vec3 v = texture2D(tView, vUv).rgb;
          float l = dot(v, vec3(0.3,0.59,0.11));
          l = pow(l / (l + 0.6), 0.85) * 1.5;
          l *= 0.82 + 0.18 * sin(vUv.y * 480.0);
          l += (h(floor(vUv * vec2(320.0,240.0))) - 0.5) * 0.18;
          vec2 d = vUv - 0.5; l *= 1.0 - dot(d,d) * 1.6;
          vec4 u = texture2D(tUI, vUv);
          vec3 col = mix(vec3(l) * vec3(0.78, 0.95, 0.85), u.rgb, u.a);
          gl_FragColor = vec4(col * 1.35, 1.0);
        }`,
    });
    this.R.cctv.screen.material = mat;
    this.cctv = { rt, cam, ctx, ui, mat };
  }

  renderCCTV(t) {
    const { rt, cam, ctx, ui, mat } = this.cctv;
    ctx.clearRect(0, 0, 320, 240);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '18px Oswald';
    const secs = 0 + Math.floor(t) % 60;
    ctx.fillText(`CAM 1   02:${58 + Math.floor((t + 12) / 60)}:${String((secs + 12) % 60).padStart(2, '0')}`, 12, 24);
    ctx.fillText('● REC', 250, 24);
    ui.needsUpdate = true;
    mat.uniforms.uTime.value = t;
    this.R.cctv.screen.visible = false;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(rt);
    r.clear();
    r.render(this.scene, cam);
    r.setRenderTarget(prev);
    this.R.cctv.screen.visible = true;
  }

  // Image-based lighting captured from the set itself (one interior, one exterior probe).
  captureEnvironment() {
    const r = this.renderer;
    const pmrem = new THREE.PMREMGenerator(r);
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(0.05, 120, cubeRT);
    const hidden = [this.boy.root, this.her.root, this.mop.root, this.phone.root, this.keys.root];
    hidden.forEach((o) => (o.visible = false));
    this.scene.add(cubeCam);
    cubeCam.position.set(-0.6, 1.7, 0.8);
    cubeCam.update(r, this.scene);
    this.envInterior = pmrem.fromCubemap(cubeRT.texture).texture;
    cubeCam.position.set(-0.5, 2.2, 13.5);
    cubeCam.update(r, this.scene);
    this.envExterior = pmrem.fromCubemap(cubeRT.texture).texture;
    this.scene.remove(cubeCam);
    hidden.forEach((o) => (o.visible = true));
    this.scene.environment = this.envInterior;
    this.scene.environmentIntensity = 0.32;
    this.S.root.traverse((o) => {
      if (o.isMesh && o.material && 'envMap' in o.material) o.material.envMap = this.envExterior;
    });
    pmrem.dispose();
    cubeRT.dispose();
  }

  setHerOutside(outside) {
    const env = outside ? this.envExterior : this.envInterior;
    for (const m of this.herMaterials) if ('envMap' in m && m.envMap !== env) m.envMap = env;
  }

  // Extra passes before the main render. state flags come from the director.
  renderPasses(state, t) {
    const r = this.renderer;
    this.scene.updateMatrixWorld(true);
    // the camera is not in the scene graph: refresh it before the mirrors read its matrix
    this.camera.updateMatrixWorld(true);
    r.shadowMap.needsUpdate = true;
    this.boy.head.visible = true;
    if (state.phone) {
      this.phone.screen.visible = false;
      this.phone.render(r, this.scene, state.phoneTime || 0);
      this.phone.screen.visible = true;
    }
    if (state.fridgeMirror) this.fridgeRefl.update(r, this.scene, this.camera);
    if (state.floorMirror) this.floorRefl.update(r, this.scene, this.camera);
    if (state.cctv) this.renderCCTV(t);
    if (state.povHideHead) this.boy.head.visible = false;
  }
}
