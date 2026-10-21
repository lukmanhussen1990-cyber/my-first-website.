// Environment: sky, diorama ground (lawn + cut soil face), grass, fence, trees, street, neighbor houses, city, power station.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { soil, lawn, stucco, shingles, noiseTex, wood, stars } from './textures.js';
import { rng, fbm } from './util.js';

const TAU = Math.PI * 2;
export const NOISE_GLSL = /* glsl */`
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm2(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn2(p); p=p*2.03+vec2(17.1,9.2); a*=.5;} return s; }
`;

// ---------------- Sky ----------------
export function makeSky() {
  const u = {
    uTime: { value: 0 }, uStorm: { value: 0 }, uNight: { value: 0 }, uFlash: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.75, 0.16, -0.62).normalize() },
    uMoonDir: { value: new THREE.Vector3(0.32, 0.36, -0.88).normalize() },
    uStars: { value: stars() }, uBright: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: NOISE_GLSL + /* glsl */`
uniform float uTime,uStorm,uNight,uFlash,uBright; uniform vec3 uSunDir,uMoonDir; uniform sampler2D uStars;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float hh = max(h, 0.0);
  // golden hour
  vec3 zen = vec3(0.09,0.17,0.42), mid = vec3(0.95,0.48,0.42), hor = vec3(2.1,0.95,0.38);
  vec3 gold = mix(hor, mid, smoothstep(0.0, 0.16, hh));
  gold = mix(gold, zen, smoothstep(0.1, 0.62, hh));
  float sd = max(dot(d, uSunDir), 0.0);
  gold += vec3(2.4,1.1,0.35)*pow(sd, 6.0)*0.9 + vec3(5.0,2.6,1.1)*pow(sd, 400.0);
  // clouds (plane projection)
  vec2 cp = d.xz/(h+0.16)*1.4;
  float cl = fbm2(cp*1.3 + vec2(uTime*0.02, 0.0));
  float cov = smoothstep(0.48, 0.75, cl) * smoothstep(-0.02, 0.12, h);
  vec3 cloudGold = mix(vec3(2.2,0.95,0.55), vec3(0.75,0.38,0.5), smoothstep(0.55, 0.85, cl)) * (0.6+0.5*pow(sd,2.0)) ;
  gold = mix(gold, cloudGold, cov*0.85);
  // clear night
  vec3 nz = vec3(0.012,0.022,0.06), nh = vec3(0.05,0.07,0.13);
  vec3 nightc = mix(nh, nz, smoothstep(0.0, 0.5, hh));
  vec2 suv = vec2(atan(d.x, -d.z)/6.2831+0.5, 1.0 - hh);
  nightc += texture2D(uStars, suv*vec2(3.,1.5)).rgb * 0.45 * smoothstep(0.05, 0.3, hh);
  float md = max(dot(d, uMoonDir), 0.0);
  nightc += vec3(0.8,0.85,1.0)*(smoothstep(0.9993, 0.9996, md)*5.0 + pow(md, 400.0)*0.35 + pow(md, 40.0)*0.04);
  float ncl = fbm2(cp*1.1 + vec2(uTime*0.03, 0.0));
  nightc = mix(nightc, vec3(0.06,0.07,0.11)+vec3(0.2,0.22,0.3)*pow(md,8.0), smoothstep(0.55,0.8,ncl)*0.7*smoothstep(-0.02,0.15,h));
  // storm
  vec2 sp = cp*0.9 + vec2(uTime*0.09, uTime*0.025);
  float s1 = fbm2(sp*1.2);
  float s2 = fbm2(sp*2.7 + s1*1.8 - vec2(uTime*0.05,0.));
  float dens = smoothstep(0.25, 0.8, s1*0.6 + s2*0.5);
  vec3 stormc = mix(vec3(0.05,0.06,0.085), vec3(0.11,0.12,0.16), smoothstep(0.0,0.25,hh));
  stormc = mix(stormc, vec3(0.022,0.025,0.035), dens*0.85);
  stormc += vec3(0.05,0.055,0.075)*pow(s2,3.0);
  stormc += uFlash * (vec3(1.1,1.15,1.45) * (0.35 + 1.4*(1.0-dens)*s2)) ;
  vec3 base = mix(gold, nightc, uNight);
  vec3 col = mix(base, stormc, uStorm);
  // below horizon haze
  col = mix(col, mix(vec3(0.55,0.32,0.22), vec3(0.03,0.035,0.05), max(uNight,uStorm)), smoothstep(0.0, -0.08, h));
  gl_FragColor = vec4(col*uBright, 1.0);
}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return { mesh: sky, uniforms: u };
}

// Equirect environment canvas for PBR reflections / soft light
export function envCanvas(kind) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  if (kind === 'gold') {
    grd.addColorStop(0, '#2c4d8c'); grd.addColorStop(0.35, '#d98a6a'); grd.addColorStop(0.49, '#ffc070');
    grd.addColorStop(0.51, '#6b5a3a'); grd.addColorStop(1, '#3a3020');
  } else {
    grd.addColorStop(0, '#1b2233'); grd.addColorStop(0.45, '#2a3346'); grd.addColorStop(0.5, '#2c3240');
    grd.addColorStop(0.52, '#161a20'); grd.addColorStop(1, '#0c0e12');
  }
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  if (kind === 'gold') {
    // warm sun glow at left-back
    const sx = W * 0.39, sy = H * 0.44;
    const rg = g.createRadialGradient(sx, sy, 2, sx, sy, 120);
    rg.addColorStop(0, 'rgba(255,240,200,1)'); rg.addColorStop(0.2, 'rgba(255,190,110,0.8)'); rg.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  return c;
}

// ---------------- Lawn + stripes ----------------
function stripeShader(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform float uWet;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float stripe = step(0.5, fract(vWPos.x/1.6));
        float yard = step(vWPos.z, 0.05)*step(-6.4, vWPos.z)*step(abs(vWPos.x), 8.0);
        diffuseColor.rgb *= mix(1.0, mix(0.82, 1.12, stripe), yard);
        diffuseColor.rgb *= mix(1.0, 0.62, uWet);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.35, uWet);');
  };
}

export function makeGround(U) {
  const group = new THREE.Group();
  // lawn (backyard + neighbourhood)
  const lt = lawn();
  lt.map.repeat.set(20, 12); lt.normalMap.repeat.set(20, 12);
  const lawnMat = new THREE.MeshStandardMaterial({ map: lt.map, normalMap: lt.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.92 });
  stripeShader(lawnMat, { uWet: U.uWet });
  const lawnGeo = new THREE.PlaneGeometry(80, 48, 1, 1); lawnGeo.rotateX(-Math.PI / 2); lawnGeo.translate(0, 0, -24);
  const lawnM = new THREE.Mesh(lawnGeo, lawnMat); lawnM.receiveShadow = true; group.add(lawnM);

  // soil cut face (front of the "cake slice")
  const st = soil();
  const faceW = 60, faceH = 9;
  const faceGeo = new THREE.PlaneGeometry(faceW, faceH, 1, 1);
  faceGeo.translate(0, -faceH / 2, 0);
  const uv = faceGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * faceW / 8, uv.getY(i));
  for (const t of [st.map, st.normalMap, st.roughnessMap]) { t.repeat.set(1, 1); t.wrapT = THREE.ClampToEdgeWrapping; }
  const faceMat = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: st.roughnessMap, roughness: 1 });
  faceMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = U.uWet;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(1.0, 0.8, uWet);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, uWet);');
  };
  const face = new THREE.Mesh(faceGeo, faceMat); face.position.z = 0.0; face.receiveShadow = true;
  group.add(face);
  // rounded turf lip along the cut edge
  const lipGeo = new THREE.CylinderGeometry(0.05, 0.05, faceW, 12, 1, false, 0, Math.PI);
  lipGeo.rotateZ(Math.PI / 2); lipGeo.rotateX(Math.PI);
  const lipMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3b5e22'), roughness: 0.95, map: lt.map });
  const lip = new THREE.Mesh(lipGeo, lipMat); lip.position.set(0, -0.035, -0.035); lip.scale.set(1, 1, 0.8);
  group.add(lip);
  // dark backing so nothing shows through under the lawn
  const back = new THREE.Mesh(new THREE.BoxGeometry(faceW, faceH, 2), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
  back.position.set(0, -faceH / 2 - 0.02, -1.02); group.add(back);
  return { group, lawnMat, faceMat };
}

// ---------------- Grass blades ----------------
export function makeGrass(U, opts = {}) {
  const R = rng(1234);
  const segs = 4, Hb = 0.15, Wb = 0.022;
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const w = Wb * (1 - t) * (1 - 0.1 * t);
    const bend = t * t * 0.035;
    pos.push(-w / 2, t * Hb, bend, w / 2, t * Hb, bend);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const blades = [];
  const excl = opts.exclude || [];
  const add = (x, z) => {
    for (const e of excl) if (x > e[0] && x < e[1] && z > e[2] && z < e[3]) return;
    blades.push([x, z]);
  };
  const front = opts.countFront ?? 34000, backN = opts.countBack ?? 18000;
  for (let i = 0; i < front; i++) add(-7.5 + R() * 15, -3.2 + R() * 3.22);
  for (let i = 0; i < backN; i++) add(-8 + R() * 16, -6.4 + R() * 3.2);
  // overhang along the cut edge
  for (let i = 0; i < 2500; i++) add(-8 + R() * 16, -0.05 + R() * 0.06);
  const n = blades.length;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide, color: 0xffffff });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const d = new THREE.Object3D(); const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const [x, z] = blades[i];
    d.position.set(x, 0, z);
    d.rotation.set((R() - 0.5) * 0.35, R() * TAU, (R() - 0.5) * 0.35);
    const s = 0.65 + R() * 0.7; d.scale.set(1, s, 1);
    if (z > -0.02) { d.rotation.x = 0.5 + R() * 0.4; d.rotation.y = (R() - 0.5) * 0.6; }
    d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
    const stripe = Math.floor((x + 1000) / 0.8) % 2;
    const v = R();
    col.setRGB(0.10 + v * 0.06 + stripe * 0.05, 0.30 + v * 0.12 + stripe * 0.1, 0.05 + v * 0.04);
    if (R() < 0.05) col.setRGB(0.25, 0.32, 0.08);
    inst.setColorAt(i, col);
  }
  inst.receiveShadow = true; inst.castShadow = false;
  inst.frustumCulled = false;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind, uWet: U.uWet });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; varying float vHgt;\n' + NOISE_GLSL)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(normal, vec3(0.,1.,0.), 0.55));\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
      .replace('#include <project_vertex>', `
        vHgt = clamp(position.y / ${Hb.toFixed(3)}, 0., 1.);
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        vec4 basep = instanceMatrix * vec4(0.,0.,0.,1.);
        #else
        vec4 basep = vec4(0.);
        #endif
        vec2 wdir = normalize(vec2(1.0, 0.35));
        vec2 gp = basep.xz*0.45 - wdir*uTime*(0.8+uWind*2.2); float g = vn2(gp)*0.65 + vn2(gp*2.1+7.3)*0.35;
        float sway = sin(uTime*(1.6+uWind*5.0) + basep.x*1.7 + basep.z*1.3)*0.5+0.5;
        float bend = (0.12 + uWind*(0.55 + 0.9*g)) * (0.6+0.4*sway);
        float hh = vHgt*vHgt;
        float ang = bend*hh*1.4;
        float L = (mvPosition.y - basep.y);
        mvPosition.xz += wdir * sin(ang) * L * 0.9;
        mvPosition.y = basep.y + L * cos(ang);
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHgt; uniform float uWet;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.35, 1.25, vHgt) * mix(1.0, 0.7, uWet);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, uWet);');
  };
  return inst;
}

