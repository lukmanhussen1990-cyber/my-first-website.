import * as THREE from 'three';

// sRGB hex -> linear THREE.Color
export const col = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------------------
// GLSL helpers shared by the procedural materials. All patterns are computed
// in world space so neighbouring meshes (lawn blocks, the turf roof, the pit
// fill) line up perfectly.
// ---------------------------------------------------------------------------
const GLSL_VARY = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
`;
const GLSL_COMMON = /* glsl */ `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),u.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=0.5;} return s/0.9375; }
// nearest feature point: xy = vector to it, z = distance, w = cell id hash
vec4 cellv(vec2 p){ vec2 i=floor(p), f=fract(p); float d=8.; vec2 rv=vec2(0.); float id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y));
    vec2 o=vec2(h21(i+g), h21(i+g+17.31))*0.85+0.075; vec2 r=g+o-f; float dd=dot(r,r);
    if(dd<d){ d=dd; rv=r; id=h21(i+g+3.17);} }
  return vec4(rv, sqrt(d), id); }
vec3 s2l(vec3 c){ return pow(c, vec3(2.2)); }
`;

const GLSL_GROUND = /* glsl */ `
uniform float uTopY;   // lawn level of this object (top of the grass)
uniform float uMode;   // 0 ground, 1 loose dirt, 2 turf roof
uniform float uGrow;   // turf coverage 0..1
uniform float uWet;    // darkening when wet
#ifdef USE_BAKE
uniform sampler2D uFrontTex; uniform vec4 uFrontRect;
uniform sampler2D uLawnTex;  uniform vec4 uLawnRect;
#endif
vec3 lawnColor(vec2 xz){
  float s = step(0.5, fract(xz.x / 2.4));
  vec3 light = s2l(vec3(0.56, 0.76, 0.33));
  vec3 dark  = s2l(vec3(0.41, 0.62, 0.25));
  vec3 c = mix(dark, light, s);
  c *= 0.88 + 0.24 * fbm(xz * 0.55);
  c *= 0.9 + 0.2 * (vnoise(xz * 23.0) * 0.5 + vnoise(xz * 41.0) * 0.5);
  return c;
}
vec3 lawnLookup(vec2 xz){
#ifdef USE_BAKE
  vec2 uv = (xz - uLawnRect.xy) / (uLawnRect.zw - uLawnRect.xy);
  if (uv.x > 0.001 && uv.y > 0.001 && uv.x < 0.999 && uv.y < 0.999) return texture2D(uLawnTex, uv).rgb;
#endif
  return lawnColor(xz);
}
vec3 dirtTop(vec2 xz){
  float n = fbm(xz * 2.2);
  vec3 c = mix(s2l(vec3(0.47,0.31,0.18)), s2l(vec3(0.6,0.41,0.25)), n);
  c *= 0.8 + 0.4 * vnoise(xz * 19.0);
  vec4 ce = cellv(xz * 4.0);
  if (ce.w > 0.8) c = mix(c, s2l(vec3(0.33,0.21,0.12)), 1.0 - smoothstep(0.18, 0.3, ce.z));
  return c;
}
vec3 soilSide(vec2 uv, float d){
  float j = (vnoise(uv * vec2(5.0, 1.0)) - 0.5) * 0.07 + (vnoise(uv * vec2(19.0, 3.0)) - 0.5) * 0.03;
  float dd = d + j;
  vec3 grass = s2l(vec3(0.38,0.62,0.20));
  vec3 roots = s2l(vec3(0.31,0.21,0.12));
  vec3 top   = s2l(vec3(0.42,0.27,0.16));
  vec3 mid   = s2l(vec3(0.58,0.38,0.22));
  vec3 deep  = s2l(vec3(0.52,0.33,0.19));
  vec3 clay  = s2l(vec3(0.64,0.45,0.28));
  vec3 loam  = s2l(vec3(0.55,0.35,0.2));
  vec3 rust  = s2l(vec3(0.56,0.33,0.19));
  vec3 ochre = s2l(vec3(0.63,0.47,0.29));
  vec3 base  = s2l(vec3(0.46,0.36,0.28));
  vec3 c;
  float b = dd + (fbm(uv * vec2(0.45, 1.6)) - 0.5) * 0.7;
  if (dd < 0.11) c = mix(grass, grass * 0.62, smoothstep(0.0, 0.11, dd));
  else if (dd < 0.5) c = mix(roots, top, smoothstep(0.11, 0.5, dd));
  else {
    // cake-like strata with soft edges and a thin dark line on each boundary
    c = mix(top, loam, smoothstep(0.45, 1.0, b));
    c = mix(c, mid, smoothstep(1.5, 1.9, b));
    c = mix(c, rust, smoothstep(3.7, 4.1, b));
    c = mix(c, ochre, smoothstep(5.4, 5.8, b));
    c = mix(c, base, smoothstep(7.0, 7.5, b));
    float line = 0.0;
    for (int k = 0; k < 4; k++) {
      float edge = k == 0 ? 1.7 : k == 1 ? 3.9 : k == 2 ? 5.6 : 7.25;
      line = max(line, 1.0 - smoothstep(0.0, 0.05, abs(b - edge)));
    }
    c *= 1.0 - 0.16 * line;
    c = mix(c, deep, 0.25 * smoothstep(2.4, 3.2, b) * (1.0 - smoothstep(3.6, 4.0, b)));
  }
  c *= 0.84 + 0.32 * fbm(uv * 3.1);
  c *= 0.92 + 0.16 * vnoise(uv * 27.0);
  // darker specks + a few small stones
  float sp = step(0.86, vnoise(uv * 41.0)) * 0.22;
  c *= 1.0 - sp;
  if (dd > 0.6) {
    vec4 ce = cellv(uv * 2.6);
    float r = 0.06 + 0.1 * fract(ce.w * 5.7);
    float pb = 1.0 - smoothstep(r - 0.03, r, ce.z);
    if (ce.w > 0.86) {
      vec3 pc = mix(s2l(vec3(0.46,0.40,0.34)), s2l(vec3(0.62,0.55,0.47)), fract(ce.w * 7.3));
      pc *= 0.8 + 0.35 * smoothstep(r, 0.0, length(ce.xy + vec2(0.03, -0.04)));
      c = mix(c, pc, pb);
    }
  }
  return c;
}
vec3 groundColor(vec3 p, vec3 n){
  float d = uTopY - p.y;
#ifdef USE_BAKE
  if (uMode < 0.5 && n.z > 0.5 && abs(p.z) < 0.03) {
    vec2 uv = (p.xy - uFrontRect.xy) / (uFrontRect.zw - uFrontRect.xy);
    if (uv.x > 0.001 && uv.y > 0.001 && uv.x < 0.999 && uv.y < 0.999) return texture2D(uFrontTex, uv).rgb;
  }
#endif
  vec2 uv = abs(n.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y);
  if (uMode > 0.5 && uMode < 1.5) {
    return n.y > 0.45 ? dirtTop(p.xz) : soilSide(uv + vec2(3.7, 0.0), 1.2 + abs(d) * 0.3);
  }
  if (uMode > 1.5) {
    float m = smoothstep(0.0, 0.18, uGrow * 1.25 - fbm(p.xz * 1.6) * 0.95);
    if (n.y > 0.45) return mix(dirtTop(p.xz), lawnLookup(p.xz), m);
    vec3 sc = soilSide(uv, d);
    return mix(soilSide(uv, d + 0.3), sc, m);
  }
  if (n.y > 0.45) return d < 0.06 ? lawnLookup(p.xz) : dirtTop(p.xz);
  if (n.y < -0.5) return s2l(vec3(0.30,0.19,0.11));
  return soilSide(uv, d);
}
`;

const GLSL_CONCRETE = /* glsl */ `
vec3 concreteColor(vec3 p, vec3 n){
  vec2 uv = abs(n.y) > 0.5 ? p.xz : (abs(n.x) > 0.5 ? p.zy : p.xy);
  vec3 c = s2l(vec3(0.74, 0.73, 0.70));
  c *= 0.9 + 0.13 * fbm(uv * 2.3);
  c *= 0.95 + 0.08 * vnoise(uv * 31.0);
  float pore = step(0.94, h21(floor(uv * 85.0)));
  c *= 1.0 - 0.22 * pore;
  return c;
}
`;

const GLSL_GRAVEL = /* glsl */ `
vec3 gPert;
vec3 gravelColor(vec3 p, vec3 n){
  vec2 uv = abs(n.y) > 0.5 ? p.xz : (abs(n.x) > 0.5 ? p.zy : p.xy);
  vec4 ce = cellv(uv * 8.5);
  vec3 base = mix(s2l(vec3(0.50,0.49,0.47)), s2l(vec3(0.78,0.76,0.72)), fract(ce.w * 13.7));
  base = mix(base, base * vec3(1.05, 0.97, 0.88), step(0.7, fract(ce.w * 3.1)));
  float edge = smoothstep(0.30, 0.52, ce.z);
  vec2 g = -ce.xy * 1.6 * (1.0 - edge);
  gPert = abs(n.x) > 0.5 ? vec3(0.0, g.y, g.x) * sign(n.x) : vec3(g.x, g.y, 0.0);
  return mix(base, base * 0.3, edge);
}
`;

const GLSL_PLATFORM = /* glsl */ `
uniform vec3 uCenter;
uniform vec2 uHalf;
vec3 platformColor(vec3 p, vec3 n){
  vec3 q = p - uCenter;
  vec3 yel = s2l(vec3(0.98, 0.77, 0.07));
  vec3 blk = s2l(vec3(0.07, 0.07, 0.07));
  if (abs(n.y) < 0.5) {
    vec2 uv = abs(n.x) > 0.5 ? vec2(q.z, q.y) : vec2(q.x, q.y);
    float s = fract((uv.x + uv.y) / 0.42);
    return s < 0.5 ? yel : blk;
  }
  float ex = uHalf.x - abs(q.x), ez = uHalf.y - abs(q.z);
  float e = min(ex, ez);
  if (e < 0.2) { float s = fract((q.x + q.z) / 0.42); return s < 0.5 ? yel : blk; }
  // diamond tread plate
  vec2 t = q.xz * 7.0;
  float dia = abs(fract(t.x + t.y) - 0.5) + abs(fract(t.x - t.y) - 0.5);
  vec3 steel = s2l(vec3(0.60, 0.62, 0.64));
  return steel * (0.86 + 0.18 * smoothstep(0.3, 0.5, dia)) * (0.92 + 0.12 * vnoise(q.xz * 3.0));
}
`;

function patch(mat, { uniforms = {}, colorFn, defines = '', extraFrag = '', perturb = '' }) {
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 wpp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wpp = instanceMatrix * wpp;
            wn = mat3(instanceMatrix) * wn;
          #endif
          vWPos = (modelMatrix * wpp).xyz;
          vWNrm = normalize(mat3(modelMatrix) * wn);
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${defines}\n${GLSL_VARY}\n${GLSL_COMMON}\n${extraFrag}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= ${colorFn}(vWPos, normalize(vWNrm));`);
    if (perturb) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n ${perturb}`
      );
    }
  };
  // make each patched material compile into its own program variant
  mat.customProgramCacheKey = () => colorFn + (perturb ? 'p' : '') + defines;
  return mat;
}

// bake = { frontTex, frontRect: Vector4(x0,y0,x1,y1), lawnTex, lawnRect: Vector4(x0,z0,x1,z1) }
export function groundMaterial({ topY = 0, mode = 0, grow = 1, bake = null } = {}) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uniforms = {
    uTopY: { value: topY },
    uMode: { value: mode },
    uGrow: { value: grow },
    uWet: { value: 0 },
  };
  if (bake) {
    uniforms.uFrontTex = { value: bake.frontTex };
    uniforms.uFrontRect = { value: bake.frontRect };
    uniforms.uLawnTex = { value: bake.lawnTex };
    uniforms.uLawnRect = { value: bake.lawnRect };
  }
  return patch(mat, {
    uniforms,
    colorFn: 'groundColor',
    extraFrag: GLSL_GROUND,
    defines: bake ? '#define USE_BAKE' : '',
  });
}

// Bake the static ground colours (soil cut face at z=0 and the lawn top) into
// half-float textures once, so the frame shader only does a texture fetch.
export function bakeGround(renderer, FullScreenQuad) {
  const make = (w, h, kind, rect) => {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const q = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { uTopY: { value: 0 }, uMode: { value: 0 }, uGrow: { value: 1 }, uWet: { value: 0 }, uRect: { value: rect }, uKind: { value: kind } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `${GLSL_COMMON}\n${GLSL_GROUND}\nuniform vec4 uRect; uniform float uKind; varying vec2 vUv;
          void main(){ vec2 q = mix(uRect.xy, uRect.zw, vUv);
            vec3 c = uKind < 0.5 ? groundColor(vec3(q.x, q.y, 0.0), vec3(0.0, 0.0, 1.0)) : lawnColor(q);
            gl_FragColor = vec4(c, 1.0); }`,
      })
    );
    renderer.setRenderTarget(rt);
    q.render(renderer);
    renderer.setRenderTarget(null);
    q.material.dispose();
    return rt.texture;
  };
  const frontRect = new THREE.Vector4(-6.6, -10.6, 6.6, 0.12);
  const lawnRect = new THREE.Vector4(-12.0, -28.0, 12.0, 0.0);
  return {
    frontTex: make(2244, 1822, 0, frontRect), // 170 px per metre
    frontRect,
    lawnTex: make(2400, 2800, 1, lawnRect), // 100 px per metre
    lawnRect,
  };
}

export function concreteMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  return patch(mat, { colorFn: 'concreteColor', extraFrag: GLSL_CONCRETE });
}

export function gravelMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  return patch(mat, {
    colorFn: 'gravelColor',
    extraFrag: GLSL_GRAVEL,
    perturb: 'normal = normalize(normal + (viewMatrix * vec4(gPert, 0.0)).xyz);',
  });
}

export function platformMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.55 });
  return patch(mat, {
    uniforms: { uCenter: { value: new THREE.Vector3() }, uHalf: { value: new THREE.Vector2(2.5, 1.4) } },
    colorFn: 'platformColor',
    extraFrag: GLSL_PLATFORM,
  });
}

// Roof tiles: rows of rounded clay tiles driven by the geometry UVs
// (u along the eave in metres, v up the slope in metres).
export function roofTileMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTileUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTileUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec2 vTileUv;\nfloat th(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }\nvec3 tPert;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 t = vTileUv / vec2(0.34, 0.30);
          float row = floor(t.y);
          t.x += mod(row, 2.0) * 0.5;
          vec2 f = fract(t);
          vec2 id = vec2(floor(t.x), row);
          float var = th(id);
          vec3 base = pow(vec3(0.74, 0.25, 0.14), vec3(2.2)) * (0.82 + 0.3 * var);
          float curve = sin(f.x * 3.14159);
          float shade = 0.62 + 0.38 * curve;
          float lip = smoothstep(0.0, 0.16, f.y);
          diffuseColor.rgb *= base * shade * mix(0.45, 1.0, lip);
          tPert = vec3(cos(f.x * 3.14159) * 0.55, 0.0, 0.0);
        }`
      )
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\n normal = normalize(normal + tPert * 0.6);'
      );
  };
  mat.customProgramCacheKey = () => 'rooftiles';
  return mat;
}

