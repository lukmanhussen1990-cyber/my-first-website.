// Renderer + post-processing + frame API used by tools/render_frames.mjs.
//   await window.reelInit()            build everything
//   await window.renderFrame(frame)     render one frame (deterministic, any order)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { G, setAnisotropy, texturesLoaded } from './lib/materials.js';
import { makeProfileTexture } from './world/geo.js';
import { buildWorld } from './world/world.js';
import { buildTunnel } from './world/tunnel.js';
import { initMachineMaterials, buildExcavator, buildBulldozer, buildDumpTruck, buildTBM } from './props/machines.js';
import { buildCar, CAR_L } from './props/train.js';
import { buildJohn } from './props/characters.js';
import { buildParticles } from './fx/particles.js';
import { createTimeline } from './anim/timeline.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);
const FPS = 30;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 1.08 }, uLift: { value: new THREE.Vector3(0.012, 0.006, 0.0) }, uGain: { value: new THREE.Vector3(1.02, 1.0, 0.97) }, uAspect: { value: W / H }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVig, uSat, uAspect, uFade; uniform vec3 uLift, uGain; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = col * uGain + uLift * (1.0 - col);
      vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0) * 1.15;
      float v = smoothstep(0.85, 0.2, length(d));
      col *= mix(1.0 - uVig, 1.0, v);
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, c.a);
    }`,
};

const AccumShader = {
  uniforms: { tDiffuse: { value: null }, uWeight: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uWeight; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv) * uWeight; }',
};

async function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;
  document.body.appendChild(renderer.domElement);
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 1, 2); // enables the custom height-fog chunks
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 9000);

  // lights
  const sun = new THREE.DirectionalLight(0xffd2a1, 3.2);
  sun.castShadow = true;
  const sm = +(params.get('shadow') || 2048); sun.shadow.mapSize.set(sm, sm);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9fb8ff, 0.55);
  scene.add(fill, fill.target);
  const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x6b4a32, 0.65);
  scene.add(hemi);
  const points = [0, 1, 2].map(() => { const p = new THREE.PointLight(0xffd9a8, 0, 18, 1.6); scene.add(p); return p; });

  const profileTex = makeProfileTexture();
  const world = buildWorld(scene, profileTex);
  const tunnel = buildTunnel(scene, profileTex);
  initMachineMaterials();
  const exc = buildExcavator(), doz = buildBulldozer(), truck1 = buildDumpTruck(), truck2 = buildDumpTruck(), tbm = buildTBM(), exc2 = buildExcavator();
  for (const m of [exc, doz, truck1, truck2, tbm, exc2]) scene.add(m.root);
  const kinds = ['lead', 'snack', 'sleep', 'cinema'];
  const cars = kinds.map((k) => { const c = buildCar(k, { johnWindow: k === 'lead' ? 0 : -1 }); scene.add(c); return c; });
  const shuttle = buildCar('shuttle', { L: 6.2 }); scene.add(shuttle);
  const john = buildJohn({ old: false }); scene.add(john.root);
  const oldJohn = buildJohn({ old: true }); scene.add(oldJohn.root);
  const fx = buildParticles(scene);

  // environment light from the sky (soft bounce + reflections)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyClone = world.sky.clone(); envScene.add(skyClone);
  const ground = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5c4a36, side: THREE.BackSide }));
  envScene.add(ground);
  G.uSunDir.value.set(0.62, 0.22, 0.75).normalize();
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;

  await texturesLoaded();

  // post-processing
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.renderToScreen = false;
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, W, H);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  if (!params.get('noao')) composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.5, 0.45, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new SMAAPass(W, H));

  // accumulation for sub-frame motion blur
  const accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const accScene = new THREE.Scene(), accCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const accMat = new THREE.ShaderMaterial({ ...AccumShader, uniforms: THREE.UniformsUtils.clone(AccumShader.uniforms), blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, depthTest: false, depthWrite: false, transparent: true });
  const accQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat); accScene.add(accQuad);
  const blitMat = new THREE.ShaderMaterial({ ...AccumShader, uniforms: THREE.UniformsUtils.clone(AccumShader.uniforms), depthTest: false, depthWrite: false });
  const blitScene = new THREE.Scene(); blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));

  const TL = await (await fetch('/timeline.json')).json();
  let VOICE = null;
  try { VOICE = await (await fetch('/voices/timings.json')).json(); } catch (e) { VOICE = null; }
  const ctx = { TL, VOICE, THREE, renderer, scene, camera, sun, fill, hemi, points, world, tunnel, exc, exc2, doz, truck1, truck2, tbm, cars, shuttle, john, oldJohn, fx, gtao, bloom, grade, CAR_L };
  const timeline = createTimeline(ctx);

  const snapV = new THREE.Vector3();
  function fitShadow(focus, extent) {
    const dir = G.uSunDir.value;
    const cam = sun.shadow.camera;
    cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent;
    cam.near = 1; cam.far = extent * 2 + 400;
    // snap the focus to shadow-map texels in light space to avoid shimmering
    const texel = (2 * extent) / sun.shadow.mapSize.x;
    const lightRot = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), new THREE.Vector3(0, 1, 0));
    const inv = lightRot.clone().invert();
    snapV.copy(focus).applyMatrix4(inv);
    snapV.x = Math.round(snapV.x / texel) * texel; snapV.y = Math.round(snapV.y / texel) * texel;
    snapV.applyMatrix4(lightRot);
    sun.target.position.copy(snapV);
    sun.position.copy(snapV).addScaledVector(dir, extent + 200);
    cam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  }

  const dbgCam = params.get('cam') ? params.get('cam').split(',').map(Number) : null;
  const dbgLook = params.get('look') ? params.get('look').split(',').map(Number) : null;
  function setTime(t) {
    const st = timeline.apply(t);
    if (dbgCam) { camera.position.set(...dbgCam); camera.lookAt(...dbgLook); camera.fov = +(params.get('fov') || 40); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); st.focus.set(...dbgLook); st.shadowExtent = 40; }
    G.uTime.value = t;
    fill.position.set(-0.5, 0.6, 0.6).multiplyScalar(100).add(st.focus); fill.target.position.copy(st.focus);
    fitShadow(st.focus, st.shadowExtent);
    return st;
  }

  async function renderFrame(frame, subframes = 0) {
    const t = frame / FPS;
    const st0 = timeline.blurAt ? timeline.blurAt(t) : 0;
    const n = params.get('noblur') ? 1 : (subframes || (st0 > 0 ? st0 : 1));
    if (n <= 1) {
      setTime(t);
      composer.render();
      blitMat.uniforms.tDiffuse.value = composer.readBuffer.texture; blitMat.uniforms.uWeight.value = 1;
    } else {
      renderer.setRenderTarget(accRT); renderer.setClearColor(0x000000, 0); renderer.clear();
      for (let i = 0; i < n; i++) {
        const ti = t + ((i + 0.5) / n - 0.5) * (0.5 / FPS); // 180-degree shutter
        setTime(ti);
        composer.render();
        accMat.uniforms.tDiffuse.value = composer.readBuffer.texture; accMat.uniforms.uWeight.value = 1 / n;
        renderer.setRenderTarget(accRT); renderer.autoClear = false; renderer.render(accScene, accCam); renderer.autoClear = true;
      }
      blitMat.uniforms.tDiffuse.value = accRT.texture; blitMat.uniforms.uWeight.value = 1;
    }
    renderer.setRenderTarget(null);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.render(blitScene, accCam);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return n;
  }

  window.renderFrame = renderFrame;
  window.reelCtx = ctx;
  window.reelReady = true;
}

window.reelInit = init;
init().catch((e) => { console.error('INIT ERROR', e.stack || e); window.reelError = String(e.stack || e); });