// small daisies
export function makeFlowers(exclude) {
  const R = rng(55);
  const g = new THREE.Group();
  const petal = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const center = new THREE.MeshStandardMaterial({ color: '#ffc21a', roughness: 0.6 });
  const n = 260;
  const pg = new THREE.CircleGeometry(0.022, 10); pg.rotateX(-Math.PI / 2);
  const cg = new THREE.SphereGeometry(0.008, 8, 6);
  const ip = new THREE.InstancedMesh(pg, petal, n), ic = new THREE.InstancedMesh(cg, center, n);
  const d = new THREE.Object3D();
  let k = 0;
  while (k < n) {
    const x = -7.5 + R() * 15, z = -6.2 + R() * 6.1;
    let bad = false; for (const e of exclude) if (x > e[0] && x < e[1] && z > e[2] && z < e[3]) bad = true;
    if (bad) continue;
    d.position.set(x, 0.09 + R() * 0.04, z); d.rotation.set((R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4); d.updateMatrix();
    ip.setMatrixAt(k, d.matrix); ic.setMatrixAt(k, d.matrix); k++;
  }
  g.add(ip, ic);
  return g;
}

// ---------------- Fence ----------------
export function makeFence() {
  const g = new THREE.Group();
  const w = wood(21, [238, 234, 226]);
  const mat = new THREE.MeshStandardMaterial({ map: w.map, normalMap: w.normalMap, roughness: 0.7, color: '#ffffff' });
  const shape = new THREE.Shape();
  shape.moveTo(-0.045, 0); shape.lineTo(0.045, 0); shape.lineTo(0.045, 0.62); shape.lineTo(0, 0.7); shape.lineTo(-0.045, 0.62); shape.closePath();
  const pg = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  const xs = []; for (let x = -9; x <= 9; x += 0.16) xs.push([x, -6.6]);
  for (let z = -6.6; z <= -0.3; z += 0.16) { xs.push([-9, z, 1]); xs.push([9, z, 1]); }
  const inst = new THREE.InstancedMesh(pg, mat, xs.length);
  const d = new THREE.Object3D();
  xs.forEach(([x, z, side], i) => { d.position.set(x, 0, z); d.rotation.set(0, side ? Math.PI / 2 : 0, 0); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); });
  inst.castShadow = true; inst.receiveShadow = true;
  g.add(inst);
  const railG = new THREE.BoxGeometry(18, 0.06, 0.03);
  for (const y of [0.18, 0.5]) { const r = new THREE.Mesh(railG, mat); r.position.set(0, y, -6.63); r.castShadow = true; g.add(r); }
  return g;
}

