import * as THREE from 'three';
import { coursePos, groundHeight, COURSE } from './course.js';
import { eyeMaterial, makeEye } from './charmat.js';
import { GLSL_NOISE } from './util.js';

// Race props: start line with a meerkat starter holding the flag, finish
// arch with a checkered banner (no words) and a checkered stripe.

function checkerTexture(nx, ny) {
  const c = document.createElement('canvas');
  c.width = nx * 32; c.height = ny * 32;
  const g = c.getContext('2d');
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    g.fillStyle = (i + j) % 2 ? '#111111' : '#f4f2ec';
    g.fillRect(i * 32, j * 32, 32, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// waving cloth: plane with a travelling wave, pinned along x = 0
function clothMaterial(map, color = 0xffffff, amp = 0.06) {
  const m = new THREE.MeshStandardMaterial({ map, color, roughness: 0.8, side: THREE.DoubleSide });
  m.userData.uTime = { value: 0 }; m.userData.uAmp = { value: amp };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = m.userData.uTime; sh.uniforms.uAmp = m.userData.uAmp;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = uv.x;
        transformed.z += uAmp * w * sin(uTime * 7.0 - uv.x * 6.0 + uv.y * 1.5) + uAmp * 0.4 * w * sin(uTime * 11.0 - uv.x * 9.0);`);
  };
  return m;
}

export function makeStart() {
  const group = new THREE.Group();
  // painted start line across the track
  const p = coursePos(0, 0);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.35, COURSE.TRACK_HALF * 2), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9, transparent: true, opacity: 0.85 }));
  line.rotation.x = -Math.PI / 2; line.position.set(p.x + 0.2, 0.012, p.z); line.receiveShadow = true;
  group.add(line);
  return { group };
}

// Meerkat starter: stands on a little mound beside the start line, raises a
// green flag and drops it.
export function makeMeerkat(env) {
  const root = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xc9a27a), roughness: 0.85 });
  const belly = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xe8d2b4), roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x3a2a20), roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 6, 14), fur); body.position.y = 0.2; root.add(body);
  const bel = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.15, 6, 12), belly); bel.position.set(0.03, 0.19, 0); root.add(bel);
  const head = new THREE.Group(); head.position.set(0.01, 0.4, 0); root.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), fur); skull.scale.set(1, 0.92, 0.95); head.add(skull);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 16), fur); snout.rotation.z = -Math.PI / 2; snout.position.set(0.085, -0.015, 0); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), dark); nose.position.set(0.125, -0.015, 0); head.add(nose);
  const eyeM = eyeMaterial({ iris: new THREE.Color(0.25, 0.15, 0.08), irisR: 0.8, pupilR: 0.5 });
  for (const s of [1, -1]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), dark); patch.position.set(0.045, 0.012, 0.038 * s); patch.scale.set(0.6, 1, 1); head.add(patch);
    const e = makeEye(0.022, eyeM, fur);
    e.group.position.set(0.055, 0.014, 0.04 * s);
    e.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), new THREE.Vector3(-1, 0, -0.35 * s), new THREE.Vector3(0, 1, 0)));
    e.set({ up: 0.1, low: 0.05, gaze: new THREE.Vector3(0, 0, 1) });
    head.add(e.group);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), dark); ear.position.set(-0.015, 0.035, 0.068 * s); ear.scale.set(0.6, 1, 0.5); head.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.2, 4, 8), fur); tail.position.set(-0.1, 0.08, 0); tail.rotation.z = 1.2; root.add(tail);
  // arm holding the flag (pivot at the shoulder)
  const arm = new THREE.Group(); arm.position.set(0.02, 0.3, 0.07); root.add(arm);
  const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.09, 4, 8), fur); armMesh.position.y = 0.05; arm.add(armMesh);
  const flag = new THREE.Group(); flag.position.y = 0.11; arm.add(flag);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.6 }));
  stick.position.y = 0.2; flag.add(stick);
  const clothMat = clothMaterial(null, new THREE.Color(0x1fae4a), 0.04);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22, 16, 6), clothMat);
  cloth.geometry.translate(0.17, 0, 0); cloth.position.set(0.0, 0.33, 0); flag.add(cloth);
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a6a44, roughness: 0.95 }));
  mound.scale.set(1, 0.45, 1); root.add(mound);
  body.position.y += 0.1; bel.position.y += 0.1; head.position.y += 0.1; arm.position.y += 0.1; tail.position.y += 0.1;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return {
    root, head, arm, clothMat,
    // drop: 0 = flag raised high, 1 = slammed down
    set(time, drop, look = 0) {
      // flag held high, then slammed down forward toward the track
      arm.rotation.z = 0.25 - 2.0 * drop;
      arm.rotation.x = -0.35 + 0.2 * drop;
      head.rotation.y = look; head.rotation.z = -0.15 * drop;
      clothMat.userData.uTime.value = time;
      body.rotation.z = -0.1 * drop;
    },
  };
}

export function makeFinish() {
  const group = new THREE.Group();
  const s = COURSE.FINISH;
  const p = coursePos(s, 0);
  const tex = checkerTexture(16, 2);
  // ground stripe
  const gtex = checkerTexture(2, 16);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.9, COURSE.TRACK_HALF * 2), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.85, transparent: true, opacity: 0.92 }));
  stripe.rotation.x = -Math.PI / 2; stripe.position.set(p.x, 0.013, p.z); stripe.receiveShadow = true;
  group.add(stripe);
  // two posts + banner across the track
  const postMat = new THREE.MeshPhysicalMaterial({ color: 0xe8e4dc, roughness: 0.4, clearcoat: 0.6 });
  const H = 3.5, half = COURSE.TRACK_HALF + 0.6;
  for (const sd of [1, -1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, H, 14), postMat);
    post.position.set(p.x, H / 2, p.z + sd * half); post.castShadow = true; group.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0xd6362a, roughness: 0.35, clearcoat: 0.8 }));
    cap.position.set(p.x, H + 0.05, p.z + sd * half); group.add(cap);
  }
  const bannerMat = clothMaterial(tex, 0xffffff, 0.05);
  // banner spans along z between the posts; uv.x runs along the span
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 - 0.2, 0.7, 40, 6), bannerMat);
  banner.rotation.y = Math.PI / 2; banner.position.set(p.x, H - 0.45, p.z); banner.castShadow = true; banner.receiveShadow = true;
  group.add(banner);
  // small checkered flags on top of the posts
  const flags = [];
  for (const sd of [1, -1]) {
    const fm = clothMaterial(checkerTexture(4, 3), 0xffffff, 0.08);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5, 16, 6), fm);
    f.geometry.translate(0.375, 0, 0);
    f.position.set(p.x - 0.02, H + 0.45, p.z + sd * half);
    f.rotation.y = Math.PI; // streams back (-x)
    group.add(f); flags.push(fm);
  }
  const pole2 = new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8);
  for (const sd of [1, -1]) { const m = new THREE.Mesh(pole2, postMat); m.position.set(p.x, H + 0.4, p.z + sd * half); group.add(m); }
  return {
    group, x: p.x,
    update(time, gust = 0) {
      bannerMat.userData.uTime.value = time; bannerMat.userData.uAmp.value = 0.05 + 0.25 * gust;
      for (const f of flags) { f.userData.uTime.value = time * 1.3; f.userData.uAmp.value = 0.08 + 0.2 * gust; }
    },
  };
}
