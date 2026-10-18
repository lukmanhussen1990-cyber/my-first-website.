// Stats helper scene: builds Jesus and reports triangles / draw calls via console (used for the perf budget check).
import * as THREE from 'three';
import { makeStudio } from './studio_lib.js';
import * as J from '../characters/jesus.js';
export async function build(stage, params) {
  const studio = makeStudio(stage, { ...params, ty: 1, dist: 3.4 }, { ground: false });
  const jesus = J.buildJesus();
  stage.scene.add(jesus.root);
  let reported = false;
  return {
    duration: 1,
    update(t) {
      studio.updateCamera();
      jesus.update(t, {});
      if (!reported) {
        reported = true;
        let tris = 0, meshes = 0;
        jesus.root.traverse((o) => {
          if (o.isMesh && o.visible) { meshes++; const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += n; console.log('  mesh', o.name || o.parent.name, Math.round(n)); }
        });
        stage.renderer.info.autoReset = false;
        stage.renderer.info.reset();
        stage.renderer.render(stage.scene, stage.camera);
        console.log(`JESUS meshes=${meshes} triangles=${Math.round(tris)} render.calls=${stage.renderer.info.render.calls} render.triangles=${stage.renderer.info.render.triangles}`);
        stage.renderer.info.autoReset = true;
      }
    },
  };
}
