#!/usr/bin/env node
// Render a Bedrock client entity (geometry + texture + animations + controllers, Molang evaluated
// every frame) headlessly. See README.md for options and the scenario format.
//
//   node tools/viewer/render.mjs --rp packs/GiantSpiderHunter_RP --entity horror:giant_spider \
//        --scenario tools/viewer/scenarios/hunting_run.json --camera low_front --frames 8 \
//        --out /tmp/run.png [--video /tmp/run.mp4] [--report /tmp/feet.json]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { ResourcePacks, loadImage, encodePNG } from './lib/resources.mjs';
import { buildMeshes, Skeleton, threeToBedrock } from './lib/geometry.mjs';
import { EntityRuntime } from './lib/runtime.mjs';
import { loadScenario } from './lib/scenario.mjs';
import { BrowserRenderer } from './lib/renderer.mjs';

function parseArgs(argv) {
  const out = { rp: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    const val = next === undefined || next.startsWith('--') ? true : (i++, next);
    if (key === 'rp') out.rp.push(val);
    else out[key] = val;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.entity) {
  console.log(fs.readFileSync(new URL('./README.md', import.meta.url), 'utf8'));
  process.exit(args.help ? 0 : 1);
}
if (!args.rp.length) args.rp.push('packs/GiantSpiderHunter_RP');

const warnings = [];
const res = new ResourcePacks(args.rp, (w) => warnings.push(w));
const ent = res.entities.get(String(args.entity).toLowerCase());
if (!ent) throw new Error(`client entity ${args.entity} not found in ${args.rp.join(', ')}`);
const desc = ent.description;
const geoId = String((desc.geometry || {}).default || Object.values(desc.geometry || {})[0]).toLowerCase();
const model = res.geometries.get(geoId);
if (!model) throw new Error(`geometry ${geoId} not found`);
const texRel = (desc.textures || {}).default || Object.values(desc.textures || {})[0];
const texFile = res.resolveTexture(texRel);
if (!texFile) throw new Error(`texture ${texRel} not found`);

// ---- texture (+ emissive map for the vanilla 'spider' emissive-alpha material: low alpha glows)
const img = loadImage(texFile);
const emissiveMaterial = /spider|emissive/.test(JSON.stringify(desc.materials || {}));
const base = { width: img.width, height: img.height, data: Buffer.from(img.data) };
const emis = { width: img.width, height: img.height, data: Buffer.alloc(img.data.length) };
let anyEmissive = false;
for (let i = 0; i < img.data.length; i += 4) {
  const a = img.data[i + 3];
  if (emissiveMaterial && a > 0 && a < 255) {
    anyEmissive = true;
    emis.data[i] = img.data[i]; emis.data[i + 1] = img.data[i + 1]; emis.data[i + 2] = img.data[i + 2];
  }
  emis.data[i + 3] = 255;
  base.data[i + 3] = 255;
}
const dataUrl = (im) => `data:image/png;base64,${encodePNG(im).toString('base64')}`;

// ---- scenario + runtime
const scenario = loadScenario(args.scenario || null, {
  entity: args.entity,
  duration: args.duration,
  fps: args.fps,
  warmup: args.warmup,
});
if (args.props) Object.assign(scenario.props, JSON.parse(args.props));
const skeleton = new Skeleton(model);
const bindRot = new Map(model.bones.map((b) => [b.key, b.rotation]));
const runtime = new EntityRuntime(res, desc, {
  warn: (w) => warnings.push(w),
  boneKeys: new Set(model.bones.map((b) => b.key)),
  bindRot,
  seed: scenario.seed,
});

const nFrames = Number(args.frames || Math.max(1, Math.round(scenario.duration * scenario.fps)));
const frameTimes = args.times
  ? String(args.times).split(',').map(Number)
  : Array.from({ length: nFrames }, (_, i) => (nFrames === 1 ? scenario.duration : (i * scenario.duration) / (nFrames - 1 || 1)));
const SIM_DT = 1 / 60;
const width = Number(args.width || 640);
const height = Number(args.height || 400);
const cameraPreset = String(args.camera || (scenario.camera && scenario.camera.preset) || 'three_quarter');

// ---- trees (deterministic) for scale reference
function rngFn(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const env = scenario.environment || {};
const trees = [];
if (env.trees !== false && !args['no-trees']) {
  const r = rngFn(scenario.seed + 99);
  const count = Number(env.tree_count ?? 36);
  const radius = Number(env.tree_radius ?? 48);
  let guard = 0;
  while (trees.length < count && guard++ < 5000) {
    const a = r() * Math.PI * 2;
    const d = 4 + Math.sqrt(r()) * radius;
    const x = Math.cos(a) * d; const z = Math.sin(a) * d;
    if (trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 3.5)) continue;
    trees.push([Math.round(x) + 0.5, Math.round(z) + 0.5, 5 + Math.floor(r() * 3)]);
  }
}

// ---- simulate
function simulateTo(state, tEnd) {
  while (state.t < tEnd - 1e-9) {
    const dt = Math.min(SIM_DT, tEnd - state.t);
    const t = state.t + dt;
    scenario.advance(t);
    const q = scenario.makeQuery(t, dt);
    const out = runtime.step({ t, dt, query: q });
    state.t = t;
    state.last = out;
  }
}

function poseAt(state) {
  const out = state.last || runtime.step({ t: state.t, dt: SIM_DT, query: scenario.makeQuery(state.t, SIM_DT) });
  skeleton.applyPose(out.pose);
  const tr = scenario.entityTransform();
  const scale = (out.entityScale || 1) * (scenario.entityScale || 1);
  skeleton.setEntityTransform([tr.pos[0], 0, tr.pos[2]], tr.yawDeg, scale / 16);
  skeleton.update();
  return { tr, out };
}

function subjectBounds() {
  const box = new THREE.Box3();
  for (const node of skeleton.nodes.values()) box.expandByPoint(new THREE.Vector3().setFromMatrixPosition(node.matrixWorld));
  for (const [name] of skeleton.locators) box.expandByPoint(skeleton.locatorWorld(name));
  box.min.y = Math.min(box.min.y, 0);
  return box;
}

function cameraFor(preset, box, tr) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.5 + 0.5;
  const yaw = (tr.yawDeg * Math.PI) / 180;
  // model forward in three world: (-sin yaw, 0, -cos yaw); left: (-cos yaw, 0, sin yaw)
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const left = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  const fov = Number(args.fov || 50);
  const dist = (r / Math.tan((fov * Math.PI) / 360)) * Number(args.zoom ? 1 / Number(args.zoom) : 1);
  let pos; let target = c.clone();
  switch (preset) {
    case 'side': pos = c.clone().addScaledVector(left, dist * 1.1).add(new THREE.Vector3(0, r * 0.1, 0)); break;
    case 'front': pos = c.clone().addScaledVector(fwd, dist * 1.1).add(new THREE.Vector3(0, r * 0.1, 0)); break;
    case 'back': pos = c.clone().addScaledVector(fwd, -dist * 1.1).add(new THREE.Vector3(0, r * 0.15, 0)); break;
    case 'top': pos = c.clone().add(new THREE.Vector3(0, dist * 1.15, 0)).addScaledVector(fwd, 0.01 * r); break;
    case 'low_front': {
      // ground-level camera looking up at the body, like the reference photos
      pos = c.clone().addScaledVector(fwd, dist * 0.95).addScaledVector(left, dist * 0.18);
      pos.y = 1.7;
      target = c.clone(); target.y = box.max.y * 0.62;
      break;
    }
    case 'chase': {
      pos = c.clone().addScaledVector(fwd, -dist * 0.8).addScaledVector(left, dist * 0.35);
      pos.y = box.max.y * 0.9;
      break;
    }
    case 'closeup': {
      pos = c.clone().addScaledVector(fwd, dist * 0.45).addScaledVector(left, dist * 0.3);
      pos.y = box.max.y * 0.75; target = c.clone(); target.y = box.max.y * 0.6;
      break;
    }
    case 'three_quarter':
    default:
      pos = c.clone().addScaledVector(fwd, dist * 0.8).addScaledVector(left, dist * 0.65).add(new THREE.Vector3(0, r * 0.45, 0));
  }
  return { position: pos.toArray(), target: target.toArray(), fov, near: 0.05, far: 4000 };
}

