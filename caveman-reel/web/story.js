// The story: 32 shots timed to the voiceover. update(T) poses everything for time T (seconds).
//  VO beats (s): caveman 0.0 | poop behind a rock 3.0 | mammoth 4.9 | not cool 6.45 | dig a hole 7.65 | home 9.9 | stinks 10.9
//  stone seat 12.8 | pour water 14.1 | flush 14.8 | where does the water go 16.0 | bamboo pipes 18.3 | under the whole village 20.2
//  congrats 21.8 | sewer 23.6 | everyone wants one 24.6 | real toilet 27.1 | white 28.06 | shiny 28.75 | beautiful 29.7
//  heated seat 31.44 | bluetooth speaker 32.48 | shelf 34.04 | phone 35.0 | and now 35.83 | 45 minutes 37.7 | scrolling 39.1
//  legs numb 40.2 | whole tribe waits 42.3 | banging 44.0 | GRUG 45.4 | are you done 46.0 | five more minutes 47.1
//  how long 48.6 | comments 50.6 | follow 51.8
import * as THREE from 'three';
import { V3, clamp, lerp, smooth, ss, lin, easeOut, easeIn, easeInOut, backOut, spring, pulse, rng, noise3, wob, canvasTex, blobGeo, mesh, TAU } from './util.js';
import { makeCaveman, pose, mixPose, alive, face, deepMerge } from './character.js';
import * as PR from './props.js';
import { MAT } from './world.js';

