// Render pipeline: road reflection -> rear-view mirror -> main HDR scene ->
// volumetric fog -> composite (fog + glass + raindrops) -> depth of field ->
// bloom -> tone mapping and grading.

import * as THREE from 'three';
import { CAR, LAYER } from '../config.js';
import { U } from '../world/shared.js';
import { fogNoise3D, headlightPattern } from '../core/textures.js';
import { MAX_FOG_LAMPS } from '../world/Lights.js';
import * as S from './shaders.js';

const TRI = new THREE.BufferGeometry();
TRI.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
const ORTHO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

class Pass {
  constructor(fragmentShader, uniforms, opts = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: S.FULLSCREEN_VERT,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      ...opts,
    });
    this.mesh = new THREE.Mesh(TRI, this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
  }

  get u() {
    return this.material.uniforms;
  }

  render(renderer, target, clear = true) {
    renderer.setRenderTarget(target);
    if (clear) renderer.clear(true, false, false);
    renderer.render(this.scene, ORTHO);
  }
}

const rt = (w, h, opts = {}) => new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
  type: THREE.HalfFloatType,
  depthBuffer: false,
  ...opts,
});

export class Pipeline {
  constructor(renderer, scene, camera, quality, { car, lights }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.q = quality;
    this.car = car;
    this.lights = lights;
    this.frame = 0;
    this.width = 1;
    this.height = 1;

    camera.layers.enable(LAYER.INTERIOR);
    camera.layers.enable(LAYER.NO_REFLECT);
    camera.layers.disable(LAYER.MIRROR_ONLY);

    this.reflCam = new THREE.PerspectiveCamera();
    this.reflCam.layers.set(LAYER.DEFAULT);
    this.reflMatrix = new THREE.Matrix4();
    U.uReflMatrix.value = this.reflMatrix;

    this._buildPasses();
    // Tunable look, driven by the director each frame.
    this.look = {
      exposure: 1.6,
      bloom: 0.09,
      glassGlare: 0.12,
      grain: 0.035,
      vignette: 0.55,
      chroma: 0.012,
      saturation: 0.86,
      fade: 0,
      letterbox: 0,
      flash: 0,
      lift: new THREE.Vector3(0.012, 0.022, 0.03),
      gain: new THREE.Vector3(1.02, 1.0, 0.97),
      focus: 20,
      aperture: 6.5,
      maxCoc: 9,
    };
  }

