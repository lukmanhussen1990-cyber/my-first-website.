import * as THREE from 'three';
import { buildWorld, OFF } from './world.js';
import { drawOverlay, buildChunks } from './overlay.js';
import * as STORY from './story.js';

const W = 1080, H = 1920;
const glc = document.getElementById('gl'), ovc = document.getElementById('ov');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 600);
scene.add(camera);

// sky dome
const skyU = { top: { value: new THREE.Color('#5fa8ef') }, hor: { value: new THREE.Color('#e6f3ff') }, bot: { value: new THREE.Color('#e6f3ff') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h*1.6,0.0,1.0),0.75)) : mix(hor, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}',
}));
sky.renderOrder = -1; scene.add(sky);

const hemi = new THREE.HemisphereLight('#dbeeff', '#7e9a62', 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3e0', 2.6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.045; sun.shadow.radius = 3;
scene.add(sun); scene.add(sun.target);
const fill = new THREE.PointLight('#ffd9a0', 0, 12, 1.6); scene.add(fill);
const rim = new THREE.DirectionalLight('#cfe6ff', 0); scene.add(rim); scene.add(rim.target);
scene.fog = new THREE.Fog('#e6f3ff', 60, 220);

const LIGHTS = {
  day: { sky: ['#5fa8ef', '#e3f1ff', '#e3f1ff'], hemi: ['#dbeeff', '#8aa86a', 1.2], sun: ['#fff1dc', 2.8, [9, 16, 12]], fog: ['#e3f1ff', 70, 240], exp: 1.08 },
  room: { sky: ['#9fb4c8', '#c7d3de', '#c7d3de'], hemi: ['#d6e2f0', '#7a6450', 1.1], sun: ['#eef4ff', 2.0, [3, 9, 9]], fog: ['#c7d3de', 80, 300], exp: 1.08, fill: ['#ffe2b8', 7, [0.5, 2.0, 1.6]] },
  office: { sky: ['#9fb4c8', '#c7d3de', '#c7d3de'], hemi: ['#fff1de', '#7a604a', 1.0], sun: ['#fff1dc', 2.2, [3, 9, 9]], fog: ['#c7d3de', 80, 300], exp: 1.05, fill: ['#ffd9a0', 8, [0.8, 2.4, 0.5]] },
  stairs: { sky: ['#9fb4c8', '#c7d3de', '#c7d3de'], hemi: ['#fff3e2', '#806650', 1.05], sun: ['#fff1dc', 2.1, [4, 10, 9]], fog: ['#c7d3de', 80, 300], exp: 1.0, fill: ['#ffe2b0', 5, [-2.5, 3.6, 1.0]] },
  studio: { sky: ['#f3dfc6', '#f3dfc6', '#f3dfc6'], hemi: ['#fff6ea', '#c9a888', 1.2], sun: ['#ffffff', 2.4, [3, 8, 10]], fog: ['#f3dfc6', 80, 300], exp: 1.0 },
  golden: { sky: ['#ff9a6a', '#ffd9a0', '#ffd9a0'], hemi: ['#ffe6c8', '#a08060', 1.45], sun: ['#ffc07a', 3.2, [-10, 9, 14]], fog: ['#ffd6a8', 60, 220], exp: 1.12, rim: ['#ffd0a0', 1.0, [6, 6, -10]] },
};

let S, words, chunks;
const registry = [];
export const ctx = {
  THREE, scene, camera, OFF, renderer,
  reg(obj) { registry.push(obj); scene.add(obj); obj.visible = false; return obj; },
  dyn: [], flashes: [],
  light(name, set, cx = 0, cz = 0, o = {}) {
    const L = LIGHTS[name], off = OFF[set];
    skyU.top.value.set(L.sky[0]); skyU.hor.value.set(L.sky[1]); skyU.bot.value.set(L.sky[2]);
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1] * (o.sun ?? 1);
    const c = new THREE.Vector3(off.x + cx, off.y + (o.cy ?? 0), off.z + cz);
    sun.target.position.copy(c); sun.position.copy(c).add(new THREE.Vector3(...L.sun[2]));
    const e = o.extent ?? 9; const sc = sun.shadow.camera; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 0.5; sc.far = 60; sc.updateProjectionMatrix();
    scene.fog.color.set(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
    renderer.toneMappingExposure = L.exp;
    if (L.fill) { fill.color.set(L.fill[0]); fill.intensity = L.fill[1]; fill.position.set(off.x + L.fill[2][0], off.y + L.fill[2][1], off.z + L.fill[2][2]); } else fill.intensity = 0;
    if (L.rim) { rim.color.set(L.rim[0]); rim.intensity = L.rim[1]; rim.target.position.copy(c); rim.position.copy(c).add(new THREE.Vector3(...L.rim[2])); } else rim.intensity = 0;
  },
  cam(set, p, l, fov = 42, roll = 0) {
    const off = OFF[set];
    camera.position.set(off.x + p[0], off.y + p[1], off.z + p[2]);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(off.x + l[0], off.y + l[1], off.z + l[2]);
    camera.fov = fov; camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
  },
  project(v) { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, p.z]; },
};

async function init() {
  await Promise.all([document.fonts.load('900 40px Mont'), document.fonts.load('800 40px Mont'), document.fonts.load('40px Lucky')]);
  words = await (await fetch('../work/words.json')).json();
  chunks = buildChunks(words);
  S = ctx.S = buildWorld(scene);
  ctx.sets = [S.street, S.room, S.stairs, S.hill, S.gas, S.studio];
  STORY.init(ctx);
  window.TOTAL = STORY.TOTAL;
  window.renderFrame = (f) => {
    ctx.dyn.length = 0;
    for (const o of registry) { if (o.parent !== scene) scene.add(o); o.visible = false; o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); }
    ctx.sets.forEach(s => (s.visible = false));
    STORY.frame(f, ctx);
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
    drawOverlay(ovc.getContext('2d'), f, f / 30, { chunks, comics: STORY.COMICS, dyn: ctx.dyn, flashes: STORY.FLASHES, captionY: STORY.captionY ? STORY.captionY(f) : 1235 });
    return true;
  };
  window.ready = true;
}
init().catch(e => { console.error('INIT ' + e.message + '\n' + e.stack); window.initError = String(e); });
