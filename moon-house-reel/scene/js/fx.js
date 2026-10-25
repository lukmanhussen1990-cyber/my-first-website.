// Effects: ballistic dust grains (low gravity, no air => clean arcs, no clouds),
// impact sparks, meteors, air dots, heat/cold glows, icons and the magnifier.
import * as THREE from 'three';
import { mulberry32, clamp, smoothstep, popScale } from './util.js';
import { noSignalTexture, noAirTexture, checkTexture, makeCanvas, drawThermo } from './textures.js';

export const G_MOON = 1.62;

function softSpriteTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}
export const SOFT = softSpriteTex();

// --------------------------------------------------------------- grains ----
// A batch: { t0, n, seed, origin:[x,y,z], vel:[vx,vy,vz], spread:[sx,sy,sz], posSpread, size:[min,max],
//            delay (emission spread in s), rest (seconds visible after landing), ground:(x,z)=>y }
export function createGrains(scene, N = 3000) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a9a9d, roughness: 0.95, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.castShadow = true; mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const batches = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  function add(b) {
    const r = mulberry32(b.seed || 1);
    const parts = [];
    const ground = b.ground || (() => 0);
    for (let i = 0; i < b.n; i++) {
      const sp = b.spread || [0, 0, 0], ps = b.posSpread || [0, 0, 0];
      const o = [b.origin[0] + (r() - 0.5) * ps[0], b.origin[1] + (r() - 0.5) * ps[1], b.origin[2] + (r() - 0.5) * ps[2]];
      const v = [b.vel[0] + (r() - 0.5) * sp[0], b.vel[1] + (r() - 0.5) * sp[1], b.vel[2] + (r() - 0.5) * sp[2]];
      const g = b.g ?? G_MOON;
      const delay = (b.delay || 0) * r();
      // landing time: solve with ground height at the (iteratively) predicted landing spot
      let tl = 1e9;
      let gy = ground(o[0], o[2]);
      for (let it = 0; it < 3; it++) {
        const A = -0.5 * g, B = v[1], C = o[1] - gy;
        const disc = B * B - 4 * A * C;
        if (disc < 0) { tl = 1e9; break; }
        tl = (-B - Math.sqrt(disc)) / (2 * A);
        if (!(tl > 0)) { tl = 1e9; break; }
        gy = ground(o[0] + v[0] * tl, o[2] + v[2] * tl);
      }
      if (b.noLand) tl = 1e9;
      const sz = (b.size ? b.size[0] + (b.size[1] - b.size[0]) * Math.pow(r(), 2) : 0.03);
      parts.push({ o, v, g, delay, tl, sz, rot: [r() * 6, r() * 6, r() * 6], spin: [(r() - 0.5) * 6, (r() - 0.5) * 6, (r() - 0.5) * 6] });
    }
    batches.push({ ...b, parts });
  }
  function update(t) {
    let k = 0;
    for (const b of batches) {
      if (t < b.t0) continue;
      const rest = b.rest ?? 1.2;
      for (const pa of b.parts) {
        let tau = t - b.t0 - pa.delay;
        if (tau < 0) continue;
        let landed = false;
        if (tau > pa.tl) { landed = true; if (tau > pa.tl + rest) continue; }
        const tt = Math.min(tau, pa.tl);
        p.set(pa.o[0] + pa.v[0] * tt, pa.o[1] + pa.v[1] * tt - 0.5 * pa.g * tt * tt, pa.o[2] + pa.v[2] * tt);
        if (p.y < -40) continue;
        let sc = pa.sz;
        if (landed) sc *= 1 - smoothstep(0, rest, tau - pa.tl);
        if (b.grow) sc *= clamp(tau / 0.12);
        e.set(pa.rot[0] + pa.spin[0] * tt, pa.rot[1] + pa.spin[1] * tt, pa.rot[2] + pa.spin[2] * tt);
        q.setFromEuler(e); s.set(sc, sc * 0.8, sc);
        m4.compose(p, q, s);
        if (k < N) mesh.setMatrixAt(k++, m4);
      }
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { add, update, mesh, batches };
}

// --------------------------------------------------------------- sparks ----
export function createSparks(scene, N = 600) {
  const geo = new THREE.SphereGeometry(1, 6, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  scene.add(mesh);
  const bursts = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0), vdir = new THREE.Vector3();
  function add(b) { // {t0, pos:[x,y,z], n, speed, seed, life, color:[r,g,b], up}
    const r = mulberry32(b.seed || 3);
    const parts = [];
    for (let i = 0; i < b.n; i++) {
      const a = r() * Math.PI * 2, el = 0.25 + r() * 1.1;
      const sp = b.speed * (0.4 + r() * 0.8);
      parts.push({ v: [Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp * (b.upBias || 1), Math.sin(a) * Math.cos(el) * sp], life: b.life * (0.5 + r() * 0.6), sz: (0.012 + r() * 0.02) * (b.scale || 1) });
    }
    bursts.push({ ...b, parts });
  }
  function update(t) {
    let k = 0;
    for (const b of bursts) {
      const tau = t - b.t0;
      if (tau < 0 || tau > b.life * 1.2) continue;
      for (const pa of b.parts) {
        if (tau > pa.life) continue;
        const f = tau / pa.life;
        p.set(b.pos[0] + pa.v[0] * tau, b.pos[1] + pa.v[1] * tau - 0.5 * G_MOON * tau * tau, b.pos[2] + pa.v[2] * tau);
        vdir.set(pa.v[0], pa.v[1] - G_MOON * tau, pa.v[2]);
        const spd = vdir.length(); vdir.normalize();
        q.setFromUnitVectors(up, vdir);
        const len = Math.min(0.12, spd * 0.03) + pa.sz;
        s.set(pa.sz, len, pa.sz);
        m4.compose(p, q, s);
        mesh.setMatrixAt(k, m4);
        const c = b.color || [6, 3.2, 1.2];
        const fade = (1 - f) * (1 - f);
        col.setRGB(c[0] * fade, c[1] * fade, c[2] * fade);
        mesh.setColorAt(k, col);
        k++;
        if (k >= N) break;
      }
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return { add, update };
}

// --------------------------------------------------------------- meteors ---
export function createMeteors(scene) {
  const list = [];
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2.2) });
  const trailMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(2.4, 1.3, 0.6) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uCol; varying vec2 vUv;
      void main(){ float a = pow(vUv.y, 2.2) * (1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0)); gl_FragColor = vec4(uCol * a, 1.0); }`,
  });
  function add(m) { // {t0, t1, from:[..], to:[..]}
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(m.size || 0.12, 1), headMat); g.add(head);
    const halo = glowSprite(new THREE.Color(2.2, 1.4, 0.8), (m.size || 0.12) * 7, 0.9); head.add(halo);
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), trailMat); g.add(trail);
    g.visible = false; scene.add(g);
    list.push({ ...m, g, head, trail });
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3();
  function update(t, camera) {
    for (const m of list) {
      const u = (t - m.t0) / (m.t1 - m.t0);
      m.g.visible = u >= 0 && u <= 1;
      if (!m.g.visible) continue;
      a.fromArray(m.from); b.fromArray(m.to);
      p.lerpVectors(a, b, u);
      m.head.position.copy(p);
      // trail: a camera-facing quad from the head back along the path
      const tailLen = Math.min(u, 0.35) * a.distanceTo(b);
      const dir = b.clone().sub(a).normalize();
      const tail = p.clone().addScaledVector(dir, -tailLen);
      const mid = p.clone().add(tail).multiplyScalar(0.5);
      m.trail.position.copy(mid);
      const view = camera.position.clone().sub(mid).normalize();
      const side = new THREE.Vector3().crossVectors(dir, view).normalize();
      const fwd = new THREE.Vector3().crossVectors(side, view).normalize();
      const basis = new THREE.Matrix4().makeBasis(side, dir, view);
      m.trail.quaternion.setFromRotationMatrix(basis);
      m.trail.scale.set((m.size || 0.12) * 2.6, Math.max(0.001, tailLen), 1);
      void fwd;
    }
  }
  return { add, update };
}

// --------------------------------------------------------------- air dots --
export function createAirDots(scene, N = 260) {
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  const r = mulberry32(77);
  for (let i = 0; i < N; i++) seed.set([r(), r(), r(), r()], i * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: SOFT }, uScale: { value: 1080 }, uAlpha: { value: 1 } },
    vertexShader: `attribute float aSize; uniform float uScale; varying float vS;
      void main(){ vS = aSize; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uAlpha; varying float vS;
      void main(){ if (vS <= 0.0) discard; float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0) * a * 0.9 * uAlpha, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  // box: {x0,x1,y0,y1,z0,z1} in world; source: [x,y,z]; t0: start, dur: fill duration
  function update(t, box, source, t0, dur, alpha = 1) {
    const sz = g.attributes.aSize;
    for (let i = 0; i < N; i++) {
      const s0 = seed[i * 4], s1 = seed[i * 4 + 1], s2 = seed[i * 4 + 2], s3 = seed[i * 4 + 3];
      const born = t0 + s0 * dur;
      const age = t - born;
      if (!box || age < 0) { sz.array[i] = 0; continue; }
      const k = smoothstep(0, 1.6, age);
      const tx = box.x0 + (box.x1 - box.x0) * (0.08 + 0.84 * s1), ty = box.y0 + (box.y1 - box.y0) * (0.1 + 0.8 * s2), tz = box.z0 + (box.z1 - box.z0) * (0.1 + 0.8 * s3);
      const wob = 0.12;
      const x = source[0] + (tx - source[0]) * k + Math.sin(t * 0.9 + s1 * 20) * wob * k;
      const y = source[1] + (ty - source[1]) * k + Math.sin(t * 0.7 + s2 * 17) * wob * k + Math.sin(k * Math.PI) * 0.3;
      const z = source[2] + (tz - source[2]) * k + Math.sin(t * 0.8 + s3 * 13) * wob * k;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      sz.array[i] = (0.022 + 0.022 * s2) * smoothstep(0, 0.3, age);
    }
    mat.uniforms.uAlpha.value = alpha;
    g.attributes.position.needsUpdate = true; sz.needsUpdate = true;
  }
  return { update, pts, mat };
}

