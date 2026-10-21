// Materials: procedural textures (made by tools/make_textures.py) + shader patches on top of
// three.js PBR materials, so lighting, shadows and fog stay physically based.
import * as THREE from 'three';

export const G = {
  // global uniforms shared by every patched material (updated per frame by main.js)
  uSunDir: { value: new THREE.Vector3(0.6, 0.3, 0.7).normalize() },
  uFogWarm: { value: new THREE.Color('#f3b47a') },
  uFogCool: { value: new THREE.Color('#a9b9cf') },
  uFogDensity: { value: 0.0045 },
  uFogFalloff: { value: 0.035 },
  uFogBase: { value: -4.0 },
  uTime: { value: 0 },
  uDigX: { value: 0 },
};

const loader = new THREE.TextureLoader();
const cache = new Map();
let maxAniso = 8;
export function setAnisotropy(a) { maxAniso = a; }
export function tex(name, { srgb = false, repeat = 1 } = {}) {
  const key = name + srgb;
  if (cache.has(key)) return cache.get(key);
  const t = loader.load(`/scene/tex/${name}.png`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.repeat.set(repeat, repeat);
  cache.set(key, t);
  return t;
}
export function texturesLoaded() {
  return Promise.all([...cache.values()].map((t) => new Promise((res) => {
    if (t.image && t.image.complete !== false && (t.image.width || t.image.naturalWidth)) return res();
    const iv = setInterval(() => { if (t.image && (t.image.width || t.image.naturalWidth)) { clearInterval(iv); res(); } }, 20);
  })));
}

// ---------------------------------------------------------------- global fog (height + sun-tinted haze)
THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif`;
THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vFogWorldPos = (inverse(viewMatrix) * mvPosition).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vFogWorldPos;
  uniform vec3 uSunDir;
  uniform vec3 uFogWarm;
  uniform vec3 uFogCool;
  uniform float uFogDensity;
  uniform float uFogFalloff;
  uniform float uFogBase;
#endif`;
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  {
    vec3 toF = vFogWorldPos - cameraPosition;
    float dist = length(toF);
    vec3 vdir = toF / max(dist, 1e-4);
    float h0 = max(cameraPosition.y - uFogBase, 0.0);
    float h1 = max(vFogWorldPos.y - uFogBase, 0.0);
    float k = uFogFalloff;
    float dh = h1 - h0;
    float integ = abs(dh) > 0.05 ? (exp(-k * h0) - exp(-k * h1)) / (k * dh) : exp(-k * h0);
    float fogAmt = 1.0 - exp(-uFogDensity * dist * clamp(integ, 0.0, 4.0));
    float sunAmt = pow(max(dot(vdir, uSunDir), 0.0), 5.0);
    vec3 fc = mix(uFogCool, uFogWarm, 0.35 + 0.65 * sunAmt);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, clamp(fogAmt, 0.0, 1.0));
  }
#endif`;

// Attach the global uniforms (and an optional extra patch) to a material.
export function hook(mat, patch, cacheKey = '') {
  mat.onBeforeCompile = (shader, renderer) => {
    for (const k of Object.keys(G)) shader.uniforms[k] = G[k];
    if (patch) patch(shader, renderer);
  };
  mat.customProgramCacheKey = () => 'h:' + cacheKey;
  return mat;
}

export function std(params, key = 'std') { return hook(new THREE.MeshStandardMaterial(params), null, key); }
export function phys(params, key = 'phys') { return hook(new THREE.MeshPhysicalMaterial(params), null, key); }

// ---------------------------------------------------------------- shared GLSL
const NOISE_GLSL = `
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbmN(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=0.5;} return s/0.9375; }
`;

