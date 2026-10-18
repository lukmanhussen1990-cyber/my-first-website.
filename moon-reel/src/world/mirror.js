import * as THREE from 'three';

// Planar reflection for a horizontal water plane (same math as three's Reflector, driven manually so
// scissored split-screen renders can re-render it per lighting condition).
export class Mirror {
  constructor(w, h) {
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.cam = new THREE.PerspectiveCamera();
    this.textureMatrix = new THREE.Matrix4();
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
  }

  // Renders `scene` reflected about the plane y = height. `mirrorObj` is the water mesh (its world
  // matrix goes into the texture matrix and it is hidden while rendering).
  render(renderer, scene, camera, mirrorObj, height = 0) {
    const cam = this.cam;
    const normal = new THREE.Vector3(0, 1, 0);
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, -1).applyMatrix4(rot);
    const up = new THREE.Vector3(0, 1, 0).applyMatrix4(rot);
    cam.position.set(camPos.x, 2 * height - camPos.y, camPos.z);
    cam.up.set(up.x, -up.y, up.z);
    cam.lookAt(cam.position.clone().add(new THREE.Vector3(fwd.x, -fwd.y, fwd.z)));
    cam.far = camera.far;
    cam.near = camera.near;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);

    mirrorObj.updateMatrixWorld();
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(cam.projectionMatrix);
    this.textureMatrix.multiply(cam.matrixWorldInverse);
    this.textureMatrix.multiply(mirrorObj.matrixWorld);

    // oblique near plane so nothing below the water ends up in the reflection
    this._plane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, height, 0));
    this._plane.applyMatrix4(cam.matrixWorldInverse);
    const c = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const pm = cam.projectionMatrix;
    const q = this._q;
    q.x = (Math.sign(c.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(c.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    c.multiplyScalar(2.0 / c.dot(q));
    pm.elements[2] = c.x;
    pm.elements[6] = c.y;
    pm.elements[10] = c.z + 1.0;
    pm.elements[14] = c.w;
    cam.projectionMatrixInverse.copy(pm).invert();

    const vis = mirrorObj.visible;
    mirrorObj.visible = false;
    const prevTarget = renderer.getRenderTarget();
    const prevScissor = renderer.getScissorTest();
    renderer.setScissorTest(false);
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(scene, cam);
    renderer.autoClear = ac;
    renderer.setRenderTarget(prevTarget);
    renderer.setScissorTest(prevScissor);
    mirrorObj.visible = vis;
  }
}
