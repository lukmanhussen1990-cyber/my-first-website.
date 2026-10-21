// Deterministic effects (all evaluated analytically from time, no simulation state):
// dirt chunks, dust puffs, light beams, sweat drops, music notes, "!" pop.
import * as THREE from 'three';
import { mulberry32, clamp, easeOut, smoothstep } from './util.js';
import { radialTexture, noteTexture } from './materials.js';

const G = -7.5;

export function makeFX(scene) {
  const fx = { emissions: [] };
  // ---- dirt chunks
  const chunkGeo = new THREE.IcosahedronGeometry(1, 1);
  { const p = chunkGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 9 + p.getY(i) * 7) * 0.18; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); } chunkGeo.computeVertexNormals(); }
  const MAXC = 700;
  const chunks = new THREE.InstancedMesh(chunkGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), MAXC);
  chunks.castShadow = true; chunks.receiveShadow = true; chunks.frustumCulled = false;
  const pal = [0x4a2e1a, 0x5c3a22, 0x3b2414, 0x6e4a2c, 0x7a5a3c].map((h) => new THREE.Color(h));
  for (let i = 0; i < MAXC; i++) chunks.setColorAt(i, pal[i % pal.length]);
  scene.add(chunks);
  // ---- dust puffs (sprites)
  const puffTex = radialTexture({ stops: [[0, 'rgba(255,255,255,0.85)'], [0.45, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']] });
  const MAXD = 90; const puffs = [];
  for (let i = 0; i < MAXD; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: new THREE.Color(0.78, 0.62, 0.46), transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; scene.add(s); puffs.push(s);
  }
  const _d = new THREE.Object3D();

  // origin, dir: arrays; floor: function(x,z)->y or number
  fx.dirt = (t0, origin, dir, { count = 14, speed = 2.2, spread = 0.5, size = 0.035, seed = 1, life = 1.4, floor = 0 } = {}) => fx.emissions.push({ k: 'dirt', t0, origin, dir, count, speed, spread, size, seed, life, floor });
  fx.dust = (t0, origin, { count = 5, radius = 0.25, size = 0.35, seed = 2, life = 1.1, rise = 0.25, color = null } = {}) => fx.emissions.push({ k: 'dust', t0, origin, count, radius, size, seed, life, rise, color });

  // ---- light beams from the chest
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uI; uniform float uTime;
      void main(){ float v = vUv.y; float fade = (1.0 - v) * smoothstep(0.0, 0.05, v);
        float edge = sin(vUv.x * 3.14159 * 2.0) * 0.5 + 0.5;
        float flick = 0.8 + 0.2 * sin(uTime * 13.0 + vUv.x * 40.0);
        vec3 c = mix(vec3(1.6, 0.95, 0.35), vec3(2.2, 1.9, 1.2), (1.0 - v) * 0.6);
        gl_FragColor = vec4(c * fade * uI * flick * (0.55 + 0.45*edge), 1.0); }`,
  });
  const beams = new THREE.Group(); scene.add(beams);
  const rb = mulberry32(81);
  for (let i = 0; i < 7; i++) {
    const g = new THREE.CylinderGeometry(0.22 + rb() * 0.25, 0.05, 1, 24, 1, true); g.translate(0, 0.5, 0);
    const m = new THREE.Mesh(g, beamMat); m.userData = { tilt: (rb() - 0.5) * 0.7, az: rb() * Math.PI * 2, len: 0.75 + rb() * 0.5, sp: (rb() - 0.5) * 0.6 };
    beams.add(m);
  }
  fx.setBeams = (t, pos, intensity, grow) => {
    beams.visible = intensity > 0.001; beamMat.uniforms.uI.value = intensity; beamMat.uniforms.uTime.value = t;
    beams.position.copy(pos);
    for (const m of beams.children) {
      const u = m.userData; m.rotation.set(Math.cos(u.az + t * u.sp) * u.tilt, 0, Math.sin(u.az + t * u.sp) * u.tilt);
      m.scale.set(1, 14 * u.len * grow, 1);
    }
  };

  // ---- sweat drops
  const dropGeo = new THREE.SphereGeometry(0.03, 14, 10); { const p = dropGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0) { const k = 1 - y / 0.03 * 0.75; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y * 1.8); } } dropGeo.computeVertexNormals(); }
  const dropMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, transmission: 0, clearcoat: 1, emissive: 0x4fa8e0, emissiveIntensity: 0.35 });
  const drops = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(dropGeo, dropMat); m.visible = false; scene.add(m); return m; });
  fx.sweatEvents = [];
  fx.sweat = (t0, side, seed) => fx.sweatEvents.push({ t0, side, seed });

  // ---- music notes (grandpa humming) + "!" pop
  const noteTex = noteTexture();
  const notes = Array.from({ length: 10 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, color: new THREE.Color(2.2, 1.7, 0.6), transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); return s; });
  fx.noteWindow = null; // {t0, t1, anchor: fn(t)->Vector3}
  const exTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.font = 'bold 110px DejaVu Sans, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 14; x.strokeStyle = '#2a1405'; x.strokeText('!', 64, 68); x.fillStyle = '#ffd23a'; x.fillText('!', 64, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: exTex, transparent: true, depthWrite: false })); bang.visible = false; scene.add(bang);
  fx.bangEvents = []; // {t0, dur, anchor: fn(t)}
  fx.bang = (t0, dur, anchor) => fx.bangEvents.push({ t0, dur, anchor });

  fx.update = (t, ctx) => {
    // dirt + dust
    let ci = 0, di = 0;
    for (const e of fx.emissions) {
      const dt0 = t - e.t0; if (dt0 < 0 || dt0 > e.life + 0.6) continue;
      const rnd = mulberry32(e.seed * 7919 + 13);
      if (e.k === 'dirt') {
        for (let i = 0; i < e.count && ci < MAXC; i++) {
          const delay = rnd() * 0.08; const dt = dt0 - delay;
          const vx = e.dir[0] * e.speed * (0.65 + rnd() * 0.7) + (rnd() - 0.5) * e.spread * e.speed;
          const vy = e.dir[1] * e.speed * (0.65 + rnd() * 0.7) + (rnd() - 0.5) * e.spread * e.speed * 0.5;
          const vz = e.dir[2] * e.speed * (0.65 + rnd() * 0.7) + (rnd() - 0.5) * e.spread * e.speed;
          const sz = e.size * (0.5 + rnd() * 1.0); const rx = rnd() * 6, ry = rnd() * 6, spin = (rnd() - 0.5) * 14;
          if (dt < 0) continue;
          let x = e.origin[0] + vx * dt, z = e.origin[2] + vz * dt, y = e.origin[1] + vy * dt + 0.5 * G * dt * dt;
          const fl = typeof e.floor === 'function' ? e.floor(x, z) : e.floor;
          // landing time: solve y = floor
          let landed = false, tl = dt;
          if (y < fl + sz * 0.5) {
            const a = 0.5 * G, b = vy, c = e.origin[1] - fl - sz * 0.5; const disc = b * b - 4 * a * c;
            tl = disc > 0 ? (-b - Math.sqrt(disc)) / (2 * a) : dt; tl = clamp(tl, 0, dt);
            x = e.origin[0] + vx * tl; z = e.origin[2] + vz * tl; y = fl + sz * 0.45; landed = true;
          }
          const after = landed ? dt - tl : 0;
          const scale = sz * (landed ? clamp(1 - after / 0.45, 0, 1) : 1) * clamp(dt / 0.04, 0, 1);
          if (scale <= 0.0005) continue;
          _d.position.set(x, y, z); _d.rotation.set(rx + spin * Math.min(dt, tl), ry, rx * 0.5); _d.scale.setScalar(scale); _d.updateMatrix();
          chunks.setMatrixAt(ci++, _d.matrix);
        }
      } else {
        for (let i = 0; i < e.count && di < MAXD; i++) {
          const delay = rnd() * 0.12; const dt = dt0 - delay; const a = rnd() * Math.PI * 2, r = rnd() * e.radius;
          const s = puffs[di]; const life = e.life * (0.7 + rnd() * 0.5);
          const k = dt / life; if (dt < 0 || k > 1) continue;
          const ek = easeOut(k);
          s.position.set(e.origin[0] + Math.cos(a) * r * (0.4 + ek), e.origin[1] + e.rise * ek + 0.05, e.origin[2] + Math.sin(a) * r * (0.4 + ek) * 0.6);
          const sc = e.size * (0.35 + ek * (0.8 + rnd() * 0.5)); s.scale.set(sc, sc, 1);
          s.material.opacity = 0.55 * (1 - k) * smoothstep(0, 0.12, k);
          if (e.color) s.material.color.copy(e.color); else s.material.color.setRGB(0.78, 0.62, 0.46);
          s.material.rotation = a + k; s.visible = true; di++;
        }
      }
    }
    chunks.count = ci; chunks.instanceMatrix.needsUpdate = true; if (chunks.instanceColor) chunks.instanceColor.needsUpdate = true;
    for (let i = di; i < MAXD; i++) puffs[i].visible = false;
    // sweat drops
    let si = 0;
    for (const e of fx.sweatEvents) {
      const dt = t - e.t0; if (dt < 0 || dt > 0.75 || si >= drops.length) continue;
      const head = ctx.kidHead(); const d = drops[si++]; d.visible = true;
      const vx = e.side * 0.6, vy = 0.9;
      d.position.set(head.x + e.side * 0.2 + vx * dt, head.y + 0.18 + vy * dt + 0.5 * G * 0.6 * dt * dt, head.z + 0.1);
      const sc = Math.min(1, dt / 0.08) * (1 - smoothstep(0.55, 0.75, dt)) * 1.2; d.scale.setScalar(Math.max(0.001, sc));
      d.rotation.z = -e.side * 0.6;
    }
    for (let i = si; i < drops.length; i++) drops[i].visible = false;
    // notes
    for (const [i, n] of notes.entries()) {
      const w = fx.noteWindow; n.visible = false; if (!w) continue;
      const te = w.t0 + i * 0.36; const dt = t - te; if (t > w.t1 + 1.2 || dt < 0 || dt > 1.3 || te > w.t1) continue;
      const a = w.anchor(te); n.visible = true;
      n.position.set(a.x + 0.12 + Math.sin(dt * 5 + i) * 0.08 + dt * 0.12, a.y + 0.25 + dt * 0.55, a.z + 0.1);
      const sc = 0.16 * Math.min(1, dt / 0.15) * (1 + 0.1 * Math.sin(dt * 12)); n.scale.set(sc, sc, 1);
      n.material.opacity = Math.min(1, dt / 0.15) * (1 - smoothstep(0.8, 1.3, dt)); n.material.rotation = Math.sin(dt * 4 + i) * 0.35;
    }
    // "!" pop
    bang.visible = false;
    for (const e of fx.bangEvents) {
      const dt = t - e.t0; if (dt < 0 || dt > e.dur) continue;
      const a = e.anchor(t); bang.visible = true; bang.position.set(a.x + 0.05, a.y + 0.42, a.z);
      const pop = dt < 0.25 ? (1 - Math.exp(-14 * dt) * Math.cos(dt * 30)) : 1; const out = 1 - smoothstep(e.dur - 0.15, e.dur, dt);
      const sc = 0.32 * pop * out; bang.scale.set(sc, sc, 1);
    }
  };
  return fx;
}