  _buildPasses() {
    const q = this.q;
    const panes = Object.values(CAR.panes);
    const paneCorners = [];
    const paneInfo = [];
    panes.forEach((p) => {
      p.corners.forEach((c) => paneCorners.push(new THREE.Vector3(...c)));
      paneInfo.push(new THREE.Vector4(p.flow[0], p.flow[1], p.wipers ? 1 : 0, 1));
    });
    const ws = CAR.panes.windshield.corners.map((c) => new THREE.Vector3(...c));
    const ax = ws[1].clone().sub(ws[0]).normalize();
    const up = ws[3].clone().sub(ws[0]);
    up.sub(ax.clone().multiplyScalar(up.dot(ax))).normalize();

    const common = () => ({
      uProjInv: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
    });

    this.fog = new Pass(S.FOG_FRAG, {
      ...common(),
      tDepth: { value: null },
      tNoise: { value: fogNoise3D(64) },
      uCarInv: { value: new THREE.Matrix4() },
      uCabinMin: { value: new THREE.Vector3(...CAR.cabinMin) },
      uCabinMax: { value: new THREE.Vector3(...CAR.cabinMax) },
      uTime: U.uTime,
      uFrame: { value: 0 },
      uSteps: { value: q.fogSteps },
      uMaxDist: { value: 220 },
      uDensity: { value: 0.012 },
      uHeightFall: { value: 0.09 },
      uGroundY: { value: 0 },
      uNoiseAmt: { value: 0.7 },
      uWindOffset: { value: new THREE.Vector3() },
      uBankDensity: { value: 0 },
      uBankCenter: { value: new THREE.Vector3() },
      uBankFwd: { value: new THREE.Vector3(0, 0, -1) },
      uBankRight: { value: new THREE.Vector3(1, 0, 0) },
      uBankSize: { value: new THREE.Vector3(40, 10, 20) },
      uHeadPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
      uHeadMatrix: { value: [new THREE.Matrix4(), new THREE.Matrix4()] },
      tHeadPattern: { value: headlightPattern() },
      uHeadColor: { value: new THREE.Vector3() },
      tHeadShadow: { value: null },
      uHeadShadowOn: { value: 0 },
      uMoonDir: { value: new THREE.Vector3() },
      uMoonColor: { value: new THREE.Vector3() },
      uMoonLightDir: { value: new THREE.Vector3() },
      uMoonMatrix: { value: new THREE.Matrix4() },
      tMoonShadow: { value: null },
      uMoonShadowOn: { value: 0 },
      uAmbient: { value: new THREE.Vector3(0.002, 0.003, 0.005) },
      uLampPos: { value: this.lights.fogLamps.pos },
      uLampCol: { value: this.lights.fogLamps.col },
      uLampDir: { value: this.lights.fogLamps.dir },
    });
    void MAX_FOG_LAMPS;

    this.comp = new Pass(S.COMPOSITE_FRAG, {
      ...common(),
      tScene: { value: null },
      tFog: { value: null },
      tDepth: { value: null },
      tWipe: { value: this.car.wipers.texture },
      uFogSize: { value: new THREE.Vector2(1, 1) },
      uCarInv: { value: new THREE.Matrix4() },
      uCarWorld: { value: new THREE.Matrix4() },
      uViewProj: { value: new THREE.Matrix4() },
      uPane: { value: paneCorners },
      uPaneInfo: { value: paneInfo },
      uWiperPivot: { value: CAR.wipers.map((w) => new THREE.Vector3(...w.pivot)) },
      uWiperLen: { value: new THREE.Vector2(CAR.wipers[0].length, CAR.wipers[1].length) },
      uWiperMax: { value: new THREE.Vector2(CAR.wipers[0].max, CAR.wipers[1].max) },
      uGlassUp: { value: up },
      uTime: U.uTime,
      uRain: U.uRain,
      uSpeed: { value: 0 },
      uWetGlass: { value: 1 },
      uDashReflect: { value: 0.35 },
      uSkyRefl: { value: new THREE.Vector3(0.004, 0.005, 0.008) },
    });

    this.dof = new Pass(S.DOF_FRAG, {
      ...common(),
      tColor: { value: null },
      tDepth: { value: null },
      uFocus: { value: 20 },
      uAperture: { value: 3 },
      uMaxCoc: { value: 5 },
      uPixel: { value: new THREE.Vector2() },
    });

    this.down = new Pass(S.BLOOM_DOWN_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uFirst: { value: 0 },
    });
    this.up = new Pass(S.BLOOM_UP_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 1 },
    }, { blending: THREE.AdditiveBlending, transparent: true });

    this.final = new Pass(S.FINAL_FRAG, {
      ...common(),
      tComp: { value: null },
      tDof: { value: null },
      tBloom: { value: null },
      tDepth: { value: null },
      uDofOn: { value: q.dof ? 1 : 0 },
      uFocus: { value: 20 },
      uAperture: { value: 6 },
      uMaxCoc: { value: 9 },
      uBloom: { value: 0.1 },
      uGlassGlare: { value: 0.1 },
      uExposure: { value: 1.5 },
      uTime: U.uTime,
      uGrain: { value: 0.04 },
      uVignette: { value: 0.5 },
      uChroma: { value: 0.01 },
      uFade: { value: 0 },
      uSaturation: { value: 0.85 },
      uLetterbox: { value: 0 },
      uFlash: { value: 0 },
      uLift: { value: new THREE.Vector3() },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uRes: { value: new THREE.Vector2() },
    });
  }

  setSize(width, height) {
    width = Math.max(2, Math.floor(width));
    height = Math.max(2, Math.floor(height));
    if (width === this.width && height === this.height && this.sceneRT) return;
    this.width = width;
    this.height = height;
    this._disposeTargets();
    const q = this.q;
    const depthTexture = new THREE.DepthTexture(width, height, THREE.FloatType);
    depthTexture.format = THREE.DepthFormat;
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: q.msaa,
      depthBuffer: true,
      depthTexture,
    });
    if (q.reflection > 0) {
      this.reflRT = rt(Math.round(width * q.reflection), Math.round(height * q.reflection), {
        depthBuffer: true,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      });
      U.uReflTex.value = this.reflRT.texture;
    } else {
      if (!this._blackTex) {
        this._blackTex = new THREE.DataTexture(new Uint8Array([2, 3, 5, 255]), 1, 1);
        this._blackTex.needsUpdate = true;
      }
      U.uReflTex.value = this._blackTex;
    }
    const fw = Math.round(width * q.fogScale);
    const fh = Math.round(height * q.fogScale);
    this.fogRT = rt(fw, fh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.compRT = rt(width, height, { minFilter: THREE.LinearFilter });
    if (q.dof) this.dofRT = rt(Math.round(width / 2), Math.round(height / 2), { minFilter: THREE.LinearFilter });
    this.bloomRTs = [];
    let bw = width;
    let bh = height;
    for (let i = 0; i < q.bloomLevels; i++) {
      bw = Math.max(1, Math.floor(bw / 2));
      bh = Math.max(1, Math.floor(bh / 2));
      this.bloomRTs.push(rt(bw, bh, { minFilter: THREE.LinearFilter }));
    }

    this.fog.u.tDepth.value = depthTexture;
    this.comp.u.tScene.value = this.sceneRT.texture;
    this.comp.u.tFog.value = this.fogRT.texture;
    this.comp.u.tDepth.value = depthTexture;
    this.comp.u.uFogSize.value.set(fw, fh);
    this.dof.u.tColor.value = this.compRT.texture;
    this.dof.u.tDepth.value = depthTexture;
    if (this.dofRT) this.dof.u.uPixel.value.set(1 / this.dofRT.width, 1 / this.dofRT.height);
    this.final.u.tComp.value = this.compRT.texture;
    this.final.u.tDof.value = this.dofRT ? this.dofRT.texture : this.compRT.texture;
    this.final.u.tBloom.value = this.bloomRTs[0].texture;
    this.final.u.tDepth.value = depthTexture;
    this.final.u.uRes.value.set(width, height);
  }

  _disposeTargets() {
    for (const t of [this.sceneRT, this.reflRT, this.fogRT, this.compRT, this.dofRT, ...(this.bloomRTs || [])]) {
      if (!t) continue;
      if (t.depthTexture) t.depthTexture.dispose();
      t.dispose();
    }
    this.sceneRT = this.reflRT = this.fogRT = this.compRT = this.dofRT = null;
  }

  dispose() {
    this._disposeTargets();
  }

  /** Mirror the camera about the horizontal plane y = planeY (Reflector maths). */
  _renderReflection(planeY) {
    const renderer = this.renderer;
    const camera = this.camera;
    const rc = this.reflCam;
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const normal = new THREE.Vector3(0, 1, 0);
    const reflPos = new THREE.Vector3(camPos.x, planeY, camPos.z);
    if (camPos.y <= planeY) return;
    const view = reflPos.clone().sub(camPos).reflect(normal).negate().add(reflPos);
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const lookAt = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = reflPos.clone().sub(lookAt).reflect(normal).negate().add(reflPos);
    rc.position.copy(view);
    rc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    rc.lookAt(target);
    rc.far = camera.far;
    rc.near = camera.near;
    rc.updateMatrixWorld();
    rc.projectionMatrix.copy(camera.projectionMatrix);
    this.reflMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.reflMatrix.multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
    // Oblique near plane = the water surface.
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, reflPos);
    plane.applyMatrix4(rc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = rc.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + P.elements[8]) / P.elements[0],
      (Math.sign(clip.y) + P.elements[9]) / P.elements[5],
      -1,
      (1 + P.elements[10]) / P.elements[14],
    );
    clip.multiplyScalar(2 / clip.dot(q));
    P.elements[2] = clip.x;
    P.elements[6] = clip.y;
    P.elements[10] = clip.z + 1 - 0.003;
    P.elements[14] = clip.w;
    rc.projectionMatrixInverse.copy(P).invert();

    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.reflRT);
    renderer.clear();
    renderer.render(this.scene, rc);
    renderer.shadowMap.autoUpdate = prevShadow;
  }

  render(ctx) {
    const { renderer, scene, camera, q } = this;
    const L = this.look;
    this.frame++;
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();

    // Shadows once, before any of the views.
    renderer.shadowMap.needsUpdate = true;

    if (this.reflRT) this._renderReflection(ctx.groundY + 0.02);
    if (q.mirror) {
      const eye = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
      if (this.frame % 2 === 0 || this.frame < 3) this.car.mirror.render(renderer, scene, eye);
    }

    renderer.setRenderTarget(this.sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    // Shared camera uniforms.
    for (const p of [this.fog, this.comp, this.dof, this.final]) {
      p.u.uProjInv.value.copy(camera.projectionMatrixInverse);
      p.u.uCamWorld.value.copy(camera.matrixWorld);
      p.u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    }
    const carWorld = this.car.group.matrixWorld;
    const carInv = new THREE.Matrix4().copy(carWorld).invert();

    // Volumetric fog.
    const f = this.fog.u;
    const env = ctx.fog;
    f.uFrame.value = this.frame % 64;
    f.uCarInv.value.copy(carInv);
    f.uDensity.value = env.density;
    f.uHeightFall.value = env.heightFall;
    f.uGroundY.value = ctx.groundY;
    f.uNoiseAmt.value = env.noise;
    f.uWindOffset.value.copy(env.windOffset);
    f.uMaxDist.value = env.maxDist;
    f.uBankDensity.value = env.bank.density;
    if (env.bank.density > 0) {
      f.uBankCenter.value.copy(env.bank.center);
      f.uBankFwd.value.copy(env.bank.fwd);
      f.uBankRight.value.copy(env.bank.right);
      f.uBankSize.value.copy(env.bank.size);
    }
    const hl = this.car.headlights;
    hl.forEach((light, i) => {
      f.uHeadPos.value[i].setFromMatrixPosition(light.matrixWorld);
      f.uHeadMatrix.value[i].copy(light.shadow.matrix);
    });
    const hi = hl[0].intensity * env.headScatter;
    f.uHeadColor.value.set(hl[0].color.r * hi, hl[0].color.g * hi, hl[0].color.b * hi);
    const hs = hl[0].castShadow && hl[0].shadow.map ? hl[0].shadow.map.depthTexture : null;
    f.tHeadShadow.value = hs;
    f.uHeadShadowOn.value = hs && q.fogShadows ? 1 : 0;
    const moon = this.lights.moon;
    f.uMoonDir.value.copy(ctx.moonDir);
    const mi = moon.intensity * env.moonScatter;
    f.uMoonColor.value.set(moon.color.r * mi, moon.color.g * mi, moon.color.b * mi);
    const ms = moon.castShadow && moon.shadow.map ? moon.shadow.map.depthTexture : null;
    f.tMoonShadow.value = ms;
    f.uMoonShadowOn.value = ms && q.fogShadows ? 1 : 0;
    if (ms) f.uMoonMatrix.value.copy(moon.shadow.matrix);
    f.uAmbient.value.copy(env.ambient);
    this.fog.render(renderer, this.fogRT);

    // Composite with glass.
    const c = this.comp.u;
    c.uCarInv.value.copy(carInv);
    c.uCarWorld.value.copy(carWorld);
    c.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    c.uSpeed.value = ctx.speed;
    c.uWetGlass.value = ctx.wetGlass;
    c.uDashReflect.value = ctx.dashReflect;
    this.comp.render(renderer, this.compRT);

    // Depth of field.
    const scale = this.height / 1080;
    if (this.dofRT) {
      this.dof.u.uFocus.value = L.focus;
      this.dof.u.uAperture.value = L.aperture * scale * 0.5;
      this.dof.u.uMaxCoc.value = Math.max(1, L.maxCoc * scale * 0.5);
      this.dof.render(renderer, this.dofRT);
    }

    // Bloom.
    const levels = this.bloomRTs;
    let src = this.compRT;
    for (let i = 0; i < levels.length; i++) {
      this.down.u.tSrc.value = src.texture;
      this.down.u.uTexel.value.set(1 / src.width, 1 / src.height);
      this.down.u.uFirst.value = i === 0 ? 1 : 0;
      this.down.render(renderer, levels[i]);
      src = levels[i];
    }
    renderer.autoClear = false;
    for (let i = levels.length - 1; i > 0; i--) {
      this.up.u.tSrc.value = levels[i].texture;
      this.up.u.uTexel.value.set(1 / levels[i].width, 1 / levels[i].height);
      this.up.render(renderer, levels[i - 1], false);
    }
    renderer.autoClear = true;

    // Final grade to the screen.
    const fu = this.final.u;
    fu.uFocus.value = L.focus;
    fu.uAperture.value = L.aperture * scale;
    fu.uMaxCoc.value = L.maxCoc * scale;
    fu.uBloom.value = L.bloom;
    fu.uGlassGlare.value = L.glassGlare;
    fu.uExposure.value = L.exposure;
    fu.uGrain.value = L.grain;
    fu.uVignette.value = L.vignette;
    fu.uChroma.value = L.chroma;
    fu.uFade.value = L.fade;
    fu.uSaturation.value = L.saturation;
    fu.uLetterbox.value = L.letterbox;
    fu.uFlash.value = L.flash;
    fu.uLift.value.copy(L.lift);
    fu.uGain.value.copy(L.gain);
    this.final.render(renderer, null);
  }
}