// ------------------------------------------------------- glow sprites ------
export function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: SOFT, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}

// heat wisps (orange, rising) and frost sparkles (blue) above the surface
export function createTempFX(scene, area) {
  const r = mulberry32(55);
  const hot = [], cold = [];
  for (let i = 0; i < 26; i++) {
    const s = glowSprite(new THREE.Color(1.0, 0.45, 0.1), 0.5, 0); scene.add(s);
    hot.push({ s, x: area.x0 + r() * (area.x1 - area.x0), z: area.z0 + r() * (area.z1 - area.z0), ph: r(), sp: 0.4 + r() * 0.4 });
    const c = glowSprite(new THREE.Color(0.35, 0.7, 1.0), 0.18, 0); scene.add(c);
    cold.push({ s: c, x: area.x0 + r() * (area.x1 - area.x0), z: area.z0 + r() * (area.z1 - area.z0), ph: r(), sp: 0.15 + r() * 0.2 });
  }
  function update(t, hotK, coldK) {
    for (const h of hot) {
      const u = (t * h.sp + h.ph) % 1;
      h.s.position.set(h.x + Math.sin(t * 2 + h.ph * 9) * 0.08, 0.1 + u * 1.3, h.z);
      h.s.material.opacity = hotK * Math.sin(u * Math.PI) * 0.55;
      h.s.scale.set(0.35 + u * 0.3, 0.6 + u * 0.4, 1);
      h.s.visible = hotK > 0.01;
    }
    for (const c of cold) {
      const u = (t * c.sp + c.ph) % 1;
      c.s.position.set(c.x, 0.05 + (1 - u) * 0.9, c.z);
      c.s.material.opacity = coldK * Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(t * 9 + c.ph * 30));
      c.s.visible = coldK > 0.01;
    }
  }
  return { update };
}