// ---------------- Trees & bushes ----------------
export function makeTree(seed, scale = 1, leafCol = '#4f8a32') {
  const R = rng(seed);
  const g = new THREE.Group();
  const bark = noiseTex('bark', [110, 80, 56], 6, 0.3, 3, 256, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.16 * scale, 1.6 * scale, 12), trunkMat);
  trunk.position.y = 0.8 * scale; trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
  const canopy = new THREE.Group(); canopy.position.y = 1.4 * scale; g.add(canopy);
  const leaf = noiseTex('leaf' + leafCol, [255, 255, 255], 24, 0.25, 4, 256, 1);
  const lm = new THREE.MeshStandardMaterial({ color: new THREE.Color(leafCol), roughness: 0.8, normalMap: leaf.normalMap, normalScale: new THREE.Vector2(1.5, 1.5) });
  for (let i = 0; i < 7; i++) {
    const geo = new THREE.IcosahedronGeometry((0.45 + R() * 0.35) * scale, 3);
    const p = geo.attributes.position; const v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); const n = fbm(v.x * 3 + seed, v.y * 3 + v.z * 2, 64, 3, 3); v.multiplyScalar(1 + (n - 0.5) * 0.35); p.setXYZ(k, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, lm);
    const a = R() * TAU, r = (i === 0 ? 0 : 0.45 + R() * 0.25) * scale;
    m.position.set(Math.cos(a) * r, (i === 0 ? 0.75 : 0.3 + R() * 0.7) * scale, Math.sin(a) * r);
    m.castShadow = true; m.receiveShadow = true;
    canopy.add(m);
  }
  g.userData.canopy = canopy; g.userData.leafMat = lm;
  return g;
}
export function makeBush(seed, s = 1) {
  const R = rng(seed);
  const g = new THREE.Group();
  const lm = new THREE.MeshStandardMaterial({ color: '#3f7a2c', roughness: 0.85, normalMap: noiseTex('leaf#bush', [255, 255, 255], 24, 0.25, 4, 256, 1).normalMap, normalScale: new THREE.Vector2(1.5, 1.5) });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry((0.22 + R() * 0.12) * s, 2), lm);
    m.position.set((R() - 0.5) * 0.5 * s, 0.18 * s, (R() - 0.5) * 0.3 * s); m.scale.y = 0.8;
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  return g;
}

