import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

// Many copies of one low-poly model in a single draw call (rocks, trees, bushes, crowds of props).

export type Instance = {
  pos: [number, number, number];
  rotY?: number;
  scale?: number | [number, number, number];
  tint?: string; // multiplies the baked vertex colours
};

export const Scatter: React.FC<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Instance[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}> = ({ geometry, material, items, castShadow = true, receiveShadow = true }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.pos);
      o.rotation.set(0, it.rotY ?? 0, 0);
      const s = it.scale ?? 1;
      if (typeof s === "number") o.scale.setScalar(s);
      else o.scale.set(...s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(it.tint ?? "#ffffff"));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    return m;
  }, [geometry, material, items, castShadow, receiveShadow]);
  useLayoutEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
};
