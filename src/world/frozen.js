// The frozen man (code version + GPT image planes) and the crowd of frozen people
// deep in the ice. All of these are OPAQUE so they show up through the transmissive ice.
import * as THREE from 'three';
import { createFigure, applyPose, POSES, blendPose } from './figures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_NOISE, mulberry32, lerp } from '../util.js';
import { LEDGE_Y, wallX } from './glacier.js';

// shared "in the ice" controls for every frozen material
export const FROZEN_U = {
  uVis: { value: 1 },            // 1 = full colour, 0 = melts into the ice-blue
  uFadeCol: { value: new THREE.Vector3(0.03, 0.12, 0.22) },
  uEyeGlow: { value: 0 },        // crowd eye shine
};

export function frostify(m, opts = {}) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uVis = FROZEN_U.uVis;
    sh.uniforms.uFadeCol = FROZEN_U.uFadeCol;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFrP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFrP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFrP; uniform float uVis; uniform vec3 uFadeCol;\n' + GLSL_NOISE)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float fr = vnoise3(vFrP*${(opts.frostScale ?? 140).toFixed(1)});
          float wool = vnoise3(vFrP*vec3(260.0, 60.0, 260.0));
          diffuseColor.rgb *= 0.86 + 0.22*wool*${(opts.wool ?? 0).toFixed(2)} + 0.1*fbm3(vFrP*20.0);
          float l = dot(diffuseColor.rgb, vec3(0.3,0.5,0.2));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l)*vec3(0.85,0.95,1.08), ${(opts.desat ?? 0.25).toFixed(2)});
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9,0.96,1.0), smoothstep(${(opts.frostLo ?? 0.7).toFixed(2)}, 0.92, fr)*0.85);
        }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor.rgb = mix(uFadeCol, gl_FragColor.rgb, uVis);`);
  };
  m.customProgramCacheKey = () => 'frost' + JSON.stringify(opts);
  return m;
}

// ---------------------------------------------------------------- sculpted head (code close-up version)
function gauss(d2, r) { return Math.exp(-d2 / (r * r)); }

export function createSculptHead(o = {}) {
  const g = new THREE.Group();
  const skin = frostify(new THREE.MeshStandardMaterial({ color: o.skin ?? 0xa9b8c4, roughness: 0.5 }), { frostScale: 220, frostLo: 0.74, desat: 0.15 });
  const geo = new THREE.SphereGeometry(0.1, 96, 72);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    // proportions
    x *= 0.82; y *= 1.18; z *= 0.98;
    // jaw narrowing + chin
    if (y < 0) { const k = Math.min(1, -y / 0.11); x *= 1 - 0.22 * k * k; z *= 1 - 0.1 * k; }
    const front = Math.max(0, z / 0.1);
    // brow ridge
    z += 0.012 * gauss((y - 0.028) ** 2, 0.012) * front * (1 - 0.3 * Math.abs(x) / 0.08);
    // eye sockets
    for (const sx of [-1, 1]) z -= 0.016 * gauss((x - sx * 0.033) ** 2 + (y - 0.008) ** 2, 0.019) * front;
    // nose bridge + tip
    z += 0.028 * gauss(x * x * 4 + (y + 0.016) ** 2 * 0.6, 0.016) * front;
    z += 0.012 * gauss(x * x + (y + 0.036) ** 2, 0.012) * front;
    // cheekbones (gaunt: cheeks hollow below them)
    for (const sx of [-1, 1]) {
      const d = (x - sx * 0.05) ** 2 + (y + 0.012) ** 2;
      x += sx * 0.006 * gauss(d, 0.018) * front;
      z -= 0.01 * gauss((x - sx * 0.045) ** 2 + (y + 0.05) ** 2, 0.02) * front;
    }
    // mouth line
    z -= 0.004 * gauss(x * x * 0.3 + (y + 0.062) ** 2 * 40, 0.01) * front;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const head = new THREE.Mesh(geo, skin);
  g.add(head);
  // ears
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), skin);
    ear.scale.set(0.4, 1.0, 0.7);
    ear.position.set(sx * 0.083, 0.0, -0.01);
    g.add(ear);
  }
  // eyes
  const white = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.15, emissive: new THREE.Color(0.06, 0.07, 0.08) });
  const dark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 });
  const lid = skin;
  const eyes = new THREE.Group(), lids = new THREE.Group();
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 20, 16), white);
    e.position.set(sx * 0.033, 0.008, 0.074);
    eyes.add(e);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 10, 8), dark);
    pu.position.set(sx * 0.031, 0.008, 0.0876);
    eyes.add(pu);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.0148, 20, 12), lid);
    l.position.copy(e.position);
    l.scale.set(1.05, 1.0, 1.0);
    lids.add(l);
  }
  g.add(eyes, lids);
  // frosted eyebrows
  const browM = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.022, 3, 6), browM);
    b.rotation.z = Math.PI / 2 + sx * 0.12;
    b.position.set(sx * 0.033, 0.03, 0.086);
    g.add(b);
  }
  // beard: displaced shell over the jaw, dark with heavy frost
  const beardM = frostify(new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 0.95 }), { frostScale: 300, frostLo: 0.45, desat: 0.2 });
  const bg = new THREE.SphereGeometry(0.104, 64, 48, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.52, Math.PI * 0.42);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    v.fromBufferAttribute(bp, i);
    let { x, y, z } = v;
    x *= 0.84; y *= 1.18; z *= 0.98;
    if (y < 0) { const k = Math.min(1, -y / 0.11); x *= 1 - 0.18 * k * k; }
    const n = 1 + 0.06 * Math.sin(x * 400) * Math.sin(y * 300) + 0.05;
    bp.setXYZ(i, x * n, y * n - 0.004, z * n + 0.004);
  }
  bg.computeVertexNormals();
  const beard = new THREE.Mesh(bg, beardM); // segment already sits on the front-lower (+z) side
  g.add(beard);
  // grey wool hat with a cuff
  const hatM = frostify(new THREE.MeshStandardMaterial({ color: 0x6b6e72, roughness: 0.95 }), { frostScale: 160, frostLo: 0.62, wool: 1.0, desat: 0.1 });
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.106, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.52), hatM);
  hat.scale.set(0.88, 1.2, 1.02);
  hat.position.y = 0.012;
  g.add(hat);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.087, 0.017, 10, 40), hatM);
  cuff.rotation.x = Math.PI / 2;
  cuff.scale.set(1.0, 1.12, 1);
  cuff.position.y = 0.02;
  g.add(cuff);
  g.userData = { eyes, lids, setEyes(open) { eyes.visible = true; lids.visible = !open; } };
  g.userData.setEyes(false);
  return g;
}

// ---------------------------------------------------------------- the frozen man
export function createFrozenMan() {
  const fig = createFigure({
    jacket: 0x7a3826, jacket2: 0x6b3020, pants: 0x3a3833, boots: 0x2a1e16, gloves: 0x4a3a2c,
    skin: 0xa9b8c4, hat: 0x6b6e72, helmet: undefined, backpack: null, transparent: false, noFace: true, frozen: true,
  });
  // swap in the sculpted head
  for (const c of [...fig.J.head.children]) if (c.isMesh) fig.J.head.remove(c);
  const sculpt = createSculptHead();
  sculpt.position.set(0, 0.105, 0.0);
  fig.J.head.add(sculpt);
  fig.sculpt = sculpt;
  // frost + wool on the clothes
  for (const k of ['jacket', 'jacket2']) frostify(fig.M[k], { wool: 1.0, frostScale: 120, frostLo: 0.66, desat: 0.2 });
  for (const k of ['pants', 'boots', 'gloves']) frostify(fig.M[k], { frostScale: 120, frostLo: 0.66, desat: 0.2 });
  return fig;
}

// ---------------------------------------------------------------- GPT image planes
const IMAGE_FILES = {
  back: 'frozen_man_back.png',
  closed: 'frozen_man_eyes_closed.png',
  open: 'frozen_man_eyes_open.png',
  hand: 'frozen_man_hand.png',
  reach: 'frozen_hand_reach.png',
  claw: 'frozen_hand_claw.png',
  crowd: 'frozen_crowd_reveal.png',
  radio: 'radio_broken.png',
  logbook: 'logbook.png',
};
export { IMAGE_FILES };

function imagePlane(texture, h = 1, opts = {}) {
  const img = texture?.image;
  const aspect = img ? img.width / img.height : 2 / 3;
  const m = new THREE.MeshStandardMaterial({
    map: texture, alphaTest: opts.alphaTest ?? 0.35, roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
    color: opts.color ?? 0xffffff, emissiveMap: texture, emissive: new THREE.Color(0, 0, 0),
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), m);
  mesh.frustumCulled = false;
  return mesh;
}

export function createFrozen(tex, images) {
  const group = new THREE.Group();
  const man = createFrozenMan();
  group.add(man.root);

  // image planes (each lives inside the right wall, facing Max = -x)
  const planes = {};
  for (const key of ['back', 'closed', 'open', 'hand', 'reach', 'claw']) {
    if (!images[key]) continue;
    const pl = imagePlane(images[key], 1, { alphaTest: key === 'reach' || key === 'claw' ? 0.3 : 0.35 });
    pl.visible = false;
    group.add(pl);
    planes[key] = pl;
  }

  // crowd of frozen people below the ledge
  const crowd = [];
  const rnd = mulberry32(1950);
  const outfits = [
    // [jacket, pants, hat/helmet] muted era colours
    [0x5b3b28, 0x3b3530, 0x4a3f36], [0x3e4a5a, 0x2c2a28, 0x8a2f2f], [0x7a3826, 0x3a3833, 0x6b6e72],
    [0x8a6a2a, 0x403a30, 0x2f3a4a], [0x2f6a6a, 0x2a2a30, 0x5a3a6a], [0x6a3a6a, 0x26262c, 0x3a5a7a],
    [0xa03a2a, 0x22242a, 0x2a2a2a], [0x2a4a8a, 0x2a2c33, 0xc8c8c0], [0x3a3a3c, 0x1e1f22, 0x5a5a5e],
    [0x6a5a3a, 0x3a3428, 0x2a2018], [0x4a6a3a, 0x2a2e26, 0x7a6a4a], [0x8a8478, 0x3a3830, 0x4a3a2a],
  ];
  const poses = ['lookUp', 'reachUp', 'reachUp2', 'lookUp', 'curled', 'reachUp', 'lookUp'];
  const N = 40;
  for (let i = 0; i < N; i++) {
    const [jk, pt, ht] = outfits[i % outfits.length];
    const f = createFigure({
      jacket: jk, jacket2: jk, pants: pt, boots: 0x231a14, gloves: 0x2a2420, skin: 0x9fb0bd,
      hat: rnd() < 0.6 ? ht : null, hair: 0x2a2018, backpack: rnd() < 0.3 ? 0x3a3a34 : null, transparent: false, frozen: true,
      noFace: true,
    });
    // pale face with dark sockets and tiny pale eyes looking up
    const sockM = new THREE.MeshBasicMaterial({ color: 0x020305 });
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xcfe2ee, emissive: new THREE.Color(0.25, 0.32, 0.38), roughness: 0.2 });
    eyeM.userData.eye = true;
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), sockM);
      s.position.set(sx * 0.036, 0.112, 0.088);
      s.scale.set(1, 0.8, 0.5);
      f.J.head.add(s);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), eyeM);
      e.position.set(sx * 0.036, 0.112, 0.097);
      f.J.head.add(e);
    }
    for (const k of Object.keys(f.M)) if (f.M[k].isMeshStandardMaterial && k !== 'skin') frostify(f.M[k], { frostScale: 110, frostLo: 0.64, desat: 0.35 });
    const side = i % 2 === 0 ? -1 : 1;
    const y = lerp(-45.5, -104, Math.pow((i + rnd() * 0.8) / N, 0.85));
    const z = -0.35 - Math.pow(rnd(), 1.3) * 9;
    const inset = 0.28 + Math.pow(rnd(), 1.5) * 1.6;
    const x = wallX(side, y, z) + side * inset;
    f.root.position.set(x, y - 0.9, z);
    // face the crack (toward -side), tilted so the face turns up toward the camera above
    f.root.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    f.root.rotateY((rnd() - 0.5) * 0.9);
    f.root.rotateX(-(0.15 + rnd() * 0.35));
    f.root.rotateZ((rnd() - 0.5) * 0.4);
    const pz = POSES[poses[i % poses.length]];
    const look = { neck: [-0.55 - rnd() * 0.2, (rnd() - 0.5) * 0.3, 0], head: [-0.45 - rnd() * 0.15, 0, 0] };
    applyPose(f, { ...pz, ...look });
    f.root.userData.depth = inset;
    group.add(f.root);
    crowd.push(f);
  }

  // merge the (static) crowd into 2 meshes: ~1200 draw calls -> 2 (huge win on a CPU renderer)
  const merged = mergeCrowd(crowd);
  for (const f of crowd) group.remove(f.root);
  for (const m of merged) group.add(m.root);
  crowd.length = 0;
  crowd.push(...merged);

  // glow card: warm-cyan light scattering in the ice behind the frozen man (opaque, seen through the cut face)
  const glowCard = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uK; varying vec2 vUv;
      void main(){ vec2 d = (vUv - vec2(0.5, 0.55)) * vec2(1.0, 0.8); float r = length(d);
        vec3 base = vec3(0.004, 0.02, 0.05);
        vec3 glow = mix(vec3(0.55, 0.32, 0.14), vec3(0.08, 0.3, 0.5), smoothstep(0.0, 0.35, r)) * exp(-r*r*9.0);
        gl_FragColor = vec4(base + glow * uK, 1.0); }`,
  }));
  glowCard.visible = false;
  group.add(glowCard);

  return { group, man, planes, crowd, images, glowCard };
}

function mergeCrowd(figs) {
  const body = [], eyes = [];
  for (const f of figs) {
    f.root.updateMatrixWorld(true);
    f.root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      const c = o.material.color || new THREE.Color(0x020305);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      (o.material.userData.eye ? eyes : body).push(g);
    });
  }
  const bodyMat = frostify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), { frostScale: 110, frostLo: 0.64, desat: 0.35 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xcfe2ee, emissive: new THREE.Color(0.25, 0.32, 0.38), roughness: 0.2 });
  const out = [];
  for (const [list, mat] of [[body, bodyMat], [eyes, eyeMat]]) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
    mesh.frustumCulled = false;
    out.push({ root: mesh });
  }
  return out;
}

// where the frozen man stands (in the right wall, across from Max)
export function frozenSpot(zOff = 0) {
  const y = LEDGE_Y;
  const z = -0.45 + zOff;
  const xw = wallX(1, y + 0.9, z);
  return { x: xw, y: y - 0.84, z };
}