// ---------------- Simple neighbor house (not cut) ----------------
// returns { group, windows: [{mesh, worldPos}], setPower(p) }
export function makeNeighborHouse(o) {
  const g = new THREE.Group();
  const w = o.w || 2.8, d = o.d || 2.4, h = o.h || 2.6, roofH = o.roofH || 1.1;
  const st = stucco(o.wall || [200, 210, 228], o.seed || 5);
  const wallMat = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const sh = shingles(o.roof || [120, 70, 60]);
  sh.map.repeat.set(2, 2); sh.normalMap.repeat.set(2, 2);
  const roofMat = new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normalMap, roughness: 0.85 });
  const roof = new THREE.Mesh(prismGeo(w + 0.3, roofH, d + 0.3), roofMat); roof.position.y = h; roof.castShadow = true; g.add(roof);
  const trim = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.6 });
  const wins = [];
  const glassMat = new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.15, metalness: 0.1, emissive: new THREE.Color('#ffb15a'), emissiveIntensity: 0 });
  const cols = o.cols || 2;
  for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
    const x = (c - (cols - 1) / 2) * (w / cols);
    const y = r === 0 ? h * 0.3 : h * 0.72;
    if (r === 0 && c === Math.floor(cols / 2) && o.door !== false) {
      const door = new THREE.Mesh(new RoundedBoxGeometry(0.5, 1.0, 0.06, 2, 0.02), new THREE.MeshStandardMaterial({ color: o.doorCol || '#7a3b2a', roughness: 0.6 }));
      door.position.set(x, 0.5, d / 2 + 0.01); g.add(door);
      continue;
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.05), trim); frame.position.set(x, y, d / 2 + 0.005); g.add(frame);
    const gm = glassMat;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), gm); glass.position.set(x, y, d / 2 + 0.035); g.add(glass);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), trim); bar.position.set(x, y, d / 2 + 0.04); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.02), trim); bar2.position.set(x, y, d / 2 + 0.04); g.add(bar2);
    wins.push({ glass, mat: gm, local: new THREE.Vector3(x, y, d / 2), row: r });
  }
  g.userData.windows = wins;
  return g;
}
export function prismGeo(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
  return geo;
}