export function buildStory(ctx) {
  const { scene, camera, aimSun, backdrop, sun, hemi, fill } = ctx;
  PR.makeSprites();
  const dyn = []; const add = (o, parent = scene) => { parent.add(o); dyn.push(o); o.visible = false; return o; };
  const show = (...os) => os.forEach(o => { o.visible = true; });

  // ---------- cast ----------
  const hero = makeCaveman({}); scene.add(hero.root);
  const CAST = [
    { seed: 2, skin: '#c98d62', hair: '#1d1612', hairHi: '#4a3b30', hairLo: '#0c0907', beard: '#1d1612', beardHi: '#43362c', beardLo: '#0c0907', eye: '#3b2412', hairStyle: 'mop', beardStyle: 'big', tunicA: '#8d8473', tunicB: '#3b352c', tunicHi: '#b4ab98', boot: '#5d4a3a', build: 1.16, belly: 0.035, scale: 1.02, headScale: 1.1, face: { jaw: 1.14, nose: 1.3, brow: 1.5, chin: 1.2 }, browThick: 1.5, strap: -1 },
    { seed: 3, skin: '#eab892', hair: '#b5742c', hairHi: '#e0a556', hairLo: '#7a4a16', beard: '#b5742c', beardHi: '#e0a556', beardLo: '#7a4a16', eye: '#3f7a4a', hairStyle: 'long', beardStyle: 'none', tunicA: '#b99a5e', tunicB: '#5a4423', tunicHi: '#dcc38a', boot: '#8a6a45', build: 0.86, belly: 0, scale: 1.04, headScale: 1.04, face: { jaw: 0.94, nose: 0.9, chin: 0.9 }, browThick: 0.75, strap: 1 },
    { seed: 4, skin: '#d59a78', hair: '#d9d5cc', hairHi: '#ffffff', hairLo: '#9c988f', beard: '#d9d5cc', beardHi: '#ffffff', beardLo: '#a09c93', eye: '#4a5c7a', hairStyle: 'bald', beardStyle: 'big', brow: '#bdb9b0', tunicA: '#7d5a3c', tunicB: '#2f2014', tunicHi: '#a47d58', boot: '#4f3626', build: 1.05, belly: 0.06, scale: 0.88, headScale: 1.16, face: { jaw: 1.08, nose: 1.45, brow: 1.2 }, browThick: 1.3, strap: 1 },
    { seed: 5, skin: '#b57a52', hair: '#a8421c', hairHi: '#e0703a', hairLo: '#5e210c', beard: '#a8421c', beardHi: '#d9682f', beardLo: '#5e210c', eye: '#5a3a1a', hairStyle: 'spiky', beardStyle: 'neat', tunicA: '#9c6b3f', tunicB: '#33200f', tunicHi: '#c79562', boot: '#6b4429', build: 0.95, belly: 0, scale: 0.97, headScale: 1.1, face: { jaw: 1.0, nose: 1.1 }, strap: -1 },
    { seed: 6, skin: '#e3ad88', hair: '#2a1b14', hairHi: '#5a3f30', hairLo: '#120b08', beard: '#2a1b14', beardHi: '#5a3f30', beardLo: '#120b08', eye: '#6b4a2a', hairStyle: 'bun', beardStyle: 'none', tunicA: '#a65a4a', tunicB: '#4a1f18', tunicHi: '#d08a78', boot: '#7a5236', build: 0.8, belly: 0, scale: 0.9, headScale: 1.1, face: { jaw: 0.9, nose: 0.85, chin: 0.85 }, browThick: 0.65, hairline: 0.076, strap: 1 },
  ];
  const cast = CAST.map(o => { const c = makeCaveman(o); scene.add(c.root); return c; });
  const chars = [hero, ...cast];

  // ---------- props ----------
  const mammoth = PR.makeMammoth(); add(mammoth.root);
  const D = V3(-3.2, 0, 2.6);                         // dig site
  const hole = PR.makeHole(); hole.g.position.copy(D); add(hole.g);
  const stick = add(PR.makeStick());
  const seat = add(PR.makeStoneSeat()); seat.position.copy(D);
  const bowl = PR.makeBowl(); add(bowl.g);
  const stream = add(mesh(new THREE.CylinderGeometry(0.046, 0.034, 1, 12), PR.WATER(0.92), { cast: false })); stream.geometry.translate(0, 0.5, 0);
  const puddle = add(mesh(new THREE.CircleGeometry(1, 40), PR.WATER(0.82), { rot: [-Math.PI / 2, 0, 0], cast: false })); puddle.position.set(D.x, 0.024, D.z);
  const pdir = V3(-0.966, 0, -0.26); const PLEN = 1.5; const pipes = [];
  for (let i = 0; i < 7; i++) { const p = add(PR.makePipe(PLEN - 0.04)); const s0 = D.clone().addScaledVector(pdir, 0.44 + i * PLEN); p.position.set(s0.x, 0.16, s0.z); p.rotation.y = Math.atan2(-pdir.z, pdir.x); pipes.push(p); const st = add(PR.makeHole ? mesh(blobGeo(0.13, 1, 300 + i, 0.2, 1.4, [1.2, 0.8, 1]), MAT.rock) : null); st.position.set(s0.x + pdir.x * 0.1, 0.05, s0.z + pdir.z * 0.1); p.userData.rest = st; }
  const heldPipe = add(PR.makePipe(PLEN - 0.04));
  const dirt = new PR.Burst(blobGeo(0.04, 1, 7, 0.3, 1.5), MAT.soil, 110, 3); add(dirt.m); dirt.floor = 0.03;
  const dropGeo = new THREE.SphereGeometry(0.03, 8, 6);
  const drops = new PR.Burst(dropGeo, new THREE.MeshStandardMaterial({ color: 0x4fb6ff, roughness: 0.1, emissive: 0x1a6fc0, emissiveIntensity: 0.5 }), 90, 5); add(drops.m); drops.floor = 0.03;
  const confetti = new PR.Burst(new THREE.BoxGeometry(0.06, 0.012, 0.035), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, vertexColors: false }), 120, 9); add(confetti.m); confetti.gravity = -3.2;
  { const cols = ['#ff5f8f', '#3ec6ff', '#ffd23e', '#7be36b', '#ff8a3e', '#ffffff']; const c = new THREE.Color(); for (let i = 0; i < 120; i++) { c.set(cols[i % cols.length]); confetti.m.setColorAt(i, c); } }
  const ribs = { stink: [], heat: [] };
  const billboard = (list, color, n, op) => { for (let i = 0; i < n; i++) { const r = new PR.Ribbon(color, 26, op); add(r.mesh); list.push(r); } };
  billboard(ribs.stink, 0x86d63c, 4, 0.92); billboard(ribs.heat, 0xff6a2a, 4, 0.9);
  const bulb = add(PR.sprite(PR.SPR.bulb, 0.5));
  const qTex = canvasTex(128, 192, (g) => { g.font = '900 170px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 18; g.strokeStyle = '#1b1b1b'; g.strokeText('?', 64, 100); g.fillStyle = '#ffffff'; g.fillText('?', 64, 100); }, { clamp: true });
  const qmark = add(PR.sprite(qTex, 0.42));
  const starTex = canvasTex(160, 160, (g) => { g.translate(80, 80); const star = (r0, r1) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, r = i % 2 ? r1 : r0; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }; g.lineJoin = 'round'; star(76, 13); g.fillStyle = '#ffc21f'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#a66f00'; g.stroke(); star(50, 8); g.fillStyle = '#fff3a8'; g.fill(); }, { clamp: true });
  const stars = []; for (let i = 0; i < 4; i++) stars.push(add(PR.sprite(starTex, 0.3)));
  const sparks = []; for (let i = 0; i < 22; i++) sparks.push(add(PR.sprite(PR.SPR.spark, 0.2, { blending: THREE.AdditiveBlending })));
  const notes = [PR.SPR.note1, PR.SPR.note2, PR.SPR.note3, PR.SPR.note2, PR.SPR.note1].map(t => add(PR.sprite(t, 0.2)));
  const zaps = []; for (let i = 0; i < 8; i++) zaps.push(add(PR.sprite(PR.SPR.zap, 0.2)));
  const hearts = []; for (let i = 0; i < 4; i++) hearts.push(add(PR.sprite(PR.SPR.heart, 0.14)));
  const bangs = []; for (let i = 0; i < 2; i++) bangs.push(add(PR.sprite(PR.SPR.bang, 0.5)));
  const puffs = []; for (let i = 0; i < 10; i++) puffs.push(add(PR.sprite(PR.SPR.puff, 0.4, { opacity: 0.8 })));
  const sweat = add(PR.sprite(PR.SPR.sweat, 0.09));
  // toilet hut
  const T = V3(9, 0, 2);
  const hut = PR.makeToiletHut(); hut.g.position.copy(T); scene.add(hut.g);
  const toilet = PR.makeToilet(); toilet.g.position.set(0, 0.06, -0.50); add(toilet.g, hut.g);
  const TW = V3(T.x, 0.06, T.z - 0.50);              // toilet world position
  const speaker = add(PR.makeSpeaker(), hut.g); speaker.position.set(-0.10, 0.06 + 0.878, -0.50 - 0.39); speaker.scale.setScalar(0.72);
  const shelf = add(PR.makeShelf(), hut.g); shelf.position.set(0, 1.58, -PR.HUT.D / 2 + PR.HUT.T);
  const clock = PR.makeClock(); add(clock.g, hut.g); clock.g.position.set(0.0, 2.38, -PR.HUT.D / 2 + PR.HUT.T + 0.04);
  const phone = PR.makePhone(); add(phone.g);
  const inLight = new THREE.PointLight(0xfff0d0, 0, 9, 1.4); inLight.position.set(0, 2.3, 0.2); hut.g.add(inLight); inLight.visible = false;
  const glow = add(PR.sprite(PR.SPR.puff, 2.6, { blending: THREE.AdditiveBlending, opacity: 0.0 }), hut.g); glow.position.set(0, 1.0, -0.6);
  // cutaway set
  const CX = 300; const cut = PR.makeCutaway(); cut.g.position.set(CX, 0, 0); add(cut.g);

  // ---------- helpers ----------
  const cam = (p, t, fov = 36, roll = 0) => { camera.position.set(p[0], p[1], p[2]); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(t[0], t[1], t[2]); camera.fov = fov; camera.updateProjectionMatrix(); };
  const camMix = (a, b, w) => cam(a[0].map((v, i) => lerp(v, b[0][i], w)), a[1].map((v, i) => lerp(v, b[1][i], w)), lerp(a[2], b[2], w));
  const shake = (t, amt, f = 30) => { camera.position.x += amt * noise3(t * f, 1.3, 0); camera.position.y += amt * noise3(t * f, 7.7, 2); };
  const kp = (t, keys, ease = smooth) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return mixPose(keys[i - 1][1], keys[i][1], (keys[i][2] || ease)((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]))); return keys[keys.length - 1][1]; };
  const put = (c, p, t, seed = 1, life = 1) => { c.root.visible = true; c.apply(life > 0 ? alive(p, t, seed, life) : p); };
  const headPos = (c) => c.bones.head.getWorldPosition(V3()).add(V3(0, 0.1 * c.P.scale, 0));
  const spark = (i, p, size, t, speed = 7) => { const s = sparks[i]; s.visible = true; s.position.set(p[0], p[1], p[2]); const k = 0.5 + 0.5 * Math.sin(t * speed + i * 2.1); s.setSize(size * (0.25 + 0.75 * k * k)); s.material.rotation = t * 1.3 + i; };
  const talk = (T, spans, amt = 0.75) => { let o = 0; for (const [a, b, n] of spans) if (T > a - 0.03 && T < b + 0.04) { const u = (T - a) / (b - a); o = Math.max(o, amt * (0.35 + 0.65 * Math.abs(Math.sin(u * Math.PI * (n || 1)))) * pulse(a - 0.03, b + 0.04, T, 0.05)); } return o; };
  const withFace = (p, f) => ({ ...p, face: f });
  const A = (p, o = {}) => ({ p, ...o });
  const stinkAt = (x, y, z, t, h = 1.15, n = 3, list = ribs.stink, w = 0.022) => { for (let i = 0; i < n; i++) { const r = list[i]; r.mesh.visible = true; r.mesh.position.set(x + (i - (n - 1) / 2) * 0.16, y, z); r.mesh.quaternion.copy(camera.quaternion); const ph = i * 2.1, rise = (t * 0.55 + i * 0.37) % 1; r.set((u) => [0.075 * Math.sin(u * 8 - t * 6 + ph) * (0.35 + u), (u * 0.75 + rise * 0.35) * h], (u) => w * Math.sin(Math.min(1, u * 1.05) * Math.PI) * (0.6 + 0.4 * Math.sin(t * 4 + i))); } };

  // ---------- pose library ----------
  const F = (n, o) => face(n, o);
  const P = {};
  P.stand = pose({});
  P.hips = pose({ armL: A([0.232, 1.045, 0.0], { pole: [1, 0.15, -0.75], twist: -1.25, flex: 0.55 }), armR: A([0.232, 1.045, 0.0], { pole: [1, 0.15, -0.75], twist: -1.25, flex: 0.55 }), spine: { pitch: -0.05, yaw: 0, roll: 0 } });
  P.present = pose({ armL: A([0.44, 1.14, 0.24], { pole: [0.5, -0.8, -0.5], twist: 1.5, fingers: 'open' }), armR: A([0.44, 1.14, 0.24], { pole: [0.5, -0.8, -0.5], twist: 1.5, fingers: 'open' }), spine: { pitch: -0.06, yaw: 0, roll: 0 }, head: { pitch: -0.05, yaw: 0, roll: 0.06 } });
  P.idea = pose({ armR: A([0.27, 1.74, 0.16], { pole: [0.7, -0.8, 0.0], fingers: 'point' }), armL: A([0.232, 1.045, 0.0], { pole: [1, 0.15, -0.75], twist: -1.25, flex: 0.55 }), head: { pitch: -0.10, yaw: 0, roll: -0.05 }, spine: { pitch: -0.07, yaw: 0, roll: 0 } });
  P.squat = pose({ hips: { x: 0, y: -0.50, z: -0.12, pitch: 0.30, yaw: 0, roll: 0 }, spine: { pitch: 0.30, yaw: 0, roll: 0 }, head: { pitch: -0.42, yaw: 0, roll: 0 },
    footL: { p: [0.22, 0, 0.06], yaw: 0.55, knee: [0.8, 0, 1] }, footR: { p: [0.22, 0, 0.06], yaw: 0.55, knee: [0.8, 0, 1] },
    armL: A([0.33, 0.52, 0.30], { space: 'root', pole: [0.9, -0.1, -0.6], twist: -1.0, fingers: 'cup' }), armR: A([0.33, 0.52, 0.30], { space: 'root', pole: [0.9, -0.1, -0.6], twist: -1.0, fingers: 'cup' }) });
  P.squatShock = deepMerge(P.squat, { hips: { x: 0, y: -0.40, z: -0.16, pitch: 0.12, yaw: 0, roll: 0 }, spine: { pitch: -0.05, yaw: 0, roll: 0 }, head: { pitch: -0.12, yaw: 0, roll: 0 },
    armL: A([0.40, 1.42, 0.22], { space: 'chest', pole: [0.8, -0.7, -0.2], twist: -0.9, fingers: 'open' }), armR: A([0.40, 1.42, 0.22], { space: 'chest', pole: [0.8, -0.7, -0.2], twist: -0.9, fingers: 'open' }) });
  P.digBase = pose({ hips: { x: 0, y: -0.13, z: -0.06, pitch: 0.32, yaw: 0, roll: 0 }, spine: { pitch: 0.34, yaw: 0, roll: 0 }, head: { pitch: -0.20, yaw: 0, roll: 0 },
    footL: { p: [0.17, 0, 0.16], yaw: 0.25, knee: [0.3, 0, 1] }, footR: { p: [0.19, 0, -0.14], yaw: 0.45, knee: [0.4, 0, 1] } });
  P.nose = pose({ spine: { pitch: -0.20, yaw: -0.12, roll: 0.03 }, head: { pitch: -0.10, yaw: -0.30, roll: 0.05 }, hips: { x: 0, y: -0.03, z: -0.05, pitch: -0.06, yaw: 0, roll: 0 },
    armR: A([0.075, 1.450, 0.170], { space: 'head', pole: [0.6, -0.9, 0.3], twist: 1.2, flex: 0.45, fingers: 'pinch' }),
    armL: A([0.34, 1.26, 0.40], { pole: [0.7, -0.7, -0.2], twist: -0.8, fingers: 'open' }), footR: { p: [0.14, 0, -0.14], yaw: 0.3 } });
  P.think = pose({ hips: { x: 0.02, y: -0.02, z: 0, pitch: 0, yaw: 0, roll: 0.03 }, spine: { pitch: 0.02, yaw: 0.06, roll: -0.03 }, head: { pitch: 0.10, yaw: 0.12, roll: 0.12 },
    armR: A([0.045, 1.515, 0.165], { space: 'head', pole: [0.55, -1, 0.25], twist: 1.2, flex: 0.25, fingers: { c: [0.30, 0.92, 0.96, 0.96], s: 0, t: 0.1, to: 0.3 } }),
    armL: A([-0.07, 1.20, 0.17], { pole: [0.8, -0.5, 0.1], twist: -0.6, flex: 0.3, fingers: 'cup' }) });
  P.cheer = pose({ hips: { x: 0, y: 0.0, z: 0, pitch: -0.04, yaw: 0, roll: 0 }, spine: { pitch: -0.12, yaw: 0, roll: 0 }, head: { pitch: -0.22, yaw: 0, roll: 0 },
    armL: A([0.36, 2.0, 0.06], { pole: [1, 0.1, -0.4], fingers: 'fist' }), armR: A([0.36, 2.0, 0.06], { pole: [1, 0.1, -0.4], fingers: 'fist' }) });
  P.crouchJump = pose({ hips: { x: 0, y: -0.2, z: -0.05, pitch: 0.2, yaw: 0, roll: 0 }, spine: { pitch: 0.18, yaw: 0, roll: 0 }, armL: A([0.28, 1.05, -0.12], { fingers: 'fist' }), armR: A([0.28, 1.05, -0.12], { fingers: 'fist' }) });
  P.point = pose({ armR: A([0.10, 1.40, 0.53], { pole: [0.5, -0.9, -0.15], twist: -1.5, fingers: 'point' }), spine: { pitch: 0.08, yaw: 0.12, roll: 0 }, head: { pitch: 0, yaw: -0.05, roll: 0 } });
  P.pointL = pose({ armL: A([0.10, 1.40, 0.53], { pole: [0.5, -0.9, -0.15], twist: -1.5, fingers: 'point' }), spine: { pitch: 0.08, yaw: -0.12, roll: 0 } });
  P.pointDown = pose({ armR: A([0.15, 1.10, 0.36], { pole: [0.9, -0.1, -0.5], twist: -1.5, flex: 0.35, fingers: 'point' }), armL: A([0.15, 1.10, 0.36], { pole: [0.9, -0.1, -0.5], twist: -1.5, flex: 0.35, fingers: 'point' }), spine: { pitch: 0.10, yaw: 0, roll: 0 }, head: { pitch: 0.02, yaw: 0, roll: 0.05 } });
  P.thumb = pose({ armR: A([0.25, 1.36, 0.36], { pole: [0.7, -0.8, -0.2], twist: 0.1, fingers: 'thumb' }), armL: A([0.232, 1.045, 0.0], { pole: [1, 0.15, -0.75], twist: -1.25, flex: 0.55 }), head: { pitch: -0.04, yaw: 0, roll: 0.10 }, spine: { pitch: 0, yaw: 0.10, roll: 0.03 } });
  P.tada = pose({ armL: A([0.50, 1.36, 0.10], { pole: [0.2, -1, -0.4], twist: 1.5, fingers: 'open' }), armR: A([0.232, 1.045, 0.0], { pole: [1, 0.15, -0.75], twist: -1.25, flex: 0.55 }), spine: { pitch: -0.04, yaw: -0.1, roll: -0.05 }, head: { pitch: -0.04, yaw: 0.15, roll: -0.06 } });
  P.awe = pose({ armR: A([0.045, 1.43, 0.21], { pole: [0.8, -0.7, 0.2], twist: 0.6, fingers: 'cup' }), armL: A([0.035, 1.40, 0.20], { pole: [0.8, -0.7, 0.2], twist: 0.6, fingers: 'cup' }), head: { pitch: 0.10, yaw: 0, roll: 0.14 }, spine: { pitch: 0.06, yaw: 0, roll: 0.04 } });
  P.cross = pose({ armR: A([-0.10, 1.25, 0.17], { pole: [0.8, -0.5, 0.0], twist: -0.9, flex: 0.4, fingers: 'cup' }), armL: A([-0.08, 1.30, 0.20], { pole: [0.8, -0.5, 0.0], twist: -0.9, flex: 0.4, fingers: 'cup' }), hips: { x: 0.02, y: -0.01, z: 0, pitch: 0, yaw: 0, roll: 0.04 }, head: { pitch: 0.03, yaw: 0, roll: -0.06 } });
  P.shrug = pose({ armL: A([0.42, 1.22, 0.20], { pole: [0.5, -0.8, -0.5], twist: 1.5, fingers: 'open', shrug: 1 }), armR: A([0.42, 1.22, 0.20], { pole: [0.5, -0.8, -0.5], twist: 1.5, fingers: 'open', shrug: 1 }), head: { pitch: 0, yaw: 0, roll: 0.12 } });
  const sitBase = { hips: { x: 0, y: -0.345, z: -0.02, pitch: -0.06, yaw: 0, roll: 0 }, spine: { pitch: 0.30, yaw: 0, roll: 0 }, head: { pitch: 0.34, yaw: 0, roll: 0 },
    footL: { p: [0.18, 0.06, 0.40], yaw: 0.14, knee: [0.26, 0.3, 1] }, footR: { p: [0.18, 0.06, 0.40], yaw: 0.14, knee: [0.26, 0.3, 1] },
    armR: A([0.085, 0.80, 0.36], { space: 'root', pole: [0.9, -0.5, -0.4], twist: 1.25, flex: 0.45, fingers: 'phone' }),
    armL: A([0.20, 0.655, 0.30], { space: 'root', pole: [0.9, -0.2, -0.5], twist: -1.2, flex: 0.2, fingers: 'cup' }) };
  P.sit = pose(sitBase);
  P.sitFive = deepMerge(P.sit, { armL: A([0.33, 1.46, 0.22], { space: 'chest', pole: [0.6, -1, -0.1], twist: 1.5, flex: -0.15, fingers: 'open' }), head: { pitch: 0.26, yaw: 0, roll: 0.04 } });

  const walk = (ph, stride = 0.34, base = P.stand) => {
    const f = (p) => { p = ((p % 1) + 1) % 1; return p < 0.5 ? { z: lerp(-stride / 2, stride / 2, smooth(p * 2)), y: Math.sin(p * 2 * Math.PI) * 0.085, pitch: lerp(0.35, -0.25, p * 2) } : { z: lerp(stride / 2, -stride / 2, (p - 0.5) * 2), y: 0, pitch: 0 }; };
    const L = f(ph), R = f(ph + 0.5); const sw = Math.sin(ph * TAU);
    return deepMerge(base, { hips: { x: 0.012 * Math.cos(ph * TAU), y: -0.03 + 0.018 * Math.cos(ph * 2 * TAU), z: 0, pitch: 0.04, yaw: -0.08 * sw, roll: 0.03 * Math.cos(ph * TAU) }, spine: { pitch: 0.02, yaw: 0.14 * sw, roll: 0 },
      footL: { p: [0.10, L.y, L.z], yaw: 0.1, pitch: L.pitch }, footR: { p: [0.10, R.y, R.z], yaw: 0.1, pitch: R.pitch } });
  };
  const walkArms = (ph, p) => deepMerge(p, { armL: A([0.265, 0.935, 0.035 - 0.16 * Math.sin(ph * TAU)]), armR: A([0.265, 0.935, 0.035 + 0.16 * Math.sin(ph * TAU)]) });

  // ---------- shots ----------
  const H0 = [-1.2, 0, 3.2];
  const SIT = [TW.x, 0, TW.z + 0.02];
  const interior = (on) => { hut.front.visible = !on; hut.roof.visible = !on; hut.door.visible = !on; hut.left.castShadow = !on; hut.right.castShadow = !on; if (on) { sun.intensity = 1.85; hemi.intensity = 1.2; } };
  const upgrades = (heat, spk, shf, clk) => { toilet.seatMat.emissiveIntensity = heat; if (spk) show(speaker); if (shf) show(shelf); if (clk) show(clock.g); };
  const phoneInHand = (c, t, on = 1) => { // phone rides in the right hand, screen toward the face
    show(phone.g); const hb = c.bones.handR; hb.updateWorldMatrix(true, false);
    const m = new THREE.Matrix4().compose(V3(0.030, -0.085, 0.004), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), V3(1, 1, 1));
    phone.g.matrixAutoUpdate = false; phone.g.matrix.multiplyMatrices(hb.matrixWorld, m); phone.g.matrixWorldNeedsUpdate = true;
    phone.tex.offset.y = (t * 0.42) % 1; phone.glow.intensity = 0.9 * on;
  };
  const queuePos = [[9.05, 4.22], [9.22, 5.45], [8.82, 6.62], [9.2, 7.8], [8.9, 8.95]];
  const queue = (t, T, bang = 0) => {
    cast.forEach((c, i) => {
      const [x, z] = queuePos[i]; let p;
      if (i === 0) p = deepMerge(P.stand, { face: F('angry') });
      else if (i === 1) p = deepMerge(P.cross, { face: F('annoyed'), footR: { p: [0.11, 0.02 + 0.03 * Math.max(0, Math.sin(t * 9)), 0.06], yaw: 0.2, pitch: -0.25 * Math.max(0, Math.sin(t * 9)) } });
      else if (i === 2) p = deepMerge(P.hips, { face: F('bored'), head: { pitch: -0.1, yaw: 0.3 * Math.sin(t * 1.4), roll: 0.05 }, hips: { x: 0.02, y: -0.015, z: 0, pitch: 0, yaw: 0, roll: 0.05 } });
      else if (i === 3) p = deepMerge(P.shrug, { face: F('nervous'), hips: { x: 0, y: -0.04 - 0.02 * Math.sin(t * 7), z: 0, pitch: 0.05, yaw: 0, roll: 0 }, footL: { p: [0.07, 0, 0.0], yaw: -0.05 }, footR: { p: [0.07, 0, 0.0], yaw: -0.05 } });   // really needs to go
      else p = deepMerge(P.cross, { face: F('annoyed'), head: { pitch: 0.02, yaw: -0.2, roll: 0.08 } });
      put(c, { ...p, pos: [x, 0, z], yaw: Math.PI + (i % 2 ? 0.08 : -0.06) }, t + i * 0.7, i + 2);
    });
    mammoth.root.visible = true; mammoth.root.position.set(11.0, 0, 12.0); mammoth.root.rotation.y = Math.PI + 0.14; mammoth.update(T, { chew: 0.6, stare: 1 });
  };
  const bangPose = (t, hits, cx = 9.05, cz = 4.22) => {
    let k = 0; for (const h of hits) { const u = (t - h) / 0.26; if (u > -0.55 && u < 1) k = Math.max(k, u < 0 ? 1 - easeIn(-u / 0.55) : 1 - smooth(u)); }
    const fist = [cx + 0.10, 1.50 + 0.10 * (1 - k), lerp(4.05, 3.49, k)];
    return { pose: deepMerge(P.stand, { pos: [cx, 0, cz], yaw: Math.PI, spine: { pitch: 0.06 + 0.16 * k, yaw: -0.20 * k, roll: 0 }, head: { pitch: -0.05, yaw: 0, roll: 0 }, hips: { x: 0, y: -0.03, z: 0.04 * k, pitch: 0.04, yaw: 0, roll: 0 },
      armR: A(fist, { space: 'world', pole: [0.9, -0.3, -0.3], twist: -0.2, flex: 0.2, fingers: 'fist' }), armL: A([0.26, 1.02, 0.10], { fingers: 'fist' }), footL: { p: [0.13, 0, 0.14], yaw: 0.15 }, footR: { p: [0.13, 0, -0.12], yaw: 0.35 } }), k };
  };

  const shots = [];
  const S = (id, t0, t1, fn) => shots.push({ id, t0, t1, fn });

  // 1a — hook: handsome caveman, close then pull back
  S('1a', 0, 1.72, (t) => {
    const p = kp(t, [[0.0, withFace(P.hips, F('smirk'))], [0.55, withFace(P.hips, F('smile'))], [0.95, withFace(P.present, F('grin')), backOut], [1.72, withFace(P.present, F('smile'))]]);
    put(hero, { ...p, pos: H0, yaw: -0.08 }, t, 1);
    const hp = headPos(hero); const w = easeOut(lin(0.12, 1.15, t));
    camMix([[hp.x + 0.10, hp.y - 0.02, hp.z + 0.78], [hp.x, hp.y - 0.01, hp.z], 30], [[H0[0] + 0.45, 1.36, H0[2] + 2.55], [H0[0], 1.30, H0[2]], 34], w);
    aimSun(H0[0], 1, H0[2], 4);
  });
  // 1b — squats behind the big rock, looking around nervously
  S('1b', 1.72, 4.30, (t) => {
    const look = Math.sin(t * 5.2) * (t > 0.55 ? 1 : 0.5);
    const base = kp(t, [[0, withFace(deepMerge(P.stand, { hips: { x: 0, y: -0.10, z: 0, pitch: 0.12, yaw: 0, roll: 0 }, spine: { pitch: 0.15, yaw: 0, roll: 0 } }), F('nervous'))], [0.62, withFace(P.squat, F('nervous')), easeInOut]]);
    const p = deepMerge(base, { head: { pitch: base.head.pitch, yaw: 0.62 * look, roll: 0.05 * look }, spine: { pitch: base.spine.pitch, yaw: 0.16 * look, roll: 0 }, face: { eye: [0.8 * Math.sign(look) * Math.min(1, Math.abs(look) * 2), 0.1] } });
    put(hero, { ...p, pos: [0, 0, 0.98], yaw: 0.1 }, t, 1, 0.6);
    camMix([[1.9, 0.62, 5.2], [0.0, 0.92, 0.6], 38], [[1.25, 0.55, 4.2], [0.0, 0.78, 0.7], 36], smooth(t / 2.58));
    const hp = headPos(hero); if (t > 0.8) { show(sweat); const u = ((t - 0.8) % 0.9) / 0.9; sweat.position.set(hp.x + 0.16, hp.y + 0.05 - u * 0.22, hp.z + 0.05); sweat.setSize(0.085 * (1 - u * 0.5)); sweat.material.opacity = 1 - u * u; }
    aimSun(0, 1, 0.5, 6);
  });
  // 2a — the mammoth stares, chewing
  S('2a', 4.30, 5.55, (t, T) => {
    show(mammoth.root); mammoth.root.position.set(1.3, 0, 8.6); mammoth.root.rotation.y = Math.PI + 0.17; mammoth.update(T, { chew: 1, stare: 1, look: [0, -0.3], nod: 0.16 });
    const turn = smooth(lin(0.1, 0.55, t));
    put(hero, { ...deepMerge(P.squat, { head: { pitch: -0.42 - 0.12 * turn, yaw: 0.5 * (1 - turn) - 0.08, roll: 0 }, face: F('nervous') }), pos: [0, 0, 0.98], yaw: 0.1 }, t, 1, 0.3);
    camMix([[-0.72, 1.22, -0.75], [1.0, 1.85, 8.6], 44], [[-0.62, 1.2, -0.35], [1.0, 2.0, 8.6], 42], easeOut(t / 1.25));
    aimSun(0.8, 1.5, 5, 11);
  });
  // 2b — caveman spots it: shock
  S('2b', 5.55, 6.42, (t, T) => {
    const p = kp(t, [[0, withFace(P.squat, F('nervous'))], [0.16, withFace(P.squatShock, F('shock')), backOut]]);
    put(hero, { ...p, pos: [0, 0, 0.98 + 0], yaw: 0.1, hips: { ...p.hips, y: p.hips.y + 0.05 * Math.exp(-t * 6) * Math.sin(t * 30) } }, t, 1, 0.3);
    const z = easeOut(lin(0, 0.22, t)); camMix([[-0.8, 0.95, 4.5], [0, 1.0, 0.9], 38], [[-0.6, 1.0, 3.55], [0, 1.08, 0.9], 34], z); shake(t, 0.012 * Math.exp(-t * 5));
    aimSun(0, 1, 0.5, 5);
  });
  // 3 — "Not cool." deadpan close-up
  S('3', 6.42, 7.62, (t) => {
    const p = deepMerge(P.squat, { head: { pitch: -0.40, yaw: 0.10 * Math.sin(t * 7.5) * pulse(0.25, 1.0, t, 0.15), roll: 0 }, face: F('annoyed', { eye: [0, 0.15] }) });
    put(hero, { ...p, pos: [0, 0, 0.98], yaw: 0.1 }, t, 1, 0.25);
    const hp = headPos(hero); camMix([[hp.x + 0.16, hp.y - 0.10, hp.z + 1.42], [hp.x, hp.y - 0.19, hp.z], 30], [[hp.x + 0.14, hp.y - 0.10, hp.z + 1.24], [hp.x, hp.y - 0.17, hp.z], 30], smooth(t / 1.2));
    aimSun(0, 1, 0.5, 4);
  });
  const DH = [D.x - 0.02, 0, D.z - 0.78];
  // 4a — light bulb
  S('4a', 7.62, 8.50, (t) => {
    const p = kp(t, [[0, withFace(P.stand, F('think'))], [0.2, withFace(P.idea, F('idea')), backOut]]);
    put(hero, { ...p, pos: DH, yaw: 0.05, hips: { ...p.hips, y: p.hips.y + 0.03 * Math.sin(Math.min(1, t / 0.3) * Math.PI) } }, t, 1, 0.5);
    const hp = headPos(hero); show(bulb); bulb.position.set(hp.x, hp.y + 0.50, hp.z); bulb.setSize(0.56 * backOut(lin(0.02, 0.24, t), 3) * (1 + 0.04 * Math.sin(t * 20)));
    camMix([[DH[0] + 0.25, 1.52, DH[2] + 3.1], [DH[0], 1.60, DH[2]], 32], [[DH[0] + 0.2, 1.52, DH[2] + 2.85], [DH[0], 1.62, DH[2]], 32], easeOut(t / 0.88));
    aimSun(D.x, 1, D.z, 5);
  });
  // 4b — digging, dirt flies
  const strokes = [0.18, 0.66, 1.14, 1.62];
  strokes.forEach((s, i) => dirt.emit(s + 0.16, [D.x + 0.05, 0.15, D.z + 0.05], [0.55, 1.35, 0.45], 3.4, 1.1, 22, 1.0, 1.0));
  S('4b', 8.50, 10.55, (t) => {
    let plunge = 0, lever = 0; for (const s of strokes) { const u = (t - s) / 0.46; if (u >= -0.25 && u < 1) { plunge = u < 0 ? 0 : u < 0.3 ? easeIn(u / 0.3) : 1 - smooth((u - 0.5) / 0.5); lever = smooth(lin(0.25, 0.6, u)) * (1 - smooth(lin(0.7, 1, u))); } }
    const tip = V3(D.x + 0.02, lerp(0.42, -0.10, plunge), D.z + 0.05); const ang = 0.30 + 0.34 * lever + 0.08 * (1 - plunge);
    const dir = V3(0.10, Math.cos(ang), -Math.sin(ang)).normalize(); const top = tip.clone().addScaledVector(dir, 1.35);
    show(stick); PR.placeBetween(stick, tip, top);
    const h1 = tip.clone().addScaledVector(dir, 1.26), h2 = tip.clone().addScaledVector(dir, 0.84);
    const p = deepMerge(P.digBase, { hips: { x: 0, y: -0.13 - 0.10 * plunge, z: -0.06, pitch: 0.30 + 0.12 * plunge, yaw: 0, roll: 0 }, spine: { pitch: 0.30 + 0.16 * plunge - 0.10 * lever, yaw: 0.05, roll: 0 }, head: { pitch: -0.12, yaw: 0, roll: 0 },
      armR: A(h1.toArray(), { space: 'world', pole: [0.9, -0.3, -0.5], twist: -0.2, flex: 0.9, fingers: 'grip' }), armL: A(h2.toArray(), { space: 'world', pole: [0.9, -0.4, -0.4], twist: 0.2, flex: 0.9, fingers: 'grip' }), face: F('effort') });
    put(hero, { ...p, pos: DH, yaw: 0.05 }, t, 1, 0.2);
    const grow = clamp(0.25 + 0.75 * lin(0.2, 1.8, t)); show(hole.g); hole.pit.scale.setScalar(grow); hole.rim.scale.setScalar(0.5 + 0.5 * grow); hole.pile.scale.setScalar(0.2 + 0.8 * lin(0.3, 1.9, t));
    show(dirt.m); dirt.update(t);
    camMix([[D.x - 1.75, 0.36, D.z + 2.5], [D.x + 0.0, 0.82, D.z - 0.3], 42], [[D.x - 1.45, 0.42, D.z + 2.25], [D.x, 0.85, D.z - 0.3], 42], smooth(t / 2.05));
    for (const s of strokes) shake(t, 0.01 * Math.exp(-Math.max(0, t - s - 0.14) * 9) * (t > s + 0.14 ? 1 : 0));
    aimSun(D.x, 1, D.z, 5);
  });
  // 5 — it stinks
  S('5', 10.55, 12.12, (t) => {
    show(hole.g); hole.pit.scale.setScalar(1); hole.rim.scale.setScalar(1); hole.pile.scale.setScalar(1);
    const wave = Math.sin(t * 13);
    const p = kp(t, [[0, withFace(P.stand, F('neutral'))], [0.22, withFace(P.nose, F('disgust')), backOut]]);
    const q = deepMerge(p, t > 0.2 ? { armL: A([0.34 + 0.08 * wave, 1.26, 0.40], { pole: [0.7, -0.7, -0.2], twist: -0.8, fingers: 'open', dev: 0.3 * wave }) } : {});
    put(hero, { ...q, pos: DH, yaw: 0.05 }, t, 1, 0.3);
    camMix([[D.x + 0.55, 0.30, D.z + 1.75], [D.x - 0.05, 0.98, D.z - 0.55], 44], [[D.x + 0.5, 0.34, D.z + 1.6], [D.x - 0.05, 1.02, D.z - 0.55], 44], smooth(t / 1.57));
    stinkAt(D.x, 0.12, D.z, t + 1, 1.15 * easeOut(lin(0, 0.5, t)), 3);
    aimSun(D.x, 1, D.z, 5);
  });
  // 6a — stone seat goes on
  S('6a', 12.12, 13.80, (t) => {
    show(hole.g, seat);
    const drop = t < 0.62 ? lerp(0.62, 0.30, smooth(t / 0.5)) : Math.max(0, 0.30 - 4.2 * (t - 0.62) * (t - 0.62) * 9);
    const y = Math.max(0, drop); seat.position.set(D.x, y, D.z); seat.rotation.set(0, t * 0.2, t < 0.7 ? 0.04 * Math.sin(t * 9) : 0);
    const landed = t > 0.78;
    const carry = deepMerge(P.digBase, { hips: { x: 0, y: -0.10 - 0.16 * smooth(lin(0.3, 0.78, t)), z: -0.10, pitch: 0.34, yaw: 0, roll: 0 }, spine: { pitch: 0.40, yaw: 0, roll: 0 }, head: { pitch: -0.25, yaw: 0, roll: 0 },
      footL: { p: [0.2, 0, 0.05], yaw: 0.35, knee: [0.5, 0, 1] }, footR: { p: [0.2, 0, 0.05], yaw: 0.35, knee: [0.5, 0, 1] },
      armL: A([D.x + 0.43, y + 0.26, D.z - 0.12], { space: 'world', pole: [0.9, -0.3, -0.5], twist: 0.0, flex: 0.5, fingers: 'cup' }), armR: A([D.x - 0.43, y + 0.26, D.z - 0.12], { space: 'world', pole: [0.9, -0.3, -0.5], twist: 0.0, flex: 0.5, fingers: 'cup' }), face: F('effort') });
    const proud = withFace(P.hips, F('smile'));
    const p = kp(t, [[0.86, carry], [1.22, proud, backOut]]);
    put(hero, { ...p, pos: DH, yaw: 0.05 }, t, 1, landed ? 0.6 : 0.2);
    if (landed) for (let i = 0; i < 6; i++) { const u = (t - 0.78) / 0.6; if (u < 1) { const a = i / 6 * TAU; const s = puffs[i]; s.visible = true; s.position.set(D.x + Math.cos(a) * (0.5 + u * 0.5), 0.12 + u * 0.18, D.z + Math.sin(a) * (0.5 + u * 0.5)); s.setSize(0.3 + u * 0.45); s.material.opacity = 0.75 * (1 - u); } }
    camMix([[D.x + 1.85, 0.95, D.z + 2.35], [D.x, 0.72, D.z - 0.3], 40], [[D.x + 1.6, 0.9, D.z + 2.2], [D.x, 0.75, D.z - 0.3], 40], smooth(t / 1.68));
    shake(t, 0.03 * (t > 0.78 ? Math.exp(-(t - 0.78) * 9) : 0));
    aimSun(D.x, 1, D.z, 5);
  });
  // 6b — pour water, flush
  drops.emit(0.86, [D.x, 0.46, D.z], [0, 1.5, 0], 1.6, 1.6, 26, 1, 0.6); drops.emit(1.05, [D.x, 0.46, D.z], [0, 1.5, 0], 1.9, 1.8, 30, 1, 0.65); drops.emit(1.3, [D.x, 0.46, D.z], [0, 1.4, 0], 1.5, 1.6, 24, 1, 0.6);
  S('6b', 13.80, 15.95, (t) => {
    show(hole.g, seat); seat.position.set(D.x, 0, D.z); seat.rotation.set(0, 0.34, 0);
    const tilt = smooth(lin(0.32, 0.72, t)) * (1 - smooth(lin(1.55, 1.9, t)));
    const bp = V3(D.x - 0.02, 1.02 - 0.04 * tilt, D.z + 0.16);
    show(bowl.g); bowl.g.position.copy(bp); bowl.g.rotation.set(-1.55 * tilt, 0, 0); bowl.water.visible = tilt < 0.75; bowl.water.scale.setScalar(1 - tilt * 0.4);
    const pour = pulse(0.62, 1.62, t, 0.12);
    if (pour > 0.02) { show(stream); const a = bp.clone().add(V3(0, -0.02 - 0.12 * tilt, -0.13 * tilt)); const b = V3(D.x, 0.34, D.z); PR.placeBetween(stream, a, b); stream.scale.set(pour * (1 + 0.15 * Math.sin(t * 40)), a.distanceTo(b), pour); }
    show(drops.m); drops.update(t);
    const p = deepMerge(P.digBase, { hips: { x: 0, y: -0.10, z: -0.05, pitch: 0.26, yaw: 0, roll: 0 }, spine: { pitch: 0.30, yaw: 0, roll: 0 }, head: { pitch: -0.05, yaw: 0, roll: 0.04 },
      footL: { p: [0.18, 0, 0.05], yaw: 0.3 }, footR: { p: [0.18, 0, 0.0], yaw: 0.3 },
      armR: A([bp.x - 0.10, bp.y + 0.03 + 0.07 * tilt, bp.z - 0.13 + 0.06 * tilt], { space: 'world', pole: [0.9, -0.5, -0.3], twist: 0.3 - 1.1 * tilt, flex: 0.3, fingers: 'cup' }), armL: A([0.30, 0.86, 0.22], { space: 'root', fingers: 'relax' }), face: F(t > 0.8 ? 'smile' : 'neutral', { eye: [0, -0.5] }) });
    put(hero, { ...p, pos: [D.x - 0.02, 0, D.z - 0.72], yaw: 0.05 }, t, 1, 0.3);
    camMix([[D.x + 1.2, 1.55, D.z + 1.85], [D.x - 0.02, 0.66, D.z + 0.02], 40], [[D.x + 1.0, 1.42, D.z + 1.6], [D.x - 0.02, 0.62, D.z + 0.02], 40], smooth(t / 2.15));
    aimSun(D.x, 1, D.z, 4);
  });
  // 6c — "but where does the water go?"
  S('6c', 15.95, 17.64, (t) => {
    show(hole.g, seat, puddle); seat.position.set(D.x, 0, D.z); seat.rotation.set(0, 0.34, 0);
    const s = lerp(0.5, 1.75, easeOut(t / 1.6)); puddle.scale.set(s * 1.15, s, 1); puddle.position.set(D.x + 0.15, 0.024, D.z + 0.25);
    const p = kp(t, [[0, withFace(P.hips, F('neutral', { eye: [0, -0.7] }))], [0.34, withFace(P.think, F('think')), smooth]]);
    const q = deepMerge(p, { head: { pitch: p.head.pitch + 0.16 * (1 - smooth(lin(0.5, 0.9, t))), yaw: p.head.yaw, roll: p.head.roll }, footL: { p: [0.13, 0, 0.02 + 0], yaw: 0.25, pitch: -0.3 * Math.max(0, Math.sin(t * 8)) * (t > 0.6 ? 1 : 0) } });
    put(hero, { ...q, pos: DH, yaw: 0.05 }, t, 1, 0.6);
    const hp = headPos(hero); if (t > 0.42) { show(qmark); qmark.position.set(hp.x + 0.30, hp.y + 0.34, hp.z); qmark.setSize(0.44 * backOut(lin(0.42, 0.66, t), 3)); qmark.material.rotation = 0.15 * Math.sin(t * 5) - 0.2; }
    camMix([[D.x + 0.95, 0.26, D.z + 2.15], [D.x - 0.05, 1.05, D.z - 0.6], 46], [[D.x + 0.8, 0.3, D.z + 1.95], [D.x - 0.05, 1.1, D.z - 0.6], 46], smooth(t / 1.69));
    aimSun(D.x, 1, D.z, 5);
  });
  // 7 — bamboo pipes
  const pipeC = (i) => D.clone().addScaledVector(pdir, 0.44 + i * PLEN + PLEN / 2);
  S('7', 17.64, 19.62, (t) => {
    show(hole.g, seat, puddle); seat.position.set(D.x, 0, D.z); seat.rotation.set(0, 0.34, 0); puddle.scale.set(1.75 * 1.15 * (1 - 0.6 * lin(0.9, 1.9, t)), 1.75 * (1 - 0.6 * lin(0.9, 1.9, t)), 1);
    const perp = V3(-pdir.z, 0, pdir.x);    // toward -Z side (behind the pipeline)
    const c1 = pipeC(1); const hpos = c1.clone().addScaledVector(perp, 0.62);
    const place = smooth(lin(0.62, 0.92, t)); const hy = lerp(1.18, 0.16, place);
    const appear = [0, 0.92, 1.12, 1.30, 1.46, 1.60, 1.72];
    pipes.forEach((p, i) => { const k = i === 0 ? 1 : i === 1 ? (place >= 1 ? 1 : 0) : backOut(lin(appear[i], appear[i] + 0.14, t), 2.5); p.visible = k > 0.01; p.scale.set(Math.max(0.01, k), 1, 1); p.userData.rest.visible = p.visible; });
    if (place < 1) { show(heldPipe); const s0 = D.clone().addScaledVector(pdir, 0.44 + PLEN); heldPipe.position.set(s0.x, hy, s0.z); heldPipe.rotation.set(0, Math.atan2(-pdir.z, pdir.x), 0.18 * (1 - place) * Math.sin(t * 3)); }
    const g1 = c1.clone().addScaledVector(pdir, -0.36), g2 = c1.clone().addScaledVector(pdir, 0.36);
    const hold = deepMerge(P.stand, { hips: { x: 0, y: -0.02 - 0.30 * place, z: -0.05 * place, pitch: 0.42 * place, yaw: 0, roll: 0 }, spine: { pitch: 0.42 * place, yaw: 0, roll: 0 }, head: { pitch: -0.1 - 0.2 * place, yaw: 0, roll: 0 },
      footL: { p: [0.17, 0, 0.04], yaw: 0.3, knee: [0.4, 0, 1] }, footR: { p: [0.17, 0, 0.0], yaw: 0.3, knee: [0.4, 0, 1] },
      armL: A([g1.x, hy + 0.09, g1.z - 0.02], { space: 'world', pole: [0.9, -0.5, -0.4], twist: 1.2, flex: 0.5, fingers: 'grip' }), armR: A([g2.x, hy + 0.09, g2.z - 0.02], { space: 'world', pole: [0.9, -0.5, -0.4], twist: 1.2, flex: 0.5, fingers: 'grip' }), face: F(t < 0.5 ? 'idea' : 'grin') });
    const done = withFace(deepMerge(P.pointL, { armL: A([0.42, 1.36, 0.30], { pole: [0.3, -1, -0.2], twist: -1.5, fingers: 'point' }), head: { pitch: 0, yaw: 0.35, roll: 0 } }), F('grin'));
    const p = kp(t, [[1.0, hold], [1.3, done, backOut]]);
    const yaw = Math.atan2(-perp.x, -perp.z);
    put(hero, { ...p, pos: [hpos.x, 0, hpos.z], yaw }, t, 1, 0.3);
    const hp = headPos(hero); if (t < 0.85) { show(bulb); bulb.position.set(hp.x, hp.y + 0.48, hp.z); bulb.setSize(0.52 * backOut(lin(0.02, 0.22, t), 3) * (1 - smooth(lin(0.7, 0.85, t)))); }
    camMix([[c1.x + 1.5, 1.05, c1.z + 3.6], [c1.x + 0.05, 1.22, c1.z - 0.5], 42], [[c1.x + 0.9, 0.85, c1.z + 4.0], [c1.x - 0.45, 1.0, c1.z - 0.7], 46], smooth(lin(0.6, 1.98, t)));
    aimSun(D.x - 3, 1, D.z, 9);
  });
  // 8a — the pipes run under the whole village (cutaway)
  S('8a', 19.62, 21.80, (t) => {
    backdrop.position.set(CX, 0, 0); show(cut.g); cut.update(t, lin(0.05, 1.25, t) * 1.05, t > 1.0 ? 1 : 0);
    put(hero, { ...withFace(P.hips, F('grin')), pos: [CX + 2.2, 0, -0.75], yaw: -0.1 }, t, 1);
    put(cast[4], { ...withFace(P.present, F('awe')), pos: [CX - 2.15, 0, -0.8], yaw: 0.2 }, t, 6);
    camMix([[CX + 0.6, -0.9, 27.5], [CX, -2.6, 0], 46], [[CX - 0.3, -1.3, 23.5], [CX, -2.9, 0], 46], smooth(t / 2.18));
    aimSun(CX, 0, -3, 16);
  });
  // 8b — Congrats! you just invented the sewer
  const CEL = [-5.2, 0, 3.6];
  confetti.emit(0.18, [CEL[0] - 0.9, 2.4, CEL[2] - 0.7], [0.4, 0.8, -0.2], 2.4, 1.8, 60, 1, 2.4); confetti.emit(0.26, [CEL[0] + 0.9, 2.4, CEL[2] - 0.7], [-0.4, 0.8, -0.2], 2.4, 1.8, 60, 1, 2.4);
  S('8b', 21.80, 24.34, (t) => {
    show(hole.g, seat); seat.position.set(D.x, 0, D.z); pipes.forEach(p => { p.visible = true; p.scale.set(1, 1, 1); p.userData.rest.visible = true; });
    const jump = (t0) => { const u = (t - t0) / 0.52; return u > 0 && u < 1 ? Math.sin(u * Math.PI) * 0.34 : 0; };
    const j = jump(0.14) + jump(0.84) * 0.7;
    const base = kp(t, [[0, withFace(P.crouchJump, F('grin'))], [0.16, withFace(P.cheer, F('joy')), backOut], [0.70, withFace(P.crouchJump, F('joy'))], [0.90, withFace(P.cheer, F('joy')), backOut], [1.5, withFace(P.cheer, F('joy'))], [1.85, withFace(deepMerge(P.thumb, { armL: A([0.30, 1.72, 0.14], { pole: [1, -0.2, -0.3], fingers: 'fist' }) }), F('grin')), backOut]]);
    const pump = t > 1.9 ? 0.06 * Math.sin((t - 1.9) * 16) : 0;
    const p = deepMerge(base, { footL: { p: [0.13, j * 0.55, 0.02], yaw: 0.25, pitch: j > 0.02 ? 0.5 : 0 }, footR: { p: [0.13, j * 0.55, -0.02], yaw: 0.25, pitch: j > 0.02 ? 0.5 : 0 } });
    if (t > 1.9) p.armL = { ...p.armL, p: [0.30, 1.72 + pump, 0.14] };
    put(hero, { ...p, pos: [CEL[0], j, CEL[2]], yaw: 0.12 }, t, 1, 0.4);
    show(confetti.m); confetti.update(t);
    for (let i = 0; i < 8; i++) spark(i, [CEL[0] + 1.1 * Math.cos(i * 2.4 + 1), 1.5 + 0.9 * Math.sin(i * 1.7), CEL[2] + 0.2 * Math.sin(i)], 0.34 * pulse(0.15, 2.3, t, 0.2), t + i, 9);
    const a = -0.45 + 0.5 * smooth(t / 2.54);
    cam([CEL[0] + Math.sin(a) * 3.6, 0.42, CEL[2] + Math.cos(a) * 3.6], [CEL[0], 1.42, CEL[2]], 46);
    aimSun(CEL[0], 1, CEL[2], 7);
  });
  // 9 — now everyone wants one
  S('9', 24.34, 26.06, (t) => {
    show(hole.g, seat); seat.position.set(D.x, 0, D.z); seat.rotation.set(0, 0.34, 0); pipes.forEach(p => { p.visible = true; p.scale.set(1, 1, 1); p.userData.rest.visible = true; });
    const spots = [[0.30, -1.15], [-0.34, -2.0], [0.42, -2.9], [-0.30, -3.8], [0.36, -4.7]];
    cast.forEach((c, i) => {
      const [dx, dz] = spots[i]; const arrive = backOut(lin(i * 0.06, i * 0.06 + 0.32, t), 1.2);
      const hop = Math.abs(Math.sin((t + i * 0.23) * 7.5)) * 0.07 * (i % 2 ? 1 : 0.6);
      const b = i % 2 ? P.pointL : P.point; const fp = deepMerge(b, { face: F(i % 3 === 0 ? 'awe' : i % 3 === 1 ? 'joy' : 'idea'), spine: { pitch: 0.20, yaw: b.spine.yaw, roll: 0 }, head: { pitch: 0.12, yaw: 0, roll: 0 }, footL: { p: [0.12, hop, 0.03], yaw: 0.2 }, footR: { p: [0.12, hop, -0.03], yaw: 0.2 } });
      const key = i % 2 ? 'armL' : 'armR'; fp[key] = { ...fp[key], p: [0.10, 1.20 + 0.04 * Math.sin(t * 9 + i), 0.50] };
      const x = D.x + dx, z = D.z + dz - (1 - arrive) * 1.2;
      put(c, { ...fp, pos: [x, hop, z], yaw: Math.atan2(D.x - x, D.z - z) }, t + i, i + 2, 0.5);
    });
    camMix([[D.x + 1.25, 2.75, D.z + 3.3], [D.x - 0.02, 0.95, D.z - 1.9], 44], [[D.x + 1.05, 2.6, D.z + 3.0], [D.x - 0.02, 1.0, D.z - 1.9], 44], smooth(t / 1.72));
    aimSun(D.x, 1, D.z - 2, 8);
  });
  // 10a — a real toilet: the door swings open
  S('10a', 26.06, 28.04, (t) => {
    show(toilet.g, glow); const open = backOut(lin(0.30, 0.95, t), 1.1); hut.door.rotation.y = -1.95 * open;
    inLight.visible = true; inLight.intensity = 4.5 * smooth(lin(0.3, 0.8, t)); glow.material.opacity = 0.30 * smooth(lin(0.35, 0.9, t)) * (0.85 + 0.15 * Math.sin(t * 9));
    const p = kp(t, [[0.1, withFace(P.hips, F('smirk'))], [0.42, withFace(P.tada, F('grin')), backOut]]);
    put(hero, { ...p, pos: [T.x + 0.98, 0, T.z + 2.2], yaw: -0.5 }, t, 1);
    if (t > 0.5) for (let i = 0; i < 10; i++) spark(i, [T.x + 0.42 * Math.cos(i * 2.2), 0.55 + 0.75 * ((i * 0.37 + t * 0.25) % 1), T.z + 0.9 + 0.2 * Math.sin(i * 1.3)], 0.30 * smooth(lin(0.5, 0.8, t)), t + i * 0.6, 8);
    camMix([[T.x + 0.3, 1.5, T.z + 9.4], [T.x + 0.25, 1.42, T.z], 34], [[T.x + 0.3, 1.3, T.z + 7.6], [T.x + 0.25, 1.15, T.z], 34], easeInOut(t / 1.98));
    aimSun(T.x, 1, T.z + 2, 8);
  });
  const TWp = [TW.x, TW.y, TW.z];
  // 10b — White.
  S('10b', 28.04, 28.74, (t) => {
    interior(true); show(toilet.g);
    camMix([[TW.x + 0.5, 0.92, TW.z + 2.3], [TW.x, 0.52, TW.z - 0.05], 36], [[TW.x + 0.38, 0.86, TW.z + 1.9], [TW.x, 0.52, TW.z - 0.05], 36], easeOut(t / 0.7));
    for (let i = 0; i < 5; i++) spark(i, [TW.x + 0.3 * Math.cos(i * 2.6), 0.4 + 0.5 * ((i * 0.41) % 1), TW.z + 0.25 * Math.sin(i * 2)], 0.22, t * 1.4 + i, 9);
    aimSun(TW.x, 0.6, TW.z, 3);
  });
  // 10c — Shiny.
  S('10c', 28.74, 29.68, (t) => {
    interior(true); show(toilet.g);
    camMix([[TW.x - 1.25, 1.12, TW.z + 1.55], [TW.x + 0.0, 0.62, TW.z - 0.14], 32], [[TW.x - 1.12, 1.06, TW.z + 1.38], [TW.x + 0.0, 0.64, TW.z - 0.16], 32], smooth(t / 0.94));
    const st = (i, p, size, ph) => { const s2 = stars[i]; s2.visible = true; s2.position.set(p[0], p[1], p[2]); const k = Math.max(0, Math.sin(clamp((t - ph) / 0.55) * Math.PI)); s2.setSize(size * k); s2.material.rotation = t * 2.2 + i; };
    st(0, [TW.x - 0.20, 0.90, TW.z - 0.27], 0.46, 0.04); st(1, [TW.x - 0.10, 0.50, TW.z + 0.26], 0.26, 0.26); st(2, [TW.x + 0.18, 0.72, TW.z - 0.22], 0.2, 0.42); st(3, [TW.x - 0.22, 0.34, TW.z + 0.06], 0.16, 0.5);
    aimSun(TW.x, 0.6, TW.z, 3);
  });
  // 10d — Beautiful. (he admires it)
  S('10d', 29.68, 30.80, (t) => {
    show(toilet.g); hut.door.rotation.y = -1.95; hut.roof.visible = false; hut.left.castShadow = false; hut.right.castShadow = false; inLight.visible = true; inLight.intensity = 3.5; sun.intensity = 1.9; hemi.intensity = 1.25;
    const p = kp(t, [[0, withFace(P.stand, F('awe'))], [0.22, withFace(P.awe, F('awe')), backOut]]);
    put(hero, { ...p, pos: [TW.x, 0.06, TW.z + 1.02], yaw: Math.PI, head: { pitch: 0.16, yaw: 0, roll: 0.14 + 0.03 * Math.sin(t * 3) } }, t, 1, 0.5);
    const hp = headPos(hero);
    camMix([[TW.x + 0.16, 1.16, TW.z - 0.10], [hp.x, hp.y - 0.16, hp.z], 40], [[TW.x + 0.14, 1.2, TW.z + 0.02], [hp.x, hp.y - 0.15, hp.z], 40], smooth(t / 1.12));
    for (let i = 0; i < 4; i++) { const h = hearts[i]; const u = ((t * 0.8 + i * 0.27) % 1); if (t > 0.2) { h.visible = true; h.position.set(hp.x + (i - 1.5) * 0.17 + 0.03 * Math.sin(t * 5 + i), hp.y + 0.12 + u * 0.36, hp.z - 0.12); h.setSize(0.11 * Math.sin(u * Math.PI)); } }
    spark(0, [hp.x - 0.24, hp.y + 0.10, hp.z - 0.15], 0.2, t * 2, 9); spark(1, [hp.x + 0.26, hp.y - 0.05, hp.z - 0.15], 0.17, t * 2 + 2, 9);
    aimSun(TW.x, 1, TW.z + 0.6, 4);
  });
  // 11a — heated seat
  S('11a', 30.80, 32.36, (t) => {
    interior(true); show(toilet.g); const heat = smooth(lin(0.60, 0.80, t)); upgrades(2.6 * heat * (0.85 + 0.15 * Math.sin(t * 10)), 0, 0, 0);
    toilet.seat.scale.set(1, 1.28, 0.5 * (1 + 0.5 * Math.sin(clamp((t - 0.6) / 0.22) * Math.PI)));
    camMix([[TW.x + 0.86, 1.02, TW.z + 1.15], [TW.x, 0.52, TW.z + 0.0], 36], [[TW.x + 0.76, 0.96, TW.z + 1.02], [TW.x, 0.55, TW.z + 0.0], 36], smooth(t / 1.56));
    if (heat > 0.05) stinkAt(TW.x, 0.52, TW.z + 0.02, t * 1.2, 0.62 * heat, 3, ribs.heat, 0.018);
    aimSun(TW.x, 0.6, TW.z, 3);
  });
  // 11b — bluetooth speaker
  S('11b', 32.36, 33.70, (t) => {
    interior(true); show(toilet.g); upgrades(2.2, 1, 0, 0);
    const k = backOut(lin(0.10, 0.30, t), 3); const beat = 1 + 0.07 * Math.abs(Math.sin(t * 11)) * (t > 0.35 ? 1 : 0); speaker.scale.set(0.72 * k * beat, 0.72 * k * (2 - beat), 0.72 * k * beat);
    const sp = speaker.getWorldPosition(V3());
    camMix([[sp.x - 0.55, sp.y + 0.36, sp.z + 0.98], [sp.x + 0.06, sp.y + 0.22, sp.z], 36], [[sp.x - 0.48, sp.y + 0.34, sp.z + 0.86], [sp.x + 0.06, sp.y + 0.24, sp.z], 36], smooth(t / 1.34));
    notes.forEach((n, i) => { const u = ((t - 0.34) * 0.75 + i * 0.22); if (t > 0.34 + i * 0.1) { const v = u % 1; n.visible = true; n.position.set(sp.x + 0.14 * Math.sin(v * 7 + i * 2) + (i - 2) * 0.07, sp.y + 0.26 + v * 0.55, sp.z + 0.06); n.setSize(0.15 * Math.sin(Math.min(1, v * 1.2) * Math.PI) + 0.01); n.material.rotation = 0.3 * Math.sin(v * 9 + i); } });
    aimSun(TW.x, 0.9, TW.z, 3);
  });
  // 11c — a little shelf for your phone
  S('11c', 33.70, 35.80, (t) => {
    interior(true); show(toilet.g); upgrades(2.2, 1, 1, 0); speaker.scale.setScalar(0.72 * (1 + 0.04 * Math.abs(Math.sin(t * 11))));
    const k = backOut(lin(0.30, 0.52, t), 3); shelf.scale.setScalar(Math.max(0.001, k));
    const sp = shelf.getWorldPosition(V3());
    const land = 1.30; const fall = t < land ? lerp(1.3, 0, easeIn(lin(0.95, land, t))) : 0.05 * Math.abs(Math.sin((t - land) * 22)) * Math.exp(-(t - land) * 9);
    if (t > 0.95) { show(phone.g); phone.g.matrixAutoUpdate = true; phone.g.position.set(sp.x + 0.02, sp.y + 0.105 + fall, sp.z + 0.085); phone.g.rotation.set(-0.22, 0, 0.0 + (t < land ? (land - t) * 5 : 0)); phone.tex.offset.y = 0.1; phone.glow.intensity = t > land ? 0.5 : 0; }
    if (t > land && t < land + 0.5) spark(0, [sp.x + 0.02, sp.y + 0.2, sp.z + 0.14], 0.5 * Math.sin((t - land) / 0.5 * Math.PI), 0.3, 0);
    notes.slice(0, 3).forEach((n, i) => { const v = ((t * 0.7 + i * 0.33) % 1); n.visible = true; const q = speaker.getWorldPosition(V3()); n.position.set(q.x + 0.12 * Math.sin(v * 7 + i * 2) - 0.12, q.y + 0.22 + v * 0.4, q.z + 0.06); n.setSize(0.11 * Math.sin(v * Math.PI) + 0.01); });
    stinkAt(TW.x, 0.52, TW.z + 0.02, t * 1.2, 0.5, 3, ribs.heat, 0.014);
    camMix([[TW.x + 0.35, 1.22, TW.z + 2.55], [TW.x, 1.02, TW.z - 0.3], 40], [[TW.x + 0.22, 1.28, TW.z + 2.15], [TW.x, 1.10, TW.z - 0.3], 40], smooth(t / 2.1));
    aimSun(TW.x, 1, TW.z, 3.5);
  });
  const sitScene = (t, T, heatRib = true) => { interior(true); show(toilet.g); upgrades(2.2, 1, 1, 1); clock.g.position.set(0.44, 1.98, -PR.HUT.D / 2 + PR.HUT.T + 0.04); speaker.scale.setScalar(0.72); shelf.scale.setScalar(1); clock.minute.rotation.z = -T * 13; clock.hour.rotation.z = -T * 13 / 12 * 3; };
  // 12p — "And now?" he sits down
  S('12p', 35.80, 36.66, (t, T) => {
    sitScene(t, T);
    const st = deepMerge(P.stand, { armR: A([0.20, 1.02, 0.22], { pole: [0.8, -0.5, -0.4], twist: 1.2, flex: 0.4, fingers: 'phone' }), face: F('smirk') });
    const p = kp(t, [[0.06, st], [0.50, withFace(P.sit, F('content')), easeInOut]]);
    const sitK = smooth(lin(0.06, 0.5, t)); const z = lerp(SIT[2] + 0.30, SIT[2], sitK);
    const q = deepMerge(p, { footL: { p: [0.18, 0.06, lerp(0.1, 0.40, sitK) + (SIT[2] - z)], yaw: 0.14, knee: [0.26, 0.3, 1] }, footR: { p: [0.18, 0.06, lerp(0.1, 0.40, sitK) + (SIT[2] - z)], yaw: 0.14, knee: [0.26, 0.3, 1] }, hips: { ...p.hips, y: p.hips.y + (t > 0.5 ? -0.03 * Math.exp(-(t - 0.5) * 10) * Math.cos((t - 0.5) * 24) : 0) } });
    put(hero, { ...q, pos: [SIT[0], 0, z], yaw: 0 }, t, 1, 0.3); phoneInHand(hero, t, sitK);
    camMix([[TW.x + 0.3, 1.25, TW.z + 3.5], [TW.x, 1.0, TW.z], 42], [[TW.x + 0.2, 1.15, TW.z + 3.2], [TW.x, 0.95, TW.z], 42], smooth(t / 0.86));
    aimSun(TW.x, 1, TW.z, 3.5);
  });
  const scrollPose = (t, f = 'content') => {
    const flick = Math.max(0, Math.sin(t * 5.2)); const p = deepMerge(P.sit, { face: F(f, { eye: [0.05, -0.55 + 0.12 * Math.sin(t * 2.6)] }) });
    p.armR = { ...p.armR, fingers: { c: [0.46, 0.5, 0.52, 0.55], s: 0.02, t: 0.18 + 0.5 * flick, to: 0.25 + 0.35 * flick } };
    return p;
  };
  // 12a — 45 minutes: the stone clock spins
  S('12a', 36.66, 39.06, (t, T) => {
    sitScene(t, T); put(hero, { ...scrollPose(t), pos: SIT, yaw: 0 }, t, 1, 0.5); phoneInHand(hero, t);
    hemi.intensity = lerp(1.2, 0.95, smooth(t / 2.4)); sun.intensity = lerp(1.85, 1.45, smooth(t / 2.4));
    camMix([[TW.x + 0.12, 1.3, TW.z + 3.5], [TW.x + 0.05, 1.22, TW.z - 0.3], 42], [[TW.x + 0.05, 1.3, TW.z + 3.05], [TW.x + 0.05, 1.24, TW.z - 0.3], 42], smooth(t / 2.4));
    aimSun(TW.x, 1, TW.z, 3.5);
  });
  // 12b — scrolling (over the shoulder)
  S('12b', 39.06, 40.20, (t, T) => {
    sitScene(t, T); put(hero, { ...scrollPose(t + 2.4), pos: SIT, yaw: 0 }, t + 2.4, 1, 0.3); phoneInHand(hero, t + 2.4, 1.9);
    hemi.intensity = 0.95; sun.intensity = 1.45;
    const hp = headPos(hero);
    camMix([[SIT[0] - 0.40, 0.84, SIT[2] + 1.08], [hp.x, hp.y - 0.20, hp.z], 36], [[SIT[0] - 0.34, 0.86, SIT[2] + 0.98], [hp.x, hp.y - 0.19, hp.z], 36], smooth(t / 1.14));
    aimSun(TW.x, 1, TW.z, 3);
  });
  // 12c — legs completely numb
  S('12c', 40.20, 41.94, (t, T) => {
    sitScene(t, T); hemi.intensity = 0.95; sun.intensity = 1.45;
    const sh = (s) => 0.022 * noise3(t * 26, s, 0.5) * smooth(lin(0, 0.3, t));
    const p = deepMerge(scrollPose(t + 3.6, 'nervous'), { head: { pitch: 0.46, yaw: 0, roll: 0 }, footL: { p: [0.18 + sh(1), 0.06 + Math.abs(sh(2)) * 0.8, 0.40 + sh(3)], yaw: 0.14, knee: [0.26 + 8 * sh(4), 0.3, 1] }, footR: { p: [0.18 + sh(5), 0.06 + Math.abs(sh(6)) * 0.8, 0.40 + sh(7)], yaw: 0.14, knee: [0.26 + 8 * sh(8), 0.3, 1] } });
    put(hero, { ...p, pos: SIT, yaw: 0 }, t, 1, 0.2); phoneInHand(hero, t);
    zaps.forEach((z, i) => { const on = Math.sin(t * 17 + i * 2.3) > 0.1; if (on) { z.visible = true; const sd = i % 2 ? 1 : -1; z.position.set(SIT[0] + sd * (0.20 + 0.10 * ((i * 0.37) % 1)) + 0.05 * Math.sin(i * 9), 0.14 + 0.42 * ((i * 0.53 + Math.floor(t * 6) * 0.31) % 1), SIT[2] + 0.50 + 0.1 * Math.sin(i * 5)); z.setSize(0.15 + 0.05 * Math.sin(i * 3)); z.material.rotation = (i % 2 ? 1 : -1) * 0.5 + 0.3 * Math.sin(i * 7); } });
    camMix([[TW.x + 0.95, 0.30, TW.z + 2.05], [TW.x, 0.50, TW.z + 0.28], 44], [[TW.x + 0.8, 0.28, TW.z + 1.85], [TW.x, 0.52, TW.z + 0.28], 44], smooth(t / 1.74));
    aimSun(TW.x, 0.6, TW.z, 3);
  });
  // 13a — the whole tribe waits outside
  S('13a', 41.94, 43.98, (t, T) => {
    queue(t, T); const b = bangPose(t, [1.25, 1.6, 1.95]); put(cast[0], withFace(b.pose, F('angry')), t, 2, 0.2); hut.door.rotation.y = 0.03 * b.k * Math.sin(t * 70);
    camMix([[7.9, 4.7, 17.6], [9.35, 1.65, 6.4], 44], [[8.1, 4.3, 16.5], [9.35, 1.65, 6.2], 44], smooth(t / 2.04));
    aimSun(9, 1, 8, 13);
  });
  // 13b — banging on the door
  const hits13 = [0.10, 0.40, 0.70, 1.00, 1.28];
  S('13b', 43.98, 45.40, (t, T) => {
    queue(t, T); const b = bangPose(t, hits13); put(cast[0], withFace(b.pose, F('shout', { mouth: { open: 0.5 } })), t, 2, 0.2);
    let rattle = 0; hits13.forEach((h, i) => { const dt = t - h - 0.02; if (dt > 0 && dt < 0.25) { rattle = Math.max(rattle, Math.exp(-dt * 14)); const s = bangs[i % 2]; s.visible = true; s.position.set(9.18, 1.52, 3.46); s.setSize(0.62 * Math.sin(Math.min(1, dt / 0.2) * Math.PI) + 0.05); s.material.rotation = i * 0.7; } });
    hut.door.rotation.y = 0.05 * rattle * Math.sin(t * 90); hut.door.position.z = PR.HUT.D / 2 - 0.02 - 0.02 * rattle;
    camMix([[11.1, 1.55, 5.75], [9.05, 1.38, 3.75], 38], [[10.8, 1.5, 5.5], [9.05, 1.4, 3.72], 38], smooth(t / 1.42)); shake(t, 0.022 * rattle);
    aimSun(9, 1, 5, 7);
  });
  // 14 — "GRUG! Are you done?"
  S('14', 45.40, 47.08, (t, T) => {
    queue(t, T); hut.g.visible = false;
    const b = bangPose(t, [0.02, 0.62, 0.86, 1.1]);
    const mo = talk(T, [[45.40, 45.78, 1], [45.98, 46.12, 1], [46.12, 46.26, 1], [46.26, 46.56, 1]], 1.15);
    const fc = F('shout', { mouth: { open: 0.12 + mo, smile: -0.5, wide: 1.1 }, lid: 1.1 });
    put(cast[0], withFace(deepMerge(b.pose, { head: { pitch: -0.06 - 0.08 * mo, yaw: 0, roll: 0.05 * Math.sin(t * 12) }, spine: { pitch: 0.16, yaw: 0, roll: 0 } }), fc), t, 2, 0.2);
    const hp = headPos(cast[0]);
    camMix([[hp.x - 0.34, hp.y - 0.16, hp.z - 1.50], [hp.x + 0.02, hp.y - 0.21, hp.z], 40], [[hp.x - 0.28, hp.y - 0.16, hp.z - 1.28], [hp.x + 0.02, hp.y - 0.20, hp.z], 40], easeOut(t / 0.5)); shake(t, 0.008 * mo);
    aimSun(9, 1, 6, 9); sun.position.set(9 - 16, 34, 4.2 - 24); fill.position.set(9 + 14, 10, -8);
  });
  // 15 — "Five more minutes!"
  S('15', 47.08, 48.56, (t, T) => {
    sitScene(t, T); hemi.intensity = 1.1; sun.intensity = 1.7;
    const mo = talk(T, [[47.14, 47.34, 1], [47.34, 47.58, 1], [47.58, 47.92, 2]], 0.6);
    const p = kp(t, [[0.0, scrollPose(t, 'content')], [0.22, deepMerge(P.sitFive, { armR: scrollPose(t).armR, face: F('smile', { eye: [0.05, -0.5], lid: 0.6, mouth: { smile: 0.75, open: 0.08 + mo } }) }), backOut], [1.05, deepMerge(P.sitFive, { armR: scrollPose(t).armR, face: F('smile', { eye: [0.05, -0.5], lid: 0.6, mouth: { smile: 0.75, open: 0.08 + mo } }) })], [1.36, scrollPose(t, 'content')]]);
    put(hero, { ...p, pos: SIT, yaw: 0 }, t, 1, 0.4); phoneInHand(hero, t);
    camMix([[TW.x + 0.92, 1.22, TW.z + 2.0], [TW.x + 0.02, 1.02, TW.z + 0.12], 40], [[TW.x + 0.8, 1.2, TW.z + 1.8], [TW.x + 0.02, 1.05, TW.z + 0.12], 40], smooth(t / 1.48));
    aimSun(TW.x, 1, TW.z, 3.5);
  });
  // 16a — looks into the camera and points at the viewer
  S('16a', 48.56, 50.56, (t) => {
    const wk = lin(0, 0.62, t); const ph = wk * 1.5; const z = H0[2] - 0.9 + 0.9 * smooth(wk);
    const w = walkArms(ph, walk(ph, 0.36, withFace(P.stand, F('smile'))));
    const pt = withFace(deepMerge(P.point, { armL: A([0.232, 1.045, 0.0], { pole: [1, 0.15, -0.75], twist: -1.25, flex: 0.55 }), spine: { pitch: 0.12, yaw: 0.14, roll: 0 } }), F('grin', { browL: [0.8, -0.1], browR: [0.3, 0] }));
    const p = kp(t, [[0.50, w], [0.86, pt, backOut]]);
    const jab = t > 0.86 ? 0.03 * Math.sin((t - 0.86) * 9) * Math.exp(-(t - 0.86) * 1.2) : 0; if (t > 0.86) p.armR = { ...p.armR, p: [0.10, 1.40, 0.53 + jab] };
    put(hero, { ...p, pos: [H0[0], 0, z], yaw: 0 }, t, 1, 0.5);
    camMix([[H0[0] + 0.12, 1.50, H0[2] + 2.3], [H0[0], 1.42, H0[2]], 34], [[H0[0] + 0.1, 1.5, H0[2] + 2.0], [H0[0], 1.44, H0[2]], 34], smooth(t / 2.0));
    aimSun(H0[0], 1, H0[2], 4);
  });
  // 16b — tell me in the comments / follow for more
  S('16b', 50.56, 52.81, (t) => {
    const bob = 0.035 * Math.sin(t * 11) * pulse(0.1, 1.05, t, 0.1);
    const dn = withFace(P.pointDown, F('grin'));
    const d2 = deepMerge(dn, { armR: A([0.15, 1.10 + bob, 0.36]), armL: A([0.15, 1.10 + bob, 0.36]) });
    const wink = pulse(1.42, 1.78, t, 0.08);
    const th = withFace(P.thumb, F('grin', { squint: 0.6 }));
    const p = kp(t, [[0.0, withFace(P.point, F('grin'))], [0.20, d2, backOut], [1.14, d2], [1.42, th, backOut]]);
    const hp0 = [H0[0], 0, H0[2]];
    put(hero, { ...p, pos: hp0, yaw: 0.0 }, t, 1, 0.5);
    if (wink > 0.01) { hero.head.eyes[0].lidU.rotation.x = lerp(hero.head.eyes[0].lidU.rotation.x, 0.16, wink); hero.head.eyes[0].lidL.rotation.x = lerp(hero.head.eyes[0].lidL.rotation.x, -0.14, wink); hero.head.eyes[0].glint.visible = wink < 0.5; }
    const hp = headPos(hero); if (t > 1.5) spark(0, [hp.x + 0.34, hp.y + 0.02, hp.z + 0.2], 0.4 * Math.sin(clamp((t - 1.5) / 0.5) * Math.PI), 0.3, 0);
    camMix([[H0[0] + 0.75, 1.30, H0[2] + 2.05], [H0[0], 1.36, H0[2]], 34], [[H0[0] + 0.55, 1.36, H0[2] + 1.8], [H0[0], 1.42, H0[2]], 34], smooth(t / 2.2));
    aimSun(H0[0], 1, H0[2], 4);
  });

  const TOTAL = 52.8;
  function update(Tm) {
    const Tt = clamp(Tm, 0, TOTAL - 1e-4);
    dyn.forEach(o => { o.visible = false; }); chars.forEach(c => { c.root.visible = false; });
    backdrop.position.set(0, 0, 0); hut.g.visible = true; hut.front.visible = true; hut.roof.visible = true; hut.door.visible = true; hut.left.castShadow = true; hut.right.castShadow = true;
    hut.door.rotation.y = 0; hut.door.position.z = PR.HUT.D / 2 - 0.02; inLight.intensity = 0; inLight.visible = false; glow.material.opacity = 0; toilet.seatMat.emissiveIntensity = 0; toilet.seat.scale.set(1, 1.28, 0.5); toilet.lid.visible = true;
    phone.g.matrixAutoUpdate = true; phone.glow.intensity = 0; hemi.intensity = 1.55; sun.intensity = 2.7; camera.up.set(0, 1, 0);
    const sh = shots.find(s => Tt >= s.t0 && Tt < s.t1) || shots[shots.length - 1];
    sh.fn(Tt - sh.t0, Tt);
    // clouds drift
    const cl = backdrop.userData.clouds; if (cl) cl.rotation.y = Tt * 0.004;
    return sh.id;
  }
  return { update, shots, TOTAL, hero, cast, P, put, cam, headPos };
}