// ------------------------------------------------------------- icons -------
export function createIcons(scene) {
  const mk = (tex, size) => {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = 20; s.visible = false; scene.add(s);
    return s;
  };
  const noSignal = mk(noSignalTexture(), 1.0);
  const noAir = mk(noAirTexture(), 0.7);
  const check = mk(checkTexture(), 0.45);
  const check2 = mk(checkTexture(), 0.45);
  const thermoA = makeCanvas(128, 384), thermoB = makeCanvas(128, 384);
  const thA = mk(thermoA.tex, 1), thB = mk(thermoB.tex, 1);
  thA.material.depthTest = thB.material.depthTest = true;
  function place(s, t, t0, t1, pos, size, aspect = 1) {
    const k = popScale(t, t0, 0.42) * (t1 !== undefined ? 1 - smoothstep(t1, t1 + 0.3, t) : 1);
    s.visible = k > 0.002;
    s.position.set(...pos);
    s.scale.set(size * k * aspect, size * k, 1);
    return k;
  }
  function thermo(which, level, color) {
    const c = which === 0 ? thermoA : thermoB;
    drawThermo(c.ctx, 128, 384, level, color);
    c.tex.needsUpdate = true;
  }
  return { noSignal, noAir, check, check2, thA, thB, place, thermo };
}

