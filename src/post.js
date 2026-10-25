import * as THREE from 'three';

// Compositor: two MSAA scene targets (for cross-dissolves) -> per-source DOF + grade
// -> mix -> bloom -> soft shoulder, vignette, sRGB encode, film grain.

export const W = 1080, H = 1920;

const QUAD_VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;

const POISSON = `
const vec2 PD[16]=vec2[16](vec2(-0.613,0.617),vec2(0.170,-0.040),vec2(-0.299,0.791),vec2(0.645,0.493),
vec2(-0.651,0.717),vec2(0.421,0.027),vec2(-0.817,-0.271),vec2(-0.705,-0.668),vec2(0.977,-0.108),
vec2(0.063,-0.991),vec2(0.198,0.881),vec2(0.495,-0.523),vec2(-0.159,-0.402),vec2(0.336,0.459),
vec2(-0.431,0.115),vec2(0.888,0.422));`;

const MIX_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, tB, dA, dB;
uniform float mixAB;
uniform vec2 res;
uniform vec4 camA, camB;      // near, far, focusDist, focusRange
uniform vec2 blurA, blurB;    // max background blur px, max foreground blur px
uniform vec4 gA, gB;          // saturation, contrast, exposure, fade-to-tint
uniform vec3 tintA, tintB, liftA, liftB, fadeColA, fadeColB;
${POISSON}
float linZ(float d, float n, float f){ float z=d*2.-1.; return 2.*n*f/(f+n-z*(f-n)); }
float coc(float z, vec4 cam, vec2 bl){
  float b = clamp((z-cam.z)/cam.w, 0., 1.)*bl.x;
  float fg = clamp((cam.z*0.55 - z)/(cam.z*0.45), 0., 1.)*bl.y;
  return max(b, fg);
}
vec3 dof(sampler2D t, sampler2D d, vec4 cam, vec2 bl){
  vec3 c0 = texture2D(t, vUv).rgb;
  if (bl.x + bl.y < 0.5) return c0;
  float z = linZ(texture2D(d, vUv).r, cam.x, cam.y);
  float r = coc(z, cam, bl);
  if (r < 0.6) return c0;
  vec3 acc = c0; float ws = 1.;
  for (int i=0;i<16;i++){
    vec2 o = PD[i]*r/res;
    float zs = linZ(texture2D(d, vUv+o).r, cam.x, cam.y);
    float rs = coc(zs, cam, bl);
    float w = smoothstep(0., 1., rs/max(r,1e-3)); // only blurred neighbours contribute: no sharp-subject bleed
    acc += texture2D(t, vUv+o).rgb*w; ws += w;
  }
  return acc/ws;
}
vec3 grade(vec3 c, vec4 g, vec3 tint, vec3 lift, vec3 fadeCol){
  c *= g.z;
  c *= tint;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(l), c, g.x);
  c = 0.22*pow(max(c,0.)/0.22, vec3(g.y));
  c += lift;
  c = mix(c, fadeCol, g.w);
  return max(c, 0.);
}
void main(){
  vec3 a = grade(dof(tA, dA, camA, blurA), gA, tintA, liftA, fadeColA);
  vec3 col = a;
  if (mixAB > 0.001) {
    vec3 b = grade(dof(tB, dB, camB, blurB), gB, tintB, liftB, fadeColB);
    col = mix(a, b, mixAB);
  }
  gl_FragColor = vec4(col, 1.);
}`;

const BRIGHT_FS = `
precision highp float; varying vec2 vUv; uniform sampler2D t; uniform float thr; uniform vec2 texel;
void main(){
  vec3 c = vec3(0.);
  c += texture2D(t, vUv+texel*vec2(-1.,-1.)).rgb; c += texture2D(t, vUv+texel*vec2(1.,-1.)).rgb;
  c += texture2D(t, vUv+texel*vec2(-1.,1.)).rgb;  c += texture2D(t, vUv+texel*vec2(1.,1.)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(thr, thr+0.35, l);
  gl_FragColor = vec4(c*k, 1.);
}`;

const BLUR_FS = `
precision highp float; varying vec2 vUv; uniform sampler2D t; uniform vec2 dir;
void main(){
  vec3 c = texture2D(t, vUv).rgb*0.2270270270;
  c += texture2D(t, vUv+dir*1.3846153846).rgb*0.3162162162; c += texture2D(t, vUv-dir*1.3846153846).rgb*0.3162162162;
  c += texture2D(t, vUv+dir*3.2307692308).rgb*0.0702702703; c += texture2D(t, vUv-dir*3.2307692308).rgb*0.0702702703;
  gl_FragColor = vec4(c, 1.);
}`;

const FINAL_FS = `
precision highp float; varying vec2 vUv;
uniform sampler2D tComp, tB1, tB2;
uniform float bloom, vig, grain, seed, flash;
uniform vec3 flashCol;
uniform vec2 res;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed*0.731)*43758.5453); }
vec3 shoulder(vec3 c){
  vec3 k = vec3(0.78);
  vec3 o = k + (1.-k)*(1.-exp(-(c-k)/(1.-k)));
  return mix(c, o, step(k, c));
}
vec3 toSRGB(vec3 c){
  c = clamp(c, 0., 1.);
  return mix(c*12.92, 1.055*pow(c, vec3(1./2.4))-0.055, step(0.0031308, c));
}
vec3 fxaa(vec2 uv){
  vec2 rcp = 1.0/res;
  vec3 L = vec3(0.299, 0.587, 0.114);
  vec3 nw = texture2D(tComp, uv + vec2(-1.,-1.)*rcp).rgb, ne = texture2D(tComp, uv + vec2(1.,-1.)*rcp).rgb;
  vec3 sw = texture2D(tComp, uv + vec2(-1.,1.)*rcp).rgb, se = texture2D(tComp, uv + vec2(1.,1.)*rcp).rgb;
  vec3 m = texture2D(tComp, uv).rgb;
  float lnw = sqrt(dot(nw,L)), lne = sqrt(dot(ne,L)), lsw = sqrt(dot(sw,L)), lse = sqrt(dot(se,L)), lm = sqrt(dot(m,L));
  float lmin = min(lm, min(min(lnw,lne), min(lsw,lse))), lmax = max(lm, max(max(lnw,lne), max(lsw,lse)));
  if (lmax - lmin < max(0.03, lmax*0.08)) return m;
  vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), ((lnw + lsw) - (lne + lse)));
  float red = max((lnw + lne + lsw + lse)*(0.25/8.), 1./128.);
  float rmin = 1./(min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir*rmin, vec2(-8.), vec2(8.))*rcp;
  vec3 a = 0.5*(texture2D(tComp, uv + dir*(1./3. - 0.5)).rgb + texture2D(tComp, uv + dir*(2./3. - 0.5)).rgb);
  vec3 b = a*0.5 + 0.25*(texture2D(tComp, uv - dir*0.5).rgb + texture2D(tComp, uv + dir*0.5).rgb);
  float lb = sqrt(dot(b,L));
  return (lb < lmin || lb > lmax) ? a : b;
}
void main(){
  vec3 c = fxaa(vUv);
  c += (texture2D(tB1, vUv).rgb*0.6 + texture2D(tB2, vUv).rgb*0.9)*bloom;
  c = mix(c, flashCol, flash);
  c = shoulder(c);
  vec2 q = (vUv-0.5)*vec2(1.0, 1.15);
  float v = smoothstep(0.88, 0.25, length(q));
  c *= mix(1., v, vig);
  vec3 s = toSRGB(c);
  // luminance-weighted film grain, two octaves so it reads as grain not noise
  vec2 p = floor(vUv*res);
  float n = (h(p) + h(floor(p*0.5)+17.)) - 1.0;
  float lum = dot(s, vec3(0.299,0.587,0.114));
  s += n*grain*(0.55 + 0.45*(1.-abs(lum-0.5)*2.));
  gl_FragColor = vec4(s, 1.);
}`;

function quadMat(fs, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
}

export class Compositor {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' }));
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.VSMShadowMap;
    r.shadowMap.autoUpdate = false; // scenery is static: re-render shadows only when a sun moves
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.autoClear = true;

    const mk = (w, h, samples = 0, depth = false) => {
      const rt = new THREE.WebGLRenderTarget(w, h, { samples, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      if (depth) { rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.FloatType; }
      return rt;
    };
    // scene targets: 8-bit sRGB, no MSAA (MSAA resolve costs ~300 ms/frame in SwiftShader);
    // edges are anti-aliased with FXAA in the final pass. sRGB storage keeps gradients band-free.
    const sceneRT = () => {
      const rt = new THREE.WebGLRenderTarget(W, H, { samples: 0, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      rt.depthTexture = new THREE.DepthTexture(W, H); rt.depthTexture.type = THREE.UnsignedIntType;
      return rt;
    };
    this.rtA = sceneRT();
    this.rtB = sceneRT();
    this.rtComp = mk(W, H);
    this.rtH1 = mk(W / 4, H / 4); this.rtH1b = mk(W / 4, H / 4);
    this.rtH2 = mk(W / 8, H / 8); this.rtH2b = mk(W / 8, H / 8);

    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);

    const v3 = (x = 1, y = 1, z = 1) => ({ value: new THREE.Vector3(x, y, z) });
    this.mixMat = quadMat(MIX_FS, {
      tA: { value: this.rtA.texture }, tB: { value: this.rtB.texture },
      dA: { value: this.rtA.depthTexture }, dB: { value: this.rtB.depthTexture },
      mixAB: { value: 0 }, res: { value: new THREE.Vector2(W, H) },
      camA: { value: new THREE.Vector4(0.1, 100, 10, 10) }, camB: { value: new THREE.Vector4(0.1, 100, 10, 10) },
      blurA: { value: new THREE.Vector2() }, blurB: { value: new THREE.Vector2() },
      gA: { value: new THREE.Vector4(1, 1, 1, 0) }, gB: { value: new THREE.Vector4(1, 1, 1, 0) },
      tintA: v3(), tintB: v3(), liftA: v3(0, 0, 0), liftB: v3(0, 0, 0), fadeColA: v3(0, 0, 0), fadeColB: v3(0, 0, 0),
    });
    this.brightMat = quadMat(BRIGHT_FS, { t: { value: this.rtComp.texture }, thr: { value: 0.8 }, texel: { value: new THREE.Vector2(1 / W, 1 / H) } });
    this.blurMat = quadMat(BLUR_FS, { t: { value: null }, dir: { value: new THREE.Vector2() } });
    this.finalMat = quadMat(FINAL_FS, {
      tComp: { value: this.rtComp.texture }, tB1: { value: this.rtH1.texture }, tB2: { value: this.rtH2.texture },
      bloom: { value: 0.5 }, vig: { value: 0.35 }, grain: { value: 0.03 }, seed: { value: 0 }, flash: { value: 0 },
      flashCol: v3(1, 0.97, 0.9), res: { value: new THREE.Vector2(W, H) },
    });
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qscene, this.cam);
  }

  renderScene(scene, camera, which, world) {
    const rt = which === 'B' ? this.rtB : this.rtA;
    if (world && world.shadowDirty) { this.renderer.shadowMap.needsUpdate = true; world.shadowDirty = false; }
    this.renderer.setRenderTarget(rt);
    this.renderer.render(scene, camera);
  }

  // look: {grade:{sat,con,exp,fade,tint[3],lift[3],fadeCol[3]}, dof:{focus,range,blur,fg}}
  setSource(which, camera, look) {
    const u = this.mixMat.uniforms, s = which;
    const g = look.grade || {}, d = look.dof || {};
    u['cam' + s].value.set(camera.near, camera.far, d.focus ?? 10, d.range ?? 10);
    u['blur' + s].value.set(d.blur ?? 0, d.fg ?? 0);
    u['g' + s].value.set(g.sat ?? 1, g.con ?? 1, g.exp ?? 1, g.fade ?? 0);
    u['tint' + s].value.fromArray(g.tint ?? [1, 1, 1]);
    u['lift' + s].value.fromArray(g.lift ?? [0, 0, 0]);
    u['fadeCol' + s].value.fromArray(g.fadeCol ?? [0, 0, 0]);
  }

  composite({ mix = 0, bloom = 0.5, bloomThr = 0.85, vig = 0.35, grain = 0.03, frame = 0, flash = 0, flashCol = [1, 0.97, 0.9] }) {
    this.mixMat.uniforms.mixAB.value = mix;
    this.pass(this.mixMat, this.rtComp);
    // bloom chain
    this.brightMat.uniforms.thr.value = bloomThr;
    this.pass(this.brightMat, this.rtH1);
    const blur = (src, dst, w, h, dx, dy) => { this.blurMat.uniforms.t.value = src.texture; this.blurMat.uniforms.dir.value.set(dx / w, dy / h); this.pass(this.blurMat, dst); };
    blur(this.rtH1, this.rtH1b, W / 4, H / 4, 1.5, 0); blur(this.rtH1b, this.rtH1, W / 4, H / 4, 0, 1.5);
    blur(this.rtH1, this.rtH2, W / 8, H / 8, 1, 0); blur(this.rtH2, this.rtH2b, W / 8, H / 8, 1.8, 0); blur(this.rtH2b, this.rtH2, W / 8, H / 8, 0, 1.8);
    blur(this.rtH2, this.rtH2b, W / 8, H / 8, 3.2, 0); blur(this.rtH2b, this.rtH2, W / 8, H / 8, 0, 3.2);
    const f = this.finalMat.uniforms;
    f.bloom.value = bloom; f.vig.value = vig; f.grain.value = grain; f.seed.value = frame % 997; f.flash.value = flash;
    f.flashCol.value.fromArray(flashCol);
    this.pass(this.finalMat, null);
  }
}
