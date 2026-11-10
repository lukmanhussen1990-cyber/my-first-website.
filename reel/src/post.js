// Custom lean post pipeline: supersampled HDR scene -> (motion-blur accumulation) -> AO -> DOF -> bloom -> grade/grain.
import * as THREE from 'three';

const VS = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
}

const DEPTH_FN = /* glsl */`
uniform sampler2D tDepth; uniform float uNear; uniform float uFar;
float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }`;

export class Pipeline {
  constructor(renderer, W, H, SS) {
    this.r = renderer; this.W = W; this.H = H; this.SS = SS;
    const sw = Math.round(W * SS), sh = Math.round(H * SS);
    this.sw = sw; this.sh = sh;
    const LDR = new URLSearchParams(location.search).get('debug')?.includes('ldr');
    const hf = { type: LDR ? THREE.UnsignedByteType : THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    const MS = parseInt(new URLSearchParams(location.search).get('msaa') || '0');
    this.rtScene = new THREE.WebGLRenderTarget(sw, sh, { ...hf, depthBuffer: true, samples: MS });
    this.rtScene.depthTexture = new THREE.DepthTexture(sw, sh);
    this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.rtScene.depthTexture.minFilter = this.rtScene.depthTexture.magFilter = THREE.NearestFilter;
    this.rtAccum = new THREE.WebGLRenderTarget(sw, sh, hf);
    this.rtFull = new THREE.WebGLRenderTarget(W, H, hf);     // resolved, AO applied
    this.rtDof = new THREE.WebGLRenderTarget(W, H, hf);
    this.rtDof2 = new THREE.WebGLRenderTarget(W, H, hf);
    const aw = W >> 1, ah = H >> 1;
    const r8 = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtAO = new THREE.WebGLRenderTarget(aw, ah, r8);
    this.rtAO2 = new THREE.WebGLRenderTarget(aw, ah, r8);
    this.bloom = [];
    for (let i = 0, w = W >> 1, h = H >> 1; i < 5; i++, w >>= 1, h >>= 1) {
      this.bloom.push([new THREE.WebGLRenderTarget(w, h, hf), new THREE.WebGLRenderTarget(w, h, hf)]);
    }
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);

    this.mCopy = pass(`uniform sampler2D t; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * k, 1.0); }`,
      { t: { value: null }, k: { value: 1 } });
    this.mAccum = pass(`uniform sampler2D t; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * k, 1.0); }`,
      { t: { value: null }, k: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });

    // --- AO (half res, normals reconstructed from depth; flat-shaded geo makes this exact) ---
    this.mAO = pass(/* glsl */`
      varying vec2 vUv; ${DEPTH_FN}
      uniform vec2 uProj; uniform vec2 uTexel; uniform float uRadius; uniform float uFrame;
      vec3 vpos(vec2 uv){ float z = viewZ(uv); return vec3((uv*2.0-1.0)*uProj*z, -z); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec3 p = vpos(vUv);
        if (-p.z > uFar*0.95) { gl_FragColor = vec4(1.0); return; }
        vec2 e = uTexel;
        vec3 pr = vpos(vUv+vec2(e.x,0.)), pl = vpos(vUv-vec2(e.x,0.)), pu = vpos(vUv+vec2(0.,e.y)), pd = vpos(vUv-vec2(0.,e.y));
        vec3 dx = abs(pr.z-p.z) < abs(p.z-pl.z) ? pr-p : p-pl;
        vec3 dy = abs(pu.z-p.z) < abs(p.z-pd.z) ? pu-p : p-pd;
        vec3 n = normalize(cross(dx, dy));
        float ang = hash(gl_FragCoord.xy) * 6.2831853;
        float ao = 0.0; const int N = 10;
        float rpix = uRadius / (-p.z) / uProj.y * 0.5;   // radius in uv (vertical)
        rpix = min(rpix, 0.12);
        float aspect = uProj.y / uProj.x;
        for (int i = 0; i < N; i++) {
          float fi = (float(i) + 0.5) / float(N);
          float a = ang + float(i) * 2.399963;
          float rr = sqrt(fi) * rpix;
          vec2 o = vec2(cos(a) * rr * aspect, sin(a) * rr);
          vec3 s = vpos(vUv + o) - p;
          float d = length(s);
          float nd = dot(n, s) / (d + 1e-4);
          float fall = 1.0 - smoothstep(uRadius * 0.6, uRadius * 1.6, d);
          ao += max(nd - 0.08, 0.0) * fall;
        }
        ao = 1.0 - ao / float(N) * 2.1;
        gl_FragColor = vec4(vec3(clamp(ao, 0.0, 1.0)), 1.0);
      }`, { tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 100 }, uProj: { value: new THREE.Vector2() }, uTexel: { value: new THREE.Vector2(1 / aw, 1 / ah) }, uRadius: { value: 0.22 }, uFrame: { value: 0 } });