// ---------------------------------------------------------------- earth: cut face, tunnel rock, dig faces
// Colours come from geology: soil layers follow the surface (sampled from a 1D height texture),
// rock strata are horizontal-ish bands; a granite mass starts at the first hill (the "solid rock").
export function earthMaterial(profileTex, profileRange, opts = {}) {
  const rockA = tex('rock_albedo', { srgb: true }), rockN = tex('rock_normal'), rockO = tex('rock_orm');
  const soilA = tex('soil_albedo', { srgb: true }), soilN = tex('soil_normal');
  const grassA = tex('grass_albedo', { srgb: true });
  const noise = tex('noise_rgba');
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: opts.side ?? THREE.FrontSide });
  const U = {
    tRockA: { value: rockA }, tRockN: { value: rockN }, tRockO: { value: rockO }, tSoilA: { value: soilA }, tSoilN: { value: soilN },
    tGrassA: { value: grassA }, tNoise: { value: noise }, tProfile: { value: profileTex },
    uProfRange: { value: new THREE.Vector2(profileRange[0], profileRange[1]) },
    uDarkDeep: { value: opts.darkDeep ?? 1.0 },
    uWet: { value: opts.wet ?? 0.0 },
    uOpenMain: { value: new THREE.Vector2(0, -1e5) },
    uOpenSteep: { value: new THREE.Vector2(0, -1e5) },
    uStation: { value: new THREE.Vector4(0, -1e5, 0, 0) },
    uOpenH: { value: opts.openH ?? 2.45 },
    uInside: { value: opts.inside ?? 0.0 },
  };
  mat.userData.uniforms = U;
  return hook(mat, (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vWP = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN;
uniform sampler2D tRockA, tRockN, tRockO, tSoilA, tSoilN, tGrassA, tNoise, tProfile;
uniform vec2 uProfRange; uniform float uDarkDeep; uniform float uWet;
uniform vec2 uOpenMain, uOpenSteep; uniform vec4 uStation; uniform float uOpenH; uniform float uInside;
${NOISE_GLSL}
vec4 profAt(float x){ return texture2D(tProfile, vec2((x-uProfRange.x)/(uProfRange.y-uProfRange.x), 0.5)); }
vec3 triW(vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); return w/(w.x+w.y+w.z); }
vec4 tri(sampler2D t, vec3 p, vec3 w, float s){
  vec4 c = vec4(0.0);
  if (w.z > 0.01) c += texture2D(t, p.xy*s) * w.z;
  if (w.x > 0.01) c += texture2D(t, p.zy*s) * w.x;
  if (w.y > 0.01) c += texture2D(t, p.xz*s) * w.y;
  return c;
}
vec3 triN(sampler2D t, vec3 p, vec3 n, vec3 w, float s){
  // whiteout-blended triplanar normal mapping in world space
  vec3 nz = texture2D(t, p.xy*s).xyz*2.0-1.0; vec3 nx = texture2D(t, p.zy*s).xyz*2.0-1.0; vec3 ny = texture2D(t, p.xz*s).xyz*2.0-1.0;
  vec3 a = vec3(nx.xy + n.zy, abs(nx.z)*n.x); vec3 b = vec3(ny.xy + n.xz, abs(ny.z)*n.y); vec3 c = vec3(nz.xy + n.xy, abs(nz.z)*n.z);
  return normalize(a.zyx*w.x + b.xzy*w.y + c.xyz*w.z);
}
`)
      .replace('#include <clipping_planes_fragment>', opts.openings ? `
  #include <clipping_planes_fragment>
  {
    vec4 pr = profAt(vWP.x);
    if (vWP.x > uOpenMain.x && vWP.x < uOpenMain.y && abs(vWP.y - pr.b) < uOpenH) discard;
    if (vWP.x > uOpenSteep.x && vWP.x < uOpenSteep.y) {
      float sl = (profAt(vWP.x + 0.3).a - profAt(vWP.x - 0.3).a) / 0.6;
      if (abs(vWP.y - pr.a) < uOpenH * sqrt(1.0 + sl*sl)) discard;
    }
    if (vWP.x > uStation.x && vWP.x < uStation.y && vWP.y > uStation.z && vWP.y < uStation.w) discard;
  }` : '#include <clipping_planes_fragment>')
      .replace('#include <map_fragment>', `
  vec3 wN = normalize(vWN);
  vec3 tw = triW(wN);
  vec4 prof = profAt(vWP.x);
  float surf = prof.r;            // ground height at the cut plane
  float rockTop = prof.g;         // where bedrock starts (absolute y)
  float depth = surf - vWP.y;     // depth below the surface
  float nA = fbmN(vWP.xy*0.35);
  float nB = texture2D(tNoise, vWP.xy*0.013).r;
  // --- layer colours
  vec3 cGrass = vec3(0.22,0.33,0.10);
  vec3 cTop = vec3(0.27,0.18,0.11);
  vec3 cSub = vec3(0.47,0.33,0.22);
  vec3 cClay = vec3(0.58,0.45,0.33);
  // horizontal rock strata with gentle waves
  float sy = vWP.y + 2.2*sin(vWP.x*0.035) + 1.3*sin(vWP.x*0.11+1.7) + (nB-0.5)*4.0;
  float band = sy*0.34 + (nA-0.5)*0.25;
  vec3 s0 = vec3(0.72,0.58,0.43); // sandstone
  vec3 s1 = vec3(0.58,0.38,0.29); // red bed
  vec3 s2 = vec3(0.70,0.68,0.62); // limestone
  vec3 s3 = vec3(0.52,0.50,0.47); // shale grey
  vec3 s4 = vec3(0.64,0.50,0.36); // ochre
  vec3 s5 = vec3(0.40,0.39,0.40); // dark slate
  float fb = fract(band); float ib = mod(floor(band), 6.0);
  vec3 sc = ib < 1.0 ? s0 : ib < 2.0 ? s1 : ib < 3.0 ? s2 : ib < 4.0 ? s3 : ib < 5.0 ? s4 : s5;
  vec3 sn = ib < 1.0 ? s1 : ib < 2.0 ? s2 : ib < 3.0 ? s3 : ib < 4.0 ? s4 : ib < 5.0 ? s5 : s0;
  vec3 strata = mix(sc, sn, smoothstep(0.86, 0.97, fb));
  strata *= 1.0 - 0.28 * smoothstep(0.93, 0.985, fb) * (1.0 - smoothstep(0.985, 1.0, fb)); // dark seam between layers
  strata *= 0.88 + 0.24 * texture2D(tNoise, vec2(vWP.x*0.004 + floor(band)*0.37, 0.5)).b;
  // granite mass = the "solid grey rock": a cool grey with slight blue
  vec3 granite = vec3(0.36,0.37,0.39) * (0.85 + 0.3*nA);
  float inGranite = smoothstep(-0.6, 0.6, rockTop - vWP.y + (nA-0.5)*1.4);
  vec3 rockCol = mix(strata, granite, inGranite*0.85);
  // soil layers following the surface
  float d = depth + (nA-0.5)*0.7;
  vec3 soilCol = d < 0.3 ? cGrass : d < 1.6 ? mix(cTop, cSub, smoothstep(1.0,1.6,d)) : mix(cSub, cClay, smoothstep(2.0,4.5,d));
  float soilDepth = 2.6 + (nB-0.5)*1.6;
  float isRock = smoothstep(soilDepth-0.6, soilDepth+0.6, d);
  isRock = max(isRock, inGranite * smoothstep(0.9, 1.4, d));
  // textures
  vec4 rA = mix(tri(tRockA, vWP, tw, 0.32), tri(tRockA, vWP + 17.0, tw, 0.13), 0.3);
  vec4 sA = tri(tSoilA, vWP, tw, 0.30);
  vec4 gA = tri(tGrassA, vWP, tw, 0.35);
  vec3 rockTex = pow(rA.rgb * 1.8, vec3(1.25));
  vec3 soilTex = sA.rgb / vec3(0.40,0.27,0.18);
  vec3 col = mix(soilCol * mix(vec3(1.0), soilTex, 0.75), rockCol * rockTex, isRock);
  col = mix(col, gA.rgb, step(d, 0.3) * (1.0-isRock));
  // depth darkening: deep layers fall into a soft shadow (diorama look)
  float deep = smoothstep(14.0, 60.0, depth) * uDarkDeep;
  col *= mix(1.0, 0.42, deep);
  // inside a tunnel the walls fall off into shadow towards the back (cheap cavity occlusion)
  col *= mix(1.0, mix(0.38, 1.0, smoothstep(-4.2, -0.4, vWP.z)), uInside);
  col *= mix(1.0, 0.8, uWet);
  diffuseColor.rgb *= col;
  float isRockF = isRock;
`)
      .replace('#include <roughnessmap_fragment>', `
  float roughnessFactor = roughness;
  vec4 rO = tri(tRockO, vWP, tw, 0.32);
  roughnessFactor = mix(0.95, rO.g, isRockF) * mix(1.0, 0.55, uWet);
`)
      .replace('#include <normal_fragment_maps>', `
  {
    vec3 nR = triN(tRockN, vWP, wN, tw, 0.32);
    vec3 nS = triN(tSoilN, vWP, wN, tw, 0.30);
    vec3 nW = normalize(mix(nS, nR, isRockF));
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }
`)
      .replace('#include <aomap_fragment>', `
  #include <aomap_fragment>
  {
    float cav = mix(1.0, rO.r, isRockF);
    reflectedLight.indirectDiffuse *= cav;
  }
`);
  }, 'earth' + (opts.key || ''));
}

// ---------------------------------------------------------------- terrain top (grass, rock on steep slopes, dirt at the dig site)
export function terrainMaterial(opts = {}) {
  const grassA = tex('grass_albedo', { srgb: true }), grassN = tex('grass_normal');
  const rockA = tex('rock_albedo', { srgb: true }), rockN = tex('rock_normal');
  const soilA = tex('soil_albedo', { srgb: true });
  const noise = tex('noise_rgba');
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  const U = { tGA: { value: grassA }, tGN: { value: grassN }, tRA: { value: rockA }, tRN: { value: rockN }, tSA: { value: soilA }, tNoise: { value: noise },
    uDirtBox: { value: new THREE.Vector4(-30, 15, -9, 1) } };
  return hook(mat, (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vWP = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN;
uniform sampler2D tGA, tGN, tRA, tRN, tSA, tNoise; uniform vec4 uDirtBox;
${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (vWP.x > 13.22 && vWP.x < 15.5 && length(vec2(vWP.y - 1.95, vWP.z + 1.1)) < 2.74) discard;`)
      .replace('#include <map_fragment>', `
  vec3 wN = normalize(vWN);
  vec2 uv = vWP.xz;
  float slope = 1.0 - wN.y;
  vec4 nz = texture2D(tNoise, uv*0.01);
  vec4 nz2 = texture2D(tNoise, uv*0.045);
  vec3 g = texture2D(tGA, uv*0.18).rgb;
  vec3 g2 = texture2D(tGA, uv*0.031).rgb;
  vec3 grass = mix(g, g2, 0.45) * mix(vec3(1.0), vec3(1.25,1.12,0.75), smoothstep(0.55,0.8,nz.r)); // sun-dried patches
  grass *= 0.85 + 0.3*nz2.g;
  vec3 aw = pow(abs(wN), vec3(4.0)); aw /= (aw.x+aw.y+aw.z);
  vec3 rock = (texture2D(tRA, vWP.zy*0.15).rgb*aw.x + texture2D(tRA, uv*0.12).rgb*aw.y + texture2D(tRA, vWP.xy*0.15).rgb*aw.z) * vec3(0.92,0.85,0.74) * 1.45;
  float rockAmt = smoothstep(0.42, 0.62, slope + (nz.g-0.5)*0.35);
  vec3 col = mix(grass, rock, rockAmt);
  // dirt patch at the dig site in the valley
  float inBox = step(uDirtBox.x, vWP.x) * step(vWP.x, uDirtBox.y) * step(uDirtBox.z, vWP.z);
  float dirtAmt = inBox * smoothstep(0.35, 0.65, nz2.r + 0.3 - 0.06*abs(vWP.z+3.0)) * uDirtBox.w;
  col = mix(col, texture2D(tSA, uv*0.25).rgb*1.15, clamp(dirtAmt,0.0,1.0));
  // near the cut edge, a richer rim
  diffuseColor.rgb *= col;
  float rockF = rockAmt;
`)
      .replace('#include <roughnessmap_fragment>', `
  float roughnessFactor = mix(0.95, 0.8, rockF);
`)
      .replace('#include <normal_fragment_maps>', `
  {
    vec3 tn = mix(texture2D(tGN, uv*0.18).xyz, texture2D(tRN, uv*0.12).xyz, rockF)*2.0-1.0;
    tn.xy *= 0.8;
    // tangent frame for a top-down planar projection
    vec3 T = normalize(vec3(1.0, 0.0, 0.0) - wN * wN.x);
    vec3 B = normalize(cross(wN, T));
    vec3 nW = normalize(T*tn.x + B*(-tn.y) + wN*tn.z);
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }
`);
  }, 'terrain');
}

