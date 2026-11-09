// The three places of the slippery short as three.js groups: pet store, living room, reef. Painted Canvas2D textures,
// two-tone shading (shade.ts), black ink from the post pass. Walls / floors / ceilings never cast shadows (the "sun"
// is the room's key light), furniture does. Dynamic parts (tanks, lid, sand, bag pile, window, lamp) are exposed as
// handles that world.ts poses per frame.
import * as THREE from "three";
import { ctex, rep, planks, rng } from "./paint";
import { twoTone } from "./shade";
import { drawFish } from "./art";
import { Pen, INK } from "./toon";
import { SETX } from "./timeline";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mats = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};
const col = (key: string, c: string) => lam("c" + key + c, () => ({ color: c }));

/** box from min to max corner; cast = casts shadows */
const box = (parent: THREE.Object3D, min: THREE.Vector3, max: THREE.Vector3, mat: THREE.Material, cast = true) => {
  const g = new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z);
  const m = new THREE.Mesh(g, mat);
  m.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m);
  return m;
};
/** flat textured plane, facing +z before the rotation; tile = metres per texture repeat */
const plane = (parent: THREE.Object3D, w: number, h: number, mat: THREE.Material, pos: THREE.Vector3, rot: [number, number, number], tile = 0) => {
  const g = new THREE.PlaneGeometry(w, h);
  if (tile) { const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile); }
  const m = new THREE.Mesh(g, mat);
  m.position.copy(pos); m.rotation.set(...rot); m.castShadow = false; m.receiveShadow = true;
  parent.add(m);
  return m;
};
const cyl = (parent: THREE.Object3D, r0: number, r1: number, h: number, mat: THREE.Material, pos: THREE.Vector3, seg = 24, cast = true) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.copy(pos); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
};
const tex = (t: THREE.Texture) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// ---------------- painted textures ----------------
const wallpaper = () => ctex("wallpaperRoom", 512, 512, (g) => {
  g.fillStyle = "#f4dfa8"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "#edd396"; g.fillRect(x + 40, 0, 14, 512); }
  g.fillStyle = "#e7c27e";
  for (let y = 32; y < 512; y += 96) for (let x = 20; x < 512; x += 64) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 7, y); g.lineTo(x, y + 9); g.lineTo(x - 7, y); g.closePath(); g.fill(); }
});
const storeWall = () => ctex("wallStore", 512, 512, (g, r) => {
  g.fillStyle = "#bfe3e3"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#a6d3d6"; g.lineWidth = 6;
  for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(r() * 512, r() * 512, 8 + r() * 18, 0, 7); g.stroke(); }
});
const checker = () => ctex("checker", 512, 512, (g) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#2aa49c" : "#f3eedf"; g.fillRect(x * 128, y * 128, 128, 128); }
  g.strokeStyle = "rgba(40,60,60,0.25)"; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
});
const rugTex = () => ctex("rug", 1024, 683, (g) => {
  g.fillStyle = "#c4503f"; g.fillRect(0, 0, 1024, 683);
  g.strokeStyle = "#f4e3c0"; g.lineWidth = 26; g.strokeRect(40, 40, 944, 603);
  g.lineWidth = 8; g.strokeRect(90, 90, 844, 503);
  g.fillStyle = "#e8a23c";
  for (let i = 0; i < 7; i++) { const x = 190 + i * 107; g.beginPath(); g.moveTo(x, 290); g.lineTo(x + 34, 341); g.lineTo(x, 392); g.lineTo(x - 34, 341); g.closePath(); g.fill(); }
});
const fabric = (key: string, base: string) => ctex("fab" + key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},0.05)`; g.fillRect(r() * 256, r() * 256, 3, 3); }
});
const wood = (key: string, base: string) => ctex("wood" + key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(70,40,20,0.22)"; g.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const y = r() * 512; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 8 * (r() - 0.5), 340, y + 8 * (r() - 0.5), 512, y); g.stroke(); }
});
const sandTex = () => tex(ctex("sand", 512, 512, (g, r) => {
  g.fillStyle = "#ead7a8"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { g.fillStyle = ["#d9c18c", "#f4e6c0", "#c9ae78", "#fff3d6"][Math.floor(r() * 4)]; g.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 3); }
  g.strokeStyle = "rgba(170,140,90,0.25)"; g.lineWidth = 5;
  for (let y = 20; y < 512; y += 46) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + 9 * Math.sin(x / 40 + y)); g.stroke(); }
}));
const windowTex = (night: boolean) => ctex(night ? "windowNight" : "windowDay", 512, 400, (g) => {
  const sky = g.createLinearGradient(0, 0, 0, 400);
  if (night) { sky.addColorStop(0, "#0e1838"); sky.addColorStop(1, "#2a3c78"); } else { sky.addColorStop(0, "#5aa0e6"); sky.addColorStop(1, "#bfe0f6"); }
  g.fillStyle = sky; g.fillRect(0, 0, 512, 400);
  if (night) {
    g.fillStyle = "#fff6d0"; g.beginPath(); g.arc(380, 90, 34, 0, 7); g.fill();
    g.fillStyle = "#ffffff"; for (const [x, y] of [[60, 50], [150, 120], [250, 40], [460, 180], [90, 170]]) g.fillRect(x, y, 4, 4);
  } else {
    g.fillStyle = "#ffffff"; for (const [x, y, s] of [[110, 90, 1], [360, 60, 0.8]]) { g.beginPath(); g.ellipse(x, y, 60 * s, 22 * s, 0, 0, 7); g.ellipse(x + 30 * s, y - 14 * s, 36 * s, 20 * s, 0, 0, 7); g.fill(); }
  }
  // houses across the street
  g.fillStyle = night ? "#2b3150" : "#e9b9a0"; g.fillRect(30, 230, 190, 170);
  g.fillStyle = night ? "#3b2d4a" : "#b5574a"; g.beginPath(); g.moveTo(10, 235); g.lineTo(125, 160); g.lineTo(240, 235); g.fill();
  g.fillStyle = night ? "#2f3a5c" : "#a9d4b8"; g.fillRect(280, 250, 210, 150);
  g.fillStyle = night ? "#ffd27a" : "#fdf7ec"; g.fillRect(70, 280, 44, 50); g.fillRect(330, 290, 50, 44);
  g.fillStyle = night ? "#202a40" : "#6cbf5a"; g.fillRect(0, 380, 512, 20);
  // frame
  g.strokeStyle = "#fbf7ef"; g.lineWidth = 26; g.strokeRect(13, 13, 486, 374);
  g.lineWidth = 16; g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 400); g.moveTo(0, 200); g.lineTo(512, 200); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(3, 3, 506, 394);
});
const doorwayTex = () => ctex("doorway", 256, 512, (g) => {
  g.fillStyle = "#ffe4a6"; g.fillRect(0, 0, 256, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "rgba(255,255,255,0.4)"); gr.addColorStop(1, "rgba(160,110,60,0.35)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = "#d39a5f"; g.fillRect(0, 430, 256, 82);
  g.fillStyle = "#8fbcd6"; g.fillRect(90, 120, 80, 100); g.strokeStyle = "#7a4f33"; g.lineWidth = 8; g.strokeRect(90, 120, 80, 100);
  g.strokeStyle = "#fbf7ef"; g.lineWidth = 26; g.strokeRect(13, 13, 230, 520);
  g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(3, 3, 250, 540);
});
const posterTex = () => ctex("fishPoster", 512, 400, (g) => {
  g.fillStyle = "#fdf3dc"; g.fillRect(0, 0, 512, 400);
  g.save(); g.translate(66, 90); g.scale(0.66, 0.66); drawFish(new Pen(g), { expr: "happy" }); g.restore();
  g.fillStyle = "#3a8fb7"; g.fillRect(0, 330, 512, 70);
  g.strokeStyle = "#7a4f33"; g.lineWidth = 30; g.strokeRect(15, 15, 482, 370);
});
const signTex = () => ctex("petSign", 1024, 256, (g) => {
  g.fillStyle = "#f6c84a"; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = INK; g.lineWidth = 14; g.strokeRect(7, 7, 1010, 242);
  g.font = "900 150px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 18; g.strokeStyle = "#ffffff"; g.strokeText("PET SHOP", 512, 136);
  g.fillStyle = "#e2453c"; g.fillText("PET SHOP", 512, 136);
});
const shelfTankTex = (k: number) => ctex("shelfTank" + k, 512, 256, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#8ff0f4"); gr.addColorStop(1, "#2a9fc0");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#e9d9a8"; g.fillRect(0, 220, 512, 36);
  g.strokeStyle = "#3aa65a"; g.lineWidth = 10;
  for (let i = 0; i < 5; i++) { const x = 40 + r() * 430; g.beginPath(); g.moveTo(x, 230); g.quadraticCurveTo(x + 30 * (r() - 0.5), 150, x + 20 * (r() - 0.5), 70 + r() * 60); g.stroke(); }
  const cols = ["#f08f3d", "#f3d34a", "#e2453c", "#7a5ac9", "#ffffff"];
  for (let i = 0; i < 4 + (k % 3); i++) {
    const x = 60 + r() * 380, y = 50 + r() * 140, s = 18 + r() * 14; g.fillStyle = cols[(i + k) % 5];
    g.beginPath(); g.ellipse(x, y, s, s * 0.55, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x + s * 0.8, y); g.lineTo(x + s * 1.5, y - s * 0.5); g.lineTo(x + s * 1.5, y + s * 0.5); g.fill();
  }
});
const sackTex = () => ctex("sack3d", 256, 256, (g, r) => {
  g.fillStyle = "#d8b77c"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(120,90,40,${0.1 + r() * 0.1})`; g.fillRect(r() * 256, r() * 256, 4, 2); }
  g.fillStyle = "#f6efe0"; g.fillRect(48, 88, 160, 80);
  g.font = "bold 54px sans-serif"; g.fillStyle = "#6b4b2a"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SAND", 128, 130);
});
const coralTex = (key: string, base: string, line: string) => tex(ctex("coral" + key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line; g.lineWidth = 7;
  for (let i = 0; i < 14; i++) { g.beginPath(); const y = r() * 256; g.moveTo(0, y); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + 14 * Math.sin(x / 22 + i)); g.stroke(); }
}));
const dots = (key: string, base: string, dot: string) => tex(ctex("dots" + key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.fillStyle = dot; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 6, 0, 7); g.fill(); }
}));