// ---------------- Street ----------------
export function makeStreet(U) {
  const g = new THREE.Group();
  const asp = noiseTex('asphalt', [70, 72, 78], 48, 0.25, 1.5, 512);
  asp.map.repeat.set(30, 1); asp.normalMap.repeat.set(30, 1);
  const am = new THREE.MeshStandardMaterial({ map: asp.map, normalMap: asp.normalMap, roughness: 0.85 });
  am.onBeforeCompile = (sh) => { sh.uniforms.uWet = U.uWet; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet;').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, uWet);').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0,0.55,uWet);'); };
  const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 2.6), am); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.012, -8.1); road.receiveShadow = true; g.add(road);
  const sw = new THREE.MeshStandardMaterial({ color: '#b9b4aa', roughness: 0.9 });
  for (const z of [-6.95, -9.75]) { const s = new THREE.Mesh(new THREE.BoxGeometry(90, 0.05, 0.6), sw); s.position.set(0, 0.025, z); s.receiveShadow = true; g.add(s); }
  const lineM = new THREE.MeshBasicMaterial({ color: '#d8c890' });
  for (let x = -40; x < 40; x += 1.2) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.06), lineM); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.016, -8.1); g.add(l); }
  // street lights
  const pole = new THREE.MeshStandardMaterial({ color: '#2d3138', roughness: 0.4, metalness: 0.8 });
  const lamps = [];
  const sharedLampHead = new THREE.MeshStandardMaterial({ color: '#333', emissive: new THREE.Color('#ffd28a'), emissiveIntensity: 0 });
  for (const x of [-10, -4.5, 1.5, 7.5, 13]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 2.4, 10), pole); p.position.set(x, 1.2, -9.6); p.castShadow = true; g.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), pole); arm.position.set(x, 2.38, -9.38); g.add(arm);
    const headMat = sharedLampHead;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.07, 14), headMat); head.position.set(x, 2.34, -9.15); g.add(head);
    lamps.push({ mat: headMat, x });
  }
  g.userData.lamps = lamps;
  return g;
}

