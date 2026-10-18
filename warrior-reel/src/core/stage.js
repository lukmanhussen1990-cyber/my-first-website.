// Renderer + post-processing stage shared by the film and by test scenes.
// The page exposes window.APP with a deterministic renderAt(t) used by the headless renderer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Final colour grade: warmth, saturation, lift, vignette, gentle film grain (deterministic by frame).
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uWarm: { value: 0.0 },       // -1 cool .. +1 warm
    uSat: { value: 1.08 },
    uContrast: { value: 1.0 },
    uLift: { value: 0.0 },
    uVignette: { value: 0.28 },
    uGrain: { value: 0.018 },
    uFrame: { value: 0 },
    uFade: { value: 0.0 },       // 0 = picture, 1 = black
    uFadeColor: { value: new THREE.Color(0, 0, 0) },
    uAspect: { value: 9 / 16 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uWarm, uSat, uContrast, uLift, uVignette, uGrain, uFrame, uFade, uAspect;
    uniform vec3 uFadeColor;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32 + uFrame * 0.618); return fract(p.x * p.y); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col *= vec3(1.0 + 0.06 * uWarm, 1.0 + 0.01 * uWarm, 1.0 - 0.07 * uWarm);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5 + uLift;
      vec2 q = vUv - 0.5; q.x *= uAspect / 0.5625;
      float v = smoothstep(0.85, 0.25, length(q * vec2(1.0, 0.92)));
      col *= mix(1.0 - uVignette, 1.0, v);
      col += (hash(vUv * 1000.0) - 0.5) * uGrain;
      col = mix(col, uFadeColor, uFade);
      gl_FragColor = vec4(col, c.a);
    }`,
};

export class Stage {
  constructor({ width = 1080, height = 1920, bloom = true, msaa = 4, pixelRatio = 1 } = {}) {
    this.width = width; this.height = height;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 600);

    const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: msaa });
    const composer = (this.composer = new EffectComposer(renderer, rt));
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);
    if (bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.22, 0.6, 0.92);
      composer.addPass(this.bloom);
    }
    this.output = new OutputPass();
    composer.addPass(this.output);
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.uAspect.value = width / height;
    composer.addPass(this.grade);
  }

  render(frameIndex = 0) {
    this.grade.uniforms.uFrame.value = frameIndex % 97;
    this.composer.render();
  }

  // Read back the final frame as RGBA bytes (bottom-up rows, as WebGL returns them).
  readPixels() {
    const gl = this.renderer.getContext();
    const px = new Uint8Array(this.width * this.height * 4);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }
}

// Build a PMREM environment map from a simple gradient sky scene, for metal reflections.
export function makeEnvMap(renderer, { top = 0x7fb6ff, horizon = 0xf2f4f8, ground = 0x8fbf3a, sun = null } = {}) {
  const envScene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, ground: { value: new THREE.Color(ground) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top, horizon, ground; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0. ? mix(horizon, top, pow(h, .6)) : mix(horizon, ground, pow(-h, .35));
      gl_FragColor = vec4(c, 1.); }`,
  });
  envScene.add(new THREE.Mesh(geo, mat));
  if (sun) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(sun.color).multiplyScalar(sun.intensity || 6) }));
    s.position.copy(new THREE.Vector3(...sun.dir).normalize().multiplyScalar(40));
    envScene.add(s);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  return rt.texture;
}
