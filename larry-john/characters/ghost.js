// THE REAL GHOST: classic cute cartoon ghost. Glowing, see-through, pale blue-white, round head,
// wavy tail, no feet, big black oval eyes, small mouth. Clearly different from Larry's cloth sheet.
import * as THREE from 'three';
import { Face, applyFace } from '../engine/toon/face.js';
import { sphere, weldSeamNormals } from '../engine/toon/geom.js';
import { clamp, smooth, lerp } from '../engine/toon/anim.js';

export class Ghost extends THREE.Group {
  constructor() {
    super();
    this.name = 'ghost';
    this.face = new Face({ eyeStyle: 'bean', eyeX: 0.36, eyeY: 0.1, eyeRX: 0.17, eyeRY: 0.25, pupil: '#101426',
      lid: '#bfe0ff', mouthY: -0.36, mouthW: 0.17, outline: '#101426', mouthIn: '#2a2240', tongue: '#ff8fb0',
      blush: 'rgba(150,180,255,0.55)', blushX: 0.58, blushY: -0.22, lineW: 0.03, noBrows: true }, 1024);
    this.mat = new THREE.MeshStandardMaterial({
      color: '#dff0ff', emissive: '#a8d4ff', emissiveIntensity: 0.85, roughness: 0.5,
      transparent: true, opacity: 0.62, depthWrite: true,
    });
    applyFace(this.mat, this.face, { extent: 0.36, center: [0, 0.68], depth: 0.2,
      ghost: { rimColor: '#e8f6ff', rimStrength: 1.1, rimPower: 2.2 } });
    this.rings = 60; this.segs = 64;
    const n = (this.rings + 1) * (this.segs + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let i = 0; i < this.rings; i++) for (let j = 0; j < this.segs; j++) {
      const a = i * (this.segs + 1) + j, b = a + this.segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    geo.setIndex(idx);
    this.geo = geo;
    this.body = new THREE.Mesh(geo, this.mat);
    this.body.frustumCulled = false;
    this.body.renderOrder = 2;
    this.add(this.body);
    // little stubby arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.33, 0.6, 0.02);
      const arm = new THREE.Mesh(sphere(0.085, 24, 16), this.mat);
      arm.scale.set(1.5, 0.75, 0.75); arm.position.x = side * 0.07; arm.renderOrder = 2;
      pivot.add(arm); this.add(pivot); this.arms.push(pivot);
    }
    // soft glow light so the ghost lights up its surroundings
    this.light = new THREE.PointLight('#bfe2ff', 1.2, 3.5, 2);
    this.light.position.set(0, 0.7, 0.2);
    this.add(this.light);
    this.params = { t: 0, tailSwish: 1, stretch: 1, armWave: 0, armUp: 0, curl: 1 };
    this.update();
  }

  set(p) { Object.assign(this.params, p); this.update(); }

  update() {
    const P = this.params, pos = this.geo.attributes.position.array;
    const R = this.rings, S = this.segs;
    let k = 0;
    // smooth silhouette: round head, soft body, long tail tapering to a point (scaled by stretch)
    if (!this._curve) this._curve = new THREE.SplineCurve([
      [0.0, 1.05], [0.22, 1.0], [0.335, 0.88], [0.365, 0.7], [0.35, 0.52], [0.3, 0.38], [0.22, 0.26], [0.14, 0.16], [0.07, 0.08], [0.012, 0.0],
    ].map(([r, y]) => new THREE.Vector2(r, y)));
    const prof = this._curve.getSpacedPoints(R);
    for (let i = 0; i <= R; i++) {
      const p = prof[i];
      const v = clamp((1.0 - p.y) / 1.0);                  // 0 at the top, 1 at the tail tip
      const tail = clamp((0.55 - p.y) / 0.55);              // 0 above the body, 1 at the tip
      const y = (p.y + (tail ** 3) * 0.3) * P.stretch + (1 - P.stretch) * 0.3;
      let cx = (tail ** 1.8) * 0.5 * P.curl + Math.sin(P.t * 3.0 - tail * 4.0) * 0.08 * tail * tail * P.tailSwish;
      const cz = -(tail ** 2) * 0.1;
      const r = Math.max(0.001, p.x);
      for (let j = 0; j <= S; j++) {
        const th = (j / S) * Math.PI * 2 + Math.PI;     // seam at the back
        const rr = r * (1 + 0.03 * v * Math.sin(th * 3 + P.t * 2.5));
        pos[k++] = Math.sin(th) * rr + cx;
        pos[k++] = y;
        pos[k++] = Math.cos(th) * rr + cz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    weldSeamNormals(this.geo, R, S);
    // arms: gentle wave or thrown up in fright
    this.arms.forEach((a, i) => {
      const side = i === 0 ? -1 : 1;
      a.rotation.z = side * (0.2 + 0.25 * Math.sin(P.t * 2.4 + i) * P.armWave + 1.4 * P.armUp);
      a.position.y = 1.05 * P.stretch - 0.36 - 0.08;
    });
  }
}

export function makeGhost() { return new Ghost(); }
