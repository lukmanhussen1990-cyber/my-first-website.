// Bedrock geometry loading + mesh building + skeleton (forward kinematics) using the exact
// Blockbench Bedrock import conventions:
//   * three.js space X = -(Bedrock JSON X). Cube from.x = -(origin.x + size.x); pivot.x negated.
//   * Rotations: three.x = -bedrock.x, three.y = -bedrock.y, three.z = +bedrock.z, Euler order 'ZYX'.
//   * Animation rotation x,y negated (same as above); animation position x negated.
//   * Model front faces -Z.
// Box UV follows Blockbench/Java ModelPart layout; per-face UV follows Blockbench's
// bedrock codec (up/down faces are stored flipped in Bedrock files).

import * as THREE from 'three';

const D2R = Math.PI / 180;

function vec3(a, def = [0, 0, 0]) {
  if (!Array.isArray(a)) return def.slice();
  return [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0];
}

// ------------------------------------------------------------------ parsing
// Returns Map(lowercase identifier -> model)
export function parseGeometryFile(json, sourceName = '') {
  const out = new Map();
  if (!json || typeof json !== 'object') return out;
  const fmt = String(json.format_version || '1.8.0');
  if (Array.isArray(json['minecraft:geometry'])) {
    for (const g of json['minecraft:geometry']) {
      const d = g.description || {};
      const id = String(d.identifier || '').toLowerCase();
      if (!id) continue;
      out.set(id, normaliseModel({
        id,
        format: fmt,
        source: sourceName,
        texW: d.texture_width ?? 64,
        texH: d.texture_height ?? 64,
        visibleBounds: { width: d.visible_bounds_width, height: d.visible_bounds_height, offset: d.visible_bounds_offset },
        bones: g.bones || [],
      }));
    }
    return out;
  }
  // legacy 1.8.0 / 1.10.0: top-level "geometry.x" or "geometry.x:geometry.parent"
  const pending = [];
  for (const [key, g] of Object.entries(json)) {
    if (!key.toLowerCase().startsWith('geometry.')) continue;
    const [idRaw, parentRaw] = key.split(':');
    pending.push({ id: idRaw.toLowerCase(), parent: parentRaw ? parentRaw.toLowerCase() : null, g });
  }
  const raw = new Map(pending.map((p) => [p.id, p]));
  const resolve = (p, depth = 0) => {
    let bones = (p.g.bones || []).map((b) => ({ ...b }));
    let texW = p.g.texturewidth ?? p.g.texture_width;
    let texH = p.g.textureheight ?? p.g.texture_height;
    if (p.parent && raw.has(p.parent) && depth < 8) {
      const par = resolve(raw.get(p.parent), depth + 1);
      const byName = new Map(par.bones.map((b) => [String(b.name).toLowerCase(), b]));
      for (const b of bones) byName.set(String(b.name).toLowerCase(), { ...(byName.get(String(b.name).toLowerCase()) || {}), ...b });
      bones = [...byName.values()];
      texW = texW ?? par.texW;
      texH = texH ?? par.texH;
    }
    return { bones, texW: texW ?? 64, texH: texH ?? 32 };
  };
  for (const p of pending) {
    const r = resolve(p);
    out.set(p.id, normaliseModel({
      id: p.id,
      format: fmt,
      source: sourceName,
      texW: r.texW,
      texH: r.texH,
      visibleBounds: { width: p.g.visible_bounds_width, height: p.g.visible_bounds_height, offset: p.g.visible_bounds_offset },
      bones: r.bones,
    }));
  }
  return out;
}

