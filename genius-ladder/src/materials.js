import * as THREE from 'three';

// One flat-shaded Lambert material per colour (+ options). Low-poly look comes from flatShading.
const cache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) {
    const { basic, ...rest } = opts;
    const m = basic
      ? new THREE.MeshBasicMaterial({ color, ...rest })
      : new THREE.MeshLambertMaterial({ color, flatShading: true, ...rest });
    cache.set(key, m);
  }
  return cache.get(key);
}

export function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, opts) : color);
  m.castShadow = true;
  return m;
}

export function at(obj, x = 0, y = 0, z = 0) {
  obj.position.set(x, y, z);
  return obj;
}

export function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

export function shadows(obj, cast = true, receive = false) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}
