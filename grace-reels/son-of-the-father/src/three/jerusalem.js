// Jerusalem kit (Q.03): limestone architecture in the bevelled low-poly paper style. Instanced where there are
// many (pavement slabs, columns, city houses, merlons, palms, straw), per-face colour variation + vertex gradients
// everywhere, a drafted-margin ashlar texture for the big Herodian walls. Also the story props: Barabbas' shackles +
// chain (fall and land), the rope on Jesus' wrists, the beam carried far away, the far cross, cloth banners that
// move in the wind, bronze braziers with live flames.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chamferBoxGeometry, faceColors, gradientColors, vcMat, canvasTex, stoneGeometry, scatter, makeBevelBox } from './kit.js';
import { U } from './materials.js';
import { FLAME_FS, makeSprites, puffTex } from './fx.js';
import { radialTex } from './materials.js';
import { hash01, mulberry32, clamp, lerp, smooth, invLerp, noise2, fbm } from '../lib/util.js';

export const LIME = ['#d9c9a6', '#cdb98f', '#c4ad84', '#e0d3b6', '#bfa77e', '#d3c09a'];
const _c = new THREE.Color();

// non-indexed, position + normal only (so anything merges with anything)
export function clean(g) {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
}
const merged = (parts) => { const g = mergeGeometries(parts.map((p) => { const c = clean(p); return c.attributes.color ? c : faceColors(c, '#ffffff', { lum: 0 }); })); g.computeVertexNormals(); return g; };
// aligned instancing (scatter() turns every instance to a random yaw): items [[x, y, z, yaw = 0]], one colour + jitter
export function placeInst(geo, mat, items, { color = '#ffffff', jitter = 0.05, seed = 1, cast = true, receive = true, scale = null } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)); im.count = items.length;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  items.forEach(([x, y, z, r = 0], i) => { q.setFromAxisAngle(up, r); p.set(x, y, z); if (scale) s.set(...scale); im.setMatrixAt(i, m4.compose(p, q, s)); im.setColorAt(i, _c.set(color).multiplyScalar(1 + (hash01(i, seed) - 0.5) * 2 * jitter)); });
  im.castShadow = cast; im.receiveShadow = receive; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

// ---------- textures ----------
// Herodian ashlar: long blocks in courses, a slightly raised boss with a flat drafted margin, dark joints
export function ashlarTex(repeat = [0.25, 0.25]) {
  const base = canvasTex('ashlar', 512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm(x * 0.02, y * 0.02, 3, 61) * 0.5 + fbm(x * 0.15, y * 0.15, 2, 63) * 0.18; const v = clamp(214 + n * 60, 0, 255); const i = (y * w + x) * 4; img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.91; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    const R = mulberry32(64); const rows = 6, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -R() * 140;
      while (x < w) {
        const bw = 120 + R() * 150, y0 = r * rh;
        // drafted margin (lighter flat band) + boss shadow + joint
        g.fillStyle = 'rgba(255,248,232,0.18)'; g.fillRect(x + 4, y0 + 4, bw - 8, 10); g.fillRect(x + 4, y0 + 4, 10, rh - 8);
        g.fillStyle = 'rgba(70,52,30,0.16)'; g.fillRect(x + 4, y0 + rh - 14, bw - 8, 10); g.fillRect(x + bw - 14, y0 + 4, 10, rh - 8);
        g.fillStyle = `rgba(${150 + R() * 40},${130 + R() * 30},${95 + R() * 25},${0.08 + R() * 0.1})`; g.fillRect(x + 14, y0 + 14, bw - 28, rh - 28);
        g.strokeStyle = 'rgba(60,44,28,0.75)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y0 + 1.5, bw - 3, rh - 3);
        x += bw;
      }
    }
  });
  const t = base.clone(); t.repeat.set(...repeat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}
export const ashlarMat = (hex = '#d6c6a2', repeat = [0.25, 0.25]) => new THREE.MeshLambertMaterial({ color: hex, map: ashlarTex(repeat), flatShading: true });