// ---------------------------------------------------------------- Great Wall bricks with moss near the base
// Geometry provides uv (bricks) and attribute aH = height above the wall base (metres).
export function wallMaterial(kind = 'bricks') {
  const a = tex(kind + '_albedo', { srgb: true }), n = tex(kind + '_normal'), o = tex(kind + '_orm');
  const noise = tex('noise_rgba');
  const mat = new THREE.MeshStandardMaterial({ map: a, normalMap: n, aoMap: o, roughnessMap: o, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.1, 1.1), aoMapIntensity: 1 });
  const U = { tNoise: { value: noise } };
  return hook(mat, (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH; varying float vH; varying vec3 vWP2; varying vec3 vWN2;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vH = aH; vWP2 = (modelMatrix * vec4(transformed,1.0)).xyz; vWN2 = normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH; varying vec3 vWP2; varying vec3 vWN2; uniform sampler2D tNoise;')
      .replace('#include <map_fragment>', `
  #include <map_fragment>
  vec4 mz = texture2D(tNoise, vWP2.xz*0.05 + vWP2.y*0.03);
  vec4 mz2 = texture2D(tNoise, vWP2.xy*0.21 + vWP2.zy*0.17);
  float moss = smoothstep(1.1, 0.0, vH) * smoothstep(0.35, 0.65, mz.g + mz2.r*0.4);
  moss = max(moss, smoothstep(0.75, 0.95, normalize(vWN2).y) * smoothstep(0.5, 0.75, mz2.g) * 0.8);
  float grime = smoothstep(0.4, 0.0, vH) * 0.35 + (mz.a-0.5)*0.25;
  diffuseColor.rgb *= 1.0 - grime*0.4;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20,0.30,0.09) * (0.7 + 0.6*mz2.b), clamp(moss,0.0,1.0)*0.85);
  float mossF = moss;
`)
      .replace('#include <roughnessmap_fragment>', `
  #include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 1.0, mossF);
`);
  }, 'wall' + kind);
}