const backdropTex = () => ctex("tankBackdrop", 1024, 600, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 600); gr.addColorStop(0, "#7fe0ef"); gr.addColorStop(0.6, "#33a9cf"); gr.addColorStop(1, "#1f7fb3");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 600);
  g.strokeStyle = "#2f9a5a"; g.lineCap = "round";
  for (let i = 0; i < 16; i++) { const x = 30 + r() * 960, top = 160 + r() * 260; g.lineWidth = 12 + r() * 10; g.beginPath(); g.moveTo(x, 600); g.quadraticCurveTo(x + 60 * (r() - 0.5), (600 + top) / 2, x + 40 * (r() - 0.5), top); g.stroke(); }
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 4;
  for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(r() * 1024, r() * 500, 4 + r() * 8, 0, 7); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(80, 0); g.lineTo(220, 0); g.lineTo(120, 600); g.lineTo(-20, 600); g.fill();
});

// ---------------- tanks ----------------
export type Tank = { g: THREE.Group; water: THREE.MeshLambertMaterial; sandBed: THREE.Mesh | null; mound: THREE.Mesh | null; w: number; h: number; d: number };
const FRAME = "#2c2a33";
/** rectangular tank, bottom centre at the group origin */
export const makeTank = (w: number, h: number, d: number, sandy: boolean): Tank => {
  const g = new THREE.Group();
  const water = twoTone(new THREE.MeshLambertMaterial({ color: "#7fd8ea", transparent: true, opacity: 0.24, depthWrite: false, emissive: new THREE.Color("#3fc6e0"), emissiveIntensity: 0.12 }));
  const wm = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.1, d - 0.04), water);
  // painted aquarium backdrop on the inside of the back glass (keeps the tank blue and the fish clean)
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.1), lam("backdrop", () => ({ map: backdropTex() })));
  bd.position.set(0, (h - 0.1) / 2 + 0.03, -d / 2 + 0.035); bd.receiveShadow = true; g.add(bd);
  wm.position.y = (h - 0.1) / 2 + 0.03; wm.renderOrder = 2; g.add(wm);
  const fr = col("frame", FRAME), t = 0.05;
  box(g, V(-w / 2, 0, -d / 2), V(w / 2, 0.06, d / 2), fr);                    // base rim
  box(g, V(-w / 2, h - 0.06, -d / 2), V(w / 2, h, -d / 2 + t), fr, false);      // top rims
  box(g, V(-w / 2, h - 0.06, d / 2 - t), V(w / 2, h, d / 2), fr, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, V(sx * w / 2 - (sx > 0 ? t : 0), 0, sz * d / 2 - (sz > 0 ? t : 0)), V(sx * w / 2 + (sx < 0 ? t : 0), h, sz * d / 2 + (sz < 0 ? t : 0)), fr, false);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.04, d * 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 1.9) }));
  glow.position.y = h - 0.02; g.add(glow);
  let sandBed: THREE.Mesh | null = null, mound: THREE.Mesh | null = null;
  if (sandy) {
    const sm = lam("tankSand", () => ({ map: rep(sandTex(), 2, 1) }));
    sandBed = box(g, V(-w / 2 + 0.03, 0.06, -d / 2 + 0.03), V(w / 2 - 0.03, 0.22, d / 2 - 0.03), sm);
    mound = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), sm);
    mound.scale.set(w * 0.42, h * 0.62, d * 0.4); mound.position.set(w * 0.05, 0.2, 0); mound.castShadow = true; mound.receiveShadow = true;
    g.add(mound);
  }
  return { g, water, sandBed, mound, w, h, d };
};
/** round glass fishbowl (lathe), rim radius r at the group origin's bottom; water to 70 % */
export const makeBowl = (r: number) => {
  const g = new THREE.Group();
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + (i / 20) * Math.PI * 0.82; prof.push(new THREE.Vector2(Math.max(0.001, r * Math.cos(a)), r + r * Math.sin(a))); }
  const glass = new THREE.MeshLambertMaterial({ color: "#dff6fb", transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const gm = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), twoTone(glass)); gm.renderOrder = 3; g.add(gm);
  const wl = r * 1.3, wp: THREE.Vector2[] = [new THREE.Vector2(0.001, 0.004)];
  const aw = Math.asin((wl - r) / r);
  for (let i = 1; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * (aw + Math.PI / 2); wp.push(new THREE.Vector2(Math.max(0.001, r * 0.97 * Math.cos(a)), r + r * 0.97 * Math.sin(a))); }
  wp.push(new THREE.Vector2(0.001, wl));
  const water = twoTone(new THREE.MeshLambertMaterial({ color: "#86dbe9", transparent: true, opacity: 0.5, depthWrite: false, emissive: new THREE.Color("#3fc6e0"), emissiveIntensity: 0.12 }));
  const wm = new THREE.Mesh(new THREE.LatheGeometry(wp, 40), water); wm.renderOrder = 2; g.add(wm);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * Math.cos(Math.PI * 0.32), 0.012, 8, 40), col("rim", "#cfeff6"));
  rim.rotation.x = Math.PI / 2; rim.position.y = r + r * Math.sin(Math.PI * 0.32); g.add(rim);
  return { g, water, top: r + r * Math.sin(Math.PI * 0.32), waterTop: wl };
};