function normaliseModel(m) {
  const bones = [];
  for (const b of m.bones) {
    const name = String(b.name);
    const bone = {
      name,
      key: name.toLowerCase(),
      parent: b.parent ? String(b.parent).toLowerCase() : null,
      pivot: vec3(b.pivot),
      rotation: vec3(b.rotation || b.bind_pose_rotation),
      mirror: !!b.mirror,
      inflate: Number(b.inflate) || 0,
      neverRender: !!(b.neverRender || b.never_render),
      cubes: [],
      locators: [],
    };
    for (const c of b.cubes || []) {
      bone.cubes.push({
        origin: vec3(c.origin),
        size: vec3(c.size),
        uv: c.uv ?? [0, 0],
        inflate: c.inflate !== undefined ? Number(c.inflate) : bone.inflate,
        mirror: c.mirror !== undefined ? !!c.mirror : bone.mirror,
        rotation: c.rotation ? vec3(c.rotation) : null,
        pivot: c.pivot ? vec3(c.pivot) : null,
      });
    }
    if (b.locators) {
      for (const [ln, lv] of Object.entries(b.locators)) {
        if (Array.isArray(lv)) bone.locators.push({ name: ln, offset: vec3(lv), rotation: [0, 0, 0] });
        else if (lv && typeof lv === 'object') bone.locators.push({ name: ln, offset: vec3(lv.offset), rotation: vec3(lv.rotation) });
      }
    }
    bones.push(bone);
  }
  // order parents before children
  const byKey = new Map(bones.map((b) => [b.key, b]));
  for (const b of bones) if (b.parent && !byKey.has(b.parent)) b.parent = null;
  const ordered = [];
  const seen = new Set();
  const visit = (b, stack = new Set()) => {
    if (seen.has(b.key)) return;
    if (stack.has(b.key)) { b.parent = null; }
    stack.add(b.key);
    if (b.parent) visit(byKey.get(b.parent), stack);
    seen.add(b.key);
    ordered.push(b);
  };
  bones.forEach((b) => visit(b));
  return { ...m, bones: ordered, boneMap: new Map(ordered.map((b) => [b.key, b])) };
}

// ------------------------------------------------------------------ conventions
export function toThreePos(p) { return new THREE.Vector3(-p[0], p[1], p[2]); }
// Bedrock rotation (degrees, Bedrock signs) -> three.js Euler (Blockbench mapping)
export function toThreeEuler(r) { return new THREE.Euler(-r[0] * D2R, -r[1] * D2R, r[2] * D2R, 'ZYX'); }

// ------------------------------------------------------------------ mesh building
// Corners of each face in three.js space for a box min..max (Three BoxGeometry layout):
// [topLeft, topRight, bottomLeft, bottomRight]
function faceCorners(face, x0, y0, z0, x1, y1, z1) {
  switch (face) {
    case 'east': return [[x1, y1, z1], [x1, y1, z0], [x1, y0, z1], [x1, y0, z0]];
    case 'west': return [[x0, y1, z0], [x0, y1, z1], [x0, y0, z0], [x0, y0, z1]];
    case 'up': return [[x0, y1, z0], [x1, y1, z0], [x0, y1, z1], [x1, y1, z1]];
    case 'down': return [[x0, y0, z1], [x1, y0, z1], [x0, y0, z0], [x1, y0, z0]];
    case 'south': return [[x0, y1, z1], [x1, y1, z1], [x0, y0, z1], [x1, y0, z1]];
    case 'north': return [[x1, y1, z0], [x0, y1, z0], [x1, y0, z0], [x0, y0, z0]];
    default: throw new Error(face);
  }
}
const FACE_NORMALS = {
  east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0], south: [0, 0, 1], north: [0, 0, -1],
};
export const FACE_ORDER = ['east', 'west', 'up', 'down', 'south', 'north'];

// Blockbench face uv [u1, v1, u2, v2] for a box-uv cube.
function boxUV(cube) {
  const sx = Math.floor(cube.size[0] + 1e-7);
  const sy = Math.floor(cube.size[1] + 1e-7);
  const sz = Math.floor(cube.size[2] + 1e-7);
  const [u, v] = Array.isArray(cube.uv) ? cube.uv : [0, 0];
  const list = {
    east: { from: [0, sz], size: [sz, sy] },
    west: { from: [sz + sx, sz], size: [sz, sy] },
    up: { from: [sz + sx, sz], size: [-sx, -sz] },
    down: { from: [sz + sx * 2, 0], size: [-sx, sz] },
    south: { from: [sz * 2 + sx, sz], size: [sx, sy] },
    north: { from: [sz, sz], size: [sx, sy] },
  };
  if (cube.mirror) {
    for (const f of Object.values(list)) { f.from[0] += f.size[0]; f.size[0] *= -1; }
    const e = list.east; list.east = list.west; list.west = e;
  }
  const res = {};
  for (const [k, f] of Object.entries(list)) {
    res[k] = { uv: [u + f.from[0], v + f.from[1], u + f.from[0] + f.size[0], v + f.from[1] + f.size[1]], rotation: 0 };
  }
  return res;
}

