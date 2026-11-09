// three.js world of the riddle short: the river set, one camera-relative key light frozen per shot, sky / fog per
// look, and the cards from stage.ts (lit billboards, effect sprites, contact blobs). Card system as in the slippery short.
import * as THREE from "three";
import { getInputProps } from "remotion";
import { Pen } from "../slippery/toon";
import { TONE, CHAR, untone } from "../slippery/shade";
import { NOINK } from "../slippery/ink";
import { cardShade, blobMaterial, CARD_K } from "../slippery/cardshade";
import type { Look } from "../slippery/looks";
import type { Card } from "../slippery/stage";
import { buildRiver, River } from "./sets";
import { SHOTS, FPS, LookId } from "./timeline";
import { PLANS } from "./stage";

const base = { lambert: 0.3, sideK: 0.88, term: 0.22, sat: 1.08, charShade: 0.9, charGrad: 0.07, bodyGrad: 0.2, glow: 0.2, night: false, grade: "day" as const, fogNear: 30, fogFar: 260 };
export const LOOKS: Record<LookId, Look & { skyTop: string; skyHor: string }> = {
  day: { ...base, az: -130, el: 50, lit: [1.55, 1.48, 1.32], shade: [0.42, 0.43, 0.6], lift: [0.04, 0.05, 0.09], charTint: [1.0, 0.96, 0.93], sideTint: [0.92, 0.9, 0.97],
    cardGain: 1.03, bg: "#cfe6f5", fog: "#cfe6f5", skyTop: "#4f8fd8", skyHor: "#cfe6f5" },
  golden: { ...base, az: -60, el: 14, lit: [1.5, 0.95, 0.55], shade: [0.3, 0.28, 0.5], lift: [0.04, 0.04, 0.12], charTint: [1.0, 0.82, 0.64], sideTint: [0.88, 0.82, 0.96],
    cardGain: 1.0, bg: "#ffc98a", fog: "#f6b98a", skyTop: "#7a6aa8", skyHor: "#ffc98a" },
};

type Entry = { tex: THREE.CanvasTexture; used: number };
const cache = new Map<string, Entry>();
let tick = 0;
const STEPS = [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 3.6];
const texFor = (c: Card, k: number) => {
  const key = `${c.key}|${c.cw}x${c.ch}@${k}`;
  let e = cache.get(key);
  if (!e) {
    const cv = document.createElement("canvas");
    cv.width = Math.min(4096, Math.ceil(c.cw * k)); cv.height = Math.min(4096, Math.ceil(c.ch * k));
    const g = cv.getContext("2d")!;
    g.setTransform(cv.width / c.cw, 0, 0, cv.height / c.ch, 0, 0);
    c.draw(new Pen(g));
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    if (c.kind === "blob") { tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; }
    e = { tex, used: 0 }; cache.set(key, e);
    if (cache.size > 110) for (const [kk, ee] of [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, 25)) { ee.tex.dispose(); cache.delete(kk); }
  }
  e.used = ++tick;
  return e.tex;
};
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
const geoCache = new Map<number, THREE.PlaneGeometry>();
const planeFor = (ay: number) => { let g = geoCache.get(ay); if (!g) { g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5 - ay, 0); geoCache.set(ay, g); } return g; };

class Sprite {
  mesh: THREE.Mesh; lit: THREE.MeshLambertMaterial; hard: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; addm: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial;
  constructor(parent: THREE.Object3D) {
    this.lit = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.hard = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.addm = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(planeFor(0.5), this.lit);
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.rotation.order = "YXZ"; this.mesh.layers.set(NOINK); this.mesh.receiveShadow = true; this.mesh.visible = false;
    parent.add(this.mesh);
  }
}