// ---------------- pet store ----------------
export const buildStore = () => {
  const R = new THREE.Group(); R.position.x = SETX.store;
  const W = 4, D0 = -3, H = 3;
  plane(R, 2 * W, 7, lam("checker", () => ({ map: tex(checker()) })), V(0, 0, 0.5), [-Math.PI / 2, 0, 0], 1.0);
  const wall = lam("storeWall", () => ({ map: tex(storeWall()) }));
  plane(R, 2 * W, H, wall, V(0, H / 2, D0), [0, 0, 0], 2);
  plane(R, 7, H, wall, V(-W, H / 2, 0.5), [0, Math.PI / 2, 0], 2);
  plane(R, 7, H, wall, V(W, H / 2, 0.5), [0, -Math.PI / 2, 0], 2);
  plane(R, 2 * W, 7, col("ceil", "#f4f1ea"), V(0, H, 0.5), [Math.PI / 2, 0, 0]);
  // shelves of glowing tanks
  const shelf = lam("shelfWood", () => ({ map: wood("shelf", "#9a6438") }));
  for (let row = 0; row < 3; row++) {
    const y0 = 0.3 + row * 0.82;
    box(R, V(-3.2, y0 - 0.06, -2.98), V(3.2, y0, -2.4), shelf);
    for (let c = 0; c < 4; c++) {
      const x = -2.25 + c * 1.5, k = row * 4 + c;
      const m = new THREE.MeshBasicMaterial({ map: shelfTankTex(k), color: new THREE.Color(1.15, 1.15, 1.15) });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.6), m);
      front.position.set(x, y0 + 0.31, -2.43); R.add(front);
      const fr = col("frame", FRAME);
      box(R, V(x - 0.65, y0, -2.95), V(x + 0.65, y0 + 0.04, -2.42), fr);
      box(R, V(x - 0.65, y0 + 0.6, -2.95), V(x + 0.65, y0 + 0.64, -2.42), fr, false);
      box(R, V(x - 0.65, y0, -2.44), V(x - 0.61, y0 + 0.64, -2.42), fr, false);
      box(R, V(x + 0.61, y0, -2.44), V(x + 0.65, y0 + 0.64, -2.42), fr, false);
    }
  }
  plane(R, 2.6, 0.65, new THREE.MeshBasicMaterial({ map: signTex() }), V(0, 2.72, -2.97), [0, 0, 0]);
  // counter + till
  const counterWood = lam("counter", () => ({ map: wood("counter", "#b8743f") }));
  box(R, V(-1.6, 0, -1.0), V(1.6, 1.0, -0.35), counterWood);
  box(R, V(-1.68, 1.0, -1.06), V(1.68, 1.06, -0.3), col("ctop", "#e9e1cf"));
  const tillM = col("till", "#8f97a3");
  box(R, V(0.75, 1.06, -0.85), V(1.25, 1.2, -0.45), tillM);
  const disp = box(R, V(0.8, 1.2, -0.8), V(1.2, 1.42, -0.62), tillM);
  disp.rotation.x = -0.25;
  box(R, V(0.85, 1.29, -0.62), V(1.15, 1.37, -0.6), new THREE.MeshBasicMaterial({ color: "#9bf09a" }), false);
  box(R, V(0.8, 1.19, -0.5), V(1.2, 1.215, -0.44), col("keys", "#3b3f52"));
  return R;
};

