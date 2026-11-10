// The two characters, both ready-made rigged models from Kenney's "Animated Characters" (CC0):
//  - MAN   = "Male Skater": skin texture recoloured to a plain purple tee / blue jeans / dark hair.
//  - GHOST = "Male" (the one with the moustache): made chubby, translucent glowing fresnel material, plus
//            attached props: big curly moustache, pink hair rollers, bathrobe trim, bunny slippers (Stanford bunny), teddy.
// Faces are repainted on the model's own skin texture so expressions can change per shot.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Actor, registerClips } from './rig.js';

const D = Math.PI / 180;
const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/node_modules/three/examples/jsm/libs/draco/gltf/'));
export async function loadAssets() {
  const [xbot, skater, male, bunny] = await Promise.all(['/assets/models/Xbot.glb', '/assets/kenney/skater-male.gltf', '/assets/kenney/male.gltf', '/assets/market/bunny.gltf'].map((u) => loader.loadAsync(u)));
  registerClips(xbot);
  return { xbot, skater, male, bunny };
}

const sph = (r, mat, sx = 1, sy = 1, sz = 1, seg = 20) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat); m.scale.set(sx, sy, sz); return m; };

// ---- skin texture + painted face ------------------------------------------------------------------
function skinCanvas(actor) {
  const mesh = actor.meshes[0]; const img = mesh.material.map.image;
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, 1024, 1024);
  return { c, g };
}
const FACE = { x: 244, y: 172, w: 158, h: 124 };     // face area of the Kenney skin (texture px)
function installFace(actor, c, g, style) {
  const tex = new THREE.CanvasTexture(c); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // wipe the stock features, keep a clean copy of the face area
  g.fillStyle = style.skin; g.fillRect(252, 183, 138, 109);
  const clean = document.createElement('canvas'); clean.width = FACE.w; clean.height = FACE.h;
  clean.getContext('2d').drawImage(c, FACE.x, FACE.y, FACE.w, FACE.h, 0, 0, FACE.w, FACE.h);
  let last = '';
  actor.setFace = (f) => {
    const F = { eye: 1, look: [0, 0], brow: [0, 0, 0, 0], mouth: 0, mouthW: 1, smile: 0.35, blush: 0, ...f };
    const key = JSON.stringify(F, (k, v) => typeof v === 'number' ? Math.round(v * 50) / 50 : v); if (key === last) return; last = key;
    g.drawImage(clean, FACE.x, FACE.y);
    g.save(); g.beginPath(); g.rect(FACE.x, FACE.y, FACE.w, FACE.h); g.clip();
    const R = style.eyeR;
    // nose + blush
    g.fillStyle = style.nose; g.beginPath(); g.ellipse(322, 246, 9, 4, 0, 0, 7); g.fill();
    if (F.blush > 0) { g.globalAlpha = 0.55 * F.blush; g.fillStyle = style.blush; for (const x of [266, 378]) { g.beginPath(); g.ellipse(x, 250, 13, 8, 0, 0, 7); g.fill(); } g.globalAlpha = 1; }
    // eyes
    [287, 357].forEach((ex, i) => {
      const ey = 221, op = F.eye;
      if (op < 0.2) { g.strokeStyle = style.dark; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.arc(ex, ey - 5, 10.5, Math.PI * 0.18, Math.PI * 0.82); g.stroke(); return; }
      if (op > 1.05) {
        const rr = R * (0.55 + 0.6 * op);
        g.fillStyle = '#ffffff'; g.strokeStyle = style.dark; g.lineWidth = 2.5; g.beginPath(); g.arc(ex, ey, rr, 0, 7); g.fill(); g.stroke();
        g.fillStyle = style.dark; g.beginPath(); g.arc(ex + F.look[0] * rr * 0.45, ey + F.look[1] * rr * 0.45, R * 0.55, 0, 7); g.fill();
      } else {
        g.fillStyle = style.dark; g.beginPath(); g.ellipse(ex + F.look[0] * 3.5, ey + F.look[1] * 3, R, R * Math.max(0.3, op), 0, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex + F.look[0] * 3.5 - R * 0.3, ey + F.look[1] * 3 - R * 0.32 * op, R * 0.26, 0, 7); g.fill();
      }
    });
    // brows
    g.strokeStyle = style.brow; g.lineWidth = style.browW; g.lineCap = 'round';
    [287, 357].forEach((ex, i) => {
      const s = i === 0 ? 1 : -1, raise = F.brow[i * 2], tilt = F.brow[i * 2 + 1];
      g.save(); g.translate(ex, 199 - raise * 9); g.rotate(s * tilt * D);
      g.beginPath(); g.moveTo(-16, 3); g.quadraticCurveTo(0, -6, 16, 3); g.stroke(); g.restore();
    });
    // mouth
    const mx = 322, my = 275, mo = F.mouth, w = F.mouthW;
    if (mo > 0.04) {
      const rx = 9 * w * (1 + 0.25 * mo), ry = 2.5 + 13 * mo;
      g.fillStyle = style.mouth; g.beginPath(); g.ellipse(mx, my + mo * 3, rx, ry, 0, 0, 7); g.fill();
      if (mo > 0.4) { g.save(); g.beginPath(); g.ellipse(mx, my + mo * 3, rx, ry, 0, 0, 7); g.clip(); g.fillStyle = style.tongue; g.beginPath(); g.ellipse(mx, my + mo * 3 + ry * 0.75, rx * 0.75, ry * 0.5, 0, 0, 7); g.fill(); g.restore(); }
    } else {
      g.strokeStyle = style.lip; g.lineWidth = 4.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(mx - 13 * w, my - F.smile * 4); g.quadraticCurveTo(mx, my + F.smile * 11, mx + 13 * w, my - F.smile * 4); g.stroke();
    }
    g.restore();
    tex.needsUpdate = true;
  };
  actor.setFace({});
  return tex;
}

