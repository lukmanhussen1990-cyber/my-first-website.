// Procedural textures generated once on the GPU at startup (tileable), so the
// heavy noise never runs per-pixel per-frame.
import * as THREE from 'three';
import { GLSL_NOISE } from './util.js';

const PERIODIC = /* glsl */ `
uniform float uSeed;
float ph12(vec2 p, float P){ p = mod(p, P); return hash12(p + uSeed); }
vec2 ph22(vec2 p, float P){ p = mod(p, P); return hash22(p + uSeed * 1.37); }
float pnoise(vec2 x, float P){ vec2 i = floor(x), f = fract(x); vec2 u = f*f*(3.-2.*f);
  return mix(mix(ph12(i,P), ph12(i+vec2(1,0),P), u.x), mix(ph12(i+vec2(0,1),P), ph12(i+vec2(1,1),P), u.x), u.y); }
float pfbm(vec2 x, float P){ float s = 0., a = .5; for(int k=0;k<5;k++){ s += a*pnoise(x,P); x *= 2.; P *= 2.; a *= .5; } return s; }
// periodic voronoi: x = F1, y = distance to cell edge, z = cell hash
vec3 pvor(vec2 x, float P){
  vec2 n = floor(x), f = fract(x); vec2 mg, mr; float md = 8.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g = vec2(i,j); vec2 o = ph22(n+g,P); vec2 r = g + o - f; float d = dot(r,r); if(d<md){ md=d; mr=r; mg=g; } }
  float ed = 8.;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ vec2 g = mg + vec2(i,j); vec2 o = ph22(n+g,P); vec2 r = g + o - f;
    if(dot(mr-r,mr-r) > 1e-5) ed = min(ed, dot(0.5*(mr+r), normalize(r-mr))); }
  return vec3(sqrt(md), ed, ph12(n+mg, P));
}
`;

function genTexture(renderer, size, frag, seed = 1.0) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
  });
  rt.texture.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSeed: { value: seed }, uRes: { value: size } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: GLSL_NOISE + PERIODIC + frag,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  mat.dispose();
  quad.geometry.dispose();
  return rt.texture;
}

// R: cracks, G: bubbles, B: cloudy layers, A: frost
const ICE_FRAG = /* glsl */ `
varying vec2 vUv; uniform float uRes;
float lineMask(float ed, float cells, float px){ float w = px / uRes * cells; return 1. - smoothstep(w*0.35, w, ed); }
void main(){
  vec2 uv = vUv;
  vec2 w = vec2(pfbm(uv*5., 5.), pfbm(uv*5. + vec2(5.2,1.3), 5.)) - 0.5;
  // big fracture network (broken polygons)
  vec3 v1 = pvor(uv*5. + w*0.9, 5.);
  float c1 = lineMask(v1.y, 5., 3.2) * smoothstep(0.42, 0.62, pfbm(uv*9. + 2.1, 9.));
  // medium cells
  vec2 w2 = vec2(pfbm(uv*14. + 9., 14.), pfbm(uv*14. + 3.3, 14.)) - 0.5;
  vec3 v2 = pvor(uv*13. + w2*0.8, 13.);
  float c2 = lineMask(v2.y, 13., 2.2) * smoothstep(0.5, 0.68, pfbm(uv*22. + 5.7, 22.));
  // fine hairline crazing
  vec3 v3 = pvor(uv*40. + w2*2., 40.);
  float c3 = lineMask(v3.y, 40., 1.5) * smoothstep(0.58, 0.75, pfbm(uv*30. + 1.9, 30.));
  float cracks = clamp(max(max(c1, c2*0.75), c3*0.45), 0., 1.);
  // bubbles: clustered in bands
  float band = smoothstep(0.35, 0.75, pfbm(vec2(uv.x*3., uv.y*11.) + 4., 3.));
  vec3 b1 = pvor(uv*70., 70.);
  float r1 = mix(0.05, 0.26, pow(fract(b1.z*7.31), 5.));
  float bub1 = (1. - smoothstep(r1*0.55, r1, b1.x)) * step(0.45, fract(b1.z*3.17)) * band;
  vec3 b2 = pvor(uv*190. + 3.1, 190.);
  float r2 = mix(0.08, 0.3, pow(fract(b2.z*5.13), 3.));
  float bub2 = (1. - smoothstep(r2*0.5, r2, b2.x)) * step(0.62, fract(b2.z*2.71)) * (0.35 + band);
  float bubbles = clamp(bub1 + bub2*0.8, 0., 1.);
  // cloudy layers (annual bands) + soft clouds
  float layers = 0.5 + 0.22*sin(6.2831853*(uv.y*9.) + pfbm(uv*4., 4.)*5.) + 0.28*(pfbm(uv*3. + 7.7, 3.) - 0.5)*2.;
  // frost patches
  float frost = smoothstep(0.42, 0.78, pfbm(uv*12. + 11., 12.)) * 0.8 + pfbm(uv*64., 64.)*0.2;
  gl_FragColor = vec4(cracks, bubbles, clamp(layers,0.,1.), clamp(frost,0.,1.));
}`;