const report = { entity: args.entity, scenario: scenario.name, frames: [] };
const renderer = await BrowserRenderer.launch();
try {
  const meshes = buildMeshes(model);
  const bonesCfg = {};
  for (const [key, m] of meshes) bonesCfg[key] = { positions: m.positions, normals: m.normals, uvs: m.uvs };
  // compute the first frame's camera before building the scene so trees never block the view
  const state = { t: -scenario.warmup };
  simulateTo(state, (args.video ? 0 : frameTimes[0]));
  const firstTr = poseAt(state).tr;
  let fixedCam = cameraFor(cameraPreset, subjectBounds(), firstTr);
  const camP = new THREE.Vector3().fromArray(fixedCam.position);
  const camT = new THREE.Vector3().fromArray(fixedCam.target);
  const visibleTrees = trees.filter(([x, z]) => {
    const p = new THREE.Vector3(x, 0, z);
    const seg = new THREE.Line3(new THREE.Vector3(camP.x, 0, camP.z), new THREE.Vector3(camT.x, 0, camT.z));
    const cp = seg.closestPointToPoint(p, true, new THREE.Vector3());
    return cp.distanceTo(p) > 5 && p.distanceTo(new THREE.Vector3(camP.x, 0, camP.z)) > 8;
  });
  await renderer.setup({
    width, height, fov: Number(args.fov || 50), shadows: !args['no-shadows'],
    background: args.background || '#a9c8e8',
    texture: dataUrl(base), emissive: anyEmissive ? dataUrl(emis) : null,
    bones: bonesCfg,
    ground: env.ground === false ? null : { size: 256, center: [0, 0], grid: true },
    trees: visibleTrees,
  });
  const tiles = [];
  const videoDir = args.video ? fs.mkdtempSync(path.join(os.tmpdir(), 'gsh-video-')) : null;
  const allTimes = args.video
    ? Array.from({ length: Math.round(scenario.duration * Number(args['video-fps'] || 30)) + 1 }, (_, i) => i / Number(args['video-fps'] || 30))
    : frameTimes;
  const sheetSet = new Set(frameTimes.map((t) => t.toFixed(4)));
  let vi = 0;
  for (const ft of allTimes) {
    simulateTo(state, ft);
    const { tr } = poseAt(state);
    const box = subjectBounds();
    if (args.follow) fixedCam = cameraFor(cameraPreset, box, tr);
    const cam = { ...fixedCam };
    if (!args.follow && args['track']) {
      cam.target = box.getCenter(new THREE.Vector3()).toArray();
    }
    const props = scenario.propsAt(ft);
    const locs = [...skeleton.locators.keys()];
    const frameRec = { t: ft, entity: { x: tr.pos[0], z: tr.pos[2], yaw: tr.yawDeg, dist: tr.dist, speed: tr.speed }, locators: {}, vars: {} };
    for (const n of locs) {
      const p = skeleton.locatorWorld(n);
      frameRec.locators[n] = [+(-p.x).toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)];
    }
    for (const v of String(args.vars || 'size_blend,scale,move,run,gait').split(',')) {
      const val = runtime.variables.get(v.toLowerCase());
      if (val !== undefined) frameRec.vars[v] = typeof val === 'number' ? +val.toFixed(4) : val;
    }
    frameRec.controllers = runtime.controllerStates();
    report.frames.push(frameRec);
    const label = args['no-label'] ? null : [`t=${ft.toFixed(2)}s  ${props['horror:state'] ?? ''}${tr.speed ? `  ${tr.speed.toFixed(1)} b/s` : ''}`];
    const frame = {
      bones: skeleton.boneMatrices(),
      camera: cam,
      light: { center: box.getCenter(new THREE.Vector3()).toArray(), radius: Math.max(40, box.getSize(new THREE.Vector3()).length()), dir: [0.45, 1.0, 0.35] },
      label,
      markers: args.markers ? locs.map((n) => skeleton.locatorWorld(n).toArray()) : [],
      markerSize: Number(args['marker-size'] || 0.25),
    };
    const png = await renderer.render(frame);
    if (videoDir) fs.writeFileSync(path.join(videoDir, `f_${String(vi++).padStart(5, '0')}.png`), png);
    if (sheetSet.has(ft.toFixed(4)) || !videoDir) tiles.push(png);
  }
  if (args.out) {
    const out = tiles.length === 1 ? tiles[0] : await renderer.sheet(tiles, Number(args.cols || Math.min(4, tiles.length)), args.title || `${args.entity} — ${scenario.name} (${cameraPreset})`);
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, out);
    console.log(`wrote ${args.out}`);
  }
  if (videoDir) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(args['video-fps'] || 30), '-i', path.join(videoDir, 'f_%05d.png'), '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', args.video]);
    fs.rmSync(videoDir, { recursive: true, force: true });
    console.log(`wrote ${args.video}`);
  }
} finally {
  await renderer.close();
}
report.warnings = [...new Set(warnings)].concat(runtime.warnings().map((w) => `${w.message} (x${w.count})`));
if (args.report) {
  fs.writeFileSync(args.report, JSON.stringify(report, null, 1));
  console.log(`wrote ${args.report}`);
}
if (report.warnings.length) console.log(`warnings:\n  ${report.warnings.slice(0, 30).join('\n  ')}`);