    this.mAOBlur = pass(/* glsl */`
      varying vec2 vUv; ${DEPTH_FN}
      uniform sampler2D tAO; uniform vec2 uDir;
      void main(){
        float zc = viewZ(vUv); float sum = 0.0, wsum = 0.0;
        for (int i = -3; i <= 3; i++) {
          vec2 uv = vUv + uDir * float(i);
          float z = viewZ(uv);
          float w = exp(-float(i*i) / 6.0) * (1.0 / (1.0 + abs(z - zc) / (0.03 * zc) * 8.0));
          sum += texture2D(tAO, uv).r * w; wsum += w;
        }
        gl_FragColor = vec4(vec3(sum / wsum), 1.0);
      }`, { tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 100 }, tAO: { value: null }, uDir: { value: new THREE.Vector2() } });

    // --- resolve: SSAA downsample + AO multiply ---
    this.mResolve = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D t; uniform sampler2D tAO; uniform vec2 uTexel; uniform float uAO; uniform float uSS;
      void main(){
        vec3 c;
        if (uSS > 1.01) {
          vec2 o = uTexel * 0.5 * (uSS > 1.75 ? 1.0 : 0.6);
          c = 0.25 * (texture2D(t, vUv + vec2(-o.x,-o.y)).rgb + texture2D(t, vUv + vec2(o.x,-o.y)).rgb + texture2D(t, vUv + vec2(-o.x,o.y)).rgb + texture2D(t, vUv + vec2(o.x,o.y)).rgb);
        } else c = texture2D(t, vUv).rgb;
        float ao = texture2D(tAO, vUv).r;
        float lum = dot(c, vec3(0.3, 0.6, 0.1));
        ao = mix(1.0, ao, uAO * (1.0 - smoothstep(0.9, 2.2, lum)));   // keep emissive screens clean
        // slightly tinted AO feels like bounce light rather than black dirt
        c *= mix(vec3(0.10, 0.08, 0.14), vec3(1.0), ao);
        gl_FragColor = vec4(c, 1.0);
      }`, { t: { value: null }, tAO: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uAO: { value: 1 }, uSS: { value: SS } });

    // --- DOF: separable-ish golden-angle disc blur driven by CoC from depth ---
    this.mDof = pass(/* glsl */`
      varying vec2 vUv; ${DEPTH_FN}
      uniform sampler2D t; uniform vec2 uTexel; uniform float uFocus; uniform float uRange; uniform float uMaxBlur; uniform float uPhase;
      float coc(vec2 uv){ float z = viewZ(uv); float c = (z - uFocus) / max(z, 0.001); return clamp(c / uRange, -1.0, 1.0); }
      void main(){
        float c0 = coc(vUv); float r0 = abs(c0) * uMaxBlur;
        vec3 sum = texture2D(t, vUv).rgb; float wsum = 1.0;
        if (uMaxBlur > 0.01) {
          const int N = 8;
          for (int i = 0; i < N; i++) {
            float fi = (float(i) + 0.5) / float(N);
            float a = float(i) * 2.399963 + uPhase;
            vec2 o = vec2(cos(a), sin(a)) * sqrt(fi);
            // gather with max radius; accept samples whose own CoC covers this pixel, or background blur
            vec2 uv = vUv + o * uTexel * uMaxBlur;
            float cs = coc(uv); float rs = abs(cs) * uMaxBlur;
            float dist = sqrt(fi) * uMaxBlur;
            float w = smoothstep(dist - 1.0, dist + 1.0, (cs > c0 + 0.05 && c0 < 0.3) ? min(rs, r0) : rs);
            sum += texture2D(t, uv).rgb * w; wsum += w;
          }
        }
        gl_FragColor = vec4(sum / wsum, 1.0);
      }`, { tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 100 }, t: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uFocus: { value: 2 }, uRange: { value: 0.5 }, uMaxBlur: { value: 0 }, uPhase: { value: 0 } });

    // --- bloom ---
    this.mBright = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D t; uniform float uThresh; uniform vec2 uTexel;
      void main(){
        vec3 c = 0.25*(texture2D(t, vUv+uTexel*vec2(-.5,-.5)).rgb+texture2D(t, vUv+uTexel*vec2(.5,-.5)).rgb+texture2D(t, vUv+uTexel*vec2(-.5,.5)).rgb+texture2D(t, vUv+uTexel*vec2(.5,.5)).rgb);
        float l = max(c.r, max(c.g, c.b));
        float k = max(l - uThresh, 0.0); k = k / (k + 0.6);
        gl_FragColor = vec4(c * k / max(l, 1e-3) * min(l, 6.0), 1.0);
      }`, { t: { value: null }, uThresh: { value: 0.9 }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) } });
    this.mBlur = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D t; uniform vec2 uDir;
      void main(){
        vec3 c = texture2D(t, vUv).rgb * 0.2270270270;
        c += (texture2D(t, vUv + uDir * 1.3846153846).rgb + texture2D(t, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
        c += (texture2D(t, vUv + uDir * 3.2307692308).rgb + texture2D(t, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
        gl_FragColor = vec4(c, 1.0);
      }`, { t: { value: null }, uDir: { value: new THREE.Vector2() } });

    // --- final: bloom add, tonemap, grade, vignette, flash, grain, chroma fringe ---
    this.mFinal = pass(/* glsl */`
      varying vec2 vUv; uniform sampler2D t; uniform sampler2D b0,b1,b2,b3,b4;
      uniform float uBloom, uExposure, uVig, uGrain, uSeed, uSat, uContrast, uCA, uFade, uAspect;
      uniform vec3 uFlash; uniform float uFlashAmt; uniform vec3 uVigCol; uniform float uVigColAmt; uniform vec3 uTint; uniform float uWhite;
      vec3 neutral(vec3 c){
        const float startCompression = 0.8 - 0.04; const float desaturation = 0.15;
        float x = min(c.r, min(c.g, c.b)); float offset = x < 0.08 ? x - 6.25 * x * x : 0.04; c -= offset;
        float peak = max(c.r, max(c.g, c.b)); if (peak < startCompression) return c;
        float d = 1.0 - startCompression; float newPeak = 1.0 - d * d / (peak + d - startCompression);
        c *= newPeak / peak; float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
        return mix(c, vec3(newPeak), g);
      }
      float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d * vec2(1.0, uAspect), d * vec2(1.0, uAspect));
        vec3 c;
        if (uCA > 0.0) {
          vec2 o = d * r2 * uCA;
          c = vec3(texture2D(t, vUv + o).r, texture2D(t, vUv).g, texture2D(t, vUv - o).b);
        } else c = texture2D(t, vUv).rgb;
        vec3 bl = texture2D(b0, vUv).rgb * 0.9 + texture2D(b1, vUv).rgb * 1.0 + texture2D(b2, vUv).rgb * 1.0 + texture2D(b3, vUv).rgb * 0.9 + texture2D(b4, vUv).rgb * 0.8;
        c += bl * uBloom * 0.085;
        c *= uExposure * uTint;
        float vig = 1.0 - smoothstep(0.18, 1.25, r2) * uVig;
        c *= vig;
        c = neutral(c);
        c = pow(max(c, 0.0), vec3(1.0 / 2.2));
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, uSat);
        c = (c - 0.5) * uContrast + 0.5;
        // subtle teal shadows / warm highlights split-tone
        c += (vec3(-0.012, 0.004, 0.022) * (1.0 - l) + vec3(0.018, 0.006, -0.016) * l);
        c = mix(c, uVigCol, uVigColAmt * smoothstep(0.10, 0.85, r2));
        c = mix(c, uFlash, uFlashAmt);
        c = mix(c, vec3(1.0), uWhite);
        float g = hash(gl_FragCoord.xy + uSeed * 91.7) + hash(gl_FragCoord.xy * 1.37 + uSeed * 13.1) - 1.0;
        c += g * uGrain * (0.55 + 0.45 * (1.0 - l));
        c *= uFade;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`, {
      t: { value: null }, b0: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null }, b4: { value: null },
      uBloom: { value: 1 }, uExposure: { value: 1 }, uVig: { value: 0.55 }, uGrain: { value: 0.035 }, uSeed: { value: 0 }, uSat: { value: 1.08 }, uContrast: { value: 1.05 },
      uCA: { value: 0.0 }, uFade: { value: 1 }, uAspect: { value: H / W }, uFlash: { value: new THREE.Color(1, 0, 0) }, uFlashAmt: { value: 0 },
      uVigCol: { value: new THREE.Color(1, 0, 0) }, uVigColAmt: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uWhite: { value: 0 },
    });
  }

  _draw(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qscene, this.cam);
  }
  _sync(label) {
    if (!this.prof) return; const gl = this.r.getContext(); const px = new Uint8Array(4); const t = this.r.getRenderTarget();
    if (t && t.texture.type === THREE.HalfFloatType) { const f = new Float32Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, f); } else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const now = performance.now(); this.prof[label] = (this.prof[label] || 0) + now - this._t; this._t = now;
  }

  // renderScene(k, n): callback renders the scene for sub-sample k of n into the bound target
  render(scene, camera, fx, subSamples, prepare) {
    const r = this.r; this._t = performance.now();
    const n = Math.max(1, subSamples | 0);
    let src = this.rtScene;
    if (n === 1) {
      prepare(0, 1);
      r.setRenderTarget(this.rtScene); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, camera); this._sync('scene');
    } else {
      r.setRenderTarget(this.rtAccum); r.setClearColor(0x000000, 1); r.clear();
      const prevAuto = r.autoClear;
      for (let k = 0; k < n; k++) {
        prepare(k, n);
        r.setRenderTarget(this.rtScene); r.autoClear = true; r.clear(); r.render(scene, camera);
        this.mAccum.uniforms.t.value = this.rtScene.texture; this.mAccum.uniforms.k.value = 1 / n;
        r.autoClear = false; this._draw(this.mAccum, this.rtAccum);
      }
      r.autoClear = prevAuto;
      src = this.rtAccum;
    }
    const near = camera.near, far = camera.far;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const depth = this.rtScene.depthTexture;
    for (const m of [this.mAO, this.mAOBlur, this.mDof]) { m.uniforms.tDepth.value = depth; m.uniforms.uNear.value = near; m.uniforms.uFar.value = far; }
    // AO
    this.mAO.uniforms.uProj.value.set(tanH * camera.aspect, tanH);
    this.mAO.uniforms.uRadius.value = fx.aoRadius ?? 0.22;
    this._draw(this.mAO, this.rtAO);
    this.mAOBlur.uniforms.tAO.value = this.rtAO.texture; this.mAOBlur.uniforms.uDir.value.set(1 / this.rtAO.width, 0); this._draw(this.mAOBlur, this.rtAO2);
    this.mAOBlur.uniforms.tAO.value = this.rtAO2.texture; this.mAOBlur.uniforms.uDir.value.set(0, 1 / this.rtAO.height); this._draw(this.mAOBlur, this.rtAO); this._sync('ao');
    // resolve
    this.mResolve.uniforms.t.value = src.texture; this.mResolve.uniforms.tAO.value = this.rtAO.texture; this.mResolve.uniforms.uAO.value = fx.ao ?? 1;
    this._draw(this.mResolve, this.rtFull); this._sync('resolve');
    // DOF (two passes with rotated kernels for a smooth disc)
    let cur = this.rtFull;
    if ((fx.dof ?? 0) > 0.01) {
      const u = this.mDof.uniforms; u.uFocus.value = fx.focus; u.uRange.value = fx.dofRange ?? 0.5; u.uMaxBlur.value = fx.dof;
      u.t.value = cur.texture; u.uPhase.value = 0; this._draw(this.mDof, this.rtDof);
      u.t.value = this.rtDof.texture; u.uPhase.value = 1.2; u.uMaxBlur.value = fx.dof * 0.5; this._draw(this.mDof, this.rtDof2);
      cur = this.rtDof2; this._sync('dof');
    }
    // bloom
    this.mBright.uniforms.t.value = cur.texture; this.mBright.uniforms.uThresh.value = fx.bloomThresh ?? 1.05;
    this._draw(this.mBright, this.bloom[0][0]);
    for (let i = 0; i < this.bloom.length; i++) {
      const [a, b] = this.bloom[i];
      if (i > 0) { this.mCopy.uniforms.t.value = this.bloom[i - 1][0].texture; this.mCopy.uniforms.k.value = 1; this._draw(this.mCopy, a); }
      this.mBlur.uniforms.t.value = a.texture; this.mBlur.uniforms.uDir.value.set(1 / a.width, 0); this._draw(this.mBlur, b);
      this.mBlur.uniforms.t.value = b.texture; this.mBlur.uniforms.uDir.value.set(0, 1 / a.height); this._draw(this.mBlur, a);
    }
    this._sync('bloom');
    const f = this.mFinal.uniforms;
    f.t.value = cur.texture; for (let i = 0; i < 5; i++) f['b' + i].value = this.bloom[i][0].texture;
    f.uBloom.value = fx.bloom ?? 1; f.uExposure.value = fx.exposure ?? 1; f.uVig.value = fx.vignette ?? 0.55; f.uGrain.value = fx.grain ?? 0.035;
    f.uSeed.value = fx.seed ?? 0; f.uSat.value = fx.sat ?? 1.08; f.uContrast.value = fx.contrast ?? 1.05; f.uCA.value = fx.ca ?? 0.0;
    f.uFlashAmt.value = fx.flashAmt ?? 0; if (fx.flashCol) f.uFlash.value.set(fx.flashCol);
    f.uVigColAmt.value = fx.vigColAmt ?? 0; if (fx.vigCol) f.uVigCol.value.set(fx.vigCol);
    if (fx.tint) f.uTint.value.set(fx.tint); else f.uTint.value.set(1, 1, 1);
    f.uWhite.value = fx.white ?? 0; f.uFade.value = fx.fade ?? 1;
    this._draw(this.mFinal, null); this._sync('final');
  }
}