function perFaceUV(cube) {
  const res = {};
  for (const face of FACE_ORDER) {
    const f = cube.uv[face];
    if (!f || !Array.isArray(f.uv)) continue;
    const size = Array.isArray(f.uv_size) ? f.uv_size : [0, 0];
    let uv = [f.uv[0], f.uv[1], f.uv[0] + size[0], f.uv[1] + size[1]];
    if (face === 'up' || face === 'down') uv = [uv[2], uv[3], uv[0], uv[1]];
    res[face] = { uv, rotation: Number(f.uv_rotation) || 0 };
  }
  return res;
}

// Builds per-bone triangle buffers in bone-local three.js space.
// Returns Map(boneKey -> {positions:[], normals:[], uvs:[]})
export function buildMeshes(model) {
  const meshes = new Map();
  for (const bone of model.bones) {
    const buf = { positions: [], normals: [], uvs: [], cubeCount: 0 };
    meshes.set(bone.key, buf);
    if (bone.neverRender) continue;
    const bp = toThreePos(bone.pivot);
    for (const cube of bone.cubes) {
      buf.cubeCount++;
      const inf = cube.inflate || 0;
      // three.js space box
      const x0 = -(cube.origin[0] + cube.size[0]) - inf;
      const x1 = -cube.origin[0] + inf;
      const y0 = cube.origin[1] - inf;
      const y1 = cube.origin[1] + cube.size[1] + inf;
      const z0 = cube.origin[2] - inf;
      const z1 = cube.origin[2] + cube.size[2] + inf;
      const faces = Array.isArray(cube.uv) ? boxUV(cube) : perFaceUV(cube);
      let rotM = null;
      let pivot = null;
      if (cube.rotation && (cube.rotation[0] || cube.rotation[1] || cube.rotation[2])) {
        rotM = new THREE.Matrix4().makeRotationFromEuler(toThreeEuler(cube.rotation));
        pivot = toThreePos(cube.pivot || [cube.origin[0] + cube.size[0] / 2, cube.origin[1] + cube.size[1] / 2, cube.origin[2] + cube.size[2] / 2]);
      }
      const tw = model.texW;
      const th = model.texH;
      for (const face of FACE_ORDER) {
        const f = faces[face];
        if (!f) continue;
        const corners = faceCorners(face, x0, y0, z0, x1, y1, z1).map((c) => {
          const v = new THREE.Vector3(c[0], c[1], c[2]);
          if (rotM) v.sub(pivot).applyMatrix4(rotM).add(pivot);
          return v.sub(bp);
        });
        const n = new THREE.Vector3(...FACE_NORMALS[face]);
        if (rotM) n.applyMatrix4(rotM).normalize();
        const [u1, v1, u2, v2] = f.uv;
        let arr = [[u1, v1], [u2, v1], [u1, v2], [u2, v2]];
        let rot = f.rotation;
        while (rot > 0) {
          const a = arr[0];
          arr[0] = arr[2]; arr[2] = arr[3]; arr[3] = arr[1]; arr[1] = a;
          rot -= 90;
        }
        arr = arr.map(([u, v]) => [u / tw, v / th]);
        // two triangles: TL, BL, TR  and TR, BL, BR (CCW seen from outside)
        const tris = [[0, 2, 1], [1, 2, 3]];
        for (const tri of tris) {
          const a = corners[tri[0]];
          const b = corners[tri[1]];
          const c = corners[tri[2]];
          const cross = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
          const order = cross.dot(n) >= 0 ? tri : [tri[0], tri[2], tri[1]];
          for (const idx of order) {
            const p = corners[idx];
            buf.positions.push(p.x, p.y, p.z);
            buf.normals.push(n.x, n.y, n.z);
            buf.uvs.push(arr[idx][0], arr[idx][1]);
          }
        }
      }
    }
  }
  return meshes;
}

