// Atmosphere: floating dust motes, star sparkles and soft light shafts.
import * as THREE from 'three';
import * as T from './tex.js';
import { rng } from './util.js';

export class Dust {
  constructor(n, pxScale) {
    const g = new THREE.BufferGeometry();
    const R = rng(77);
    const seeds = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) seeds[i] = R();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    const sprite = T.tex(T.glowSprite(64, 1.4), { repeat: false, srgb: false });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }, center: { value: new THREE.Vector3() }, extent: { value: new THREE.Vector3(2.4, 2.2, 2.4) },
        size: { value: 18 * pxScale }, color: { value: new THREE.Color('#fff0d6') }, opacity: { value: 0.5 }, sprite: { value: sprite },
      },
      vertexShader: `
        attribute vec3 seed; uniform float time, size; uniform vec3 center, extent; varying float vA;
        void main(){
          vec3 drift = vec3(sin(time*0.23 + seed.x*40.0)*0.05 + time*0.010,
                            -time*0.007 + sin(time*0.17 + seed.y*30.0)*0.04,
                            cos(time*0.19 + seed.z*20.0)*0.04);
          vec3 p = center + (fract(seed + drift / extent) - 0.5) * extent;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          gl_PointSize = size * (0.35 + seed.x * 0.9) / max(d, 0.25);
          vA = (0.3 + 0.7 * (0.5 + 0.5 * sin(time * 1.6 + seed.y * 50.0))) * smoothstep(0.2, 0.7, d) * step(0.0, d);
        }`,
      fragmentShader: `
        uniform vec3 color; uniform float opacity; uniform sampler2D sprite; varying float vA;
        void main(){ float a = texture2D(sprite, gl_PointCoord).r; gl_FragColor = vec4(color * a * vA * opacity, 1.0); }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }
  set(t, center, opacity = 0.5, color = '#fff0d6', extent = [2.4, 2.2, 2.4]) {
    const u = this.mat.uniforms;
    u.time.value = t;
    u.center.value.copy(center);
    u.opacity.value = opacity;
    u.color.value.set(color);
    u.extent.value.set(...extent);
    this.points.visible = opacity > 0;
  }
}

export class Sparkles {
  constructor(scene, n = 60) {
    this.tex = T.tex(T.sparkleSprite(256), { repeat: false, srgb: false });
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: this.tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const s = new THREE.Sprite(m);
      s.visible = false;
      s.renderOrder = 11;
      scene.add(s);
      this.pool.push(s);
    }
    this.i = 0;
  }
  reset() { this.pool.forEach((s) => (s.visible = false)); this.i = 0; }
  add(pos, size, intensity = 1, rot = 0, color = '#fff6d8', depthTest = true) {
    const s = this.pool[this.i++];
    if (!s || intensity <= 0.001) return;
    s.visible = true;
    s.position.copy(pos);
    s.scale.setScalar(size);
    s.material.rotation = rot;
    s.material.depthTest = depthTest;
    s.material.color.set(color).multiplyScalar(intensity);
  }
  twinkle(pos, t, seed, size, intensity = 1, color, depthTest = true) {
    const k = Math.max(0, Math.sin(t * 4.2 + seed * 7.1)) ** 2;
    this.add(pos, size * (0.4 + 0.8 * k), intensity * (0.25 + 0.75 * k), t * 0.7 + seed, color, depthTest);
  }
}

// Volumetric-looking shaft through a rectangular opening (parallel light).
export class Shaft {
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color('#ffe2b0') }, intensity: { value: 0.0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float intensity; varying vec2 vUv;
        void main(){ float a = intensity * pow(1.0 - vUv.y, 1.3) * pow(sin(vUv.x * 3.14159), 0.9);
        gl_FragColor = vec4(color * a, 1.0); }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.key = '';
  }
  // corners: 4 Vector3 (window rectangle), dir: normalized light direction
  build(corners, dir, len) {
    const key = corners.map((c) => c.toArray().join()).join() + dir.toArray().join() + len;
    if (key === this.key) return;
    this.key = key;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const a2 = a.clone().addScaledVector(dir, len), b2 = b.clone().addScaledVector(dir, len);
      const v = pos.length / 3;
      for (const p of [a, b, b2, a2]) pos.push(p.x, p.y, p.z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
  }
  set(intensity, color) {
    this.mat.uniforms.intensity.value = intensity;
    if (color) this.mat.uniforms.color.value.set(color);
    this.mesh.visible = intensity > 0;
  }
}
