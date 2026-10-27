// Stage: renderer + post-processing + lighting rig + sky + frame readback.
// One "look" object describes the whole lighting mood (sky, sun/moon, fill, rim, fog, bloom, grade)
// and looks can be blended, e.g. golden hour -> dusk -> night.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { lerp } from './anim.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, saturation: { value: 1.08 }, contrast: { value: 1.04 },
    lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) },
    vignette: { value: 0.22 }, aspect: { value: 0.5625 }, flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) },
    fade: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation, contrast, vignette, aspect, flash, fade;
    uniform vec3 lift, gain, flashColor; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col = col * gain + lift * (1.0 - col);
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0) * 1.6;
      col *= 1.0 - vignette * smoothstep(0.25, 1.05, dot(d, d));
      col = mix(col, flashColor, flash);
      col *= 1.0 - fade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

const SkyShader = {
  uniforms: {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    ground: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.2, -1) }, sunColor: { value: new THREE.Color() },
    sunGlow: { value: 0.0 }, sunSize: { value: 0.0 },
  },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
  fragmentShader: `
    uniform vec3 top, mid, horizon, ground, sunColor, sunDir; uniform float sunGlow, sunSize; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = h > 0.0 ? mix(horizon, mid, smoothstep(0.0, 0.18, h)) : mix(horizon, ground, smoothstep(0.0, -0.08, h));
      col = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.65, h)) : col;
      float s = max(0.0, dot(d, normalize(sunDir)));
      col += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6) * sunGlow;
      col += sunColor * smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.8, s) * 4.0;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
};

export class Stage {
  constructor({ width = 1080, height = 1920, quality = 'high', toneMapping = 'neutral' } = {}) {
    this.W = width; this.H = height; this.quality = quality;
    const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.setSize(width, height);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = { agx: THREE.AgXToneMapping, aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping }[toneMapping]; r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.05, 900);
    this.scene.add(this.camera);

    // ---- lights ----
    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = true;
    const sm = quality === 'high' ? 4096 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.025; this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#bcd4ff', '#5a7a3a', 1.2);
    this.scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight('#ffffff', 0.4);       // soft light from the camera side: faces stay readable
    this.camera.add(this.fill); this.fill.position.set(0.3, 0.5, 1); this.fill.target.position.set(0, 0, -5); this.camera.add(this.fill.target);
    this.rim = new THREE.DirectionalLight('#ffffff', 0.6);         // back light for silhouettes
    this.scene.add(this.rim, this.rim.target);

    // ---- sky ----
    const skyMat = new THREE.ShaderMaterial({ ...SkyShader, uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms), side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog('#cfe0ff', 60, 400);

    // ---- post ----
    const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: quality === 'draft' ? 0 : 4 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.gtao = new GTAOPass(this.scene, this.camera, width, height);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 1.0;
    this.gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: quality === 'draft' ? 8 : 16, distanceFallOff: 1.0 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    // objects flagged userData.noAO (glows, fog sprites, the see-through ghost) are skipped by AO
    const gtaoRender = this.gtao.render.bind(this.gtao);
    this.gtao.render = (...args) => {
      const hidden = [];
      this.scene.traverse((o) => { if (o.visible && o.userData.noAO) { o.visible = false; hidden.push(o); } });
      this.sky.visible = false;
      gtaoRender(...args);
      this.sky.visible = true;
      hidden.forEach((o) => { o.visible = true; });
    };
    this.composer.addPass(this.gtao);
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 3, aperture: 0.004, maxblur: 0.008 });
    this.bokeh.enabled = false;
    this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.aspect.value = width / height;
    this.composer.addPass(this.grade);

    this.pixels = new Uint8Array(width * height * 4);
    this.accum = null;
  }

  // ---- look (lighting mood) ----
  applyLook(L) {
    const S = this.sky.material.uniforms;
    S.top.value.set(L.sky.top); S.mid.value.set(L.sky.mid); S.horizon.value.set(L.sky.horizon); S.ground.value.set(L.sky.ground || L.sky.horizon);
    S.sunColor.value.set(L.sky.sunColor || L.sun.color); S.sunGlow.value = L.sky.sunGlow ?? 0; S.sunSize.value = L.sky.sunSize ?? 0;
    S.sunDir.value.set(...L.sun.dir).normalize();
    this.sun.color.set(L.sun.color); this.sun.intensity = L.sun.intensity;
    this.sunDir = new THREE.Vector3(...L.sun.dir).normalize();
    this.hemi.color.set(L.hemi.sky); this.hemi.groundColor.set(L.hemi.ground); this.hemi.intensity = L.hemi.intensity;
    this.fill.color.set(L.fill.color); this.fill.intensity = L.fill.intensity;
    this.rim.color.set(L.rim.color); this.rim.intensity = L.rim.intensity;
    this.rimDir = new THREE.Vector3(...L.rim.dir).normalize();
    this.scene.fog.color.set(L.fog.color); this.scene.fog.near = L.fog.near; this.scene.fog.far = L.fog.far;
    this.renderer.toneMappingExposure = L.exposure ?? 1;
    this.bloom.strength = L.bloom.strength; this.bloom.radius = L.bloom.radius; this.bloom.threshold = L.bloom.threshold;
    const G = this.grade.uniforms;
    G.saturation.value = L.grade.saturation; G.contrast.value = L.grade.contrast; G.vignette.value = L.grade.vignette;
    G.lift.value.set(L.grade.lift || '#000000'); G.gain.value.set(L.grade.gain || '#ffffff');
    this.look = L;
  }

  // Aim the sun/moon shadow camera at the area the shot looks at.
  setShadowFocus(center, radius = 8) {
    const c = new THREE.Vector3(...center);
    const d = (this.sunDir || new THREE.Vector3(0.5, 1, 0.3)).clone();
    this.sun.position.copy(c).addScaledVector(d, 40);
    this.sun.target.position.copy(c);
    const cam = this.sun.shadow.camera;
    cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius; cam.near = 1; cam.far = 90;
    cam.updateProjectionMatrix();
    this.rim.position.copy(c).addScaledVector(this.rimDir || new THREE.Vector3(0, 1, -1), 30);
    this.rim.target.position.copy(c);
  }

  setDOF(on, focus = 3, aperture = 0.004, maxblur = 0.008) {
    this.bokeh.enabled = on;
    if (on) { const u = this.bokeh.uniforms; u.focus.value = focus; u.aperture.value = aperture; u.maxblur.value = maxblur; }
  }

  // Render the current scene state into this.pixels. `subframes` is an array of callbacks that pose the
  // scene at sub-frame times: their average gives true motion blur.
  renderNow(subframes = null) {
    const gl = this.renderer.getContext();
    if (!subframes || subframes.length <= 1) {
      if (subframes) subframes[0]();
      this.composer.render();
      gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
      return;
    }
    if (!this.accum) this.accum = new Float32Array(this.W * this.H * 4);
    this.accum.fill(0);
    for (const pose of subframes) {
      pose();
      this.composer.render();
      gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
      const a = this.accum, p = this.pixels;
      for (let i = 0; i < a.length; i++) a[i] += p[i];
    }
    const n = subframes.length, a = this.accum, p = this.pixels;
    for (let i = 0; i < a.length; i++) p[i] = a[i] / n + 0.5;
  }

  async sendPixels(frame) {
    await fetch(`/sink?kind=frame&f=${frame}`, { method: 'POST', body: this.pixels });
  }

  async toPNGBlob() {
    const c = document.createElement('canvas'); c.width = this.W; c.height = this.H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.W, this.H);
    const row = this.W * 4;
    for (let y = 0; y < this.H; y++) img.data.set(this.pixels.subarray((this.H - 1 - y) * row, (this.H - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    return await new Promise((res) => c.toBlob(res, 'image/png'));
  }
  async sendPNG(relPath) {
    const blob = await this.toPNGBlob();
    await fetch(`/sink?kind=file&path=${encodeURIComponent(relPath)}`, { method: 'POST', body: blob });
  }
}

// Blend two looks (numbers lerp, colours mix).
export function blendLook(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const mix = (x, y) => {
    if (typeof x === 'number') return lerp(x, y, t);
    if (typeof x === 'string' && x.startsWith('#')) return '#' + new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString();
    if (Array.isArray(x)) return x.map((v, i) => lerp(v, y[i], t));
    if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = k in y ? mix(x[k], y[k]) : x[k]; return o; }
    return t < 0.5 ? x : y;
  };
  return mix(a, b);
}
