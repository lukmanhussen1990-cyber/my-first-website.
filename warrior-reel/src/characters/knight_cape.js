// Procedural (stateless, deterministic) cape: each frame every column is "dropped" from anchors on the
// upper back like a chain that slides over collision volumes (back plate, pauldrons, hips, thighs, the
// seat rock, the ground). No simulation history, so renderAt(t) for any t gives the same result.
import * as THREE from 'three';
import { rng, clamp, noise1, smoothstep, lerp } from '../core/util.js';

const COLS = 19, ROWS = 24;

function capeTextures() {
  // cloth colour detail (dithered weave, sRGB)
  const N = 32, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), r = rng(77);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const w = ((x + y) % 4 < 2 ? 1 : 0.94) * (0.9 + r() * 0.14) * (1 - 0.06 * ((y % 8) === 0 ? 1 : 0));
    const v = Math.round(clamp(w, 0, 1) * 255);
    ctx.fillStyle = `rgb(${v},${v},${Math.round(v * 1.0)})`; ctx.fillRect(x, y, 1, 1);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestMipmapLinearFilter; map.repeat.set(4, 6);
  // alpha: frayed hem (v = 0 at the hem) + a few moth holes near the bottom
  const A = 64, data = new Uint8Array(A * A * 4), r2 = rng(13);
  for (let i = 0; i < A * A * 4; i++) data[i] = 255;
  for (let x = 0; x < A; x++) {
    let cut = 1 + Math.floor(r2() * 3) + (r2() < 0.22 ? 2 + Math.floor(r2() * 3) : 0);
    for (let y = 0; y < cut; y++) { const i = (y * A + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  }
  for (let k = 0; k < 5; k++) {
    const hx = Math.floor(r2() * A), hy = 6 + Math.floor(r2() * 6);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) { const i = (((hy + dy) % A) * A + ((hx + dx) % A)) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  }
  const alpha = new THREE.DataTexture(data, A, A, THREE.RGBAFormat);
  alpha.magFilter = THREE.NearestFilter; alpha.minFilter = THREE.NearestFilter; alpha.generateMipmaps = false;
  alpha.wrapS = THREE.RepeatWrapping; alpha.wrapT = THREE.ClampToEdgeWrapping; alpha.needsUpdate = true;
  return { map, alpha };
}

export function buildCape(rig, { length = 1.24, color = 0x262c3b } = {}) {
  const nV = (ROWS + 1) * COLS;
  const pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2);
  const idx = [];
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i;
    uv[k * 2] = i / (COLS - 1) * 1.0; uv[k * 2 + 1] = 1 - j / ROWS;
    if (j < ROWS && i < COLS - 1) { const a = k, b = k + 1, c = k + COLS + 1, d = k + COLS; idx.push(a, d, c, a, c, b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const { map, alpha } = capeTextures();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0.0, map, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide });
  // alpha must use the un-repeated uv; the map repeats -> give the alpha its own transform
  alpha.repeat.set(1, 1); alpha.offset.set(0, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'knightCape'; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  rig.root.add(mesh);

  // per-column hem length jitter (frayed, uneven)
  const r = rng(5150);
  const colLen = Array.from({ length: COLS }, (_, i) => length * (1 - 0.035 * r() - 0.02 * Math.abs((i / (COLS - 1)) * 2 - 1)));

  // ---- colliders, in bone-local space (ellipsoidal capsules along local Y) ----
  const B = rig.b;
  const caps = [
    { bone: 'chest', y0: 0.02, y1: 0.25, rx: 0.205, rz: 0.165, cz: -0.005 },
    { bone: 'spine', y0: -0.02, y1: 0.14, rx: 0.185, rz: 0.15, cz: 0.0 },
    { bone: 'hips', y0: -0.13, y1: 0.05, rx: 0.215, rz: 0.17, cz: -0.005 },
    { bone: 'thighL', y0: -0.43, y1: 0.0, rx: 0.105, rz: 0.105, cz: 0 },
    { bone: 'thighR', y0: -0.43, y1: 0.0, rx: 0.105, rz: 0.105, cz: 0 },
    { bone: 'shinL', y0: -0.42, y1: 0.0, rx: 0.08, rz: 0.085, cz: -0.01 },
    { bone: 'shinR', y0: -0.42, y1: 0.0, rx: 0.08, rz: 0.085, cz: -0.01 },
    { bone: 'upperArmL', y0: -0.3, y1: 0.0, rx: 0.085, rz: 0.085, cz: 0 },
    { bone: 'upperArmR', y0: -0.3, y1: 0.0, rx: 0.085, rz: 0.085, cz: 0 },
    { bone: 'foreArmL', y0: -0.27, y1: 0.0, rx: 0.07, rz: 0.07, cz: 0 },
    { bone: 'foreArmR', y0: -0.27, y1: 0.0, rx: 0.07, rz: 0.07, cz: 0 },
    { bone: 'head', y0: 0.04, y1: 0.2, rx: 0.155, rz: 0.165, cz: 0.0 },
  ];
  const spheres = [ // pauldron domes
    { bone: 'upperArmL', p: new THREE.Vector3(0.015, 0.0, 0), r: 0.16 },
    { bone: 'upperArmR', p: new THREE.Vector3(-0.015, 0.0, 0), r: 0.16 },
  ];
  const inv = caps.map(() => new THREE.Matrix4());
  const tmp = new THREE.Vector3(), q = new THREE.Vector3();

  // rock collider: rounded frustum. center = seat-top centre (world), rTop/rBottom radii, top = world y.
  function pushRock(p, rock) {
    if (!rock) return false;
    const dx = p.x - rock.center.x, dz = (p.z - rock.center.z) / (rock.depth || 1);
    const d = Math.hypot(dx, dz);
    const top = rock.center.y, h = top - (rock.ground ?? 0);
    if (p.y > top + rock.pad) return false;
    const ty = clamp((p.y - (rock.ground ?? 0)) / Math.max(h, 1e-3), 0, 1);
    const rad = lerp(rock.rBottom, rock.rTop, ty) + rock.pad;
    // rounded top edge: shrink radius near the top
    const edge = rock.round || 0.08;
    const radTop = rad - edge * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(clamp((p.y - (top - edge)) / edge, 0, 1), 2))));
    if (d >= radTop) return false;
    const upPush = top + rock.pad - p.y, outPush = radTop - d;
    if (upPush < outPush * 1.3 || d < 0.05) { p.y = top + rock.pad; }
    else { const s = (d + outPush) / Math.max(d, 1e-5); p.x = rock.center.x + dx * s; p.z = rock.center.z + dz * s * (rock.depth || 1); }
    return true;
  }

  function collide(p, rock, ground) {
    for (let k = 0; k < caps.length; k++) {
      const c = caps[k];
      q.copy(p).applyMatrix4(inv[k]);
      const yc = clamp(q.y, c.y0, c.y1);
      const ex = q.x / c.rx, ez = (q.z - c.cz) / c.rz, ey = (q.y - yc) / Math.min(c.rx, c.rz);
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (d < 1 && d > 1e-6) {
        q.set(ex / d * c.rx, yc + ey / d * Math.min(c.rx, c.rz), c.cz + ez / d * c.rz);
        p.copy(q.applyMatrix4(B[c.bone].matrixWorld));
      }
    }
    for (const s of spheres) {
      tmp.copy(s.p).applyMatrix4(B[s.bone].matrixWorld);
      const d = p.distanceTo(tmp);
      if (d < s.r && d > 1e-6) p.sub(tmp).multiplyScalar(s.r / d).add(tmp);
    }
    pushRock(p, rock);
    if (p.y < ground + 0.012) p.y = ground + 0.012;
  }

  // anchors in chest-local space: along the back of the shoulders, from left (+X) to right (-X)
  const anchors = [];
  for (let i = 0; i < COLS; i++) {
    const u = (i / (COLS - 1)) * 2 - 1; // +1 = his left (+X)
    const a = u * 1.15;
    anchors.push(new THREE.Vector3(-Math.sin(a) * 0.165, 0.245 - 0.012 * u * u, -Math.cos(a) * 0.15 - 0.012));
  }
  const P = Array.from({ length: (ROWS + 1) * COLS }, () => new THREE.Vector3());
  const invRoot = new THREE.Matrix4();
  const down = new THREE.Vector3(), back = new THREE.Vector3(), side = new THREE.Vector3(), dir = new THREE.Vector3();
  const prevDir = Array.from({ length: COLS }, () => new THREE.Vector3());
  const chestQ = new THREE.Quaternion();

  function update(t = 0, { seated = false, rock = null, wind = 0.3, ground = 0 } = {}) {
    rig.root.updateMatrixWorld(true);
    caps.forEach((c, k) => inv[k].copy(B[c.bone].matrixWorld).invert());
    B.chest.getWorldQuaternion(chestQ);
    // "back" = chest -Z flattened to horizontal; side = chest +X
    back.set(0, 0, -1).applyQuaternion(chestQ); back.y = 0; back.normalize();
    side.set(1, 0, 0).applyQuaternion(chestQ);
    let rk = null;
    if (seated) {
      const rootPos = new THREE.Vector3().setFromMatrixPosition(rig.root.matrixWorld);
      rk = {
        center: rock?.center ? rock.center.clone() : rootPos.clone().add(new THREE.Vector3(0, 0.48, 0)),
        rTop: rock?.rTop ?? 0.31, rBottom: rock?.rBottom ?? 0.44, depth: rock?.depth ?? 0.95, pad: 0.012, round: 0.07, ground,
      };
    }
    const seg = (i) => colLen[i] / ROWS;
    // row 0 = anchors
    for (let i = 0; i < COLS; i++) {
      P[i].copy(anchors[i]).applyMatrix4(B.chest.matrixWorld);
      prevDir[i].set(0, -1, 0).addScaledVector(back, 0.35).normalize();
    }
    const restW = [];
    for (let j = 1; j <= ROWS; j++) {
      const v = j / ROWS;
      const spread = 0.18 + 0.55 * v; // lateral flare grows down the cape
      for (let i = 0; i < COLS; i++) {
        const u = (i / (COLS - 1)) * 2 - 1;
        const prev = P[(j - 1) * COLS + i];
        const gust = wind * (0.05 + 0.05 * noise1(t * 0.9 + i * 0.21 + j * 0.05)) + 0.025 * noise1(t * 0.6 + i * 0.37 + 11);
        dir.set(0, -1, 0)
          .addScaledVector(back, 0.12 + gust * (0.6 + v))
          .addScaledVector(side, u * spread * 0.22)
          .normalize();
        dir.lerp(prevDir[i], seated ? 0.55 : 0.35).normalize();
        const p = P[j * COLS + i].copy(prev).addScaledVector(dir, seg(i));
        collide(p, rk, ground);
        // keep segment length
        tmp.subVectors(p, prev); const L = tmp.length();
        if (L > 1e-6) p.copy(prev).addScaledVector(tmp, seg(i) / L);
        collide(p, rk, ground);
        prevDir[i].subVectors(p, prev).normalize();
      }
      // lateral relaxation: neighbours no further apart than their rest spacing (allows folds, no stretch)
      const maxW = (0.33 + 0.62 * v) / (COLS - 1);
      for (let it = 0; it < 2; it++) for (let i = 0; i < COLS - 1; i++) {
        const a = P[j * COLS + i], b = P[j * COLS + i + 1];
        tmp.subVectors(b, a); const d = tmp.length();
        if (d > maxW) { const corr = (d - maxW) * 0.5 / d; a.addScaledVector(tmp, corr); b.addScaledVector(tmp, -corr); }
      }
      for (let i = 0; i < COLS; i++) collide(P[j * COLS + i], rk, ground);
    }
    // pleats: push outward (away from the body) in soft vertical folds that deepen toward the hem
    const nrm = new THREE.Vector3(), du = new THREE.Vector3(), dv = new THREE.Vector3();
    for (let j = 1; j <= ROWS; j++) {
      const v = j / ROWS;
      for (let i = 0; i < COLS; i++) {
        const k = j * COLS + i;
        du.subVectors(P[j * COLS + Math.min(COLS - 1, i + 1)], P[j * COLS + Math.max(0, i - 1)]);
        dv.subVectors(P[k], P[(j - 1) * COLS + i]);
        nrm.crossVectors(du, dv).normalize();
        if (nrm.dot(back) < 0) nrm.negate();
        const u = (i / (COLS - 1)) * 2 - 1;
        const fold = 0.5 + 0.5 * Math.sin(u * Math.PI * 3.2 + 0.7 + 0.4 * noise1(t * 0.5 + i * 0.3));
        const amp = 0.028 * Math.pow(v, 0.8) * (seated ? 0.8 : 1);
        tmp.copy(P[k]).addScaledVector(nrm, amp * fold);
        P[k].copy(tmp);
        if (P[k].y < ground + 0.01) P[k].y = ground + 0.01;
      }
    }
    // write positions in the cape mesh's local space (it lives under rig.root)
    invRoot.copy(mesh.matrixWorld).invert();
    const pa = geo.attributes.position;
    for (let k = 0; k < P.length; k++) { tmp.copy(P[k]).applyMatrix4(invRoot); pa.setXYZ(k, tmp.x, tmp.y, tmp.z); }
    pa.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  return { mesh, update, anchors, tris: idx.length / 3 };
}
