// Compact HDR post pipeline: MSAA scene -> bloom (dual filter) + light DOF ->
// ACES filmic tone mapping, chromatic aberration (scares only), vignette, film grain.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uKnee, uUseThreshold; varying vec2 vUv;
vec3 s(vec2 o){ return min(texture2D(tSrc, vUv + o*uTexel).rgb, vec3(64.0)); }
void main(){
  vec3 A=s(vec2(-2,-2)),B=s(vec2(0,-2)),C=s(vec2(2,-2)),D=s(vec2(-1,-1)),E=s(vec2(1,-1)),F=s(vec2(-2,0)),G=s(vec2(0,0)),
       H=s(vec2(2,0)),I=s(vec2(-1,1)),J=s(vec2(1,1)),K=s(vec2(-2,2)),L=s(vec2(0,2)),M=s(vec2(2,2));
  vec3 c = (D+E+I+J)*0.125 + (A+B+G+F)*0.03125 + (B+C+H+G)*0.03125 + (F+G+L+K)*0.03125 + (G+H+M+L)*0.03125;
  if (uUseThreshold > 0.5) {
    float br = max(c.r, max(c.g, c.b));
    float rq = clamp(br - uThreshold + uKnee, 0., 2.*uKnee); rq = rq*rq/(4.*uKnee + 1e-4);
    c *= max(rq, br - uThreshold) / max(br, 1e-4);
  }
  gl_FragColor = vec4(c, 1.);
}`;

const BOX = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv + uTexel*vec2(-0.5,-0.5)).rgb + texture2D(tSrc, vUv + uTexel*vec2(0.5,-0.5)).rgb
         + texture2D(tSrc, vUv + uTexel*vec2(-0.5,0.5)).rgb + texture2D(tSrc, vUv + uTexel*vec2(0.5,0.5)).rgb;
  gl_FragColor = vec4(min(c*0.25, vec3(64.0)), 1.);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius, uGain; varying vec2 vUv;
void main(){
  vec4 d = uTexel.xyxy * vec4(1., 1., -1., 0.) * uRadius;
  vec3 s = texture2D(tSrc, vUv - d.xy).rgb + texture2D(tSrc, vUv - d.wy).rgb*2. + texture2D(tSrc, vUv - d.zy).rgb
         + texture2D(tSrc, vUv + d.zw).rgb*2. + texture2D(tSrc, vUv).rgb*4. + texture2D(tSrc, vUv + d.xw).rgb*2.
         + texture2D(tSrc, vUv + d.zy).rgb + texture2D(tSrc, vUv + d.wy).rgb*2. + texture2D(tSrc, vUv + d.xy).rgb;
  gl_FragColor = vec4(s / 16. * uGain, 1.);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tScene, tDepth, tBloom, tDofQ, tDofE;
uniform vec2 uRes; uniform float uBloom, uExposure, uVignette, uGrain, uCA, uFade, uFlash, uFrame;
uniform float uFocus, uFocusRange, uMaxBlur, uNearBlur, uNear, uFar, uSat, uContrast;
uniform vec3 uFlashColor, uShadowTint, uLift;
varying vec2 vUv;
float viewZ(float d){ return (uNear*uFar) / ((uFar-uNear)*d - uFar); }
vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v + 0.0245786) - 0.000090537; vec3 b = v*(0.983729*v + 0.4329510) + 0.238081; return a/b; }
vec3 aces(vec3 color){
  const mat3 ACESInputMat = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
  color *= 1.0/0.6; color = ACESInputMat*color; color = RRTAndODTFit(color); color = ACESOutputMat*color; return clamp(color, 0., 1.);
}
vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - 0.055, step(0.0031308, c)); }
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv = vUv;
  vec2 dir = uv - 0.5;
  vec3 col;
  if (uCA > 0.0) {
    vec2 off = dir * uCA * (0.3 + dot(dir,dir)*2.0);
    col = vec3(texture2D(tScene, uv - off).r, texture2D(tScene, uv).g, texture2D(tScene, uv + off).b);
  } else col = texture2D(tScene, uv).rgb;
  if (uMaxBlur > 0.0) {
    float z = -viewZ(texture2D(tDepth, uv).r);
    float coc = z < uFocus ? (uFocus - z) / uFocusRange * uNearBlur : (z - uFocus) / uFocusRange;
    coc = clamp(coc, 0., 1.) * uMaxBlur;
    vec3 q = texture2D(tDofQ, uv).rgb, e = texture2D(tDofE, uv).rgb;
    col = mix(col, mix(q, e, smoothstep(0.45, 1.0, coc)), smoothstep(0.0, 0.45, coc));
  }
  col += texture2D(tBloom, uv).rgb * uBloom;
  col = col * uExposure + uLift;
  col = aces(col);
  // gentle grade: cool shadows, saturation, contrast
  float l = dot(col, vec3(0.2126,0.7152,0.0722));
  col += uShadowTint * (1.0 - smoothstep(0.0, 0.35, l)) * 0.06;
  col = mix(vec3(l), col, uSat);
  col = toSRGB(col);
  col = (col - 0.5) * uContrast + 0.5;
  float v = smoothstep(0.95, 0.25, length(dir * vec2(1.0, 0.82)) * 1.15);
  col *= mix(1.0 - uVignette, 1.0, v);
  vec2 gp = floor(uv * uRes * 0.5);                 // 2x2-pixel grain clusters: filmic and far easier to encode
  float g = h(gp + vec2(uFrame*17.31, uFrame*7.77)) + h(floor(gp*0.5) + vec2(uFrame*3.1, uFrame*11.3)) * 0.6 - 0.8;
  float lum = dot(col, vec3(0.299,0.587,0.114));
  col += g * uGrain * (1.0 - 0.65*lum);
  col = mix(col, uFlashColor, uFlash);
  col *= 1.0 - uFade;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer;
    this.W = W;
    this.H = H;
    const depthTexture = new THREE.DepthTexture(W, H);
    depthTexture.type = THREE.FloatType;
    this.rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture, depthBuffer: true });
    const mk = (w, h) => new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
      type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    this.rtHalf = mk(W / 2, H / 2);
    this.chain = [mk(W / 4, H / 4), mk(W / 8, H / 8), mk(W / 16, H / 16), mk(W / 32, H / 32), mk(W / 64, H / 64), mk(W / 128, H / 128)];
    this.rtDofQ = mk(W / 4, H / 4);
    this.rtDofE = mk(W / 8, H / 8);
    this.rtOut = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sm = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.mBox = sm(BOX, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mDown = sm(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uUseThreshold: { value: 0 } });
    this.mUp = sm(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uGain: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.mFinal = sm(FINAL, {
      tScene: { value: this.rtScene.texture }, tDepth: { value: depthTexture }, tBloom: { value: this.chain[0].texture },
      tDofQ: { value: this.rtDofQ.texture }, tDofE: { value: this.rtDofE.texture },
      uRes: { value: new THREE.Vector2(W, H) }, uBloom: { value: 0.6 }, uExposure: { value: 1 }, uVignette: { value: 0.5 },
      uGrain: { value: 0.05 }, uCA: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 }, uFrame: { value: 0 },
      uFocus: { value: 5 }, uFocusRange: { value: 3 }, uMaxBlur: { value: 0 }, uNearBlur: { value: 1 }, uNear: { value: 0.1 }, uFar: { value: 1000 },
      uSat: { value: 1 }, uContrast: { value: 1.04 }, uFlashColor: { value: new THREE.Vector3(1, 1, 1) },
      uShadowTint: { value: new THREE.Vector3(0.0, 0.25, 0.6) }, uLift: { value: new THREE.Vector3(0, 0, 0) },
    });
    this.p = {
      bloom: 0.55, threshold: 1.0, knee: 0.6, exposure: 1, vignette: 0.5, grain: 0.05, ca: 0, fade: 0, flash: 0,
      flashColor: [1, 1, 1], focus: 5, focusRange: 3, maxBlur: 0, nearBlur: 1, sat: 1, contrast: 1.04, lift: [0, 0, 0],
      shadowTint: [0.0, 0.25, 0.6],
    };
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qScene, this.qCam);
  }

  render(scene, camera, frame) {
    const r = this.r, p = this.p;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);
    // full -> half
    this.mBox.uniforms.tSrc.value = this.rtScene.texture;
    this.mBox.uniforms.uTexel.value.set(1 / this.W, 1 / this.H);
    this.pass(this.mBox, this.rtHalf);
    // DOF sources
    if (p.maxBlur > 0) {
      this.down(this.rtHalf, this.rtDofQ, false);
      this.down(this.rtDofQ, this.rtDofE, false);
    }
    // bloom chain
    this.down(this.rtHalf, this.chain[0], true);
    for (let i = 1; i < this.chain.length; i++) this.down(this.chain[i - 1], this.chain[i], false);
    r.autoClear = false;
    for (let i = this.chain.length - 1; i > 0; i--) {
      const src = this.chain[i];
      this.mUp.uniforms.tSrc.value = src.texture;
      this.mUp.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.mUp.uniforms.uGain.value = 1.0;
      this.pass(this.mUp, this.chain[i - 1]);
    }
    r.autoClear = true;
    const u = this.mFinal.uniforms;
    u.uBloom.value = p.bloom;
    u.uExposure.value = p.exposure;
    u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain;
    u.uCA.value = p.ca;
    u.uFade.value = p.fade;
    u.uFlash.value = p.flash;
    u.uFlashColor.value.fromArray(p.flashColor);
    u.uFrame.value = frame;
    u.uFocus.value = p.focus;
    u.uFocusRange.value = p.focusRange;
    u.uMaxBlur.value = p.maxBlur;
    u.uNearBlur.value = p.nearBlur;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uSat.value = p.sat;
    u.uContrast.value = p.contrast;
    u.uLift.value.fromArray(p.lift);
    u.uShadowTint.value.fromArray(p.shadowTint);
    this.pass(this.mFinal, this.rtOut);
  }

  down(src, dst, threshold) {
    const u = this.mDown.uniforms;
    u.tSrc.value = src.texture;
    u.uTexel.value.set(1 / src.width, 1 / src.height);
    u.uUseThreshold.value = threshold ? 1 : 0;
    u.uThreshold.value = this.p.threshold;
    u.uKnee.value = this.p.knee;
    this.pass(this.mDown, dst);
  }

  readPixels(buf) {
    this.r.readRenderTargetPixels(this.rtOut, 0, 0, this.W, this.H, buf);
  }
}