// ---- MAN ----------------------------------------------------------------------------------------
export function buildMan(assets) {
  const a = new Actor(assets.skater, 1.72);
  const { c, g } = skinCanvas(a);
  const SKIN = '#f4916d';
  // dark hair: replace the stock reddish-brown hair colour
  const d = g.getImageData(0, 0, 640, 490), p = d.data;
  for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - 0x4b) < 26 && Math.abs(p[i + 1] - 0x14) < 22 && Math.abs(p[i + 2] - 0x10) < 22) { p[i] = 0x1d; p[i + 1] = 0x15; p[i + 2] = 0x12; }
  g.putImageData(d, 0, 0);
  // plain purple tee (torso + upper arms), bare forearms and hands, plain jeans, white socks
  const pg = g.createLinearGradient(0, 490, 0, 1024); pg.addColorStop(0, '#8a47ff'); pg.addColorStop(1, '#6c2ee0');
  g.fillStyle = pg; g.fillRect(148, 490, 348, 534);
  g.fillStyle = SKIN; g.fillRect(0, 490, 148, 534); g.fillRect(496, 490, 144, 534);
  g.fillRect(462, 640, 34, 200); g.fillRect(148, 640, 34, 200);                 // short sleeves
  g.fillRect(824, 134, 200, 631); g.fillRect(640, 524, 384, 241);               // hands / pads -> skin
  g.drawImage(c, 611, 850, 413, 20, 611, 874, 413, 60);                         // paint out knee-pad straps
  g.fillStyle = '#eef1f6'; g.fillRect(640, 0, 184, 524);                        // socks
  const tex = installFace(a, c, g, { skin: SKIN, dark: '#1a1210', brow: '#1d1512', browW: 7, eyeR: 9.5, nose: '#ea7f5d', blush: '#ff5a6e', mouth: '#3a0d12', tongue: '#e8647c', lip: '#8a3324' });
  for (const m of a.meshes) { m.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0 }); }
  return a;
}

