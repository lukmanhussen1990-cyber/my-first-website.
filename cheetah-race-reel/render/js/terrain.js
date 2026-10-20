import * as THREE from 'three';
import { COURSE, groundHeight, trackDist, RIVER_X } from './course.js';
import { GLSL_NOISE, mulberry32, smoothstep, clamp } from './util.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// The savanna "slice": a long block of land whose front (z = 0) is cut open
// like cake, showing soil strata, roots and stones. The race track and the
// river are carved into its top.

const TILE = 25;

function zRows() {
  const zs = [];
  for (let z = 0; z > -26; z -= 0.25) zs.push(z);
  for (let z = -26; z > -44; z -= 0.75) zs.push(z);
  for (let z = -44; z >= -COURSE.BACK; z -= 3) zs.push(z);
  return zs;
}

function topMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMask;\nvarying vec3 vMask;\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vMask;\nvarying vec3 vWPos;\n${GLSL_NOISE}
        float groundH(vec2 p, float trk){
          float rip = sin(dot(p, vec2(0.83, 0.55)) * 9.0 + fbm2(p * 0.7) * 6.0) * 0.5 + 0.5;
          float grain = vnoise2(p * 38.0);
          float clod = fbm2(p * 3.1);
          return mix(clod * 0.035 + grain * 0.002, rip * 0.009 + grain * 0.0015, trk);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vWPos.xz;
          float trk = vMask.x, wet = vMask.y, edge = vMask.z;
          float n1 = fbm2(p * 0.35), n2 = fbm2(p * 2.3 + 5.0), n3 = vnoise2(p * 30.0);
          vec3 sand = mix(vec3(0.82, 0.58, 0.3), vec3(0.93, 0.7, 0.4), n1);
          sand *= 0.92 + 0.12 * n3;
          // faint tyre / paw scuffs along the racing line
          sand *= 1.0 - 0.06 * smoothstep(0.55, 0.9, n2) * trk;
          vec3 earth = mix(vec3(0.44, 0.31, 0.17), vec3(0.6, 0.47, 0.25), n1);
          earth = mix(earth, vec3(0.62, 0.52, 0.27), smoothstep(0.4, 0.75, n2));
          earth *= 0.9 + 0.15 * n3;
          vec3 mud = mix(vec3(0.2, 0.15, 0.1), vec3(0.32, 0.24, 0.15), n2);
          vec3 c = mix(earth, sand, trk);
          c = mix(c, mud, wet);
          c *= 1.0 - 0.18 * edge;
          diffuseColor.rgb = c;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float hh = groundH(vWPos.xz, vMask.x);
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hh), dhy = dFdy(hh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.55, vMask.y);`);
  };
  return m;
}

function faceMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTop;\nvarying float vTop;\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTop = aTop;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vTop;\nvarying vec3 vWPos;\n${GLSL_NOISE}
        // layer id and in-layer coordinate for the cut face
        vec3 strata(vec2 p, float top){
          float y = p.y;
          float w1 = 0.07 * sin(p.x * 0.21) + 0.06 * fbm2(vec2(p.x * 0.15, 3.0)) ;
          float w2 = 0.12 * sin(p.x * 0.11 + 1.3) + 0.1 * fbm2(vec2(p.x * 0.09, 7.0));
          float w3 = 0.2 * sin(p.x * 0.05 + 4.0) + 0.15 * fbm2(vec2(p.x * 0.05, 9.0));
          float dt = top - y; // depth below the local surface
          float id;
          if (dt < 0.11 + 0.03 * fbm2(vec2(p.x * 2.0, 1.0))) id = 0.0;        // topsoil + roots
          else if (y > -0.8 + w1) id = 1.0;                                     // golden sandy loam
          else if (y > -0.95 + w1) id = 2.0;                                    // pebble band
          else if (y > -2.05 + w2) id = 3.0;                                    // red laterite
          else if (y > -2.2 + w2) id = 4.0;                                     // dark band
          else if (y > -3.5 + w3) id = 5.0;                                     // ochre sandstone
          else id = 6.0;                                                        // bedrock
          return vec3(id, dt, 0.0);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vWPos.xy;
          vec3 L = strata(p, vTop);
          float id = L.x;
          float g = vnoise2(p * vec2(60.0, 60.0));
          float n = fbm2(p * vec2(1.4, 2.2));
          float n2 = fbm2(p * vec2(6.0, 9.0) + 3.0);
          vec3 c;
          if (id < 0.5) {
            c = mix(vec3(0.16, 0.1, 0.055), vec3(0.24, 0.15, 0.08), n);
            // fine roots hanging from the grass
            float r = smoothstep(0.92, 1.0, vnoise2(vec2(p.x * 26.0, p.y * 2.5)));
            c = mix(c, vec3(0.42, 0.32, 0.2), r * 0.7);
          } else if (id < 1.5) {
            c = mix(vec3(0.66, 0.45, 0.24), vec3(0.8, 0.58, 0.32), n);
            c *= 0.88 + 0.2 * g;
            float r = smoothstep(0.94, 1.0, vnoise2(vec2(p.x * 18.0, p.y * 1.6))) * smoothstep(-0.6, -0.15, p.y - vTop + 0.2);
            c = mix(c, vec3(0.3, 0.2, 0.12), r * 0.6);
          } else if (id < 2.5) {
            vec3 vo = voronoi2(p * 14.0);
            c = mix(vec3(0.42, 0.33, 0.25), vec3(0.62, 0.55, 0.47), smoothstep(0.35, 0.05, vo.x) * (0.5 + 0.5 * vo.z));
          } else if (id < 3.5) {
            c = mix(vec3(0.5, 0.2, 0.09), vec3(0.66, 0.3, 0.13), n);
            c = mix(c, vec3(0.78, 0.5, 0.25), smoothstep(0.62, 0.8, n2) * 0.6); // mottles
            c *= 0.9 + 0.14 * g;
          } else if (id < 4.5) {
            c = mix(vec3(0.2, 0.12, 0.08), vec3(0.3, 0.18, 0.11), n);
          } else if (id < 5.5) {
            float st = 0.5 + 0.5 * sin(p.y * 26.0 + fbm2(p * vec2(0.5, 3.0)) * 5.0);
            c = mix(vec3(0.62, 0.43, 0.22), vec3(0.78, 0.6, 0.33), st * 0.6 + n * 0.4);
            c *= 0.9 + 0.12 * g;
          } else {
            c = mix(vec3(0.3, 0.26, 0.24), vec3(0.42, 0.37, 0.33), n);
            float crack = smoothstep(0.03, 0.0, abs(fbm2(p * vec2(1.2, 0.8)) - 0.5));
            c *= 1.0 - 0.45 * crack;
          }
          // slightly darker toward the bottom (ambient occlusion of the slab)
          c *= mix(0.7, 1.0, smoothstep(-6.0, -1.0, p.y));
          diffuseColor.rgb = c;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vWPos.xy;
          float hh = fbm2(p * vec2(3.0, 5.0)) * 0.05 + vnoise2(p * 40.0) * 0.004;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hh), dhy = dFdy(hh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  return m;
}

function waterSurfaceMaterial(env) {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.03, 0.1, 0.11), roughness: 0.09, metalness: 0.0, envMap: env, envMapIntensity: 0.65, transparent: true, opacity: 0.9, depthWrite: true });
  m.userData.uTime = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = m.userData.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\n${GLSL_NOISE}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vWPos.xz;
          float t = uTime;
          float hh = fbm2(p * 1.3 + vec2(0.0, t * 0.6)) * 0.6 + vnoise2(p * 6.0 + vec2(t * 0.8, t * 1.1)) * 0.25;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hh), dhy = dFdy(hh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad * 0.08);
        }`);
  };
  return m;
}