// ---------- columns ----------
// Roman column (unit: base at y 0, height h): plinth, two torus rings, tapering 16-sided shaft, neck, echinus, abacus.
export function columnGeometry(h = 7, r = 0.34, color = '#d8c8a6') {
  const P = [
    chamferBoxGeometry(r * 2.9, 0.24, r * 2.9, 0.035).translate(0, 0.12, 0),
    new THREE.CylinderGeometry(r * 1.26, r * 1.34, 0.17, 16).translate(0, 0.325, 0),
    new THREE.CylinderGeometry(r * 1.1, r * 1.18, 0.1, 16).translate(0, 0.46, 0),
    new THREE.CylinderGeometry(r * 0.88, r, h - 1.02, 16, 1).translate(0, 0.51 + (h - 1.02) / 2, 0),
    new THREE.CylinderGeometry(r * 0.98, r * 0.9, 0.1, 16).translate(0, h - 0.46, 0),
    new THREE.CylinderGeometry(r * 1.42, r * 0.98, 0.24, 16).translate(0, h - 0.29, 0),
    chamferBoxGeometry(r * 3.05, 0.18, r * 3.05, 0.025).translate(0, h - 0.09, 0),
  ].map((g) => faceColors(clean(g), color, { lum: 0.05, seed: 7, top: 0.08 }));
  const g = mergeGeometries(P);
  gradientColors(g, { axis: 'y', from: 0, to: h * 0.55, a: '#b9ab92', b: '#ffffff' });
  return g;
}
export function makeColumns(list, { h = 7, r = 0.34, color = '#d8c8a6', seed = 3 } = {}) {
  const im = new THREE.InstancedMesh(columnGeometry(h, r, color), vcMat(), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  list.forEach(([x, y, z, sc = 1], i) => { q.setFromAxisAngle(up, hash01(i, seed) * 0.4); p.set(x, y, z); s.setScalar(sc); im.setMatrixAt(i, m4.compose(p, q, s)); _c.setScalar(0.94 + 0.1 * hash01(i, seed + 1)); im.setColorAt(i, _c); });
  im.castShadow = im.receiveShadow = true; im.instanceColor.needsUpdate = true;
  return im;
}

// ---------- pavement (Gabbatha): bevelled slabs in running bond, per-slab colour + a hair of height/tilt ----------
export function makePavement({ x0 = -15.6, x1 = 15.6, z0 = -7.4, z1 = 24, sw = 1.3, sd = 0.92, seed = 11, skip = null } = {}) {
  const geo = faceColors(chamferBoxGeometry(1, 0.16, 1, 0.045).translate(0, -0.08, 0), '#ffffff', { lum: 0.03, seed, top: 0.06 });
  const pts = [];
  const R = mulberry32(seed);
  for (let z = z0, row = 0; z < z1; z += sd, row++) {
    let x = x0 - (row % 2) * sw * 0.5;
    while (x < x1) {
      const w = sw * (0.75 + 0.5 * R());
      const cx = Math.max(x0, x) + (Math.min(x1, x + w) - Math.max(x0, x)) / 2, cw = Math.min(x1, x + w) - Math.max(x0, x);
      if (cw > 0.2 && !(skip && skip(cx, z + sd / 2))) pts.push([cx, z + sd / 2, cw - 0.035, sd - 0.035, R(), R(), R()]);
      x += w;
    }
  }
  const im = new THREE.InstancedMesh(geo, vcMat(), pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const pal = ['#d4c3a0', '#c9b58e', '#bfa983', '#dccbaa', '#c3ae88', '#b8a07a'];
  pts.forEach(([x, z, w, d, a, b, c], i) => {
    e.set((a - 0.5) * 0.012, 0, (b - 0.5) * 0.012); q.setFromEuler(e); p.set(x, (c - 0.5) * 0.014, z); s.set(w, 1, d);
    im.setMatrixAt(i, m4.compose(p, q, s));
    _c.set(pal[Math.floor(c * pal.length) % pal.length]).multiplyScalar(0.93 + 0.12 * a); im.setColorAt(i, _c);
  });
  im.receiveShadow = true; im.castShadow = false; im.instanceColor.needsUpdate = true;
  const grout = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.4, z1 - z0 + 0.4).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7a6850' }));
  grout.position.set((x0 + x1) / 2, -0.045, (z0 + z1) / 2); grout.receiveShadow = true;
  const g = new THREE.Group(); g.add(grout, im); return g;
}

// ---------- steps: a flight of bevelled steps rising toward -dir ----------
export function makeSteps({ x = 0, z = 0, w = 4, n = 4, rise = 0.3, run = 0.32, dir = 1, color = '#cdbb96', seed = 5, y0 = 0 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const top = y0 + rise * (n - i), b = makeBevelBox(w, top - y0, run + 0.02, color, { bevel: 0.03, seed: seed + i, lum: 0.04 });
    b.position.set(x, y0 + (top - y0) / 2, z + dir * (i + 0.5) * run); g.add(b);
  }
  return g;
}

// ---------- cloth banner that moves in the wind (hangs from its top edge) ----------
export function makeBanner(w = 1.4, h = 3.2, { colors = ['#8a1f1f', '#c9a24a'], seed = 1, border = 0.12, fringe = true, horizontal = false } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, 6, 12).translate(0, -h / 2, 0);
  const col = [], p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const edge = Math.abs(x) > w / 2 - border || y < -h + border * 1.4 || y > -border * 0.8;
    _c.set(edge ? colors[1] : colors[0]).multiplyScalar(0.95 + 0.08 * hash01(i, seed)); col.push(_c.r, _c.g, _c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uSeed = { value: seed };
    sh.vertexShader = 'uniform float uTime; uniform float uWind; uniform float uSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hang = clamp(-position.y / ${h.toFixed(3)}, 0.0, 1.0);
      float wv = sin(uTime * 2.1 + position.y * 1.7 + uSeed) * 0.6 + sin(uTime * 3.3 + position.x * 2.5 + uSeed * 2.0) * 0.4;
      transformed.z += wv * 0.11 * uWind * hang * hang;
      transformed.x += sin(uTime * 1.3 + uSeed) * 0.04 * uWind * hang;`);
  };
  mat.customProgramCacheKey = () => 'banner' + h.toFixed(2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, w + 0.3, 6).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#6a4a26' })); g.add(rod);
  for (const sx of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshLambertMaterial({ color: '#c9a24a' })); k.position.x = sx * (w / 2 + 0.15); g.add(k); }
  if (fringe) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.02), new THREE.MeshLambertMaterial({ color: colors[1] })); f.position.y = -h - 0.04; m.add(f); }
  void horizontal;
  return g;
}

// ---------- Roman standard (vexillum): pole, crossbar, square red flag with gold fringe, gilded finial ----------
export function makeStandard(h = 3.4, seed = 2) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#5e3f24', flatShading: true }), gold = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.7, roughness: 0.35 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, h, 6), wood); pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 6).rotateZ(Math.PI / 2), wood); bar.position.y = h - 0.32; g.add(bar);
  const flag = makeBanner(0.78, 0.82, { colors: ['#8e1c1c', '#d0a84e'], seed, border: 0.07 }); flag.position.y = h - 0.32; flag.children[1].visible = false; g.add(flag);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), gold); fin.position.y = h + 0.1; g.add(fin);
  for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 12).rotateX(Math.PI / 2), gold); d.position.y = h - 1.2 - i * 0.28; g.add(d); }
  return g;
}

// ---------- bronze brazier on a tripod, with live flames + glow + embers ----------
export function makeBrazier(seed = 4, s = 1) {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: '#8a5a2a', metalness: 0.65, roughness: 0.42, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 1.0 * s, 5), bronze);
    leg.position.set(Math.cos(a) * 0.17 * s, 0.48 * s, Math.sin(a) * 0.17 * s); leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22); leg.castShadow = true; g.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.16 * s, 0.2 * s, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#7a4e22', metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide, flatShading: true }));
  bowl.position.y = 1.0 * s; bowl.castShadow = true; g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3 * s, 0.022 * s, 5, 16).rotateX(Math.PI / 2), bronze); rim.position.y = 1.1 * s; g.add(rim);
  const coal = new THREE.Mesh(new THREE.CircleGeometry(0.27 * s, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.45, 0.08), map: radialTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  coal.position.y = 1.07 * s; g.add(coal);
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, seed: { value: i * 3.7 + seed }, k: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FLAME_FS }));
    m.renderOrder = 7; m.position.y = 1.05 * s; g.add(m); flames.push(m);
  }
  const glow = makeSprites(2, { additive: true, fog: false, order: 8 }), embers = makeSprites(26, { additive: true, fog: false, order: 8 });
  g.add(glow.group, embers.group);
  const _p = new THREE.Vector3();
  return {
    group: g,
    set(t, camera, k = 1) {
      g.visible = k > 0.001; if (!g.visible) return;
      const o = g.getWorldPosition(_p), yaw = Math.atan2(camera.position.x - o.x, camera.position.z - o.z);
      flames.forEach((m, i) => {
        m.material.uniforms.time.value = t + i * 0.41; m.material.uniforms.k.value = k * (0.85 + 0.15 * noise2(t * 3 + i, 2, seed));
        m.rotation.set(0, yaw + (i - 1.5) * 0.22, 0); const sc = (i < 2 ? 1 : 0.75) * s * (0.9 + 0.15 * noise2(t * 2.4, i, seed)); m.scale.set(0.42 * sc, 0.78 * sc, 1);
      });
      const f = k * (0.85 + 0.15 * noise2(t * 7, 1.3, seed));
      glow.begin(); glow.add(o.x, o.y + 1.3 * s, o.z, 1.6 * s * f, 0.5 * f, 0.24 * f, 0.07 * f, 0.6); glow.end();
      embers.begin();
      for (let i = 0; i < 26; i++) {
        const life = 1.2 + 1.2 * hash01(i, 51), uu = ((t + hash01(i, 52) * life) % life) / life;
        const x = o.x + (hash01(i, 53) - 0.5) * 0.3 * s + 0.25 * noise2(t * 0.8 + i, 3, 9) * uu, z = o.z + (hash01(i, 54) - 0.5) * 0.3 * s + 0.25 * noise2(t * 0.8 + i, 7, 9) * uu;
        const b = k * (1 - uu) * (0.6 + 0.4 * Math.sin(t * 19 + i));
        embers.add(x, o.y + 1.15 * s + uu * (1.1 + hash01(i, 55)) * s, z, 0.025 * s, 1.8 * b, 0.7 * b, 0.15 * b, 1);
      }
      embers.end();
    },
  };
}

// ---------- the governor's palace: stylobate + steps, a colonnade of 10 columns, entablature, two-storey façade with
// doors and arched windows, cornice + parapet, side wings. Front faces +z; z1 = front edge of the stylobate.
export function makePalace({ x0 = -16, x1 = 16, z0 = -14.5, z1 = -8.4, h = 1.2, colH = 7.2, wallZ = -12.2, top = 15.5, color = '#d6c6a2' } = {}) {
  const g = new THREE.Group();
  const W = x1 - x0, cx = (x0 + x1) / 2;
  const sty = makeBevelBox(W, h, z1 - z0, '#cfbe9a', { bevel: 0.05, seed: 21, lum: 0.03 }); sty.position.set(cx, h / 2, (z0 + z1) / 2); g.add(sty);
  g.add(makeSteps({ x: cx, z: z1, w: W - 0.6, n: 4, rise: h / 4, run: 0.3, dir: 1, seed: 22 }));
  const colZ = z1 - 0.85, cols = [];
  for (let i = 0; i < 10; i++) cols.push([x0 + 2.5 + i * (W - 5) / 9, h, colZ]);
  g.add(makeColumns(cols, { h: colH, r: 0.36, seed: 23 }));
  const eY = h + colH;
  const arch = makeBevelBox(W - 1.2, 0.55, 1.15, '#d2c19c', { bevel: 0.04, seed: 24 }); arch.position.set(cx, eY + 0.275, colZ); g.add(arch);
  const frieze = makeBevelBox(W - 1.0, 0.7, 1.05, '#c8b690', { bevel: 0.03, seed: 25 }); frieze.position.set(cx, eY + 0.9, colZ); g.add(frieze);
  const cornice = makeBevelBox(W - 0.4, 0.32, 1.6, '#dccdab', { bevel: 0.06, seed: 26 }); cornice.position.set(cx, eY + 1.41, colZ + 0.1); g.add(cornice);
  // dentils under the cornice (instanced little blocks)
  const den = placeInst(faceColors(chamferBoxGeometry(0.16, 0.14, 0.12, 0.015), '#ffffff', { lum: 0.03 }), vcMat(),
    Array.from({ length: Math.floor((W - 1) / 0.32) }, (_, i) => [x0 + 0.6 + i * 0.32, eY + 1.18, colZ + 0.82]), { color: '#c9b791', jitter: 0.04, cast: false });
  g.add(den);
  // portico ceiling + the façade wall (two storeys) behind
  const ceil = makeBevelBox(W - 1.0, 0.3, Math.abs(wallZ - colZ) + 0.6, '#b9a783', { bevel: 0.02, seed: 27 }); ceil.position.set(cx, eY + 1.75, (wallZ + colZ) / 2); g.add(ceil);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(W, top - h, 1.2), ashlarMat(color, [0.22, 0.25])); wall.position.set(cx, h + (top - h) / 2, wallZ - 0.6); wall.castShadow = wall.receiveShadow = true; g.add(wall);
  // doors: deep dark openings with bronze-studded leaves half open + frames
  const dark = new THREE.MeshLambertMaterial({ color: '#2a1d14' }), bronze = new THREE.MeshStandardMaterial({ color: '#7a5226', metalness: 0.55, roughness: 0.45, flatShading: true });
  for (const [dx, dw, dh] of [[0, 3.0, 5.2], [-7.5, 2.0, 3.8], [7.5, 2.0, 3.8]]) {
    const op = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.2), dark); op.position.set(cx + dx, h + dh / 2, wallZ + 0.02); g.add(op);
    const fr = makeBevelBox(dw + 0.6, 0.4, 0.35, '#e2d4b4', { bevel: 0.04, seed: 28 }); fr.position.set(cx + dx, h + dh + 0.2, wallZ + 0.1); g.add(fr);
    for (const sx of [-1, 1]) { const jamb = makeBevelBox(0.3, dh, 0.32, '#e2d4b4', { bevel: 0.03, seed: 29 }); jamb.position.set(cx + dx + sx * (dw / 2 + 0.15), h + dh / 2, wallZ + 0.1); g.add(jamb);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(dw / 2, dh * 0.98, 0.08), bronze); leaf.position.set(cx + dx + sx * (dw / 2 - 0.05), h + dh / 2, wallZ + 0.3 + dw * 0.17); leaf.rotation.y = -sx * 1.15; leaf.castShadow = true; g.add(leaf); }
  }
  // upper storey: arched windows (dark), pilasters, a string course, the crowning cornice + parapet
  const sc = makeBevelBox(W + 0.3, 0.3, 0.5, '#dccdab', { bevel: 0.04, seed: 30 }); sc.position.set(cx, eY + 2.1, wallZ + 0.1); g.add(sc);
  for (let i = 0; i < 9; i++) {
    const wx = x0 + 2.2 + i * (W - 4.4) / 8;
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.15), dark); win.position.set(wx, eY + 3.6, wallZ + 0.02); g.add(win);
    const ar = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10, 0, Math.PI), dark); ar.position.set(wx, eY + 4.55, wallZ + 0.1); g.add(ar);
    const sill = makeBevelBox(1.3, 0.14, 0.32, '#e2d4b4', { bevel: 0.02, seed: 31 + i }); sill.position.set(wx, eY + 2.6, wallZ + 0.12); g.add(sill);
    if (i < 8) { const pil = makeBevelBox(0.5, top - eY - 2.3, 0.22, '#dacbaa', { bevel: 0.03, seed: 40 + i }); pil.position.set(wx + (W - 4.4) / 16, eY + 2.3 + (top - eY - 2.3) / 2, wallZ + 0.08); g.add(pil); }
  }
  const crown = makeBevelBox(W + 0.6, 0.55, 1.6, '#dccdab', { bevel: 0.07, seed: 50 }); crown.position.set(cx, top + 0.1, wallZ - 0.3); g.add(crown);
  const merl = [];
  for (let x = x0 + 0.3; x < x1 - 0.2; x += 1.1) merl.push([x, top + 0.37, wallZ + 0.25]);
  const mg = faceColors(chamferBoxGeometry(0.62, 0.7, 0.5, 0.04).translate(0, 0.35, 0), '#ffffff', { lum: 0.04 });
  g.add(placeInst(mg, vcMat(), merl, { color: '#d6c6a2', jitter: 0.04 }));
  // side wings going back (seen from above in the crane-up)
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(9, top - 2, 26), ashlarMat('#cfbf9b', [0.25, 0.25])); wing.position.set(cx + sx * (W / 2 - 4.5), (top - 2) / 2, wallZ - 14); wing.castShadow = wing.receiveShadow = true; g.add(wing);
    const r = makeBevelBox(9.4, 0.4, 26.4, '#c2b08a', { bevel: 0.05, seed: 52 }); r.position.set(cx + sx * (W / 2 - 4.5), top - 1.8, wallZ - 14); g.add(r);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(W - 18, top - 4, 22), ashlarMat('#cbbb97', [0.25, 0.25])); back.position.set(cx, (top - 4) / 2, wallZ - 13); back.castShadow = true; g.add(back);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, colZ, eY };
}

// ---------- the judgment seat (bema): a raised dais with panelled sides and front steps, the curule chair with a red
// cushion and a footstool. Seat surface at y = h + 0.48.
export function makeBema({ x = 2.2, z0 = -8.4, z1 = -5.6, h = 1.6, seat = [0, 1.6, -7.3] } = {}) {
  const g = new THREE.Group();
  const dais = makeBevelBox(2 * x, h, z1 - z0, '#d3c29d', { bevel: 0.06, seed: 61, lum: 0.03, grad: { axis: 'y', from: -h / 2, to: h / 2, a: '#b9aa8c', b: '#ffffff' } });
  dais.position.set(0, h / 2, (z0 + z1) / 2); g.add(dais);
  const slab = makeBevelBox(2 * x + 0.3, 0.14, z1 - z0 + 0.3, '#e0d2b2', { bevel: 0.04, seed: 62 }); slab.position.set(0, h + 0.02, (z0 + z1) / 2); g.add(slab);
  for (const px of [-x + 0.55, x - 0.55]) { const p = makeBevelBox(0.9, h * 0.6, 0.06, '#c1ae86', { bevel: 0.02, seed: 63 }); p.position.set(px, h * 0.48, z1 + 0.01); g.add(p); }
  const n = 5, rise = h / n, run = 0.32;
  for (let i = 0; i < n - 1; i++) { const top = h - rise * (i + 1); const s = makeBevelBox(2 * x - 1.0, top, run + 0.02, '#cdbb96', { bevel: 0.03, seed: 64 + i, lum: 0.04 }); s.position.set(0, top / 2, z1 + (i + 0.5) * run); g.add(s); }
  // curule chair: crossed curved legs (X) each side, an ivory seat, a red cushion with a gold edge
  const ivory = new THREE.MeshLambertMaterial({ color: '#efe6d2', flatShading: true }), goldM = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.7, roughness: 0.35, flatShading: true });
  const chair = new THREE.Group(); chair.position.set(seat[0], seat[1], seat[2]);
  for (const sx of [-0.33, 0.33]) for (const a of [-0.62, 0.62]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.06), ivory); leg.position.set(sx, 0.25, 0); leg.rotation.x = a; leg.castShadow = true; chair.add(leg);
  }
  for (const sx of [-0.33, 0.33]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.6), goldM); foot.position.set(sx, 0.025, 0); chair.add(foot); }
  const seatB = makeBevelBox(0.78, 0.07, 0.5, '#e8dcc4', { bevel: 0.02, seed: 66 }); seatB.position.y = 0.47; chair.add(seatB);
  const cush = makeBevelBox(0.7, 0.08, 0.44, '#8e1c1c', { bevel: 0.03, seed: 67 }); cush.position.y = 0.53; chair.add(cush);
  const fs = makeBevelBox(0.6, 0.14, 0.34, '#cdbb96', { bevel: 0.02, seed: 68 }); fs.position.set(0, 0.07, 0.55); chair.add(fs);
  g.add(chair);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, chair };
}

// ---------- a wall with an arched gate (extruded shape), two crenellated towers and gate leaves ----------
export function makeGateWall({ x0 = -16, x1 = 16, z = 24.5, t = 2.4, h = 9, gw = 2.6, gh = 4.6, towerX = 5.8, towerW = 4.6, towerH = 13, color = '#d2c19b', open = 1.15 } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(x0, 0); s.lineTo(-gw, 0); s.lineTo(-gw, gh); s.absarc(0, gh, gw, Math.PI, 0, true); s.lineTo(gw, 0); s.lineTo(x1, 0); s.lineTo(x1, h); s.lineTo(x0, h); s.lineTo(x0, 0);
  const eg = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 });
  eg.translate(0, 0, z - t / 2);
  const wall = new THREE.Mesh(eg, ashlarMat(color, [0.25, 0.25])); wall.castShadow = wall.receiveShadow = true; g.add(wall);
  // arch voussoirs (a ring of bevelled blocks around the opening, both faces)
  for (const fz of [z + t / 2 + 0.06, z - t / 2 - 0.06]) for (let i = 0; i <= 8; i++) {
    const a = Math.PI * i / 8, b = makeBevelBox(0.62, 0.42, 0.18, '#e2d4b4', { bevel: 0.03, seed: 70 + i });
    b.position.set(Math.cos(a) * (gw + 0.25), gh + Math.sin(a) * (gw + 0.25), fz); b.rotation.z = a - Math.PI / 2; g.add(b);
  }
  // top walk + merlons
  const merl = []; for (let x = x0 + 0.4; x < x1; x += 1.25) merl.push([x, h, z + t / 2 - 0.3], [x, h, z - t / 2 + 0.3]);
  const mg = faceColors(chamferBoxGeometry(0.7, 0.8, 0.55, 0.04).translate(0, 0.4, 0), '#ffffff', { lum: 0.04 });
  g.add(placeInst(mg, vcMat(), merl, { color: '#d2c19b', jitter: 0.05 }));
  // towers
  for (const sx of [-1, 1]) {
    const tw = new THREE.Mesh(new THREE.BoxGeometry(towerW, towerH, towerW + 0.6), ashlarMat('#cdbc96', [0.25, 0.25])); tw.position.set(sx * towerX, towerH / 2, z); tw.castShadow = tw.receiveShadow = true; g.add(tw);
    const cap = makeBevelBox(towerW + 0.5, 0.45, towerW + 1.1, '#dccdab', { bevel: 0.06, seed: 80 }); cap.position.set(sx * towerX, towerH + 0.1, z); g.add(cap);
    const tm = []; for (let i = 0; i < 4; i++) { const mx = sx * towerX - towerW / 2 + 0.5 + i * (towerW - 1) / 3; tm.push([mx, towerH + 0.3, z + towerW / 2 + 0.05], [mx, towerH + 0.3, z - towerW / 2 - 0.05]); }
    for (let i = 1; i < 3; i++) { const mz = z - towerW / 2 + 0.5 + i * (towerW - 1) / 3; tm.push([sx * towerX - towerW / 2 - 0.05, towerH + 0.3, mz, Math.PI / 2], [sx * towerX + towerW / 2 + 0.05, towerH + 0.3, mz, Math.PI / 2]); }
    g.add(placeInst(mg, vcMat(), tm, { color: '#d6c6a2', jitter: 0.05 }));
    for (const wy of [6.5, 9.8]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.1), new THREE.MeshLambertMaterial({ color: '#2a1d14' })); sl.position.set(sx * towerX, wy, z + towerW / 2 + 0.31); g.add(sl); const sl2 = sl.clone(); sl2.position.z = z - towerW / 2 - 0.31; g.add(sl2); }
  }
  // gate leaves (wood + iron bands), swung open into the courtyard
  const wood = new THREE.MeshLambertMaterial({ color: '#5e3e22', flatShading: true }), iron = new THREE.MeshStandardMaterial({ color: '#3d3a36', metalness: 0.5, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * gw, 0, z - t / 2 - 0.05); piv.rotation.y = sx * open; g.add(piv);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(gw, gh + 1.2, 0.16), wood); leaf.position.set(-sx * gw / 2, (gh + 1.2) / 2, -0.08); leaf.castShadow = true; piv.add(leaf);
    for (const by of [0.8, 2.6, 4.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(gw * 0.98, 0.12, 0.2), iron); b.position.set(-sx * gw / 2, by, -0.08); piv.add(b); }
  }
  return g;
}

// ---------- low parapet (balustrade) with posts, an opening with steps down (to the lower street) ----------
export function makeParapet({ x = 15.5, z0 = -7.4, z1 = 24, gap = [-5.2, -1.8], h = 1.1, down = 3.0 } = {}) {
  const g = new THREE.Group();
  for (const [a, b] of [[z0, gap[0]], [gap[1], z1]]) {
    const w = makeBevelBox(0.55, h, b - a, '#d3c29d', { bevel: 0.05, seed: 90, lum: 0.04 }); w.position.set(x, h / 2, (a + b) / 2); g.add(w);
    const cap = makeBevelBox(0.75, 0.14, b - a + 0.1, '#e0d2b2', { bevel: 0.03, seed: 91 }); cap.position.set(x, h + 0.06, (a + b) / 2); g.add(cap);
  }
  const posts = []; for (let z = z0; z <= z1 + 0.01; z += 3.4) if (z < gap[0] - 0.3 || z > gap[1] + 0.3) posts.push([x, 0, z]);
  posts.push([x, 0, gap[0]], [x, 0, gap[1]]);
  const pg = faceColors(chamferBoxGeometry(0.8, 1.6, 0.8, 0.06).translate(0, 0.8, 0), '#ffffff', { lum: 0.04 });
  g.add(placeInst(pg, vcMat(), posts, { color: '#d8c8a6', jitter: 0.05 }));
  // the steps down to the north street (dir +x)
  const n = 10, rise = down / n, run = 0.36;
  for (let i = 0; i < n; i++) { const top = -rise * (i + 1) + rise; const st = makeBevelBox(run + 0.02, 0.6, gap[1] - gap[0], '#c9b690', { bevel: 0.03, seed: 92 + i }); st.position.set(x + 0.3 + (i + 0.5) * run, top - 0.3, (gap[0] + gap[1]) / 2); g.add(st); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- a portico along one side: columns, a sloping tiled roof, the back wall with doors ----------
export function makePortico({ x = -15.4, back = -19.6, z0 = -6.5, z1 = 23, colH = 6, n = 9, tile = '#a0583a' } = {}) {
  const g = new THREE.Group();
  const cols = []; for (let i = 0; i < n; i++) cols.push([x, 0, z0 + i * (z1 - z0) / (n - 1)]);
  g.add(makeColumns(cols, { h: colH, r: 0.3, seed: 101 }));
  const beam = makeBevelBox(0.9, 0.6, z1 - z0 + 1.2, '#d2c19b', { bevel: 0.04, seed: 102 }); beam.position.set(x, colH + 0.3, (z0 + z1) / 2); g.add(beam);
  const depth = Math.abs(x - back) + 1.2;
  const roofG = new THREE.BoxGeometry(depth, 0.22, z1 - z0 + 1.6, 1, 1, 1);
  const roofM = new THREE.Mesh(faceColors(clean(roofG), tile, { lum: 0.05, seed: 103 }), vcMat()); roofM.position.set((x + back) / 2, colH + 1.2, (z0 + z1) / 2); roofM.rotation.z = (x > back ? -1 : 1) * 0.2; g.add(roofM);
  // tile ridges (instanced strips)
  const rp = []; for (let z = z0 - 0.6; z < z1 + 0.6; z += 0.42) rp.push([0, 0.12, z]);
  const rg = faceColors(clean(new THREE.CylinderGeometry(0.07, 0.07, depth, 5).rotateZ(Math.PI / 2)), '#ffffff', { lum: 0.05 });
  const ridges = placeInst(rg, vcMat(), rp, { color: '#9a5034', jitter: 0.08, cast: false }); ridges.position.set((x + back) / 2, colH + 1.2, 0); ridges.rotation.z = roofM.rotation.z; g.add(ridges);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.0, colH + 1.4, z1 - z0 + 1.6), ashlarMat('#cdbc96', [0.25, 0.25])); wall.position.set(back, (colH + 1.4) / 2, (z0 + z1) / 2); g.add(wall);
  const dark = new THREE.MeshLambertMaterial({ color: '#2a1d14' });
  for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 1.6), dark); d.position.set(back + (x > back ? 0.52 : -0.52), 1.3, z0 + 3 + i * (z1 - z0 - 6) / 3); g.add(d); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- the city: instanced flat-roofed limestone houses (body, roof slab, parapet, door + windows), some domes,
// rooftop booths and striped awnings. lots: [{ x, z, w, d, h, rot, y, color, dome, booth, awning }]
export function makeCity(lots, { seed = 5 } = {}) {
  const g = new THREE.Group();
  const n = lots.length;
  const body = faceColors(chamferBoxGeometry(1, 1, 1, 0.025).translate(0, 0.5, 0), '#ffffff', { lum: 0.035, seed, top: 0.05 });
  gradientColors(body, { axis: 'y', from: 0, to: 0.6, a: '#c9bfae', b: '#ffffff' });
  const slab = faceColors(chamferBoxGeometry(1.03, 0.07, 1.03, 0.01), '#ffffff', { lum: 0.03 });
  const par = merged([chamferBoxGeometry(1.03, 0.09, 0.05, 0.005).translate(0, 0.045, 0.49), chamferBoxGeometry(1.03, 0.09, 0.05, 0.005).translate(0, 0.045, -0.49),
    chamferBoxGeometry(0.05, 0.09, 1.03, 0.005).translate(0.49, 0.045, 0), chamferBoxGeometry(0.05, 0.09, 1.03, 0.005).translate(-0.49, 0.045, 0)]);
  const ops = merged([new THREE.BoxGeometry(0.15, 0.4, 0.02).translate(0.2, 0.2, 0.505), new THREE.BoxGeometry(0.09, 0.1, 0.02).translate(-0.22, 0.66, 0.505),
    new THREE.BoxGeometry(0.09, 0.1, 0.02).translate(0.02, 0.66, 0.505), new THREE.BoxGeometry(0.02, 0.1, 0.09).translate(0.505, 0.64, -0.15), new THREE.BoxGeometry(0.02, 0.1, 0.09).translate(-0.505, 0.64, 0.18)]);
  const mk = (geo, cnt, mat = vcMat()) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, cnt)); m.count = 0; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const B = mk(body, n), S = mk(slab, n), P = mk(par, n), O = mk(ops, n, new THREE.MeshLambertMaterial({ color: '#2e2016' }));
  const dome = faceColors(clean(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), '#ffffff', { lum: 0.04, top: 0.06 });
  const D = mk(dome, n), booth = faceColors(chamferBoxGeometry(1, 1, 1, 0.04).translate(0, 0.5, 0), '#ffffff', { lum: 0.04 }), BO = mk(booth, n);
  const awn = faceColors(clean(new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2 + 0.3)), '#ffffff', { lum: 0.02 });
  const A = mk(awn, n, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const add = (im, x, y, z, sx, sy, sz, rot, col) => { const i = im.count++; q.setFromAxisAngle(up, rot); p.set(x, y, z); s.set(sx, sy, sz); im.setMatrixAt(i, m4.compose(p, q, s)); if (col) im.setColorAt(i, _c.set(col)); };
  const R = mulberry32(seed);
  for (const L of lots) {
    const col = L.color || LIME[Math.floor(R() * LIME.length)];
    _c.set(col).multiplyScalar(0.93 + 0.1 * R()); const hex = '#' + _c.getHexString();
    add(B, L.x, L.y, L.z, L.w, L.h, L.d, L.rot, hex);
    add(O, L.x, L.y, L.z, L.w, L.h, L.d, L.rot, null);
    add(S, L.x, L.y + L.h, L.z, L.w, 1, L.d, L.rot, '#' + _c.multiplyScalar(0.92).getHexString());
    if (L.dome) add(D, L.x, L.y + L.h + 0.05, L.z, Math.min(L.w, L.d) * 0.82, Math.min(L.w, L.d) * 0.55, Math.min(L.w, L.d) * 0.82, L.rot, hex);
    else add(P, L.x, L.y + L.h + 0.03, L.z, L.w, 4, L.d, L.rot, hex);
    if (L.booth) { const bw = 1.8 + R() * 1.2; add(BO, L.x + (R() - 0.5) * L.w * 0.4, L.y + L.h + 0.05, L.z + (R() - 0.5) * L.d * 0.4, bw, 1.6 + R() * 0.6, bw * (0.8 + 0.4 * R()), L.rot, LIME[Math.floor(R() * LIME.length)]); }
    if (L.awning) { const c = ['#a8452c', '#3c6b66', '#c99a3a', '#7a2e3a', '#e8d6b0'][Math.floor(R() * 5)]; const cs = Math.cos(L.rot), sn = Math.sin(L.rot);
      add(A, L.x + sn * (L.d / 2 + 0.5), L.y + 2.2, L.z + cs * (L.d / 2 + 0.5), Math.min(3.2, L.w * 0.5), 1, 1.3, L.rot, c); }
  }
  for (const im of [B, S, P, O, D, BO, A]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  return g;
}

// ---------- city walls: crenellated segments with square towers ----------
export function makeCityWall(points, { h = 11, t = 3.6, heightAt = () => 0, color = '#cbb994', towerEvery = 42, towerH = 17, seed = 9 } = {}) {
  const g = new THREE.Group(); const merl = [], towers = [];
  const mat = ashlarMat(color, [0.2, 0.22]);
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1], L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az);
    const nSeg = Math.ceil(L / 14);
    for (let k = 0; k < nSeg; k++) {
      const u0 = k / nSeg, u1 = (k + 1) / nSeg, cx = lerp(ax, bx, (u0 + u1) / 2), cz = lerp(az, bz, (u0 + u1) / 2);
      const y = Math.min(heightAt(lerp(ax, bx, u0), lerp(az, bz, u0)), heightAt(lerp(ax, bx, u1), lerp(az, bz, u1))) - 2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(t, h + 2, L / nSeg + 0.05), mat); seg.position.set(cx, y + (h + 2) / 2, cz); seg.rotation.y = rot; seg.castShadow = seg.receiveShadow = true; g.add(seg);
      for (let d = 0.6; d < L / nSeg; d += 1.5) { const u = u0 + d / L; merl.push([lerp(ax, bx, u) + Math.cos(rot) * t * 0.35, lerp(az, bz, u) - Math.sin(rot) * t * 0.35, y + h + 2, rot]); }
    }
    for (let d = 0; d < L; d += towerEvery) towers.push([lerp(ax, bx, d / L), lerp(az, bz, d / L), rot]);
  }
  towers.push([...points[points.length - 1], 0]);
  const mg = faceColors(chamferBoxGeometry(0.9, 1.1, 0.7, 0.05).translate(0, 0.55, 0), '#ffffff', { lum: 0.05 });
  const mi = new THREE.InstancedMesh(mg, vcMat(), merl.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  merl.forEach(([x, z, y, r], i) => { q.setFromAxisAngle(up, r); p.set(x, y, z); mi.setMatrixAt(i, m4.compose(p, q, s)); mi.setColorAt(i, _c.set(color).multiplyScalar(0.94 + 0.1 * hash01(i, seed))); });
  mi.castShadow = true; g.add(mi);
  towers.forEach(([x, z, r], i) => {
    const y = heightAt(x, z) - 2, th = towerH + 4 * hash01(i, seed + 3);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(7, th + 2, 7), mat); tw.position.set(x, y + (th + 2) / 2, z); tw.rotation.y = r; tw.castShadow = tw.receiveShadow = true; g.add(tw);
    const cap = makeBevelBox(7.6, 0.6, 7.6, '#d6c6a2', { bevel: 0.08, seed: seed + i }); cap.position.set(x, y + th + 2.2, z); cap.rotation.y = r; g.add(cap);
  });
  return g;
}

// ---------- the temple on its platform (far away in the haze): retaining walls with pilasters, courts, the white
// and gold sanctuary, the altar (its smoke rises from ev to ev), the long royal portico, the fortress at the corner.
export function makeTemple({ c = [-10, 0, 300], baseY = -2, top = 7 } = {}) {
  const g = new THREE.Group(); g.position.set(c[0], 0, c[2]);
  const W = 190, D = 170;
  const plat = new THREE.Mesh(new THREE.BoxGeometry(W, top - baseY, D), ashlarMat('#d3c4a2', [0.08, 0.1])); plat.position.y = baseY + (top - baseY) / 2; plat.castShadow = plat.receiveShadow = true; g.add(plat);
  const pil = []; const py = top - 4.6;
  for (let x = -W / 2 + 3; x < W / 2; x += 6) { pil.push([x, py, -D / 2 - 0.4]); pil.push([x, py, D / 2 + 0.4]); } for (let z = -D / 2 + 3; z < D / 2; z += 6) { pil.push([-W / 2 - 0.4, py, z]); pil.push([W / 2 + 0.4, py, z]); }
  const pg = faceColors(chamferBoxGeometry(1.2, 4.5, 1.2, 0.08).translate(0, 2.25, 0), '#ffffff', { lum: 0.04 });
  g.add(placeInst(pg, vcMat(), pil, { color: '#d8c9a8', jitter: 0.04 }));
  // porticoes around the edge (low roofed colonnades as long blocks) + the royal portico on the south (-x) side
  const stoa = (x, z, w, d, h) => { const b = makeBevelBox(w, h, d, '#e2d6bc', { bevel: 0.15, seed: 111 }); b.position.set(x, top + h / 2, z); g.add(b); const r = makeBevelBox(w + 1, 0.6, d + 1, '#a8583a', { bevel: 0.1, seed: 112 }); r.position.set(x, top + h + 0.3, z); g.add(r); };
  stoa(-W / 2 + 6, 0, 10, D - 4, 12); stoa(W / 2 - 4, 0, 7, D - 4, 8); stoa(0, D / 2 - 3.5, W - 18, 7, 8); stoa(0, -D / 2 + 3.5, W - 18, 7, 8);
  const rc = []; for (let z = -D / 2 + 6; z < D / 2 - 4; z += 4.5) rc.push([-W / 2 + 12.2, top, z]);
  g.add(makeColumns(rc, { h: 11.5, r: 0.55, seed: 113 }));
  // inner courts: a raised terrace with walls
  const court = makeBevelBox(70, 4, 100, '#ddd0b2', { bevel: 0.2, seed: 114 }); court.position.set(10, top + 2, 15); g.add(court);
  // the sanctuary: porch (46 x 46) + the house behind, white with gold
  const white = '#f3ede0';
  const porch = makeBevelBox(46, 46, 11, white, { bevel: 0.3, seed: 115, lum: 0.02 }); porch.position.set(10, top + 4 + 23, 22); g.add(porch);
  const house = makeBevelBox(30, 34, 52, '#ece4d4', { bevel: 0.25, seed: 116, lum: 0.02 }); house.position.set(10, top + 4 + 17, 52); g.add(house);
  const door = new THREE.Mesh(new THREE.BoxGeometry(10, 24, 0.5), new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.6, roughness: 0.35, emissive: '#5a3a10', emissiveIntensity: 0.2 })); door.position.set(10, top + 4 + 12, 22 - 5.6); g.add(door);
  const band = new THREE.Mesh(new THREE.BoxGeometry(46.4, 1.4, 11.4), new THREE.MeshStandardMaterial({ color: '#d4aa4c', metalness: 0.7, roughness: 0.3 })); band.position.set(10, top + 4 + 44.5, 22); g.add(band);
  const spikes = []; for (let x = -12; x <= 32; x += 2.2) spikes.push([x, 22]);
  const sg = new THREE.ConeGeometry(0.25, 1.6, 4).translate(0, 0.8, 0);
  const sp = scatter(clean(sg), new THREE.MeshStandardMaterial({ color: '#d9b04e', metalness: 0.7, roughness: 0.3 }), 0, { points: spikes, scale: [1, 1], tilt: 0, cast: false }); sp.position.y = top + 4 + 46; g.add(sp);
  // altar of burnt offering (smoke source)
  const altar = makeBevelBox(15, 7, 15, '#d8ccb0', { bevel: 0.2, seed: 117 }); altar.position.set(10, top + 4 + 3.5, -8); g.add(altar);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 18), new THREE.MeshLambertMaterial({ color: '#d0c3a6', flatShading: true })); ramp.position.set(10, top + 4 + 3.4, -22); ramp.rotation.x = -0.36; g.add(ramp);
  // the fortress at the north-west corner (+x, -z of the platform)
  const fort = makeBevelBox(36, 22, 26, '#cbb994', { bevel: 0.25, seed: 118 }); fort.position.set(W / 2 - 18, top + 11, -D / 2 + 13); g.add(fort);
  for (const [fx, fz, fh] of [[W / 2 - 2, -D / 2 + 1, 36], [W / 2 - 34, -D / 2 + 1, 28], [W / 2 - 2, -D / 2 + 25, 28], [W / 2 - 34, -D / 2 + 25, 28]]) { const tw = makeBevelBox(7, fh, 7, '#c9b791', { bevel: 0.15, seed: 119 }); tw.position.set(fx, top + fh / 2, fz); g.add(tw); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, altarTop: [c[0] + 10, top + 4 + 7.4, c[2] - 8] };
}

// ---------- instanced palm (merged vertex-coloured geometry: trunk segments + 9 fronds) ----------
let _palmGeo = null;
export function palmGeometry() {
  if (_palmGeo) return _palmGeo;
  const parts = []; let px = 0, py = 0; const lean = 0.12;
  for (let i = 0; i < 6; i++) { const seg = faceColors(clean(new THREE.CylinderGeometry(0.13, 0.17, 1.05, 6).translate(0, 0.52, 0).rotateZ(lean * (1 + i * 0.15)).translate(px, py, 0)), i % 2 ? '#7a5634' : '#6a4a2c', { lum: 0.06, seed: i }); parts.push(seg); px -= Math.sin(lean * (1 + i * 0.15)); py += Math.cos(lean); }
  for (let i = 0; i < 10; i++) {
    const lf = new THREE.ConeGeometry(0.42, 2.8, 3); lf.translate(0, 1.4, 0); lf.scale(1, 1, 0.16); lf.rotateX(1.75 + 0.3 * hash01(i, 3)); lf.rotateY(i / 10 * Math.PI * 2 + 0.3 * hash01(i, 4)); lf.translate(px, py, 0);
    parts.push(faceColors(clean(lf), i % 2 ? '#5d7a30' : '#4f6a28', { lum: 0.08, seed: 10 + i }));
  }
  _palmGeo = mergeGeometries(parts); _palmGeo.computeVertexNormals();
  return _palmGeo;
}
export const makePalms = (points, o = {}) => scatter(palmGeometry(), vcMat(), 0, { points, scale: [0.9, 1.25], tilt: 0.04, colors: ['#ffffff', '#f2f0e6', '#e8eadc'], jitter: 0.05, ...o });

// ---------- straw / chaff scattered on the stone (thin instanced blades) ----------
export function makeStraw(n, { area = [-10, 0, 10, 10], seed = 7, skip = null } = {}) {
  const geo = faceColors(clean(new THREE.BoxGeometry(0.22, 0.006, 0.012)), '#ffffff', { lum: 0.15, seed });
  return scatter(geo, vcMat(), n, { area, scale: [0.5, 1.3], squash: [1, 1], tilt: 0.05, colors: ['#d9bf7a', '#c9a95e', '#e2cd8e', '#b8984e'], seed, skip, cast: false });
}

// ---------- Barabbas' shackles: two iron cuffs (on the wrists) and a heavy sagging chain between them. set() places
// them from two wrist points (world) toward the camera; fall() drops them (slow motion) and lets them settle in a pile.
export function makeShackles({ links = 22, sag = 0.34 } = {}) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: '#4c4f55', metalness: 0.7, roughness: 0.42, flatShading: true });
  const cuffGeo = new THREE.TorusGeometry(0.058, 0.022, 6, 14); cuffGeo.rotateX(Math.PI / 2);
  const hinge = new THREE.BoxGeometry(0.04, 0.05, 0.04).translate(0.075, 0, 0);
  const cuffs = [0, 1].map(() => { const c = new THREE.Group(); const r = new THREE.Mesh(cuffGeo, iron); r.scale.y = 1.6; c.add(r); c.add(new THREE.Mesh(hinge, iron)); c.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.add(c); return c; });
  const lg = new THREE.TorusGeometry(0.026, 0.0085, 5, 8); lg.scale(1, 1.55, 1);
  const chain = new THREE.InstancedMesh(lg, iron, links); chain.castShadow = true; chain.frustumCulled = false; g.add(chain);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), d = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const pts = Array.from({ length: links + 1 }, () => new THREE.Vector3());
  const layChain = () => {
    for (let i = 0; i < links; i++) {
      const a = pts[i], b = pts[i + 1]; p.copy(a).add(b).multiplyScalar(0.5); d.copy(b).sub(a); const L = d.length() || 1e-4; d.divideScalar(L);
      q.setFromUnitVectors(Y, d); q2.setFromAxisAngle(Y, i % 2 ? Math.PI / 2 : 0); q.multiply(q2);
      s.set(1, Math.max(0.6, L / 0.07), 1); chain.setMatrixAt(i, m4.compose(p, q, s));
    }
    chain.instanceMatrix.needsUpdate = true;
  };
  return {
    group: g, cuffs, chain,
    // attached: wrists a, b (world, already pushed toward the camera), sway (m) for a little swing
    // dirA / dirB: forearm directions (the cuff rings sit around them)
    set(a, b, sway = 0, toCam = null, dirA = null, dirB = null) {
      A.copy(a); B.copy(b);
      cuffs[0].position.copy(A); cuffs[1].position.copy(B);
      if (dirA && dirB) { cuffs[0].quaternion.setFromUnitVectors(Y, dirA); cuffs[1].quaternion.setFromUnitVectors(Y, dirB); }
      else if (toCam) { const yaw = Math.atan2(toCam.x, toCam.z); cuffs[0].rotation.set(0, yaw, 0.35); cuffs[1].rotation.set(0, yaw, -0.35); }
      const span = A.distanceTo(B);
      const sg = Math.max(0.08, sag - span * 0.25);
      for (let i = 0; i <= links; i++) {
        const u = i / links; pts[i].copy(A).lerp(B, u); pts[i].y -= sg * 4 * u * (1 - u);
        if (toCam) pts[i].addScaledVector(toCam, 0.012 * Math.sin(u * Math.PI));
        pts[i].x += sway * Math.sin(u * Math.PI);
      }
      layChain();
    },
    // dropped at age (s) after release from wrists a0/b0: falls as it hung (slow-motion gravity g0), then settles in a
    // loose pile on groundY over 0.35 s (a small bounce)
    fall(age, a0, b0, { groundY = 0.03, g0 = 9.8 * 0.3, toCam = null, dirA = null, dirB = null } = {}) {
      const drop = 0.5 * g0 * Math.max(0, age) ** 2;
      const low = Math.min(a0.y, b0.y) - 0.3;                      // lowest point of the hanging chain
      const tf = Math.sqrt(2 * Math.max(0.01, low - groundY) / g0);
      const land = age > tf ? Math.min(1, (age - tf) / 0.35) : 0, ls = smooth(land);
      const bounce = land > 0 ? 0.035 * Math.sin(Math.PI * land) * (1 - land) : 0;
      const mx = (a0.x + b0.x) / 2, mz = (a0.z + b0.z) / 2;
      for (let i = 0; i <= links; i++) {
        const u = i / links;
        const hx = lerp(a0.x, b0.x, u), hz = lerp(a0.z, b0.z, u), hy = Math.max(groundY + 0.012, lerp(a0.y, b0.y, u) - 0.3 * 4 * u * (1 - u) - drop);
        const px = mx + (u - 0.5) * 0.5 + 0.08 * Math.sin(u * 9), pz = mz + 0.13 * Math.sin(u * 6.3), py = groundY + 0.012 + bounce * Math.sin(u * Math.PI);
        pts[i].set(lerp(hx, px, ls), lerp(hy, py, ls), lerp(hz, pz, ls));
      }
      layChain();
      const yaw = toCam ? Math.atan2(toCam.x, toCam.z) : 0;
      [a0, b0].forEach((w, j) => {
        const c = cuffs[j], e = pts[j ? links : 0];
        c.position.set(lerp(w.x, e.x, ls), Math.max(groundY + 0.03, lerp(w.y - drop, groundY + 0.03, ls)) + bounce, lerp(w.z, e.z, ls));
        const flat = q2.setFromEuler(new THREE.Euler(0, yaw + j * 0.7, (j ? -0.15 : 0.15)));
        const dd = j ? dirB : dirA;
        if (dd) { q.setFromUnitVectors(Y, dd); c.quaternion.copy(q).slerp(flat, Math.max(ls, clamp(age / 1.2) * 0.4)); }
        else c.quaternion.copy(flat);
      });
    },
  };
}

// ---------- the rope on Jesus' wrists (a few coils + a short hanging end) ----------
export function makeRope() {
  // a tight wrap of rope around both wrists (turns overlap and cross, so it reads as one bound band, never as
  // separate rings), a knot, and the loose end hanging down in two segments
  const g = new THREE.Group(), coils = new THREE.Group(); g.add(coils);
  const m = new THREE.MeshLambertMaterial({ color: '#b8925c', emissive: '#2a1d0c', emissiveIntensity: 0.35, flatShading: true });
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.043 + 0.003 * (i % 2), 0.0135, 6, 14).rotateX(Math.PI / 2), m); t.position.y = (i - 2) * 0.017; t.rotation.z = (i % 2 ? 1 : -1) * 0.32; coils.add(t); }
  const knot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.024, 0), m); knot.position.set(0, 0.005, 0.045); knot.scale.set(1.2, 0.9, 0.8); coils.add(knot);
  const end = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0105, 0.15, 6).translate(0, -0.075, 0), m); g.add(end);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.008, 0.12, 6).translate(0, -0.06, 0), m); tail.position.y = -0.145; tail.rotation.z = 0.35; end.add(tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.coils = coils; g.userData.end = end;
  return g;
}

// ---------- the beam carried up the hill (seen far away only) + the far cross on the summit ----------
export function makeBeamProp(len = 2.0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.16), new THREE.MeshLambertMaterial({ color: '#5e4128', flatShading: true })); m.castShadow = true; return m;
}
export function makeCross(h = 4.6, w = 2.2) {
  const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: '#4a3220', flatShading: true });
  const up = new THREE.Mesh(new THREE.BoxGeometry(0.24, h, 0.24), mat); up.position.y = h / 2; g.add(up);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.22), mat); bar.position.y = h * 0.74; g.add(bar);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- rocks on the hill (instanced bevelled stones) ----------
export function makeRocks(points, { colors = ['#a39276', '#968569', '#b09f82', '#8a7a60'], seed = 13, scale = [0.4, 1.6] } = {}) {
  const geo = faceColors(stoneGeometry(1, seed, { points: 12, squash: 0.6 }), '#ffffff', { lum: 0.1, seed: seed + 1, top: 0.12 });
  return scatter(geo, vcMat(), 0, { points, scale, squash: [0.5, 0.9], tilt: 0.25, colors, jitter: 0.08, seed });
}

// ---------- rising smoke column (temple altar) ----------
export function makeSmoke(n = 36, seed = 3) {
  const sp = makeSprites(n, { tex: puffTex(), order: 4 });
  return {
    group: sp.group,
    set(t, base, { k = 1, wind = [3.5, 0, 1.2], color = [0.82, 0.8, 0.78], rise = 3.2, life = 9 } = {}) {
      sp.begin();
      if (k > 0.001) for (let i = 0; i < n; i++) {
        const u = ((t + i * life / n + hash01(i, seed) * 0.5) % life) / life;
        const y = base[1] + u * rise * life, s = 3 + u * 16;
        sp.add(base[0] + wind[0] * u * life * 0.5 + 2 * noise2(u * 3, i, seed), y, base[2] + wind[2] * u * life * 0.5 + 2 * noise2(u * 3, i + 9, seed), s,
          color[0], color[1], color[2], 0.42 * k * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.4), i * 1.7);
      }
      sp.end();
    },
  };
}