// ---- GHOST --------------------------------------------------------------------------------------
export function ghostMaterial({ color = 0xd4ecff, opacity = 0.6, glow = 0.55, rim = 1.2, map = null, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: map ? color : new THREE.Color(color).multiplyScalar(0.55), emissive: map ? 0xffffff : color, emissiveMap: map, map, emissiveIntensity: glow, roughness: 0.6, metalness: 0, transparent: true, opacity, depthWrite: false, side });
  m.depthFunc = THREE.LessEqualDepth;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRim;')
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - saturate(abs(dot(normalize(vViewPosition), normal))), 2.2);
        outgoingLight += vec3(0.62, 0.86, 1.0) * fres * uRim;
        diffuseColor.a = mix(diffuseColor.a, min(1.0, diffuseColor.a + 0.36), fres);
        #include <opaque_fragment>`);
  };
  return m;
}
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
// A translucent ghost part = depth pre-pass twin (we only ever see the nearest ghost surface) + colour pass.
function ghostPart(geom, mat) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(geom, depthOnly); d.renderOrder = 10; g.add(d);
  const c = new THREE.Mesh(geom, mat); c.renderOrder = 11; g.add(c);
  return g;
}

export function buildTeddy() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xc27c3a, roughness: 0.95, emissive: 0x5a3008, emissiveIntensity: 0.55 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf3dcaa, roughness: 0.95, emissive: 0x5a4418, emissiveIntensity: 0.5 });
  const dk = new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.5 });
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(sph(1, fur, 0.075, 0.088, 0.065), 0, 0, 0);                       // body
  add(sph(1, light, 0.045, 0.055, 0.02), 0, -0.005, 0.052);             // tummy patch
  add(sph(0.066, fur), 0, 0.125, 0.005);                                // head
  for (const s of [1, -1]) {
    add(sph(0.027, fur), s * 0.052, 0.18, 0); add(sph(0.014, light, 1, 1, 0.5), s * 0.052, 0.18, 0.019);
    add(sph(0.009, dk), s * 0.025, 0.14, 0.06);
    add(sph(1, fur, 0.026, 0.052, 0.026), s * 0.088, 0.02, 0.012).rotation.z = s * 0.9;
    add(sph(1, fur, 0.03, 0.05, 0.032), s * 0.045, -0.092, 0.03).rotation.x = -0.7;
    add(sph(0.018, light, 1, 1, 0.4), s * 0.045, -0.118, 0.06);
  }
  add(sph(0.029, light, 1, 0.8, 0.8), 0, 0.113, 0.057);                 // muzzle
  add(sph(0.01, dk), 0, 0.121, 0.08);                                    // nose
  const s = new THREE.Group(); s.add(g); g.scale.setScalar(1.55); return s;
}