function waterFaceMaterial() {
  // the water seen in cross-section at the cut: aquarium-like gradient with caustics
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTop: { value: COURSE.WATER_Y } },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform float uTop; varying vec3 vW;\n${GLSL_NOISE}
      void main(){
        float d = uTop - vW.y;
        vec3 deep = vec3(0.012, 0.04, 0.05), shallow = vec3(0.05, 0.17, 0.17);
        vec3 c = mix(shallow, deep, smoothstep(0.0, 0.9, d));
        // caustic light bands
        vec2 q = vec2(vW.x * 2.2, vW.y * 3.0 - uTime * 0.4);
        float ca = pow(1.0 - abs(fbm2(q + vec2(uTime * 0.3, 0.0)) * 2.0 - 1.0), 6.0);
        c += vec3(0.3, 0.5, 0.4) * ca * (1.0 - smoothstep(0.0, 0.7, d)) * 0.45;
        // bright meniscus line at the surface
        c += vec3(0.9, 0.7, 0.45) * smoothstep(0.035, 0.0, d) * 1.2;
        float a = mix(0.62, 0.86, smoothstep(0.0, 0.8, d));
        gl_FragColor = vec4(c * a, a);
      }`,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

export function makeTerrain(env) {
  const group = new THREE.Group();
  const topMat = topMaterial();
  const faceMat = faceMaterial();
  const zs = zRows();
  const tiles = [];
  for (let x0 = COURSE.X0; x0 < COURSE.X1; x0 += TILE) {
    const xs = [];
    for (let x = x0; x <= x0 + TILE + 1e-6; x += 0.25) xs.push(x);
    const nx = xs.length, nz = zs.length;
    const pos = new Float32Array(nx * nz * 3), mask = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = xs[i], z = zs[j];
      const h = groundHeight(x, z);
      const k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      const { d } = trackDist(x, z);
      const trk = 1 - smoothstep(COURSE.TRACK_HALF - 0.6, COURSE.TRACK_HALF + 0.9, d);
      const rd = Math.abs(x - RIVER_X(z));
      const wet = 1 - smoothstep(COURSE.RIVER_W / 2 - 0.6, COURSE.RIVER_W / 2 + 1.6, rd);
      mask[k] = trk * (1 - wet); mask[k + 1] = wet; mask[k + 2] = smoothstep(-0.6, 0, z) * 0.3;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      // rows go toward -z: (a, c, b) is counter-clockwise seen from above
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, topMat);
    mesh.receiveShadow = true;
    group.add(mesh);
    tiles.push(mesh);

    // cut face for this tile
    const fy = [];
    for (let k = 0; k <= 26; k++) fy.push(k / 26); // param from top (0) to bottom (1)
    const fpos = new Float32Array(nx * fy.length * 3), ftop = new Float32Array(nx * fy.length);
    const rnd = mulberry32(Math.floor(x0 * 13 + 7));
    for (let j = 0; j < fy.length; j++) for (let i = 0; i < nx; i++) {
      const x = xs[i];
      const top = groundHeight(x, 0);
      const u = fy[j];
      const y = top + (-COURSE.DEPTH - top) * Math.pow(u, 1.35);
      const k = (j * nx + i) * 3;
      const bump = j === 0 ? 0 : 0.03 * Math.sin(x * 3.1 + y * 2.3) * Math.sin(y * 4.7 - x * 1.3) + 0.012 * (rnd() - 0.5);
      fpos[k] = x; fpos[k + 1] = y; fpos[k + 2] = bump;
      ftop[j * nx + i] = top;
    }
    const fidx = [];
    for (let j = 0; j < fy.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      fidx.push(a, c, b, b, c, d);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    fg.setAttribute('aTop', new THREE.BufferAttribute(ftop, 1));
    fg.setIndex(fidx);
    fg.computeVertexNormals();
    const face = new THREE.Mesh(fg, faceMat);
    face.receiveShadow = true;
    group.add(face);
  }

  // stones embedded in the cut face (deterministic placement)
  let stoneGeo = new THREE.IcosahedronGeometry(1, 2);
  stoneGeo.deleteAttribute('uv'); stoneGeo.deleteAttribute('normal');
  stoneGeo = mergeVertices(stoneGeo);
  {
    const p = stoneGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const s = 1 + 0.18 * Math.sin(v.x * 3.1 + v.y * 2.2) * Math.cos(v.z * 2.7) + 0.08 * Math.sin(v.y * 7.0);
      v.multiplyScalar(s); p.setXYZ(i, v.x, v.y, v.z);
    }
    stoneGeo.computeVertexNormals();
  }
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, vertexColors: false });
  const nStones = 2200;
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, nStones);
  const rnd = mulberry32(4242);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < nStones * 3 && n < nStones; i++) {
    const x = COURSE.X0 + rnd() * (COURSE.X1 - COURSE.X0);
    const top = groundHeight(x, 0);
    let y, r;
    const band = rnd();
    if (band < 0.45) { y = -0.8 - rnd() * 0.15; r = 0.02 + rnd() * 0.035; }            // pebble band
    else if (band < 0.75) { y = top - 0.25 - rnd() * 5.4; r = 0.02 + Math.pow(rnd(), 3) * 0.1; }
    else { y = -2.3 - rnd() * 3.5; r = 0.03 + Math.pow(rnd(), 2) * 0.14; }
    if (y > top - 0.08) continue;
    e.set(rnd() * 6, rnd() * 6, rnd() * 6); q.setFromEuler(e);
    sc.set(r * (1 + rnd() * 0.6), r * (0.6 + rnd() * 0.4), r * (0.8 + rnd() * 0.4));
    pp.set(x, y, -r * 0.55);
    m4.compose(pp, q, sc);
    stones.setMatrixAt(n, m4);
    // weathered pebbles: grey-brown to rust, darker than the soil around them
    const tone = 0.16 + rnd() * 0.2, rust = rnd();
    col.setRGB(tone * (1.05 + 0.5 * rust), tone * (0.88 + 0.08 * rust), tone * (0.74 - 0.2 * rust));
    stones.setColorAt(n, col);
    n++;
  }
  stones.count = n;
  stones.receiveShadow = true;
  group.add(stones);

  // river: reflective surface + water cut face
  const water = new THREE.Group();
  const wsMat = waterSurfaceMaterial(env);
  {
    const pts = [];
    const rows = [];
    for (let z = 0; z >= -COURSE.BACK; z -= 1) rows.push(z);
    const half = COURSE.RIVER_W / 2 + 1.4;
    const pos = [], idx = [];
    rows.forEach((z, j) => {
      const xc = RIVER_X(z);
      for (let i = 0; i <= 8; i++) { const x = xc - half + (2 * half) * (i / 8); pos.push(x, COURSE.WATER_Y, z); }
      if (j > 0) for (let i = 0; i < 8; i++) {
        const a = (j - 1) * 9 + i, b = a + 1, c = j * 9 + i, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const surf = new THREE.Mesh(g, wsMat);
    surf.receiveShadow = true;
    water.add(surf);
  }
  const wfMat = waterFaceMaterial();
  {
    const pos = [], idx = [];
    const xc = RIVER_X(0), half = COURSE.RIVER_W / 2 + 1.4;
    const nx = 60;
    for (let i = 0; i <= nx; i++) {
      const x = xc - half + 2 * half * (i / nx);
      const bed = Math.min(groundHeight(x, 0), COURSE.WATER_Y);
      pos.push(x, COURSE.WATER_Y, 0.004, x, bed, 0.004);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const wf = new THREE.Mesh(g, wfMat);
    wf.renderOrder = 5;
    water.add(wf);
  }
  group.add(water);

  return {
    group, tiles, water,
    update(time) { wsMat.userData.uTime.value = time; wfMat.uniforms.uTime.value = time; },
  };
}