const SNOW_FRAG = /* glsl */ `
varying vec2 vUv; uniform float uRes;
void main(){
  vec2 uv = vUv;
  float soft = pfbm(uv*6., 6.);
  float ripples = pfbm(vec2(uv.x*24., uv.y*8.) + soft*2., 8.);
  vec3 s = pvor(uv*260., 260.);
  float sparkle = (1. - smoothstep(0.03, 0.09, s.x)) * step(0.82, s.z);
  gl_FragColor = vec4(soft, ripples, sparkle, 1.);
}`;

export function makeTextures(renderer) {
  const ice = genTexture(renderer, 2048, ICE_FRAG, 3.0);
  const snow = genTexture(renderer, 1024, SNOW_FRAG, 7.0);

  // soft round sprite
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const sprite = new THREE.CanvasTexture(c);
  sprite.colorSpace = THREE.NoColorSpace;

  // soft puff (noisy cloud) sprite for breath/snow puffs
  const c2 = document.createElement('canvas');
  c2.width = c2.height = 128;
  const g2 = c2.getContext('2d');
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = 64 + (rnd() - 0.5) * 50, y = 64 + (rnd() - 0.5) * 50, r = 14 + rnd() * 26;
    const gg = g2.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, 'rgba(255,255,255,0.22)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gg;
    g2.fillRect(0, 0, 128, 128);
  }
  const puff = new THREE.CanvasTexture(c2);
  puff.colorSpace = THREE.NoColorSpace;

  return { ice, snow, sprite, puff };
}

// small environment map for subtle ice reflections ('day' = bright sunrise sky, for foil etc.)
export function makeEnv(renderer, mode = 'night') {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: mode === 'day' ? `varying vec3 vP; void main(){ vec3 d = normalize(vP);
      vec3 c = mix(vec3(1.3,0.85,0.7), vec3(0.35,0.55,1.0), smoothstep(0.0,0.7,d.y));
      c = mix(c, vec3(0.9,0.92,1.0), smoothstep(0.0,-0.3,d.y));
      c += vec3(3.0,1.8,1.0) * pow(max(dot(d, normalize(vec3(-0.6,0.1,-0.8))),0.), 40.) * 4.;
      gl_FragColor = vec4(c,1.); }` : `varying vec3 vP; void main(){ vec3 d = normalize(vP);
      vec3 c = mix(vec3(0.004,0.01,0.03), vec3(0.05,0.12,0.25), smoothstep(-0.2,0.8,d.y));
      c += vec3(0.8,0.9,1.0) * pow(max(dot(d, normalize(vec3(0.4,0.7,0.3))),0.), 200.) * 6.;
      c += vec3(0.12,0.2,0.3) * smoothstep(0.1,-0.4,d.y) * 0.3;
      gl_FragColor = vec4(c,1.); }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, 0.02).texture;
  pm.dispose();
  return env;
}
