// Effects, all evaluated analytically from time t (deterministic, frame-independent).
import * as THREE from 'three';
import { M, V, lumpy, labelTexture } from './parts.js';
import { rng, clamp, lerp, smooth, easeOut, easeOutBack, pop, seg } from './util.js';

const G = 9.8;
const dummy = new THREE.Object3D();
const camQ = new THREE.Quaternion();

function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return labelTexture(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, inner); g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, w, h); });
}

function glyphTex(text, fill, stroke = '#1b1320', size = 200) {
  return labelTexture(256, 256, (c, w, h) => {
    c.font = `bold ${size}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = 26; c.strokeStyle = stroke; c.strokeText(text, w / 2, h / 2 + 10);
    c.fillStyle = fill; c.fillText(text, w / 2, h / 2 + 10);
  });
}

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    // --- dirt chunks
    this.dirtBursts = []; // {t0, from, to, n, seed, dur, size}
    const dg = lumpy(1, 5, 0.35, 1);
    this.dirt = new THREE.InstancedMesh(dg, M.soilLoose, 260); this.dirt.castShadow = true; this.dirt.receiveShadow = true; this.dirt.frustumCulled = false;
    scene.add(this.dirt);
    // --- soft puffs (dust, leaves, sparkles share billboards)
    const puffMat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(196,160,120,0.85)', 'rgba(196,160,120,0)'), transparent: true, depthWrite: false, fog: false });
    this.puffs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), puffMat, 80); this.puffs.frustumCulled = false; this.puffs.renderOrder = 6; scene.add(this.puffs);
    this.puffBursts = [];
    // --- sparkles (additive stars on snaps)
    const starTex = labelTexture(128, 128, (c, w, h) => { c.translate(w / 2, h / 2); const g = c.createRadialGradient(0, 0, 0, 0, 0, 60); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,240,180,0.8)'); g.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = g; c.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 14 : 62; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); });
    this.stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.2, 2.0, 1.6), fog: false }), 60);
    this.stars.frustumCulled = false; this.stars.renderOrder = 7; scene.add(this.stars); this.starBursts = [];
    // --- feathers
    const fg = new THREE.SphereGeometry(1, 8, 6); fg.scale(0.012, 0.003, 0.04);
    this.feathers = new THREE.InstancedMesh(fg, new THREE.MeshPhysicalMaterial({ color: 0x1c1d26, roughness: 0.4, clearcoat: 0.5, sheen: 1, sheenColor: new THREE.Color(0x4a62c8) }), 90);
    this.feathers.castShadow = true; this.feathers.frustumCulled = false; scene.add(this.feathers); this.featherBursts = [];
    // --- leaves (bush dives)
    const lg = new THREE.PlaneGeometry(0.05, 0.03);
    this.leaves = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0x5f9a35, side: THREE.DoubleSide, roughness: 0.6 }), 90);
    this.leaves.frustumCulled = false; scene.add(this.leaves); this.leafBursts = [];
    // --- sound rings (camera facing tori)
    this.rings = []; this.ringEvents = [];
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 10, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.visible = false; m.renderOrder = 8; scene.add(m); this.rings.push(m);
    }
    // --- glyph sprites: ! ? notes
    this.glyphMats = {
      '!': new THREE.SpriteMaterial({ map: glyphTex('!', '#ffd23a'), depthWrite: false }),
      '?': new THREE.SpriteMaterial({ map: glyphTex('?', '#7fe3ff'), depthWrite: false }),
      'n1': new THREE.SpriteMaterial({ map: glyphTex('♪', '#ff6ad5', '#2a0f2a', 190), depthWrite: false }),
      'n2': new THREE.SpriteMaterial({ map: glyphTex('♫', '#ffe14d', '#2a1f0a', 190), depthWrite: false }),
      'n3': new THREE.SpriteMaterial({ map: glyphTex('♪', '#6df0ff', '#0a1f2a', 190), depthWrite: false }),
    };
    this.glyphs = []; this.glyphEvents = [];
    for (let k = 0; k < 16; k++) { const s = new THREE.Sprite(this.glyphMats['!']); s.visible = false; s.renderOrder = 9; scene.add(s); this.glyphs.push(s); }
    // --- spin swooshes
    const swTex = labelTexture(256, 32, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 8, w, 16); });
    this.swooshes = [];
    for (let k = 0; k < 3; k++) {
      const g = new THREE.CylinderGeometry(1, 1, 0.05, 48, 1, true, 0, Math.PI * 0.9);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: swTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0, fog: false }));
      m.renderOrder = 6; scene.add(m); this.swooshes.push(m);
    }
    // --- fireflies
    this.flies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 3.2, 1.2), fog: false }), 18);
    this.flies.frustumCulled = false; scene.add(this.flies);
    // --- calendar
    this.calendar = this.buildCalendar(); camera.add(this.calendar.grp);
  }

  buildCalendar() {
    const grp = new THREE.Group(); grp.position.set(-0.3, 0.6, -2.6); grp.rotation.set(0.12, 0.28, -0.06);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.03), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7 })); back.position.set(0, -0.05, -0.02); grp.add(back);
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.04), new THREE.MeshStandardMaterial({ color: 0xd8432b, roughness: 0.5 })); header.position.set(0, 0.25, 0.0); grp.add(header);
    for (const x of [-0.17, 0.17]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16), M.metal); ring.position.set(x, 0.32, 0.01); grp.add(ring); }
    const pageTex = (n) => labelTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8dfca'; c.fillRect(0, h - 14, w, 14);
      c.fillStyle = '#2b2430'; c.font = 'bold 168px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, h / 2 + 6);
      c.fillStyle = '#d8432b'; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(30 + k * 33, 26, 7, 0, 7); c.fill(); }
    });
    const pages = [];
    for (let k = 0; k < 7; k++) {
      const piv = new THREE.Group(); piv.position.set(0, 0.18, 0.025 + 0.002 * (7 - k)); grp.add(piv);
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.5), new THREE.MeshStandardMaterial({ map: pageTex(12 + k), roughness: 0.8, side: THREE.DoubleSide }));
      pg.position.y = -0.25; piv.add(pg); pages.push(piv);
    }
    grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 20; } });
    grp.visible = false;
    return { grp, pages };
  }

  // ---------------------------------------------------------------- event registration
  dirtBurst(t0, from, to, { n = 14, dur = 0.5, size = 0.035, spread = 0.12, seed = 1, arc = 0.5, keep = 0 } = {}) { this.dirtBursts.push({ t0, from, to, n, dur, size, spread, seed, arc, keep }); }
  puff(t0, at, { n = 6, size = 0.25, dur = 0.8, seed = 1, color = null, rise = 0.25 } = {}) { this.puffBursts.push({ t0, at, n, size, dur, seed, rise }); }
  sparkle(t0, at, { n = 6, size = 0.12, dur = 0.5, seed = 1 } = {}) { this.starBursts.push({ t0, at, n, size, dur, seed }); }
  featherBurst(t0, at, { n = 6, seed = 1, dur = 2.2 } = {}) { this.featherBursts.push({ t0, at, n, seed, dur }); }
  leafBurst(t0, at, { n = 14, seed = 1, dur = 1.4 } = {}) { this.leafBursts.push({ t0, at, n, seed, dur }); }
  ring(t0, at, { dur = 0.9, r0 = 0.05, r1 = 1.6, color = 0xffd27a, width = 1, intensity = 2.5 } = {}) { this.ringEvents.push({ t0, at, dur, r0, r1, color: new THREE.Color(color), width, intensity }); }
  glyph(t0, t1, key, at, { size = 0.16 } = {}) { this.glyphEvents.push({ t0, t1, key, at, size }); }

  // ---------------------------------------------------------------- update
  update(t, ctx) {
    this.camera.getWorldQuaternion(camQ);
    const resolve = (p, tt) => (typeof p === 'function' ? p(tt) : p);
    // dirt chunks
    let di = 0;
    for (const b of this.dirtBursts) {
      const life = b.dur + 0.6;
      if (t < b.t0 || t > b.t0 + life + b.keep) continue;
      const r = rng(b.seed);
      for (let k = 0; k < b.n && di < this.dirt.count; k++) {
        const delay = r() * 0.08; const tt = t - b.t0 - delay; const d = b.dur * (0.85 + r() * 0.3);
        const from = resolve(b.from, b.t0).clone().add(V((r() - 0.5) * 0.06, r() * 0.03, (r() - 0.5) * 0.06));
        const to = resolve(b.to, b.t0 + d).clone().add(V((r() - 0.5) * b.spread * 2, 0, (r() - 0.5) * b.spread));
        if (tt < 0) continue;
        const u = Math.min(1, tt / d);
        const p = from.clone().lerp(to, u); p.y += Math.sin(Math.PI * u) * (b.arc + r() * 0.15);
        const sz = b.size * (0.5 + r()) * (tt > d ? Math.max(0, 1 - (tt - d) / (0.6 + b.keep)) : 1);
        if (sz <= 0.001) continue;
        dummy.position.copy(p); dummy.rotation.set(tt * 7 * r(), tt * 9 * r(), tt * 5); dummy.scale.setScalar(sz); dummy.updateMatrix();
        this.dirt.setMatrixAt(di++, dummy.matrix);
      }
    }
    for (let k = di; k < 260; k++) { dummy.scale.setScalar(0); dummy.updateMatrix(); this.dirt.setMatrixAt(k, dummy.matrix); }
    this.dirt.instanceMatrix.needsUpdate = true;

    // puffs
    let pi = 0; const pcol = new THREE.Color();
    for (const b of this.puffBursts) {
      if (t < b.t0 || t > b.t0 + b.dur) continue;
      const r = rng(b.seed); const u = (t - b.t0) / b.dur; const at = resolve(b.at, b.t0);
      for (let k = 0; k < b.n && pi < 80; k++) {
        const a = r() * Math.PI * 2; const sp = 0.2 + r() * 0.35;
        dummy.position.copy(at).add(V(Math.cos(a) * sp * easeOut(u), b.rise * easeOut(u) + r() * 0.05, Math.sin(a) * sp * 0.6 * easeOut(u)));
        dummy.quaternion.copy(camQ); dummy.scale.setScalar(b.size * (0.5 + r() * 0.6) * (0.4 + easeOut(u) * 0.9)); dummy.updateMatrix();
        this.puffs.setMatrixAt(pi, dummy.matrix); pcol.setScalar(Math.max(0, 1 - u) * 0.9); this.puffs.setColorAt(pi, pcol); pi++;
      }
    }
    for (let k = pi; k < 80; k++) { dummy.scale.setScalar(0); dummy.updateMatrix(); this.puffs.setMatrixAt(k, dummy.matrix); }
    this.puffs.instanceMatrix.needsUpdate = true; if (this.puffs.instanceColor) this.puffs.instanceColor.needsUpdate = true;
    this.puffs.material.opacity = 1;

    // sparkles
    let si = 0;
    for (const b of this.starBursts) {
      if (t < b.t0 || t > b.t0 + b.dur) continue;
      const r = rng(b.seed); const u = (t - b.t0) / b.dur; const at = resolve(b.at, b.t0);
      for (let k = 0; k < b.n && si < 60; k++) {
        const a = (k / b.n) * Math.PI * 2 + r(); const d = 0.05 + easeOut(u) * (0.12 + r() * 0.12);
        dummy.position.copy(at).add(V(Math.cos(a) * d, Math.sin(a) * d, 0.05).applyQuaternion(camQ));
        dummy.quaternion.copy(camQ); dummy.rotateZ(u * 3 + k); dummy.scale.setScalar(b.size * Math.sin(Math.PI * Math.min(1, u * 1.2)) * (0.6 + r() * 0.6)); dummy.updateMatrix();
        this.stars.setMatrixAt(si++, dummy.matrix);
      }
    }
    for (let k = si; k < 60; k++) { dummy.scale.setScalar(0); dummy.updateMatrix(); this.stars.setMatrixAt(k, dummy.matrix); }
    this.stars.instanceMatrix.needsUpdate = true;

    // feathers (flutter down)
    let fi = 0;
    for (const b of this.featherBursts) {
      if (t < b.t0 || t > b.t0 + b.dur) continue;
      const r = rng(b.seed); const tt = t - b.t0; const at = resolve(b.at, b.t0);
      for (let k = 0; k < b.n && fi < 90; k++) {
        const vx = (r() - 0.5) * 1.2, vz = (r() - 0.5) * 0.6, up = 0.6 + r() * 0.6; const ph = r() * 6;
        const fall = Math.min(tt * up, 0.25) - Math.max(0, tt - 0.25 / up) * 0.32;
        const y = at.y + fall; if (y < 0.01) continue;
        dummy.position.set(at.x + vx * easeOut(Math.min(1, tt / 0.8)) * 0.5 + Math.sin(tt * 5 + ph) * 0.06, y, at.z + vz * 0.4 * easeOut(Math.min(1, tt)));
        dummy.rotation.set(Math.sin(tt * 6 + ph) * 0.8, tt * 2 + ph, Math.cos(tt * 5 + ph) * 0.6);
        dummy.scale.setScalar((1 - smooth(seg(tt, b.dur - 0.4, b.dur))) * (0.8 + r() * 0.5)); dummy.updateMatrix();
        this.feathers.setMatrixAt(fi++, dummy.matrix);
      }
    }
    for (let k = fi; k < 90; k++) { dummy.scale.setScalar(0); dummy.updateMatrix(); this.feathers.setMatrixAt(k, dummy.matrix); }
    this.feathers.instanceMatrix.needsUpdate = true;

    // leaves
    let li = 0;
    for (const b of this.leafBursts) {
      if (t < b.t0 || t > b.t0 + b.dur) continue;
      const r = rng(b.seed); const tt = t - b.t0; const at = resolve(b.at, b.t0);
      for (let k = 0; k < b.n && li < 90; k++) {
        const a = r() * Math.PI * 2, sp = 0.6 + r() * 1.0, vy = 1.2 + r() * 1.4;
        const y = at.y + vy * tt - 0.5 * 3.2 * tt * tt; if (y < 0.0) continue;
        dummy.position.set(at.x + Math.cos(a) * sp * tt * 0.7, y, at.z + Math.sin(a) * sp * tt * 0.5 + 0.1);
        dummy.rotation.set(tt * 8 + k, tt * 5, tt * 6); dummy.scale.setScalar(1 - smooth(seg(tt, b.dur - 0.4, b.dur))); dummy.updateMatrix();
        this.leaves.setMatrixAt(li++, dummy.matrix);
      }
    }
    for (let k = li; k < 90; k++) { dummy.scale.setScalar(0); dummy.updateMatrix(); this.leaves.setMatrixAt(k, dummy.matrix); }
    this.leaves.instanceMatrix.needsUpdate = true;

    // rings
    let ri = 0;
    for (const e of this.ringEvents) {
      if (t < e.t0 || t > e.t0 + e.dur || ri >= this.rings.length) continue;
      const u = (t - e.t0) / e.dur; const m = this.rings[ri++]; m.visible = true;
      m.position.copy(resolve(e.at, t)); m.quaternion.copy(camQ);
      const rad = lerp(e.r0, e.r1, easeOut(u)); m.scale.set(rad, rad, rad * e.width);
      m.material.color.copy(e.color).multiplyScalar(e.intensity * Math.pow(1 - u, 1.3));
    }
    for (let k = ri; k < this.rings.length; k++) this.rings[k].visible = false;

    // glyphs
    let gi = 0;
    for (const e of this.glyphEvents) {
      if (t < e.t0 || t > e.t1 || gi >= this.glyphs.length) continue;
      const s = this.glyphs[gi++]; s.visible = true; s.material = this.glyphMats[e.key];
      const age = t - e.t0, left = e.t1 - t;
      const sc = e.size * pop(t, e.t0, 0.3) * smooth(Math.min(1, left / 0.15));
      s.position.copy(resolve(e.at, t)); s.position.y += 0.03 * Math.sin(age * 9) + (e.key.startsWith('n') ? age * 0.25 : 0);
      if (e.key.startsWith('n')) s.position.x += Math.sin(age * 4 + e.t0 * 7) * 0.05;
      s.scale.set(sc, sc, sc); s.material.rotation = Math.sin(age * 7) * 0.15;
    }
    for (let k = gi; k < this.glyphs.length; k++) this.glyphs[k].visible = false;

    // swooshes around the spinning scarecrow
    const spinSpeed = ctx.spinSpeed || 0; const sp = ctx.scarecrowPos || V(0, 0, 0);
    this.swooshes.forEach((m, k) => {
      const a = clamp((Math.abs(spinSpeed) - 4) / 6) * 0.75;
      m.material.opacity = a; m.visible = a > 0.01;
      const rad = [0.75, 0.62, 0.42][k]; m.scale.set(rad, 1, rad);
      m.position.set(sp.x, [1.12, 0.95, 1.5][k], sp.z); m.rotation.y = -ctx.spinAngle * 1.0 - k * 2.1 + Math.PI;
    });

    // fireflies at night
    const night = ctx.night || 0; const fr = rng(4242);
    for (let k = 0; k < 18; k++) {
      const bx = lerp(-2.4, 2.4, fr()), by = lerp(0.25, 1.4, fr()), bz = lerp(-2.4, -0.2, fr()), ph = fr() * 10;
      const blink = Math.max(0, Math.sin(t * (1.2 + fr()) + ph)) ** 3;
      dummy.position.set(bx + Math.sin(t * 0.7 + ph) * 0.2, by + Math.sin(t * 1.1 + ph * 2) * 0.12, bz + Math.cos(t * 0.6 + ph) * 0.15);
      dummy.scale.setScalar(night > 0.5 ? blink * (night - 0.5) * 2 + 0.0001 : 0.0001); dummy.updateMatrix(); this.flies.setMatrixAt(k, dummy.matrix);
    }
    this.flies.instanceMatrix.needsUpdate = true;

    // calendar
    const cal = ctx.calendar; const C = this.calendar;
    if (cal && t > cal.t0 - 0.01 && t < cal.t1 + 0.4) {
      C.grp.visible = true;
      const s = pop(t, cal.t0, 0.35) * (1 - easeOutBack(seg(t, cal.t1, cal.t1 + 0.3)) * 1.0);
      C.grp.scale.setScalar(Math.max(0.0001, s * 0.8));
      C.pages.forEach((pg, k) => {
        const ft = cal.flips[k]; const fu = ft === undefined ? 0 : smooth(seg(t, ft, ft + 0.28));
        pg.rotation.x = -fu * Math.PI * 0.95; pg.visible = k >= cal.first && k <= cal.first + cal.flips.length;
        pg.position.z = 0.025 + 0.002 * (7 - k) + fu * 0.03;
      });
      C.pages.forEach((pg, k) => { pg.children[0].material.opacity = 1; });
      C.grp.position.y = 0.62 + Math.sin(t * 2.2) * 0.01;
    } else C.grp.visible = false;
  }
}