export class World {
  root = new THREE.Group();
  private river: River;
  private sun: THREE.DirectionalLight;
  private fog = new THREE.Fog("#ffffff", 30, 260);
  private sprites: Sprite[] = [];
  private sunCache = new Map<number, THREE.Vector3>();
  constructor() {
    this.river = buildRiver(); this.root.add(this.river.root);
    const sh = (getInputProps() as { post?: { shadow?: number } }).post?.shadow ?? 2048;
    this.sun = new THREE.DirectionalLight("#ffffff", 2.5); this.sun.castShadow = true; this.sun.shadow.mapSize.set(sh, sh);
    this.root.add(this.sun, this.sun.target);
  }
  private sprite(i: number) { while (this.sprites.length <= i) this.sprites.push(new Sprite(this.root)); return this.sprites[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): { focus: THREE.Vector3; cInf: number } {
    const s = SHOTS[id - 1], plan = PLANS[s.name], t = f / FPS, t0 = s.a / FPS, L = LOOKS[s.look];
    const c = plan.cam(t, t0);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 500; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); cam.layers.enable(NOINK);
    let sunDir = this.sunCache.get(id);
    if (!sunDir) {
      const c0 = plan.cam(t0, t0), fw = new THREE.Vector3(c0.look[0] - c0.pos[0], 0, c0.look[2] - c0.pos[2]).normalize();
      const rt = new THREE.Vector3(-fw.z, 0, fw.x), az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
      sunDir = fw.clone().multiplyScalar(Math.cos(az)).addScaledVector(rt, Math.sin(az)).normalize().multiplyScalar(Math.cos(el)).add(new THREE.Vector3(0, Math.sin(el), 0)).normalize();
      this.sunCache.set(id, sunDir);
    }
    const look = new THREE.Vector3(...c.look);
    const near = look.clone().lerp(cam.position, look.distanceTo(cam.position) > 20 ? 0.8 : 0);
    this.sun.position.copy(near).addScaledVector(sunDir, 60); this.sun.target.position.copy(near);
    const sc = this.sun.shadow.camera, Rr = 12;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 1; sc.far = 140; sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(0, 0, 0); TONE.uSat.value = L.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    CARD_K.uGain.value = L.cardGain;
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar; scene.fog = this.fog; scene.background = untone(L.bg);
    untone(L.skyTop, this.river.sky.uniforms.top.value); untone(L.skyHor, this.river.sky.uniforms.hor.value);
    // river + boat
    this.river.waterTex.offset.set(t * 0.03, t * 0.01);
    const bp = plan.boat ? plan.boat(t) : [0.3, 0.04, -0.75];
    this.river.boat.position.set(bp[0], bp[1], bp[2]); this.river.boat.rotation.z = 0.02 * Math.sin(t * 1.7);
    // cards
    const cards = plan.cards(t, t - t0), camPos = cam.position, ppmK = 960 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    let n = 0;
    for (const cd of cards) {
      const sp = this.sprite(n++), m = sp.mesh, kind = cd.kind ?? "lit", h = (cd.w * cd.ch) / cd.cw;
      const dist = Math.max(0.3, camPos.distanceTo(new THREE.Vector3(...cd.pos)));
      const want = cd.res ?? (ppmK / dist) * (cd.w / cd.cw) * 1.15, k = STEPS.find((v) => v >= want) ?? STEPS[STEPS.length - 1];
      m.geometry = planeFor(cd.ay ?? 0.5); m.position.set(...cd.pos); m.scale.set(cd.w * (cd.mirror ? -1 : 1) * (cd.sx ?? 1), h, 1);
      if (cd.flat) m.rotation.set(-Math.PI / 2, 0, 0); else m.rotation.set(0, Math.atan2(camPos.x - cd.pos[0], camPos.z - cd.pos[2]), cd.roll ?? 0);
      const mat = kind === "lit" ? sp.lit : kind === "fx" ? sp.hard : kind === "soft" ? sp.soft : kind === "add" ? sp.addm : sp.blob;
      mat.map = texFor(cd, k); m.material = mat; m.renderOrder = kind === "blob" ? 0.5 : kind === "add" || kind === "soft" ? 4 : 1; m.visible = true;
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i].mesh.visible = false;
    return { focus: new THREE.Vector3(...(plan.dof.focus ? plan.dof.focus(t) : c.look)), cInf: plan.dof.cInf(t) };
  }
}
