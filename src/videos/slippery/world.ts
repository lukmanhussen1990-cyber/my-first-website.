// The slippery short's three.js world: the three sets, one key light (camera-relative, frozen per shot), fog /
// background per look, the two-tone + card uniforms, and the cards from stage.ts as lit billboards or effect sprites.
import * as THREE from "three";
import { getInputProps } from "remotion";
import { Pen } from "./toon";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import { buildStore, buildRoom, buildReef, Room, ROOM } from "./sets";
import { LOOKS } from "./looks";
import { SHOTS, FPS, V3, smooth } from "./timeline";
import { PLANS, Card, RoomState } from "./stage";

// ---------------- canvas cache ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; used: number };
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
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    if (c.kind === "blob") { tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; }
    e = { cv, tex, used: 0 };
    cache.set(key, e);
    if (cache.size > 90) { // drop the least recently used
      const old = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, 20);
      for (const [kk, ee] of old) { ee.tex.dispose(); cache.delete(kk); }
    }
  }
  e.used = ++tick;
  return e.tex;
};

const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
const geoCache = new Map<number, THREE.PlaneGeometry>();
const planeFor = (ay: number) => {
  let g = geoCache.get(ay);
  if (!g) { g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5 - ay, 0); geoCache.set(ay, g); }
  return g;
};

class Sprite {
  mesh: THREE.Mesh;
  lit: THREE.MeshLambertMaterial; hard: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; addm: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial;
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
  private store: THREE.Group; private room: Room; private reef: THREE.Group;
  private sun: THREE.DirectionalLight; private hemi: THREE.HemisphereLight;
  private fog = new THREE.Fog("#ffffff", 20, 140);
  private sprites: Sprite[] = [];
  private sunCache = new Map<number, THREE.Vector3>();

  constructor() {
    this.store = buildStore(); this.room = buildRoom(); this.reef = buildReef();
    this.root.add(this.store, this.room.root, this.reef);
    this.hemi = new THREE.HemisphereLight("#ffffff", "#888888", 0.4);
    this.sun = new THREE.DirectionalLight("#ffffff", 2.5);
    const sh = (getInputProps() as { post?: { shadow?: number } }).post?.shadow ?? 2048;
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(sh, sh);
    this.root.add(this.hemi, this.sun, this.sun.target);
  }

  private sprite(i: number) { while (this.sprites.length <= i) this.sprites.push(new Sprite(this.root)); return this.sprites[i]; }

  /** poses everything for shot `id` at frame f; returns the lens focus point */
  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): { focus: THREE.Vector3; cInf: number } {
    const s = SHOTS[id - 1], plan = PLANS[s.name], t = f / FPS, t0 = s.a / FPS, L = LOOKS[s.look];
    // ---- camera ----
    const c = plan.cam(t, t0);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 400; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    // ---- sets ----
    this.store.visible = s.set === "store"; this.room.root.visible = s.set === "room"; this.reef.visible = s.set === "reef";
    // ---- key light, frozen per shot, camera-relative ----
    let sunDir = this.sunCache.get(id);
    if (!sunDir) {
      const c0 = plan.cam(t0, t0), fw = new THREE.Vector3(c0.look[0] - c0.pos[0], 0, c0.look[2] - c0.pos[2]).normalize();
      const rt = new THREE.Vector3(-fw.z, 0, fw.x), az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
      sunDir = fw.clone().multiplyScalar(Math.cos(az)).addScaledVector(rt, Math.sin(az)).normalize().multiplyScalar(Math.cos(el)).add(new THREE.Vector3(0, Math.sin(el), 0)).normalize();
      this.sunCache.set(id, sunDir);
    }
    const focus = new THREE.Vector3(...(plan.dof.focus ? plan.dof.focus(t) : c.look));
    const look = new THREE.Vector3(...c.look);
    this.sun.position.copy(look).addScaledVector(sunDir, 40); this.sun.target.position.copy(look);
    const sc = this.sun.shadow.camera, Rr = s.set === "reef" ? 14 : 7;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 1; sc.far = 90; sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(0, 0, 0); TONE.uSat.value = L.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint); CARD_K.uGain.value = L.cardGain;
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = untone(L.bg);
    // ---- room state ----
    if (s.set === "room") this.poseRoom(plan.room ? plan.room(t) : { tableBowl: false, container: "giant", medium: 0, giant: 1, lidY: null, sand: "bed", bags: () => 1, bowlReef: false }, L.night, L.glow);
    // ---- cards ----
    const cards = plan.cards(t, t - t0);
    const camPos = cam.position, H = 1920, ppmK = (H / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    let n = 0;
    for (const cd of cards) {
      const sp = this.sprite(n++), m = sp.mesh, kind = cd.kind ?? "lit";
      const h = (cd.w * cd.ch) / cd.cw;
      const dist = Math.max(0.3, camPos.distanceTo(new THREE.Vector3(...cd.pos)));
      const want = cd.res ?? (ppmK / dist) * (cd.w / cd.cw) * 1.15;
      const k = STEPS.find((v) => v >= want) ?? STEPS[STEPS.length - 1];
      const tex = texFor(cd, k);
      m.geometry = planeFor(cd.ay ?? 0.5);
      m.position.set(...cd.pos);
      m.scale.set(cd.w * (cd.mirror ? -1 : 1) * (cd.sx ?? 1), h, 1);
      if (cd.flat) { m.rotation.set(-Math.PI / 2, 0, 0); }
      else { m.rotation.set(0, Math.atan2(camPos.x - cd.pos[0], camPos.z - cd.pos[2]), cd.roll ?? 0); }
      const mat = kind === "lit" ? sp.lit : kind === "fx" ? sp.hard : kind === "soft" ? sp.soft : kind === "add" ? sp.addm : sp.blob;
      mat.map = tex; m.material = mat;
      m.renderOrder = kind === "blob" ? 0.5 : kind === "add" || kind === "soft" ? 4 : 1;
      m.visible = true;
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i].mesh.visible = false;
    return { focus, cInf: plan.dof.cInf(t) };
  }

  private poseRoom(st: RoomState, night: boolean, glow: number) {
    const r = this.room;
    r.window.material = night ? r.windowNight : r.windowDay;
    r.lampShade.emissiveIntensity = night ? 1.6 : 0;
    r.tableBowl.g.visible = st.tableBowl;
    r.bowlReef.visible = st.bowlReef; r.spill.visible = st.bowlReef;
    r.standBowl.g.visible = st.container === "bowl";
    r.medium.g.visible = st.container === "medium"; r.medium.g.scale.setScalar(Math.max(0.001, st.medium));
    r.giant.g.visible = st.container === "giant"; r.giant.g.scale.setScalar(Math.max(0.001, st.giant));
    if (r.giant.sandBed) r.giant.sandBed.visible = st.sand !== "none";
    if (r.giant.mound) r.giant.mound.visible = st.sand === "mound";
    for (const w of [r.giant.water, r.medium.water, r.tableBowl.water, r.standBowl.water] as THREE.MeshLambertMaterial[]) w.emissiveIntensity = night ? 0.55 * glow : 0.12;
    r.lid.visible = st.lidY !== null;
    if (st.lidY !== null) r.lid.position.set(ROOM.stand.x, ROOM.stand.y + r.standBowl.top + 0.012 + st.lidY, ROOM.stand.z);
    for (const b of r.bags) { const k = st.bags(b.userData.k as number); b.visible = k > 0.001; b.scale.setScalar(Math.max(0.001, k)); }
  }
}
export { smooth };
export type { V3 };