// ------------------------------------------------------------------ skeleton / FK
export class Skeleton {
  constructor(model) {
    this.model = model;
    this.entity = new THREE.Object3D(); // world transform of the entity (translation, yaw, scale)
    this.root = new THREE.Object3D(); // model space (three.js convention)
    this.entity.add(this.root);
    this.nodes = new Map();
    this.locators = new Map();
    for (const bone of model.bones) {
      const node = new THREE.Object3D();
      node.name = bone.name;
      const parentBone = bone.parent ? model.boneMap.get(bone.parent) : null;
      const pp = parentBone ? toThreePos(parentBone.pivot) : new THREE.Vector3();
      node.userData.basePos = toThreePos(bone.pivot).sub(pp);
      node.userData.bone = bone;
      node.rotation.order = 'ZYX';
      this.nodes.set(bone.key, node);
      for (const loc of bone.locators) {
        const ln = new THREE.Object3D();
        ln.position.copy(toThreePos(loc.offset).sub(toThreePos(bone.pivot)));
        ln.rotation.copy(toThreeEuler(loc.rotation));
        node.add(ln);
        this.locators.set(loc.name, { node: ln, bone: bone.key });
      }
    }
    for (const bone of model.bones) {
      const node = this.nodes.get(bone.key);
      if (bone.parent) this.nodes.get(bone.parent).add(node);
      else this.root.add(node);
    }
    this.applyPose(new Map());
  }

  // pose: Map(boneKey -> {rot:[x,y,z] deg (Bedrock signs, added to bind), pos:[x,y,z] px (Bedrock signs), scl:[x,y,z]})
  applyPose(pose) {
    for (const [key, node] of this.nodes) {
      const bone = node.userData.bone;
      const p = pose.get(key);
      const r = bone.rotation;
      const rot = p ? [r[0] + p.rot[0], r[1] + p.rot[1], r[2] + p.rot[2]] : r;
      node.rotation.copy(toThreeEuler(rot));
      node.position.copy(node.userData.basePos);
      if (p) {
        node.position.x -= p.pos[0];
        node.position.y += p.pos[1];
        node.position.z += p.pos[2];
        node.scale.set(p.scl[0], p.scl[1], p.scl[2]);
      } else node.scale.set(1, 1, 1);
    }
  }

  // world transform of the entity: position in three.js world units (model px), yawDeg rotates
  // about +Y (three.js, counter-clockwise from above), scale uniform.
  setEntityTransform(pos, yawDeg, scale) {
    this.entity.position.set(pos[0], pos[1], pos[2]);
    this.entity.rotation.set(0, yawDeg * D2R, 0);
    this.entity.scale.setScalar(scale);
  }

  update() { this.entity.updateMatrixWorld(true); }

  boneMatrices() {
    const out = {};
    for (const [key, node] of this.nodes) out[key] = node.matrixWorld.elements.slice();
    return out;
  }

  locatorWorld(name) {
    const l = this.locators.get(name);
    if (!l) return null;
    return new THREE.Vector3().setFromMatrixPosition(l.node.matrixWorld);
  }

  // point given in Bedrock JSON model coordinates attached to a bone -> three world
  boneWorldPoint(boneKey, jsonPoint) {
    const node = this.nodes.get(boneKey);
    const bone = node.userData.bone;
    const local = toThreePos(jsonPoint).sub(toThreePos(bone.pivot));
    return local.applyMatrix4(node.matrixWorld);
  }
}

// three.js world (Blockbench space, px) -> Bedrock JSON convention (px): x mirrored back
export function threeToBedrock(v) { return [-v.x, v.y, v.z]; }