// ------------------------------------------------------------ magnifier ----
// A round inset attached to the camera, showing the jagged dust grains up close.
export function createMagnifier(camera) {
  const g = new THREE.Group(); camera.add(g);
  const D = 3.0; // distance in front of the camera
  g.position.set(0, 0, -D);
  const bgTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const grd = x.createRadialGradient(128, 110, 10, 128, 128, 128); grd.addColorStop(0, '#7a8696'); grd.addColorStop(1, '#2b323c');
    x.fillStyle = grd; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bg = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), new THREE.MeshBasicMaterial({ map: bgTex }));
  bg.renderOrder = 30; g.add(bg);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 16, 80), new THREE.MeshStandardMaterial({ color: 0x7d858f, roughness: 0.5, metalness: 0.3 }));
  ring.renderOrder = 33; g.add(ring);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.4 }));
  handle.position.set(0.47, -0.47, 0); handle.rotation.z = Math.PI / 4; handle.renderOrder = 33; g.add(handle);
  // jagged shards: noisy tetra/octa-hedra, glassy dark with sharp glints
  const shardMat = new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.16, metalness: 0.8, flatShading: true, envMapIntensity: 3.0 });
  const r = mulberry32(19);
  const shards = [];
  for (let i = 0; i < 9; i++) {
    const base = i % 3 === 0 ? new THREE.OctahedronGeometry(1, 0) : new THREE.TetrahedronGeometry(1, 0);
    const geo = base.toNonIndexed();
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.6 + r() * 0.9), p.getY(k) * (1.0 + r() * 1.3), p.getZ(k) * (0.4 + r() * 0.6));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, shardMat); m.renderOrder = 31;
    const a = r() * Math.PI * 2, rad = i === 0 ? 0 : 0.17 + r() * 0.18;
    m.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0.15);
    const sc = i === 0 ? 0.16 : 0.05 + r() * 0.07; m.scale.setScalar(sc);
    m.userData = { rx: r() * 6, ry: r() * 6, sx: (r() - 0.5) * 1.2, sy: (r() - 0.5) * 1.2 };
    g.add(m); shards.push(m);
  }
  const keyLight = new THREE.PointLight(0xfff1dd, 0, 3, 1.2); keyLight.position.set(-0.4, 0.5, 0.7); camera.add(keyLight);
  keyLight.userData.follow = g;
  g.visible = false;
  function update(t, k, screen) {
    // k: 0..1 pop amount; screen: [nx, ny] in NDC-ish units for placement, radius in NDC height units
    g.visible = k > 0.002;
    keyLight.intensity = g.visible ? 2.2 : 0;
    if (!g.visible) return;
    const fovH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * D;
    g.position.set(screen[0] * fovH * camera.aspect, screen[1] * fovH, -D);
    g.scale.setScalar(Math.max(0.001, k) * screen[2] * fovH * 2);
    keyLight.position.set(g.position.x - 0.3 * g.scale.x, g.position.y + 0.4 * g.scale.x, g.position.z + 0.8 * g.scale.x);
    for (const s of shards) { s.rotation.set(s.userData.rx + t * s.userData.sx, s.userData.ry + t * s.userData.sy, 0); }
  }
  return { update, group: g };
}

// --------------------------------------------------------------- trails ----
// dotted path behind a flying clump, so the slow low-gravity arc reads clearly
export function createTrail(scene, N = 48) {
  const pos = new Float32Array(N * 3), size = new Float32Array(N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: SOFT }, uScale: { value: 1080 } },
    vertexShader: `attribute float aSize; uniform float uScale; varying float vS;
      void main(){ vS = aSize; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = abs(aSize) * uScale / -mv.z; }`,
    fragmentShader: `uniform sampler2D uMap; varying float vS;
      void main(){ if (vS == 0.0) discard; float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0, 0.9, 0.7) * a * 0.9, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  // path(t) -> [x,y,z] or null ; shows dots at path(t - k*step) fading with age
  function update(t, path, t0, step = 0.12, fade = 2.2) {
    for (let k = 0; k < N; k++) {
      const tk = t - (k + 1) * step;
      const p = tk >= t0 ? path(tk) : null;
      if (!p) { size[k] = 0; continue; }
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
      size[k] = 0.2 * Math.max(0, 1 - (t - tk) / fade);
    }
    g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
  return { update };
}