export function makeSimpleMats(envMap) {
  const std = (hex, rough = 0.7, metal = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal, ...extra });
  // matte surfaces: Lambert is visually identical at this roughness and much cheaper in software GL
  const mat = (hex, extra = {}) => new THREE.MeshLambertMaterial({ color: col(hex), ...extra });
  const mats = {
    carPaint: new THREE.MeshPhysicalMaterial({
      color: col('#c60c18'),
      roughness: 0.3,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.04,
      envMap,
      envMapIntensity: 0.55,
    }),
    carGlass: new THREE.MeshPhysicalMaterial({
      color: col('#11161d'),
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMap,
      envMapIntensity: 0.9,
    }),
    trimBlack: std('#16171a', 0.55),
    tire: std('#141416', 0.92),
    rim: new THREE.MeshStandardMaterial({ color: col('#d9dce1'), roughness: 0.22, metalness: 1.0, envMap, envMapIntensity: 1.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: col('#e8eaee'), roughness: 0.07, metalness: 1.0, envMap, envMapIntensity: 1.5 }),
    steel: new THREE.MeshStandardMaterial({ color: col('#9aa1a8'), roughness: 0.3, metalness: 0.9, envMap, envMapIntensity: 1.1 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: col('#3b4148'), roughness: 0.42, metalness: 0.7, envMap, envMapIntensity: 0.9 }),
    headlight: new THREE.MeshStandardMaterial({ color: col('#fff6dc'), roughness: 0.15, metalness: 0, emissive: col('#ffe9b0'), emissiveIntensity: 0.0 }),
    taillight: new THREE.MeshStandardMaterial({ color: col('#b0101a'), roughness: 0.2, metalness: 0, emissive: col('#ff1a1a'), emissiveIntensity: 0.25 }),
    pipe: std('#141518', 0.45, 0.1),
    pvc: std('#2a2c30', 0.5, 0.0),
    pump: std('#2c6fd6', 0.4, 0.2),
    pumpCap: std('#1e2024', 0.4, 0.5),
    sumpLiner: std('#8a8f96', 0.7),
    wall: mat('#e9d9b9'),
    wallShade: mat('#d8c6a2'),
    trim: mat('#fbfaf6'),
    shutter: mat('#3c6aa8'),
    shutterDark: mat('#2f5690'),
    houseGlass: new THREE.MeshPhysicalMaterial({ color: col('#1d2a3a'), roughness: 0.08, metalness: 0.0, envMap, envMapIntensity: 0.55 }),
    brick: mat('#a35a43'),
    patio: mat('#c9c3b8'),
    trunk: mat('#6b4a32'),
    leaf: mat('#62a646'),
    leafDark: mat('#4c913a'),
    hedge: mat('#559a39'),
    flowerPink: mat('#f08bb0'),
    flowerYellow: mat('#f6d04d'),
    flowerWhite: mat('#fbf7ef'),
    fence: mat('#f3efe6'),
    cloud: mat('#5d6470'),
    cloudLight: mat('#7a818c'),
    farGround: mat('#5f9a3c'),
    water: new THREE.MeshPhysicalMaterial({
      color: col('#2f8fe0'),
      roughness: 0.06,
      metalness: 0.0,
      transparent: true,
      opacity: 0.62,
      envMap,
      envMapIntensity: 1.2,
      depthWrite: false,
    }),
    waterTop: new THREE.MeshPhysicalMaterial({
      color: col('#7cc4ff'),
      roughness: 0.04,
      metalness: 0.0,
      transparent: true,
      opacity: 0.7,
      envMap,
      envMapIntensity: 1.6,
      depthWrite: false,
    }),
    rain: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.88, 1.0), transparent: true, opacity: 0.55, depthWrite: false }),
    dot: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 3.4, 10.0), toneMapped: true }),
    dotHalo: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.45, 1.3), transparent: true, opacity: 0.35, depthWrite: false }),
    smoke: new THREE.MeshLambertMaterial({ color: col('#9a9ca1'), transparent: true, opacity: 0.62, depthWrite: false }),
    exhaust: new THREE.MeshLambertMaterial({ color: col('#8d8f94'), transparent: true, opacity: 0.7, depthWrite: false }),
    dust: new THREE.MeshLambertMaterial({ color: col('#c4ab8c'), transparent: true, opacity: 0.42, depthWrite: false }),
    stone: mat('#8b847a'),
    stoneDark: mat('#6f675d'),
    tuft: mat('#5c9e33'),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(9.0, 7.6, 5.0), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }),
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.55), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    fanBlade: std('#d7dade', 0.35, 0.6),
    fanHub: std('#202226', 0.4, 0.4),
    grate: std('#2b2d31', 0.45, 0.7),
  };
  return mats;
}