// ---------------- City ----------------
export function makeCity(U) {
  const R = rng(2024);
  const items = [];
  // suburbs and downtown
  for (let z = -88; z > -250; z -= 3.6) {
    for (let x = -120; x < 120; x += 3.4) {
      if (R() < 0.2) continue;
      const dz = -z; const downtown = Math.exp(-((x - 8) ** 2) / 1400 - ((z + 170) ** 2) / 1200);
      const hgt = dz < 115 ? 1.3 + R() * 2.0 : 2.2 + R() * 4.5 + downtown * (7 + R() * 13);
      const wx = 1.8 + R() * 1.2, wz = 1.8 + R() * 1.2;
      items.push({ x: x + (R() - 0.5) * 0.8, z: z + (R() - 0.5) * 0.8, w: wx, d: wz, h: hgt, seed: R() * 100 });
    }
  }
  const station = new THREE.Vector3(-44, 0, -150);
  const maxD = 170;
  const n = items.length;
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const aPower = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const aSize = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  geo.setAttribute('aPower', aPower); geo.setAttribute('aSeed', aSeed); geo.setAttribute('aSize', aSize);
  const mat = new THREE.MeshStandardMaterial({ color: '#8a8f9a', roughness: 0.75, metalness: 0.1 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uNight: U.uNight, uWinBoost: U.uWinBoost });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPower; attribute float aSeed; attribute vec3 aSize; varying float vPower; varying float vSeed; varying vec3 vLP; varying vec3 vSize; varying vec3 vN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vPower = aPower; vSeed = aSeed; vLP = position; vSize = aSize; vN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uWinBoost; varying float vPower; varying float vSeed; varying vec3 vLP; varying vec3 vSize; varying vec3 vN;\nfloat hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 fc = abs(vN.x) > 0.5 ? vec2(vLP.z*vSize.z, vLP.y*vSize.y) : vec2(vLP.x*vSize.x, vLP.y*vSize.y);
        vec2 cell = floor(fc / vec2(0.42, 0.5));
        vec2 f = fract(fc / vec2(0.42, 0.5));
        float win = step(0.18, f.x)*step(f.x, 0.82)*step(0.22, f.y)*step(f.y, 0.78) * step(0.4, vLP.y*vSize.y) * (1.0 - step(0.5, abs(vN.y)));
        float lit = step(hh(cell + vSeed), mix(0.35, 0.72, uNight));
        vec3 wc = mix(vec3(1.0,0.72,0.38), vec3(0.85,0.9,1.0), step(0.75, hh(cell*1.7+vSeed)));
        totalEmissiveRadiance += wc * win * lit * vPower * uWinBoost;
        diffuseColor.rgb *= mix(1.0, 0.45, win);`);
  };
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const d = new THREE.Object3D();
  const order = new Float32Array(n);
  items.forEach((it, i) => {
    d.position.set(it.x, 0, it.z); d.scale.set(it.w, it.h, it.d); d.rotation.set(0, 0, 0); d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
    aSeed.setX(i, it.seed); aSize.setXYZ(i, it.w, it.h, it.d); aPower.setX(i, 1);
    order[i] = Math.min(1, (Math.floor(Math.hypot(it.x - station.x, it.z - station.z) / 16) * 16 + R() * 3) / maxD);
  });
  inst.castShadow = false; inst.receiveShadow = false;
  // ground
  const groundMat = new THREE.MeshStandardMaterial({ color: '#2d3a2a', roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.03, -230);
  // street light dots along city roads
  const dotsGeo = new THREE.OctahedronGeometry(0.14, 0);
  const lamps = [];
  for (let z = -89.8; z > -250; z -= 7.2) for (let x = -120; x < 120; x += 2.2) lamps.push([x + (R() - 0.5) * 0.3, z]);
  for (let x = -118.3; x < 120; x += 10.2) for (let z = -88; z > -250; z -= 2.2) lamps.push([x, z]);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.95, 0.42) });
  const lampInst = new THREE.InstancedMesh(dotsGeo, lampMat, lamps.length);
  const lampOrder = new Float32Array(lamps.length);
  const lampPos = lamps.map(([x, z], i) => { lampOrder[i] = Math.min(1, (Math.floor(Math.hypot(x - station.x, z - station.z) / 16) * 16) / maxD); return new THREE.Vector3(x, 0.25, z); });
  const g = new THREE.Group(); g.add(inst, ground, lampInst);
  const powerStation = makePowerStation(); powerStation.position.copy(station); g.add(powerStation);
  // hills on the horizon
  const hillMat = new THREE.MeshStandardMaterial({ color: '#2a3524', roughness: 1 });
  for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(30 + R() * 30, 24, 12), hillMat); h.position.set(-200 + i * 50, -22 - R() * 8, -300 - R() * 40); h.scale.x = 1.6; h.scale.y = 0.55; g.add(h); }
  return {
    group: g, inst, aPower, order, lampInst, lampPos, lampOrder, station, powerStation,
    setPower(fn) {
      for (let i = 0; i < n; i++) aPower.setX(i, fn(order[i]));
      aPower.needsUpdate = true;
      const m = new THREE.Matrix4();
      for (let i = 0; i < lampPos.length; i++) {
        const p = fn(lampOrder[i]);
        m.makeScale(p, p, p).setPosition(lampPos[i]);
        lampInst.setMatrixAt(i, m);
      }
      lampInst.instanceMatrix.needsUpdate = true;
    },
  };
}

function makePowerStation() {
  const g = new THREE.Group();
  const conc = new THREE.MeshStandardMaterial({ color: '#b8b4ac', roughness: 0.9 });
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; const r = 3.2 - 1.6 * Math.sin(t * Math.PI * 0.85) + t * 0.4; pts.push(new THREE.Vector2(r, t * 9)); }
  for (const [x, z] of [[-4, -2], [3, -4]]) { const ct = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), conc); ct.position.set(x, 0, z); g.add(ct); }
  const bld = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 5), new THREE.MeshStandardMaterial({ color: '#7d8590', roughness: 0.8 })); bld.position.set(-0.5, 2, 4); g.add(bld);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 16, 16), new THREE.MeshStandardMaterial({ color: '#c9c3bb', roughness: 0.8 })); stack.position.set(5, 8, 2); g.add(stack);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 1.2, 16), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 })); band.position.set(5, 14.5, 2); g.add(band);
  // lights on station
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.5) });
  const lights = [];
  for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), lightMat); l.position.set(-4 + (i % 7) * 1.2, 3.2 + Math.floor(i / 7) * 0.7, 6.6); g.add(l); lights.push(l); }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 0.3) })); top.position.set(5, 16.2, 2); g.add(top); lights.push(top);
  // pylons
  const steel = new THREE.MeshStandardMaterial({ color: '#8d939b', roughness: 0.5, metalness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Group();
    const legGeo = new THREE.CylinderGeometry(0.06, 0.12, 8, 4);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(legGeo, steel); l.position.set(s * 0.6, 4, 0); l.rotation.z = s * 0.12; p.add(l); }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 0.15), steel); arm.position.y = 7.4; p.add(arm);
    p.position.set(10 + i * 10, 0, 6 + i * 3); g.add(p);
  }
  g.userData.lights = lights;
  g.userData.strikePoint = new THREE.Vector3(5, 16.4, 2);
  return g;
}
