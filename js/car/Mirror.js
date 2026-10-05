// Rear-view mirror with a true reflection. The virtual camera uses an
// off-axis projection fitted to the mirror glass (Kooima's generalised
// perspective), so even a small render target stays sharp, and its near plane
// lies on the glass so nothing behind the mirror leaks in.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYER } from '../config.js';

const W = 0.25;
const H = 0.07;

export class RearMirror {
  constructor(interior, { enabled = true } = {}) {
    this.enabled = enabled;
    const m = interior.m;
    this.anchor = new THREE.Group();
    this.anchor.position.set(0.0, 1.285, -0.3);
    // Angled toward the driver's eyes (left) and slightly down.
    this.anchor.rotation.set(0.06, -0.2, 0, 'YXZ');
    interior.group.add(this.anchor);

    const housing = new THREE.Mesh(new RoundedBoxGeometry(W + 0.022, H + 0.02, 0.045, 3, 0.012), m.plastic);
    housing.position.z = -0.024;
    housing.castShadow = true;
    this.anchor.add(housing);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.1, 10), m.plastic);
    stem.position.set(0, 0.06, -0.035);
    stem.rotation.x = -0.25;
    this.anchor.add(stem);
    const mount = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.02, 0.06, 2, 0.008), m.plastic);
    mount.position.set(0, 0.105, -0.05);
    this.anchor.add(mount);

    this.rt = new THREE.WebGLRenderTarget(448, 128, { type: THREE.HalfFloatType, samples: 0 });
    this.glassMat = new THREE.ShaderMaterial({
      uniforms: {
        tMirror: { value: this.rt.texture },
        uDim: { value: 0.78 },
        uEnabled: { value: enabled ? 1 : 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform sampler2D tMirror;
        uniform float uDim;
        uniform float uEnabled;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tMirror, vec2(1.0 - vUv.x, vUv.y)).rgb * uDim;
          // Slight anti-glare tint and a faint edge darkening.
          vec2 e = smoothstep(vec2(0.0), vec2(0.03, 0.1), vUv) * smoothstep(vec2(1.0), vec2(0.97, 0.9), vUv);
          c *= vec3(0.92, 0.95, 1.0) * mix(0.6, 1.0, e.x * e.y);
          c = mix(vec3(0.004), c, uEnabled);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.glassMat);
    this.glass.position.z = 0.0;
    this.anchor.add(this.glass);
    this.glass.layers.set(LAYER.INTERIOR);
    housing.layers.set(LAYER.INTERIOR);
    stem.layers.set(LAYER.INTERIOR);
    mount.layers.set(LAYER.INTERIOR);

    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;
    this.camera.layers.enable(LAYER.INTERIOR);
    this.camera.layers.enable(LAYER.NO_REFLECT);
    this.camera.layers.enable(LAYER.MIRROR_ONLY);
    this._v = Array.from({ length: 8 }, () => new THREE.Vector3());
    this._m = new THREE.Matrix4();
    this.frame = 0;
  }

  /** Render the reflection for the eye at `eye` (world space). */
  render(renderer, scene, eye) {
    if (!this.enabled) return;
    this.frame++;
    const [ll, lr, ul, ur, n, pe, vr, vu] = this._v;
    this.glass.updateMatrixWorld();
    const mw = this.glass.matrixWorld;
    ll.set(-W / 2, -H / 2, 0).applyMatrix4(mw);
    lr.set(W / 2, -H / 2, 0).applyMatrix4(mw);
    ul.set(-W / 2, H / 2, 0).applyMatrix4(mw);
    ur.set(W / 2, H / 2, 0).applyMatrix4(mw);
    n.set(0, 0, 1).transformDirection(mw);
    // Reflect the eye across the glass plane.
    const dist = n.dot(pe.copy(eye).sub(ll));
    if (dist <= 0.001) return; // looking at the back of the mirror
    pe.copy(eye).addScaledVector(n, -2 * dist);
    // Seen from behind the glass, left and right swap.
    const pa = lr;
    const pb = ll;
    const pc = ur;
    vr.copy(pb).sub(pa).normalize();
    vu.copy(pc).sub(pa).normalize();
    const vn = n.clone().crossVectors(vr, vu).normalize();
    const va = pa.clone().sub(pe);
    const vb = pb.clone().sub(pe);
    const vc = pc.clone().sub(pe);
    const d = -va.dot(vn);
    const near = Math.max(0.005, d);
    const far = 600;
    const k = near / d;
    const l = vr.dot(va) * k;
    const r = vr.dot(vb) * k;
    const b = vu.dot(va) * k;
    const t = vu.dot(vc) * k;
    const cam = this.camera;
    cam.projectionMatrix.makePerspective(l, r, t, b, near, far);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const view = this._m.set(
      vr.x, vr.y, vr.z, 0,
      vu.x, vu.y, vu.z, 0,
      vn.x, vn.y, vn.z, 0,
      0, 0, 0, 1,
    ).multiply(new THREE.Matrix4().makeTranslation(-pe.x, -pe.y, -pe.z));
    cam.matrixWorldInverse.copy(view);
    cam.matrixWorld.copy(view).invert();
    cam.near = near;
    cam.far = far;

    const prevTarget = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    this.glass.visible = false;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, cam);
    this.glass.visible = true;
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
  }
}
