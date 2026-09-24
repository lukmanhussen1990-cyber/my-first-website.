// STUB — Characters agent replaces the internals (keep the API from ARCHITECTURE.md).
import * as THREE from 'three';

const COLORS = { bun: 0xfff1d0, wine: 0x8a4a20, sword: 0x88ccff, scroll: 0xe8d8a0 };

export function createItemRenderer(ctx, { max = 32 } = {}) {
  const geo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x332200 });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false;
  ctx.scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  return {
    update(list, time) {
      let n = 0;
      for (const it of list) {
        if (!it.visible || n >= max) continue;
        q.setFromAxisAngle(up, time * 2);
        p.set(it.x, 0.5 + Math.sin(time * 3) * 0.12 + (it.y || 0), it.z);
        m.compose(p, q, s); mesh.setMatrixAt(n, m);
        mesh.setColorAt(n, c.setHex(COLORS[it.kind] || 0xffffff));
        n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