export function buildGhost(assets) {
  const a = new Actor(assets.male, 1.72);
  const { c, g } = skinCanvas(a);
  // whole skin -> pale spectral blue ramp (keeps hair / suit trim readable as tone)
  const d = g.getImageData(0, 0, 1024, 1024), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = Math.pow((0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255, 0.75);
    p[i] = 70 + l * 170; p[i + 1] = 105 + l * 145; p[i + 2] = 185 + l * 70;
  }
  g.putImageData(d, 0, 0);
  const sk = g.getImageData(300, 258, 1, 1).data;
  const tex = installFace(a, c, g, { skin: `rgb(${sk[0]},${sk[1]},${sk[2]})`, dark: '#17225a', brow: '#27367c', browW: 9, eyeR: 13, nose: '#9fbdf0', blush: '#ff8fd0', mouth: '#141d52', tongue: '#8fb0ff', lip: '#27367c' });
  const bodyMat = ghostMaterial({ color: 0x9fb4d4, opacity: 0.66, glow: 0.42, rim: 0.6, map: tex });
  for (const m of [...a.meshes]) {
    m.material = bodyMat; m.renderOrder = 11; m.castShadow = false; m.receiveShadow = false;
    const dm = new THREE.SkinnedMesh(m.geometry, depthOnly); dm.bind(m.skeleton, m.bindMatrix); dm.frustumCulled = false; dm.renderOrder = 10; m.parent.add(dm);
  }
  // chubby: widen the belly bones (scale given in model axes, converted to each bone's local axes)
  const localScale = (bone, s) => { const q = a.rest[bone].Wb.clone().invert(); const v = new THREE.Vector3(); const out = [0, 0, 0];
    // local axis i points along model direction Wb·e_i  ->  scale_i = |S · (Wb·e_i)|
    const w = a.rest[bone].Wb;
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, i) => { v.set(...e).applyQuaternion(w); out[i] = Math.hypot(v.x * s[0], v.y * s[1], v.z * s[2]); });
    return new THREE.Vector3(...out); };
  const SX = 1.6, SZ = 1.95, CX = 1.18, CZ = 1.25;
  a.boneScale.Spine = localScale('Spine', [SX, 1, SZ]);
  a.boneScale.Spine2 = localScale('Spine2', [CX / SX, 1, CZ / SZ]);
  for (const n of ['Neck', 'LeftShoulder', 'RightShoulder']) a.boneScale[n] = localScale(n, [1 / CX, 1, 1 / CZ]);

  const ROBE = 0xa9c9ff;
  const robeMat = ghostMaterial({ color: ROBE, opacity: 0.66, glow: 0.4, rim: 0.5 });
  const skirtMat = ghostMaterial({ color: ROBE, opacity: 0.6, glow: 0.4, rim: 0.5, side: THREE.DoubleSide });
  const trimMat = ghostMaterial({ color: 0xffffff, opacity: 0.82, glow: 0.5, rim: 0.5 });
  const pinkMat = ghostMaterial({ color: 0xff72b6, opacity: 0.9, glow: 0.6, rim: 0.3 });
  const slipMat = ghostMaterial({ color: 0xffc4e2, opacity: 0.85, glow: 0.5, rim: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2f73, roughness: 0.6, emissive: 0x101c55, emissiveIntensity: 0.9 });

  // belly + bum (on the un-scaled pelvis so they stay round), bathrobe skirt, belt + knot, fluffy collar, cuffs, lapels
  a.attach('Hips', ghostPart(new THREE.SphereGeometry(1, 32, 24), robeMat), [0, 0.22, 0.07], [0, 0, 0], [0.275, 0.25, 0.285]);
  a.attach('Hips', ghostPart(new THREE.SphereGeometry(1, 24, 18), robeMat), [0, 0.07, -0.08], [0, 0, 0], [0.235, 0.2, 0.19]);
  a.attach('Hips', ghostPart(new THREE.CylinderGeometry(0.25, 0.33, 0.44, 32, 1, true), skirtMat), [0, -0.1, 0.01], [0, 0, 0], [1, 1, 0.95]);
  a.attach('Hips', ghostPart(new THREE.TorusGeometry(0.33, 0.032, 10, 40), trimMat), [0, -0.32, 0.01], [90, 0, 0], [1, 0.95, 1]);
  a.attach('Hips', ghostPart(new THREE.TorusGeometry(0.272, 0.03, 10, 40), trimMat), [0, 0.2, 0.065], [90, 0, 0], [1, 1.04, 1]);
  a.attach('Hips', ghostPart(new THREE.SphereGeometry(0.05, 14, 10), trimMat), [0.05, 0.2, 0.35]);
  for (const s of [1, -1]) a.attach('Hips', ghostPart(new THREE.CapsuleGeometry(0.022, 0.14, 4, 10), trimMat), [0.05 + s * 0.04, 0.09, 0.36], [8, 0, s * 14]);
  a.attach('Neck', ghostPart(new THREE.TorusGeometry(0.13, 0.045, 10, 32), trimMat), [0, 0.03, 0.0], [80, 0, 0], [1.2, 1.0, 1]);
  for (const s of [1, -1]) {
    a.attach(s > 0 ? 'LeftForeArm' : 'RightForeArm', ghostPart(new THREE.TorusGeometry(0.062, 0.03, 10, 24), trimMat), [s * 0.2, -0.012, 0], [0, 90, 0]);
    a.attach('Spine2', ghostPart(new THREE.CapsuleGeometry(0.034, 0.2, 4, 10), trimMat), [s * 0.07, 0.0, 0.135], [10, 0, s * 22]);
  }

  // head props (head bone origin sits at the base of the skull; face plane z ≈ 0.217)
  const head = new THREE.Group(); a.attach('Head', head);
  const rg = new THREE.CylinderGeometry(0.052, 0.052, 0.15, 18);
  for (const [x, y, z, ry] of [[-0.1, 0.475, 0.1, 12], [0.1, 0.475, 0.1, -12], [0, 0.515, -0.01, 0], [-0.135, 0.445, -0.09, 30], [0.135, 0.445, -0.09, -30], [0, 0.47, -0.17, 0]]) {
    const r = ghostPart(rg, pinkMat); r.position.set(x, y, z); r.rotation.set(0, ry * D, 90 * D); head.add(r);
    for (const e of [-1, 0, 1]) { const ring = ghostPart(new THREE.TorusGeometry(0.053, 0.008, 6, 18), trimMat); ring.position.set(0, e * 0.06, 0); ring.rotation.x = 90 * D; r.add(ring); }
  }
  // big curly handlebar moustache: each half pivots at the centre so it can flap when he snores
  const stache = [];
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 44; i++) {
      const u = i / 44; let x, y;
      if (u < 0.45) { const k = u / 0.45; x = 0.006 + k * 0.15; y = -0.03 * Math.sin(k * Math.PI * 0.9) - 0.012 * k; }
      else { const k = (u - 0.45) / 0.55; const ang = -Math.PI / 2 + k * Math.PI * 1.75, rr = 0.058 * (1 - 0.5 * k); x = 0.156 + Math.cos(ang) * rr; y = -0.0205 + 0.058 + Math.sin(ang) * rr; }
      pts.push(new THREE.Vector3(s * x, y, -0.07 * Math.pow(Math.min(1, x / 0.2), 2)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const sg = new THREE.Group(); sg.position.set(0, 0.092, 0.232); head.add(sg);
    sg.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 70, 0.021, 10), darkMat));
    const blob = sph(1, darkMat, 0.06, 0.034, 0.026, 14); blob.position.set(s * 0.045, -0.012, 0.0); sg.add(blob);
    const tip = sph(0.021, darkMat); tip.position.copy(pts[44]); sg.add(tip);
    stache.push(sg);
  }
  a.stache = stache;

  // bunny slippers: the ready-made Stanford bunny, one per foot
  const bunny = assets.bunny.scene; bunny.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(bunny); const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  a.bunnyInfo = { size: size.toArray(), ctr: ctr.toArray() };
  for (const s of ['Left', 'Right']) {
    const sl = new THREE.Group(); const sx = s === 'Left' ? 1 : -1;
    const fit = new THREE.Group(); const k = 0.3 / Math.max(size.x, size.z); fit.scale.setScalar(k); sl.add(fit);
    bunny.traverse((o) => { if (o.isMesh) { const gp = ghostPart(o.geometry, slipMat); gp.applyMatrix4(o.matrixWorld); gp.position.sub(new THREE.Vector3(ctr.x, bb.min.y, ctr.z)); fit.add(gp); } });
    a.attach(s + 'Foot', sl, [sx * 0.022, -0.088, 0.075], [0, 90, 0]);
    a['slipper' + s] = sl;
  }

  // glow: soft halo sprite + point light that travel with the ghost
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g2 = cv.getContext('2d');
  const gr = g2.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(170,215,255,0.9)'); gr.addColorStop(0.35, 'rgba(120,180,255,0.35)'); gr.addColorStop(1, 'rgba(90,150,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 256, 256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.14, fog: false }));
  halo.scale.set(2.6, 3.0, 1); halo.renderOrder = 9; a.halo = halo;
  a.light = new THREE.PointLight(0x9fd0ff, 1.6, 5, 1.8);
  a.teddy = buildTeddy();
  return a;
}