// ---------------- living room ----------------
export type Room = {
  root: THREE.Group; tableBowl: ReturnType<typeof makeBowl>; standBowl: ReturnType<typeof makeBowl>; lid: THREE.Mesh;
  medium: Tank; giant: Tank; bags: THREE.Mesh[]; window: THREE.Mesh; windowDay: THREE.Material; windowNight: THREE.Material;
  lampShade: THREE.MeshLambertMaterial; bowlReef: THREE.Group; spill: THREE.Mesh;
};
export const ROOM = { table: V(-1.6, 0.42, -1.15), stand: V(2.6, 0.72, -2.55), couchSeat: 0.48 };
export const buildRoom = (): Room => {
  const R = new THREE.Group(); R.position.x = SETX.room;
  const W = 4.5, D0 = -3, H = 3;
  plane(R, 2 * W, 8, lam("floorPlanks", () => ({ map: tex(planks()) })), V(0, 0, 1), [-Math.PI / 2, 0, 0], 1.6);
  const wall = lam("wallpaper", () => ({ map: tex(wallpaper()) }));
  plane(R, 2 * W, H, wall, V(0, H / 2, D0), [0, 0, 0], 1.5);
  plane(R, 8, H, wall, V(-W, H / 2, 1), [0, Math.PI / 2, 0], 1.5);
  plane(R, 8, H, wall, V(W, H / 2, 1), [0, -Math.PI / 2, 0], 1.5);
  plane(R, 2 * W, 8, col("ceilR", "#fbf4e6"), V(0, H, 1), [Math.PI / 2, 0, 0]);
  const skirt = col("skirt", "#f8f1e2");
  box(R, V(-W, 0, D0), V(W, 0.12, D0 + 0.03), skirt, false);
  box(R, V(-W, 0, D0), V(-W + 0.03, 0.12, 5), skirt, false);
  box(R, V(W - 0.03, 0, D0), V(W, 0.12, 5), skirt, false);
  // window + curtains
  const windowDay = new THREE.MeshBasicMaterial({ map: windowTex(false), color: new THREE.Color(1.05, 1.05, 1.05) });
  const windowNight = new THREE.MeshBasicMaterial({ map: windowTex(true) });
  const win = plane(R, 1.9, 1.48, windowDay, V(-1.6, 1.75, D0 + 0.01), [0, 0, 0]);
  const curtain = lam("curtain", () => ({ map: fabric("curtain", "#f2b83a") }));
  box(R, V(-2.85, 0.95, D0 + 0.02), V(-2.5, 2.65, D0 + 0.12), curtain);
  box(R, V(-0.7, 0.95, D0 + 0.02), V(-0.35, 2.65, D0 + 0.12), curtain);
  box(R, V(-2.95, 2.65, D0 + 0.02), V(-0.25, 2.72, D0 + 0.1), col("rod", "#7a4f33"));
  // doorway (left wall) + poster
  plane(R, 1.0, 2.2, new THREE.MeshBasicMaterial({ map: doorwayTex() }), V(-W + 0.01, 1.1, -1.1), [0, Math.PI / 2, 0]);
  plane(R, 0.78, 0.6, lam("poster", () => ({ map: posterTex() })), V(0.15, 1.85, D0 + 0.02), [0, 0, 0]);
  // rug, couch, coffee table, lamp
  plane(R, 4.2, 2.8, lam("rug", () => ({ map: rugTex() })), V(-1.4, 0.012, -0.9), [-Math.PI / 2, 0, 0]);
  const couch = lam("couch", () => ({ map: fabric("couch", "#c8453b") })), cush = lam("cushion", () => ({ map: fabric("cush", "#d65a4e") }));
  box(R, V(-2.8, 0.12, -2.85), V(-0.4, 0.42, -1.9), couch);
  box(R, V(-2.7, 0.42, -2.75), V(-0.5, 0.5, -1.92), cush);
  box(R, V(-2.8, 0.42, -2.95), V(-0.4, 1.05, -2.62), couch);
  box(R, V(-3.0, 0.12, -2.95), V(-2.75, 0.7, -1.85), couch);
  box(R, V(-0.45, 0.12, -2.95), V(-0.2, 0.7, -1.85), couch);
  for (const x of [-2.9, -0.3]) for (const z of [-2.85, -1.95]) box(R, V(x - 0.04, 0, z - 0.04), V(x + 0.04, 0.12, z + 0.04), col("leg", "#5a3b2a"));
  const tw = lam("tableWood", () => ({ map: wood("table", "#a86b3c") }));
  box(R, V(-2.25, 0.36, -1.45), V(-0.95, 0.42, -0.85), tw);
  for (const x of [-2.15, -1.05]) for (const z of [-1.37, -0.93]) box(R, V(x - 0.03, 0, z - 0.03), V(x + 0.03, 0.36, z + 0.03), tw);
  cyl(R, 0.02, 0.02, 1.55, col("pole", "#5a3b2a"), V(-3.7, 0.78, -2.5), 8);
  cyl(R, 0.18, 0.18, 0.04, col("lampBase", "#5a3b2a"), V(-3.7, 0.02, -2.5));
  const lampShade = twoTone(new THREE.MeshLambertMaterial({ color: "#f8e7b8", emissive: new THREE.Color("#ffcf7a"), emissiveIntensity: 0.0 }));
  cyl(R, 0.16, 0.3, 0.36, lampShade, V(-3.7, 1.62, -2.5));
  // ceiling lamp
  cyl(R, 0.01, 0.01, 0.5, col("cord", "#3b3f52"), V(0.3, 2.75, -0.5), 6, false);
  cyl(R, 0.06, 0.32, 0.22, col("pendant", "#2aa49c"), V(0.3, 2.42, -0.5), 24, false);
  // tank cabinet
  const cab = lam("cabinet", () => ({ map: wood("cab", "#8a5a3c") }));
  box(R, V(0.9, 0, -2.95), V(4.3, 0.72, -2.15), cab);
  box(R, V(0.95, 0.15, -2.14), V(2.55, 0.62, -2.12), col("cabDoor", "#9c6a46"), false);
  box(R, V(2.65, 0.15, -2.14), V(4.25, 0.62, -2.12), col("cabDoor", "#9c6a46"), false);
  // containers
  const tableBowl = makeBowl(0.17); tableBowl.g.position.copy(ROOM.table); R.add(tableBowl.g);
  const standBowl = makeBowl(0.17); standBowl.g.position.copy(ROOM.stand); R.add(standBowl.g);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 32), col("lid", "#e2453c"));
  lid.castShadow = true; R.add(lid);
  const medium = makeTank(1.0, 0.6, 0.5, false); medium.g.position.copy(ROOM.stand); R.add(medium.g);
  const giant = makeTank(3.3, 1.9, 0.8, true); giant.g.position.set(2.6, 0.72, -2.55); R.add(giant.g);
  // sand bag mountain (front right), 3 m tall
  const sackM = lam("sack3d", () => ({ map: sackTex() }));
  const bags: THREE.Mesh[] = [], bg = new THREE.BoxGeometry(0.62, 0.24, 0.42), r = rng(7);
  for (let layer = 0; layer < 11; layer++) {
    const n = Math.max(1, 6 - Math.floor(layer / 2)), w = n * 0.34;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(bg, sackM);
      m.position.set(3.3 - w / 2 + i * 0.34 + 0.1 * (r() - 0.5), 0.12 + layer * 0.25, -1.0 + 0.9 * (r() - 0.5) * (1 - layer / 12));
      m.rotation.y = (r() - 0.5) * 0.8; m.rotation.z = (r() - 0.5) * 0.12;
      m.castShadow = true; m.receiveShadow = true; m.userData.k = bags.length;
      R.add(m); bags.push(m);
    }
  }
  // the reef squeezed into the coffee-table bowl
  const bowlReef = new THREE.Group(); bowlReef.position.copy(ROOM.table); R.add(bowlReef);
  const pink = lam("coralPink", () => ({ map: coralTex("pink", "#f28ab0", "#c95a86") })), purple = lam("coralPurple", () => ({ map: dots("purple", "#8f5ad1", "#b78ae8") }));
  const orange = lam("coralOrange", () => ({ map: dots("orange", "#f2994a", "#ffc27a") }));
  const br = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), pink); br.position.set(0.02, 0.32, 0); br.scale.set(1, 0.8, 1); bowlReef.add(br);
  for (const [x, z, h, m] of [[-0.08, 0.04, 0.48, purple], [0.07, -0.05, 0.42, orange], [-0.02, -0.07, 0.36, purple], [0.1, 0.06, 0.3, orange]] as [number, number, number, THREE.Material][]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, h, 10), m); c.position.set(x, 0.05 + h / 2, z); c.rotation.z = x * 1.6; bowlReef.add(c);
  }
  const spill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam("tankSand", () => ({ map: rep(sandTex(), 2, 1) })));
  spill.scale.set(0.42, 0.06, 0.24); spill.position.set(ROOM.table.x + 0.12, ROOM.table.y, ROOM.table.z + 0.05); spill.receiveShadow = true; R.add(spill);
  bowlReef.traverse((o) => { (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true; });
  return { root: R, tableBowl, standBowl, lid, medium, giant, bags, window: win, windowDay, windowNight, lampShade, bowlReef, spill };
};

