// FROZEN STUB SNAPSHOT (used by `node build.mjs --stubs`). Do not edit.
import * as THREE from 'three';

export function createCrowdRenderer(ctx, { max = 240 } = {}) {
  const geo = new THREE.BoxGeometry(0.55, 1.75, 0.35);
  geo.translate(0, 0.875, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = !!ctx.quality.shadows;
  mesh.frustumCulled = false;
  ctx.scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  return {
    update(soldiers, count) {
      let n = 0;
      for (let i = 0; i < count && n < max; i++) {
        const o = soldiers[i];
        if (!o.visible) continue;
        const lying = o.anim === 'down' || o.anim === 'dead';
        e.set(lying ? -Math.PI / 2 : o.anim === 'air' ? o.pitch : 0, o.yaw, lying ? 0 : o.anim === 'air' ? o.roll : 0, 'YXZ');
        q.setFromEuler(e);
        p.set(o.x, o.y + (lying ? 0.2 : 0) - (o.fade || 0) * 0.5, o.z);
        m.compose(p, q, s);
        mesh.setMatrixAt(n, m);
        col.setHex(o.kind === 'shield' ? 0x3a2a20 : o.tint === 2 ? 0x8a1a1a : 0x222226).lerp(new THREE.Color(1, 1, 1), o.flash || 0);
        mesh.setColorAt(n, col);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() { ctx.scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
