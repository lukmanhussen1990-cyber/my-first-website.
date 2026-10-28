import React, {useLayoutEffect, useMemo} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CORNERS, CS, FX, FZ, Shot, applyCam, cornerGlow, cornerOf, cutTime, fieldCam, isTop, sweepX} from './fieldLayout';
import {rand} from '../lib/anim';
import {PostFX} from './PostFX';

// ------------------------------------------------------------------ wheat clump geometry (4 stalks, vertex colours)
const STEM_LO = new THREE.Color('#A8913E'), STEM_HI = new THREE.Color('#E2B958'), HEAD = new THREE.Color('#FAD36A'), HEAD_S = new THREE.Color('#E0A63E');
function stalk(seed: number): THREE.BufferGeometry {
  const h = 0.92 + rand(seed, 1) * 0.28;
  const lx = (rand(seed, 2) - 0.5) * 0.18, lz = (rand(seed, 3) - 0.5) * 0.18;
  const ox = (rand(seed, 4) - 0.5) * 0.14, oz = (rand(seed, 5) - 0.5) * 0.14;
  const pos: number[] = [], col: number[] = [];
  const r = 0.008;
  const P = (y: number, a: number, rr: number) => [ox + lx * y + Math.cos(a) * rr, y, oz + lz * y + Math.sin(a) * rr];
  // 3-sided stem
  for (let s = 0; s < 3; s++) {
    const a0 = (s / 3) * Math.PI * 2, a1 = ((s + 1) / 3) * Math.PI * 2;
    const yTop = h - 0.16;
    const q = [P(0, a0, r), P(0, a1, r), P(yTop, a1, r * 0.7), P(yTop, a0, r * 0.7)];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      pos.push(...q[idx]);
      const c = q[idx][1] > 0.1 ? STEM_HI : STEM_LO;
      col.push(c.r, c.g, c.b);
    }
  }
  // head: elongated octahedron
  const hy0 = h - 0.26, hy1 = h + 0.04, hr = 0.046;
  const mid = (hy0 + hy1) / 2 + 0.02;
  const top = [ox + lx * hy1, hy1, oz + lz * hy1], bot = [ox + lx * hy0, hy0, oz + lz * hy0];
  const ring = [0, 1, 2, 3].map((k) => {
    const a = (k / 4) * Math.PI * 2 + rand(seed, 6);
    return [ox + lx * mid + Math.cos(a) * hr, mid, oz + lz * mid + Math.sin(a) * hr];
  });
  for (let k = 0; k < 4; k++) {
    const a = ring[k], b = ring[(k + 1) % 4];
    for (const v of [top, a, b, bot, b, a]) pos.push(...v);
    for (let j = 0; j < 6; j++) {
      const c = j < 3 ? HEAD : HEAD_S;
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
function clumpGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([stalk(1), stalk(2), stalk(3), stalk(4)])!;
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ shader patch: wind, reaping, corner glow
const VERT_HEAD = `
attribute float aCut;
attribute float aPhase;
attribute float aCorner;
uniform float uTime;
uniform float uWind;
uniform vec4 uGlow;
varying float vGlow;
varying float vCutK;
varying float vH;
`;
const VERT_BEGIN = `
vec3 transformed = vec3(position);
float cutK = aCut < -50.0 ? 1.0 : (aCut < 0.0 ? 0.0 : smoothstep(aCut, aCut + 0.18, uTime));
vH = clamp(position.y / 1.2, 0.0, 1.0);
transformed.y *= mix(1.0, 0.07, cutK);
transformed.xz *= mix(1.0, 0.35, cutK);
vCutK = cutK;
float g = 0.0;
if (aCorner > 0.5 && aCorner < 1.5) g = uGlow.x;
else if (aCorner > 1.5 && aCorner < 2.5) g = uGlow.y;
else if (aCorner > 2.5 && aCorner < 3.5) g = uGlow.z;
else if (aCorner > 3.5) g = uGlow.w;
vGlow = g;
`;
const VERT_PROJECT = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
float bend = pow(clamp(transformed.y / 1.15, 0.0, 1.0), 1.7);
float wx = sin(uTime * 1.7 + aPhase + mvPosition.x * 0.45 + mvPosition.z * 0.2) * 0.65 + sin(uTime * 2.9 + aPhase * 1.7) * 0.35;
float gust = 0.6 + 0.4 * sin(uTime * 0.6 + mvPosition.x * 0.08);
mvPosition.x += bend * wx * uWind * gust;
mvPosition.z += bend * wx * uWind * 0.45 * gust;
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;
const FRAG_HEAD = `
varying float vGlow;
varying float vCutK;
varying float vH;
`;
function patchWheat(mat: THREE.Material, uniforms: Record<string, THREE.IUniform>, depth = false) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = VERT_HEAD + shader.vertexShader
      .replace('#include <begin_vertex>', VERT_BEGIN)
      .replace('#include <project_vertex>', VERT_PROJECT);
    if (!depth) {
      shader.fragmentShader = FRAG_HEAD + shader.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.58, 0.34), vCutK * 0.95);
          diffuseColor.rgb *= mix(0.72, 1.05, vH);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.66, 0.2) * vGlow * (0.18 + 0.75 * vH) * (1.0 - vCutK);`);
    }
  };
  mat.customProgramCacheKey = () => (depth ? 'wheat-depth' : 'wheat');
}

// ------------------------------------------------------------------ wheat field (instanced)
const Wheat: React.FC<{shot: Shot; t: number; spacing: number; region: [number, number, number, number]}> = ({shot, t, spacing, region}) => {
  const uniforms = useMemo(() => ({uTime: {value: 0}, uWind: {value: 0.1}, uGlow: {value: new THREE.Vector4()}}), []);
  const mesh = useMemo(() => {
    const geo = clumpGeometry();
    const pts: number[][] = [];
    const [x0, x1, z0, z1] = region;
    let i = 0;
    for (let x = Math.max(-FX, x0) + spacing / 2; x < Math.min(FX, x1); x += spacing) {
      for (let z = Math.max(-FZ, z0) + spacing / 2; z < Math.min(FZ, z1); z += spacing) {
        const jx = x + (rand(7, i) - 0.5) * spacing * 0.8, jz = z + (rand(8, i) - 0.5) * spacing * 0.8;
        pts.push([jx, jz, rand(9, i), rand(10, i), rand(11, i)]);
        i++;
      }
    }
    const n = pts.length;
    const mat = new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, emissive: new THREE.Color('#000000')});
    patchWheat(mat, uniforms);
    const m = new THREE.InstancedMesh(geo, mat, n);
    const depthMat = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking});
    patchWheat(depthMat, uniforms, true);
    m.customDepthMaterial = depthMat;
    const aCut = new Float32Array(n), aPhase = new Float32Array(n), aCorner = new Float32Array(n);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    pts.forEach(([x, z, r1, r2, r3], k) => {
      o.position.set(x, 0, z);
      o.rotation.set(0, r1 * Math.PI * 2, 0);
      const s = 0.88 + r2 * 0.26;
      o.scale.set(1, s, 1);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
      // near-white tint so the vertex colours keep their hue; just a little per-clump variation
      const b = 0.88 + r2 * 0.2;
      c.setRGB(b, b * (0.96 + (r3 - 0.5) * 0.08), b * (0.9 + (r1 - 0.5) * 0.12));
      m.setColorAt(k, c);
      aCut[k] = cutTime(shot, x, z, r3 - 0.5);
      aPhase[k] = r1 * 6.28;
      aCorner[k] = cornerOf(x, z);
    });
    geo.setAttribute('aCut', new THREE.InstancedBufferAttribute(aCut, 1));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    geo.setAttribute('aCorner', new THREE.InstancedBufferAttribute(aCorner, 1));
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  }, [shot, spacing, region, uniforms]);
  const g = cornerGlow(shot, t);
  uniforms.uTime.value = t;
  uniforms.uWind.value = isTop(shot) ? 0.07 : 0.11;
  uniforms.uGlow.value.set(g[0], g[1], g[2], g[3]);
  return <primitive object={mesh} />;
};

// ------------------------------------------------------------------ sheaves left behind the reapers
const Sheaves: React.FC<{shot: Shot; t: number}> = ({shot, t}) => {
  const {mesh, items} = useMemo(() => {
    const body = new THREE.CylinderGeometry(0.1, 0.22, 0.5, 7);
    body.translate(0, 0.25, 0);
    const top = new THREE.CylinderGeometry(0.26, 0.1, 0.42, 7);
    top.translate(0, 0.71, 0);
    const cap = new THREE.ConeGeometry(0.26, 0.16, 7);
    cap.translate(0, 1.0, 0);
    const parts = [body, top, cap].map((g, i) => {
      const ng = g.toNonIndexed();
      const col = new THREE.Color(['#D2A752', '#F0C25C', '#F6CF6A'][i]);
      const arr = new Float32Array(ng.attributes.position.count * 3);
      for (let k = 0; k < arr.length; k += 3) arr.set([col.r, col.g, col.b], k);
      ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return ng;
    });
    const geo = mergeGeometries(parts)!;
    const mat = new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.95});
    const list: {x: number; z: number; ct: number}[] = [];
    let i = 0;
    for (let x = -FX + 1.4; x < FX; x += 2.4) {
      for (let z = -FZ + 1.4; z < FZ; z += 2.8) {
        const jx = x + (rand(21, i) - 0.5) * 0.8, jz = z + (rand(22, i) - 0.5) * 0.8;
        i++;
        if (cornerOf(jx, jz)) continue;
        if (shot === 'S2' && jz < -FZ + CS + 4 && jx > -6) continue;
        if (!isTop(shot) && shot !== 'S2' && !(jz < -11.6 && Math.abs(jx) < 4.6)) continue;
        if (shot === 'S2' && !(jz < -13.4 || jx < -4)) continue;
        const ct = cutTime(shot, jx, jz, 0);
        list.push({x: jx, z: jz, ct});
      }
    }
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    return {mesh: m, items: list};
  }, [shot]);
  const o = new THREE.Object3D();
  items.forEach((it, k) => {
    const appear = it.ct < -50 ? 1 : THREE.MathUtils.smoothstep(t, it.ct + 0.25, it.ct + 0.55);
    o.position.set(it.x, 0, it.z);
    o.rotation.set(0, k * 1.3, (rand(23, k) - 0.5) * 0.15);
    const ss = isTop(shot) ? 1 : 0.72;
    o.scale.set(appear * ss, Math.max(0.001, appear * ss), appear * ss);
    o.updateMatrix();
    mesh.setMatrixAt(k, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return <primitive object={mesh} />;
};

// ------------------------------------------------------------------ surroundings
const Surroundings: React.FC<{ground: boolean}> = ({ground}) => {
  const objs = useMemo(() => {
    const group = new THREE.Group();
    // earth: big low-poly plane with gentle bumps outside the field
    const earth = new THREE.PlaneGeometry(420, 420, 70, 70);
    earth.rotateX(-Math.PI / 2);
    const p = earth.attributes.position as THREE.BufferAttribute;
    const cols: number[] = [];
    const cA = new THREE.Color('#A47C4C'), cB = new THREE.Color('#957044');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const inField = Math.abs(x) < FX + 1.5 && Math.abs(z) < FZ + 1.5;
      const d = Math.max(0, Math.hypot(Math.max(0, Math.abs(x) - FX - 6), Math.max(0, Math.abs(z) - FZ - 6)));
      p.setY(i, inField ? -0.02 : Math.sin(x * 0.07) * Math.cos(z * 0.06) * Math.min(2.4, d * 0.06) - 0.05);
      const c = cA.clone().lerp(cB, rand(31, i));
      cols.push(c.r, c.g, c.b);
    }
    earth.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const em = new THREE.Mesh(earth.toNonIndexed(), new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 1}));
    (em.geometry as THREE.BufferGeometry).computeVertexNormals();
    em.receiveShadow = true;
    group.add(em);
    // field soil
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(FX * 2 + 0.6, FZ * 2 + 0.6), new THREE.MeshStandardMaterial({color: '#D3AF6C', roughness: 1}));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.005;
    soil.receiveShadow = true;
    group.add(soil);
    // paths along the left and bottom
    const pathMat = new THREE.MeshStandardMaterial({color: '#D9B47A', roughness: 1});
    const pathL = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 120), pathMat);
    pathL.rotation.x = -Math.PI / 2;
    pathL.position.set(-FX - 2.4, 0.01, 0);
    pathL.receiveShadow = true;
    group.add(pathL);
    const pathB = new THREE.Mesh(new THREE.PlaneGeometry(120, 2.0), pathMat);
    pathB.rotation.x = -Math.PI / 2;
    pathB.position.set(0, 0.01, FZ + 2.6);
    pathB.receiveShadow = true;
    group.add(pathB);
    // low stone walls with gaps
    const stones: THREE.Vector3[] = [];
    for (let x = -FX - 1; x <= FX + 1; x += 0.62) {
      if (rand(41, Math.round(x * 10)) > 0.2) stones.push(new THREE.Vector3(x, 0, -FZ - 1.1));
      if (rand(42, Math.round(x * 10)) > 0.25 && Math.abs(x) > 1.5) stones.push(new THREE.Vector3(x, 0, FZ + 1.1));
    }
    for (let z = -FZ - 1; z <= FZ + 1; z += 0.62) {
      if (rand(43, Math.round(z * 10)) > 0.2) stones.push(new THREE.Vector3(FX + 1.1, 0, z));
      if (rand(44, Math.round(z * 10)) > 0.3 && Math.abs(z) > 1.5) stones.push(new THREE.Vector3(-FX - 1.1, 0, z));
    }
    const sg = new THREE.DodecahedronGeometry(0.34, 0);
    const sm = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({color: '#A99A82', flatShading: true, roughness: 1}), stones.length);
    const o = new THREE.Object3D();
    stones.forEach((s, i) => {
      o.position.set(s.x, 0.18, s.z);
      o.rotation.set(rand(45, i) * 3, rand(46, i) * 3, 0);
      o.scale.set(1, 0.75 + rand(47, i) * 0.4, 1);
      o.updateMatrix();
      sm.setMatrixAt(i, o.matrix);
    });
    sm.castShadow = true;
    sm.receiveShadow = true;
    group.add(sm);
    // olive trees around the field
    const trees: {x: number; z: number; s: number}[] = [];
    for (let i = 0; i < 70; i++) {
      const a = rand(51, i) * Math.PI * 2;
      const r = 7 + rand(52, i) * 34;
      const x = Math.cos(a) * (FX + r), z = Math.sin(a) * (FZ + r * 0.8);
      if (Math.abs(x + FX + 2.4) < 1.6 || Math.abs(z - FZ - 2.6) < 1.6) continue; // keep the paths clear
      trees.push({x, z, s: 0.6 + rand(53, i) * 0.45});
    }
    const canopyG = new THREE.IcosahedronGeometry(1.5, 0);
    const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 5);
    const canopy = new THREE.InstancedMesh(canopyG, new THREE.MeshStandardMaterial({color: '#FFFFFF', flatShading: true, roughness: 0.95}), trees.length);
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({color: '#5E4128', flatShading: true}), trees.length);
    const tc = new THREE.Color();
    trees.forEach((tr, i) => {
      o.position.set(tr.x, 0.8 * tr.s, tr.z);
      o.rotation.set(0, i, 0);
      o.scale.set(tr.s, tr.s, tr.s);
      o.updateMatrix();
      trunk.setMatrixAt(i, o.matrix);
      o.position.set(tr.x, 2.1 * tr.s, tr.z);
      o.scale.set(tr.s * 1.25, tr.s * 0.9, tr.s * 1.25);
      o.updateMatrix();
      canopy.setMatrixAt(i, o.matrix);
      tc.set(['#7E8A44', '#6C7A3A', '#8A9048', '#76823E'][i % 4]);
      canopy.setColorAt(i, tc);
    });
    canopy.castShadow = trunk.castShadow = true;
    group.add(canopy, trunk);
    if (ground) {
      // far hills (hazy in the fog) and a small village on a hill
      const hillCols = ['#C08C62', '#B07F60', '#A98670', '#C79A6C', '#B38A74'];
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + rand(61, i) * 0.2;
        const r = 110 + rand(62, i) * 70;
        const hg = new THREE.ConeGeometry(40 + rand(63, i) * 34, 8 + rand(64, i) * 12, 6 + (i % 3), 1);
        const hm = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({color: hillCols[i % 5], flatShading: true, roughness: 1}));
        hm.position.set(Math.cos(a) * r, (8 + rand(64, i) * 12) / 2 - 3, Math.sin(a) * r);
        hm.rotation.y = rand(65, i) * 3;
        group.add(hm);
      }
      const vill = new THREE.Group();
      for (let i = 0; i < 26; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(2 + rand(71, i) * 2.5, 1.6 + rand(72, i) * 2, 2 + rand(73, i) * 2), new THREE.MeshStandardMaterial({color: i % 3 ? '#D9BF95' : '#CDAE82', flatShading: true}));
        b.position.set((rand(74, i) - 0.5) * 22, 9 + rand(75, i) * 3, (rand(76, i) - 0.5) * 10);
        vill.add(b);
      }
      const hill = new THREE.Mesh(new THREE.ConeGeometry(24, 11, 7), new THREE.MeshStandardMaterial({color: '#BF956A', flatShading: true}));
      hill.position.set(0, 3.5, 0);
      vill.add(hill);
      vill.position.set(55, -2, -150);
      group.add(vill);
    }
    return group;
  }, [ground]);
  return <primitive object={objs} />;
};

// ------------------------------------------------------------------ glowing corner light (ground pool + rising light)
const glowTexture = (() => {
  let tex: THREE.CanvasTexture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,214,120,1)');
    grd.addColorStop(0.55, 'rgba(255,170,60,0.55)');
    grd.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();
const beamMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uI: {value: 0}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uI; varying vec2 vUv; void main(){ float e = smoothstep(0.0,0.35,vUv.x)*smoothstep(1.0,0.65,vUv.x); float h = pow(1.0 - vUv.y, 1.6); gl_FragColor = vec4(vec3(1.0,0.78,0.38)*uI*e*h*0.3, 1.0); }',
  });
const CornerLights: React.FC<{shot: Shot; t: number; beams: boolean}> = ({shot, t, beams}) => {
  const items = useMemo(
    () =>
      CORNERS.map(() => {
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(CS * 1.9, CS * 1.9), new THREE.MeshBasicMaterial({map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0}));
        pool.rotation.x = -Math.PI / 2;
        const beamGroup = new THREE.Group();
        const mats: THREE.ShaderMaterial[] = [];
        for (let k = 0; k < 2; k++) {
          const m = beamMaterial();
          mats.push(m);
          const plane = new THREE.Mesh(new THREE.PlaneGeometry(CS * 0.7, 16), m);
          plane.position.y = 8;
          plane.rotation.y = k * (Math.PI / 2) + 0.4;
          beamGroup.add(plane);
        }
        return {pool, beamGroup, mats};
      }),
    [],
  );
  const g = cornerGlow(shot, t);
  return (
    <>
      {CORNERS.map((c, i) => {
        const it = items[i];
        (it.pool.material as THREE.MeshBasicMaterial).opacity = Math.min(1, g[i] * 0.85);
        it.mats.forEach((m) => (m.uniforms.uI.value = g[i]));
        return (
          <group key={c.id} position={[c.cx, 0, c.cz]}>
            <primitive object={it.pool} position={[0, 0.06, 0]} />
            {beams && <primitive object={it.beamGroup} />}
          </group>
        );
      })}
    </>
  );
};

// ------------------------------------------------------------------ tiny low-poly people for the top-down opening
const Tiny: React.FC<{x: number; z: number; robe: string; head: string; bob: number; arm?: number; scale?: number}> = ({x, z, robe, head, bob, arm = 0, scale = 1}) => (
  <group position={[x, 0, z]} scale={scale}>
    <mesh position={[0, 0.55 + bob * 0.04, 0]} castShadow>
      <coneGeometry args={[0.3, 1.1, 6]} />
      <meshStandardMaterial color={robe} flatShading />
    </mesh>
    <mesh position={[0, 1.2 + bob * 0.04, 0]} castShadow>
      <icosahedronGeometry args={[0.2, 0]} />
      <meshStandardMaterial color={head} flatShading />
    </mesh>
    <mesh position={[0.25, 0.9, 0]} rotation={[0, 0, arm]} castShadow>
      <boxGeometry args={[0.5, 0.07, 0.07]} />
      <meshStandardMaterial color="#C88A3E" />
    </mesh>
  </group>
);
const OpeningPeople: React.FC<{t: number}> = ({t}) => {
  const fx = sweepX(t) + 0.6;
  const reaping = t < 1.7;
  // Ruth walks up the left path toward the top-left corner
  const rk = Math.min(1, t / 3.6);
  const rz = 2.5 - rk * 9.5;
  return (
    <>
      {reaping &&
        Array.from({length: 9}).map((_, i) => {
          const z = -FZ + 2 + i * 3.3;
          const ph = t * 9 + i * 1.3;
          return <Tiny key={i} x={Math.min(FX + 0.6, fx + Math.sin(i * 2.1) * 0.5)} z={z} robe={i % 2 ? '#E2D3B0' : '#B89A6E'} head={i % 3 ? '#D8C7A0' : '#8B6B4A'} bob={Math.abs(Math.sin(ph))} arm={Math.sin(ph) * 1.1} scale={2.1} />;
        })}
      <mesh position={[-FX - 2.4, 0.08, rz]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.2, 24]} />
        <meshBasicMaterial map={glowTexture()} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.9} />
      </mesh>
      <Tiny x={-FX - 2.4} z={rz} robe="#B4766A" head="#EFE3C8" bob={Math.abs(Math.sin(t * 6))} arm={-1.4} scale={2.3} />
    </>
  );
};

// ------------------------------------------------------------------ sky dome (ground shots)
const Sky: React.FC<{sunDir: THREE.Vector3}> = ({sunDir}) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {uSun: {value: sunDir.clone().normalize()}},
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uSun; varying vec3 vDir;
          void main(){
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 horizon = vec3(0.98, 0.80, 0.52);
            vec3 mid = vec3(0.93, 0.66, 0.44);
            vec3 top = vec3(0.70, 0.52, 0.50);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
            c = mix(c, top, smoothstep(0.18, 0.75, h));
            float s = max(dot(normalize(vDir), uSun), 0.0);
            c += vec3(1.0, 0.75, 0.4) * pow(s, 18.0) * 0.45 + vec3(1.0, 0.92, 0.7) * pow(s, 400.0) * 1.2;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [sunDir],
  );
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[500, 32, 16]} />
    </mesh>
  );
};

// ------------------------------------------------------------------ camera driver
const CameraRig: React.FC<{shot: Shot; t: number}> = ({shot, t}) => {
  const {camera} = useThree();
  const c = fieldCam(shot, t);
  applyCam(camera as THREE.PerspectiveCamera, c);
  useFrame(() => applyCam(camera as THREE.PerspectiveCamera, fieldCam(shot, t)), -1);
  return null;
};

// ------------------------------------------------------------------ the world
export const FieldWorld: React.FC<{shot: Shot; t: number; preview?: boolean}> = ({shot, t, preview}) => {
  const ground = !isTop(shot);
  const sunDir = useMemo(() => new THREE.Vector3(-0.78, 0.13, -0.6), []);
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight('#FFD08A', ground ? 2.9 : 3.2);
    l.castShadow = true;
    l.shadow.mapSize.set(preview ? 1024 : 2048, preview ? 1024 : 2048);
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 3;
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    const ext = ground ? 16 : 26;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.near = 1; cam.far = 140;
    return l;
  }, [ground, preview]);
  const c = fieldCam(shot, t);
  const focus: [number, number, number] = ground ? [c.target[0] * 0.5 + c.pos[0] * 0.5, 0, c.target[2] * 0.5 + c.pos[2] * 0.5] : [0, 0, -2];
  light.position.set(focus[0] - 36, 26, focus[2] - 26);
  light.target.position.set(...focus);
  light.target.updateMatrixWorld();
  const region: [number, number, number, number] = ground ? [-FX, FX, -FZ, 4] : [-FX, FX, -FZ, FZ];
  const spacing = ground ? (preview ? 0.34 : 0.24) : preview ? 0.4 : 0.3;
  const {scene} = useThree();
  useLayoutEffect(() => {
    scene.fog = ground ? new THREE.Fog('#EDC08A', 24, 230) : new THREE.Fog('#C9975E', 95, 240);
    scene.background = new THREE.Color(ground ? '#EBB47C' : '#B98A55');
  }, [scene, ground]);
  return (
    <>
      <CameraRig shot={shot} t={t} />
      <hemisphereLight args={['#FFE8C4', '#7A5A3A', ground ? 1.25 : 1.3]} />
      <primitive object={light} />
      <primitive object={light.target} />
      {ground && <Sky sunDir={sunDir} />}
      <Surroundings ground={ground} />
      <Wheat shot={shot} t={t} spacing={spacing} region={region} />
      <Sheaves shot={shot} t={t} />
      <CornerLights shot={shot} t={t} beams={ground} />
      {isTop(shot) && <OpeningPeople t={shot === 'LOOP' ? 0 : t} />}
      <PostFX bloom={ground ? 0.85 : 1.0} threshold={ground ? 0.82 : 0.76} vignette={0.42} />
    </>
  );
};