// ---------------- reef ----------------
export const buildReef = () => {
  const R = new THREE.Group(); R.position.x = SETX.reef;
  const sand = lam("reefSand", () => ({ map: rep(sandTex(), 30, 30) }));
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(90, 90, 60, 60), sand);
  const pa = fl.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setZ(i, 0.12 * Math.sin(x * 0.7) * Math.cos(y * 0.5) + 0.25 * Math.sin(x * 0.13 + y * 0.21)); }
  fl.geometry.computeVertexNormals();
  fl.rotation.x = -Math.PI / 2; fl.position.set(0, -0.12, -20); fl.receiveShadow = true; R.add(fl);
  const r = rng(11);
  const pink = lam("coralPink", () => ({ map: coralTex("pink", "#f28ab0", "#c95a86") }));
  const purple = lam("coralPurple", () => ({ map: dots("purple", "#8f5ad1", "#b78ae8") }));
  const orange = lam("coralOrange", () => ({ map: dots("orange", "#f2994a", "#ffc27a") }));
  const yellow = lam("coralYellow", () => ({ map: coralTex("yellow", "#f2d14a", "#c9a52a") }));
  const rock = lam("rock", () => ({ map: dots("rock", "#9b8f86", "#7f746c") }));
  const fan = lam("fan", () => ({ color: "#b54a8f", side: THREE.DoubleSide }));
  const add = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; R.add(m); return m; };
  for (let i = 0; i < 70; i++) {
    const x = -18 + r() * 36, z = -26 + r() * 27;
    if (Math.abs(z + 1.2) < 1.3 && Math.abs(x) < 9) continue; // keep the swim lane clear in front of the cameras
    const k = r();
    if (k < 0.25) { const s = 0.4 + r() * 0.8; const m = add(new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), pink)); m.position.set(x, s * 0.45, z); m.scale.y = 0.75; }
    else if (k < 0.5) { for (let j = 0; j < 4; j++) { const h = 0.6 + r() * 1.4; const m = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, h, 12), r() < 0.5 ? purple : orange)); m.position.set(x + (r() - 0.5) * 0.6, h / 2 - 0.05, z + (r() - 0.5) * 0.6); m.rotation.z = (r() - 0.5) * 0.5; } }
    else if (k < 0.7) { const s = 0.5 + r() * 1.0; const m = add(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock)); m.position.set(x, s * 0.35, z); m.scale.y = 0.6; m.rotation.y = r() * 6; }
    else if (k < 0.85) { const m = add(new THREE.Mesh(new THREE.CircleGeometry(0.7 + r() * 0.6, 7), fan)); m.position.set(x, 0.75, z); m.rotation.y = r() * 3; }
    else { const s = 0.3 + r() * 0.5; const m = add(new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.6, 9), yellow)); m.position.set(x, s * 1.2, z); }
  }
  return R;
};