// ---------------------------------------------------------------- painted machine metal with dirt, scratches, chips
// Triplanar in object space so it works on any primitive. amount controls overall wear.
export function paintMaterial(color, { amount = 1, rough = 0.42, clearcoat = 0.35, metal = 0.05, dirtColor = '#5b4630', scale = 0.55, key = '' } = {}) {
  const grime = tex('grime_mask');
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, clearcoat, clearcoatRoughness: 0.35 });
  const U = { tGrime: { value: grime }, uAmt: { value: amount }, uDirt: { value: new THREE.Color(dirtColor) }, uScale: { value: scale } };
  mat.userData.uniforms = U;
  return hook(mat, (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; varying vec3 vWNp;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vOP = position; vON = normal; vWNp = normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vOP; varying vec3 vON; varying vec3 vWNp; uniform sampler2D tGrime; uniform float uAmt; uniform vec3 uDirt; uniform float uScale;`)
      .replace('#include <map_fragment>', `
  vec3 an = pow(abs(normalize(vON)), vec3(4.0)); an /= (an.x+an.y+an.z);
  vec3 op = vOP * uScale;
  vec4 gm = texture2D(tGrime, op.yz)*an.x + texture2D(tGrime, op.xz)*an.y + texture2D(tGrime, op.xy)*an.z;
  float down = clamp(-normalize(vWNp).y, 0.0, 1.0);
  float dirt = smoothstep(0.45, 0.8, gm.r + down*0.3) * uAmt;
  float chip = gm.b * uAmt;
  float scr = gm.g * uAmt;
  diffuseColor.rgb = mix(diffuseColor.rgb, uDirt, clamp(dirt*0.75, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16,0.15,0.14), clamp(chip*0.9, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*1.25 + 0.06, clamp(scr*0.6, 0.0, 1.0));
  float wearF = dirt; float scrF = scr; float chipF = chip;
`)
      .replace('#include <roughnessmap_fragment>', `
  #include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor + wearF*0.45 + chipF*0.3 - scrF*0.15, 0.05, 1.0);
`)
      .replace('#include <metalnessmap_fragment>', `
  #include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 0.85, clamp(chipF*0.8 + scrF*0.5, 0.0, 1.0));
`)
      .replace('#include <clearcoat_normal_fragment_begin>', `
  #include <clearcoat_normal_fragment_begin>
`);
  }, 'paint' + key);
}

// emissive (glowing) material for lamps, windows, headlights (bloom picks these up)
export function glowMaterial(color, intensity = 4, key = 'glow') {
  return std({ color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.4 }, key);
}
