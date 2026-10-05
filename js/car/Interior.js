// The car cabin, modelled procedurally in car-local space
// (origin on the ground at the car centre, -Z forward, +Y up).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { CAR, LAYER } from '../config.js';
import { interiorMaterials } from './materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function rbox(w, h, d, r, mat, segs = 3) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function surface(fn, nu, nv, mat) {
  const g = new ParametricGeometry(fn, nu, nv);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Mesh aligned from p0 to p1 (geometry built along +Y with given length). */
function between(geoFn, p0, p1, mat) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const m = new THREE.Mesh(geoFn(len), mat);
  m.position.copy(p0).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const capsule = (p0, p1, r, mat) => between((len) => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 12), p0, p1, mat);
const rod = (p0, p1, r, mat, sides = 8) => between((len) => new THREE.CylinderGeometry(r, r, len, sides), p0, p1, mat);

export class Interior {
  constructor(envMap) {
    this.group = new THREE.Group();
    this.group.name = 'interior';
    this.m = interiorMaterials(envMap);
    this.wipers = [];
    this.animated = {};
    this._buildDash();
    this._buildWheel();
    this._buildSeats();
    this._buildConsole();
    this._buildDoors();
    this._buildPillarsAndRoof();
    this._buildFloorAndRear();
    this._buildExterior();
    this._buildPlayer();
    this._buildFreshener();
    this.group.traverse((o) => {
      if (o.isMesh && !o.userData.keepLayer) o.layers.set(LAYER.INTERIOR);
    });
  }

  add(o, parent = this.group) {
    parent.add(o);
    return o;
  }

  _buildDash() {
    const m = this.m;
    // Upper dash: from the cabin-side edge up to the windshield base, with the
    // instrument hood rising in front of the driver.
    const top = surface((u, v, t) => {
      const x = -0.8 + 1.6 * u;
      const side = Math.abs(x) / 0.8;
      const z = -0.7 - 0.38 * v - 0.04 * side * side;
      const hood = 0.045 * Math.exp(-(((x + 0.38) / 0.17) ** 2)) * Math.max(0, 1 - v * 1.6);
      const y = 0.972 - 0.022 * v + 0.012 * Math.sin(v * Math.PI) + hood - 0.02 * side * side;
      t.set(x, y, z);
    }, 48, 10, m.dash);
    top.name = 'dash-top';
    this.add(top);

    // Dash face: rounded leading edge then down toward the footwells.
    const face = surface((u, v, t) => {
      const x = -0.8 + 1.6 * u;
      const side = Math.abs(x) / 0.8;
      const a = v * Math.PI * 0.5;
      const r = 0.05;
      let y;
      let z;
      if (v < 0.25) {
        const k = v / 0.25;
        y = 0.972 - r + Math.cos(k * Math.PI * 0.5) * r;
        z = -0.7 + Math.sin(k * Math.PI * 0.5) * r;
      } else {
        const k = (v - 0.25) / 0.75;
        y = 0.922 - 0.4 * k;
        z = -0.65 + 0.06 * k - 0.025 * Math.sin(k * Math.PI);
      }
      void a;
      // Recess for the cluster behind the wheel.
      const recess = 0.06 * Math.exp(-(((x + 0.38) / 0.16) ** 2)) * Math.exp(-(((y - 0.89) / 0.06) ** 2));
      t.set(x, y, z - recess - 0.04 * side * side);
    }, 48, 14, m.dash);
    face.geometry.index.array.reverse();
    face.geometry.computeVertexNormals();
    face.name = 'dash-face';
    this.add(face);

    // Satin trim strip and a soft ambient light line across the passenger side.
    const trim = rbox(0.62, 0.028, 0.02, 0.008, m.satin);
    trim.position.set(0.42, 0.83, -0.645);
    this.add(trim);
    const ambient = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.004, 0.004),
      new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff9a4a, emissiveIntensity: 3 }),
    );
    ambient.position.set(0.42, 0.812, -0.64);
    this.add(ambient);
    this.ambientStrips = [ambient];

    // Centre stack with the navigation screen and vents.
    const stack = rbox(0.32, 0.4, 0.08, 0.02, m.piano);
    stack.position.set(0, 0.74, -0.665);
    stack.rotation.x = -0.12;
    this.add(stack);
    this.screenAnchor = new THREE.Object3D();
    this.screenAnchor.position.set(0, 0.865, -0.622);
    this.screenAnchor.rotation.x = -0.16;
    this.add(this.screenAnchor);
    const bezel = rbox(0.27, 0.16, 0.012, 0.006, m.plastic);
    bezel.position.set(0, 0, -0.006);
    this.screenAnchor.add(bezel);

    const vent = (x, y, z, w = 0.12, h = 0.045, ry = 0) => {
      const g = new THREE.Group();
      const frame = rbox(w, h, 0.02, 0.008, m.satin);
      g.add(frame);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.012, h - 0.01), m.rubber);
      back.position.z = 0.006;
      g.add(back);
      for (let i = 0; i < 4; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.014, 0.003, 0.012), m.plastic);
        slat.position.set(0, -h / 2 + (i + 0.8) * (h / 4.6), 0.01);
        slat.rotation.x = 0.35;
        g.add(slat);
      }
      g.position.set(x, y, z);
      g.rotation.y = ry;
      this.add(g);
    };
    vent(-0.05, 0.765, -0.615, 0.08);
    vent(0.05, 0.765, -0.615, 0.08);
    vent(-0.72, 0.88, -0.66, 0.1, 0.06, 0.25);
    vent(0.72, 0.88, -0.66, 0.1, 0.06, -0.25);
    // Climate knobs and hazard button.
    for (const x of [-0.09, 0.09]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 24), m.satin);
      knob.rotation.x = Math.PI / 2 - 0.12;
      knob.position.set(x, 0.69, -0.618);
      this.add(knob);
    }
    const hazard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, 0.01), new THREE.MeshStandardMaterial({ color: 0x200404, emissive: 0xff2010, emissiveIntensity: 0.6 }));
    hazard.position.set(0, 0.715, -0.616);
    this.add(hazard);
    this.hazardButton = hazard;

    // Instrument cluster anchor (Dashboard puts the dials here).
    this.clusterAnchor = new THREE.Object3D();
    this.clusterAnchor.position.set(-0.38, 0.885, -0.712);
    this.clusterAnchor.rotation.x = -0.1;
    this.add(this.clusterAnchor);

    // Lower dash: knee panels and steering column shroud.
    const knee = rbox(1.5, 0.18, 0.1, 0.04, m.plastic);
    knee.position.set(0, 0.5, -0.6);
    this.add(knee);
    const shroud = rbox(0.12, 0.09, 0.2, 0.04, m.plastic);
    shroud.position.set(-0.38, 0.8, -0.64);
    shroud.rotation.x = 0.35;
    this.add(shroud);
    // Defroster grille along the windshield base.
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.002, 0.05), m.rubber);
    grille.position.set(0, 0.958, -1.0);
    this.add(grille);
  }

  _buildWheel() {
    const m = this.m;
    const wheel = new THREE.Group();
    wheel.position.set(-0.38, 0.9, -0.44);
    wheel.rotation.x = -0.4; // tilted toward the driver
    this.add(wheel);
    const spin = new THREE.Group();
    wheel.add(spin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.0175, 12, 48), m.leather);
    rim.castShadow = true;
    spin.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 24), m.plastic);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.02;
    spin.add(hub);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20), m.chrome);
    badge.position.z = 0.056;
    spin.add(badge);
    for (const a of [Math.PI * 0.5 + 1.75, Math.PI * 0.5 - 1.75, -Math.PI * 0.5]) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.026, 0.016), m.plastic);
      sp.position.set(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0.012);
      sp.rotation.z = a;
      spin.add(sp);
    }
    const column = rod(V(-0.38, 0.875, -0.5), V(-0.38, 0.79, -0.73), 0.03, m.plastic, 12);
    this.add(column);
    this.wheel = spin;
    this.wheelGroup = wheel;
    // Stalks.
    const stalk = rod(V(-0.33, 0.85, -0.53), V(-0.21, 0.835, -0.51), 0.006, m.plastic);
    this.add(stalk);
  }

  _seat(x, driver) {
    const m = this.m;
    const seat = new THREE.Group();
    seat.position.set(x, 0.47, 0.04);
    this.add(seat);
    const cushion = rbox(0.5, 0.12, 0.5, 0.05, m.leather);
    cushion.position.set(0, -0.03, -0.22);
    cushion.rotation.x = 0.06;
    seat.add(cushion);
    for (const s of [-1, 1]) {
      const bol = rbox(0.09, 0.1, 0.42, 0.04, m.leather);
      bol.position.set(s * 0.22, 0.02, -0.2);
      seat.add(bol);
    }
    const base = rbox(0.42, 0.22, 0.46, 0.03, m.plastic);
    base.position.set(0, -0.2, -0.2);
    seat.add(base);

    const back = new THREE.Group();
    back.rotation.x = 0.26; // recline: top leans back toward +Z
    seat.add(back);
    const main = rbox(0.48, 0.66, 0.12, 0.05, m.leather);
    main.position.set(0, 0.38, 0.07);
    back.add(main);
    const insert = rbox(0.3, 0.46, 0.02, 0.01, m.leatherPerf);
    insert.position.set(0, 0.36, 0.005);
    back.add(insert);
    for (const s of [-1, 1]) {
      const bol = rbox(0.1, 0.56, 0.17, 0.05, m.leather);
      bol.position.set(s * 0.215, 0.35, 0.05);
      bol.rotation.y = -s * 0.18;
      back.add(bol);
    }
    // Hard shell on the back of the seat (what the passenger stares at) with a map pocket.
    const shell = rbox(0.47, 0.62, 0.03, 0.025, m.plastic);
    shell.position.set(0, 0.37, 0.14);
    back.add(shell);
    const pocket = rbox(0.38, 0.2, 0.025, 0.012, m.seatFabric);
    pocket.position.set(0, 0.2, 0.162);
    pocket.rotation.x = -0.06;
    back.add(pocket);
    const pocketEdge = rbox(0.38, 0.012, 0.03, 0.006, m.rubber);
    pocketEdge.position.set(0, 0.302, 0.165);
    back.add(pocketEdge);
    // Headrest on chrome posts.
    for (const s of [-0.07, 0.07]) {
      const post = rod(V(s, 0.64, 0.06), V(s, 0.7, 0.056), 0.0055, m.chrome, 10);
      back.add(post);
    }
    const head = rbox(0.25, 0.17, 0.1, 0.045, m.leather);
    head.position.set(0, 0.775, 0.06);
    back.add(head);
    const seam = rbox(0.22, 0.006, 0.102, 0.003, m.leatherPerf);
    seam.position.set(0, 0.775, 0.06);
    back.add(seam);
    seat.userData.back = back;
    return seat;
  }

  _buildSeats() {
    this.driverSeat = this._seat(-0.38, true);
    this.passengerSeat = this._seat(0.38, false);
    // Driver's seat belt over the outer (left) shoulder down to the buckle.
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.048, 1, 0.004), this.m.belt);
    const a = V(-0.66, 1.18, 0.11);
    const b = V(-0.27, 0.58, -0.09);
    belt.scale.y = a.distanceTo(b);
    belt.position.copy(a).lerp(b, 0.5);
    belt.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    belt.castShadow = true;
    this.add(belt);
    this.driverBelt = belt;
  }

  _buildConsole() {
    const m = this.m;
    const body = rbox(0.24, 0.3, 1.0, 0.04, m.plastic);
    body.position.set(0, 0.44, -0.13);
    this.add(body);
    const lid = rbox(0.22, 0.07, 0.38, 0.03, m.leather);
    lid.position.set(0, 0.62, 0.15);
    this.add(lid);
    const tray = rbox(0.2, 0.02, 0.36, 0.01, m.piano);
    tray.position.set(0, 0.6, -0.27);
    this.add(tray);
    const shiftBase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 20), m.satin);
    shiftBase.position.set(0, 0.615, -0.36);
    this.add(shiftBase);
    const shift = capsule(V(0, 0.62, -0.36), V(0, 0.7, -0.37), 0.018, m.leather);
    this.add(shift);
    // Rear face: air vents and a small climate display for the back seat.
    const rearFace = rbox(0.22, 0.2, 0.02, 0.01, m.piano);
    rearFace.position.set(0, 0.47, 0.375);
    this.add(rearFace);
    for (const x of [-0.05, 0.05]) {
      const v = rbox(0.07, 0.04, 0.012, 0.006, m.satin);
      v.position.set(x, 0.52, 0.388);
      this.add(v);
      const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), m.rubber);
      slot.position.set(x, 0.52, 0.395);
      this.add(slot);
    }
    this.rearDisplayAnchor = new THREE.Object3D();
    this.rearDisplayAnchor.position.set(0, 0.445, 0.387);
    this.add(this.rearDisplayAnchor);
  }

  _door(side, z0, z1, front) {
    const m = this.m;
    const g = new THREE.Group();
    this.add(g);
    const xIn = side * 0.86;
    const panel = surface((u, v, t) => {
      const z = z0 + (z1 - z0) * u;
      const y = 0.22 + (0.97 - 0.22) * v;
      const bulge = 0.025 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      t.set(xIn - side * bulge, y, z);
    }, 16, 12, m.plastic);
    if (side < 0) panel.geometry.index.array.reverse();
    panel.geometry.computeVertexNormals();
    g.add(panel);
    const upper = rbox(0.05, 0.16, z1 - z0 - 0.04, 0.02, m.leather);
    upper.position.set(xIn - side * 0.02, 0.88, (z0 + z1) / 2);
    g.add(upper);
    const arm = rbox(0.09, 0.05, (z1 - z0) * 0.62, 0.02, m.leather);
    arm.position.set(xIn - side * 0.05, 0.64, (z0 + z1) / 2 + (front ? 0.06 : -0.03));
    g.add(arm);
    const sill = rbox(0.07, 0.02, z1 - z0, 0.008, m.rubber);
    sill.position.set(xIn - side * 0.015, 0.975, (z0 + z1) / 2);
    g.add(sill);
    const handle = rbox(0.015, 0.025, 0.11, 0.008, m.chrome);
    handle.position.set(xIn - side * 0.035, 0.8, z0 + 0.14);
    g.add(handle);
    const speaker = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), m.rubber);
    speaker.position.set(xIn - side * 0.032, 0.38, z0 + (front ? 0.2 : 0.25));
    speaker.rotation.y = -side * Math.PI / 2;
    g.add(speaker);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.004, 6, 32), m.satin);
    ring.position.copy(speaker.position);
    ring.rotation.y = -side * Math.PI / 2;
    g.add(ring);
    const sw = rbox(0.04, 0.012, 0.05, 0.004, m.piano);
    sw.position.set(xIn - side * 0.07, 0.667, (z0 + z1) / 2 + 0.05);
    g.add(sw);
    return g;
  }

  _buildDoors() {
    this._door(-1, -0.95, -0.04, true);
    this._door(1, -0.95, -0.04, true);
    this._door(-1, 0.04, 0.98, false);
    this._door(1, 0.04, 0.98, false);
  }

  _buildPillarsAndRoof() {
    const m = this.m;
    // A-pillars follow the windshield edges.
    for (const s of [-1, 1]) {
      const a = rbox(0.075, 0.82, 0.06, 0.025, m.fabric);
      const p0 = V(s * 0.745, 0.97, -1.08);
      const p1 = V(s * 0.66, 1.385, -0.38);
      a.position.copy(p0).lerp(p1, 0.5);
      a.quaternion.setFromUnitVectors(V(0, 1, 0), p1.clone().sub(p0).normalize());
      a.scale.y = p0.distanceTo(p1) / 0.82;
      this.add(a);
      // B-pillar with seat-belt anchor.
      const b = rbox(0.06, 0.42, 0.12, 0.025, m.fabric);
      b.position.set(s * 0.8, 1.17, 0.0);
      b.rotation.z = -s * 0.24;
      this.add(b);
      const anchor = rbox(0.02, 0.05, 0.05, 0.01, m.plastic);
      anchor.position.set(s * 0.77, 1.24, 0.07);
      this.add(anchor);
      // C-pillar trim behind the rear doors.
      const c = rbox(0.06, 0.45, 0.4, 0.03, m.fabric);
      c.position.set(s * 0.79, 1.17, 1.15);
      c.rotation.z = -s * 0.22;
      c.rotation.x = -0.35;
      this.add(c);
      // Roof rail above the doors.
      const rail = rbox(0.06, 0.05, 1.75, 0.02, m.fabric);
      rail.position.set(s * 0.77, 1.365, 0.3);
      this.add(rail);
      // Grab handle above the rear door.
      const gh = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 8, 20, Math.PI), m.plastic);
      gh.position.set(s * 0.75, 1.31, 0.55);
      gh.rotation.set(0, Math.PI / 2, Math.PI);
      gh.rotation.x = s * 0.3;
      this.add(gh);
      // Sun visor folded against the headliner.
      const visor = rbox(0.36, 0.018, 0.17, 0.008, m.fabric);
      visor.position.set(s * 0.36, 1.37, -0.31);
      visor.rotation.x = 0.06;
      this.add(visor);
    }
    const headliner = surface((u, v, t) => {
      const x = -0.8 + 1.6 * u;
      const z = -0.42 + 1.68 * v;
      const y = 1.392 - 0.05 * (x / 0.8) ** 2 - 0.02 * Math.max(0, (z - 1.0) / 0.26) ** 2;
      t.set(x, y, z);
    }, 16, 16, m.fabric);
    this.add(headliner);
    // Overhead console with map lights, and the dome light.
    const over = rbox(0.2, 0.03, 0.12, 0.012, m.plastic);
    over.position.set(0, 1.37, -0.27);
    this.add(over);
    const domeLens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x2c2a27, roughness: 0.5, emissive: 0xffd9a0, emissiveIntensity: 0 }));
    domeLens.position.set(0, 1.375, 0.35);
    this.add(domeLens);
    this.domeLens = domeLens;
  }

  _buildFloorAndRear() {
    const m = this.m;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.6), m.carpet);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.2, 0.15);
    floor.receiveShadow = true;
    this.add(floor);
    const tunnel = rbox(0.26, 0.12, 2.0, 0.05, m.carpet);
    tunnel.position.set(0, 0.24, 0.0);
    this.add(tunnel);
    // Rear bench.
    const cushion = rbox(1.36, 0.15, 0.56, 0.06, m.leather);
    cushion.position.set(0, 0.47, 1.15);
    cushion.rotation.x = 0.07;
    this.add(cushion);
    const back = rbox(1.36, 0.66, 0.16, 0.06, m.leather);
    back.position.set(0, 0.82, 1.5);
    back.rotation.x = -0.28;
    this.add(back);
    for (const x of [-0.45, 0.45]) {
      const hr = rbox(0.25, 0.16, 0.1, 0.04, m.leather);
      hr.position.set(x, 1.22, 1.6);
      hr.rotation.x = -0.25;
      this.add(hr);
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.3), m.carpet);
    shelf.position.set(0, 1.0, 1.72);
    this.add(shelf);
  }

  _buildExterior() {
    const m = this.m;
    // Hood seen through the windshield.
    const hood = surface((u, v, t) => {
      const x = -0.86 + 1.72 * u;
      const z = -1.1 - 1.22 * v;
      const crown = 0.035 * (1 - (x / 0.86) ** 2);
      const y = 0.938 - 0.11 * v * v - 0.02 * v + crown - 0.025 * (x / 0.86) ** 4;
      t.set(x, y, z);
    }, 24, 16, m.paint);
    hood.name = 'hood';
    hood.userData.keepLayer = true;
    hood.layers.set(LAYER.INTERIOR);
    this.add(hood);
    // Cowl panel between hood and glass.
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.1), m.rubber);
    cowl.position.set(0, 0.935, -1.11);
    this.add(cowl);
    // Wiper arms lying in the windshield plane (the glass shader clears drops
    // along the same sweep, see CAR.wipers).
    const up = new THREE.Vector3(0, 0.41, 0.7).normalize();
    const tilt = Math.atan2(up.z, up.y);
    CAR.wipers.forEach((w) => {
      const pivot = new THREE.Group();
      pivot.position.set(w.pivot[0], w.pivot[1], w.pivot[2]).addScaledVector(V(0, 0.862, -0.507), 0.012);
      pivot.rotation.x = tilt;
      this.add(pivot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(w.length, 0.011, 0.012), m.rubber);
      arm.position.x = w.length / 2;
      arm.castShadow = true;
      pivot.add(arm);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(w.length * 0.88, 0.016, 0.008), m.rubber);
      blade.position.set(w.length * 0.52, 0.01, 0.0);
      pivot.add(blade);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.025, 12), m.rubber);
      cap.rotation.x = Math.PI / 2;
      pivot.add(cap);
      this.wipers.push({ pivot, length: w.length });
    });
    // Side mirrors outside the front doors.
    for (const s of [-1, 1]) {
      const housing = rbox(0.2, 0.12, 0.09, 0.04, m.paint);
      housing.position.set(s * 1.0, 1.03, -0.86);
      housing.rotation.y = s * 0.12;
      this.add(housing);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.095), m.piano);
      glass.position.set(s * 1.0, 1.03, -0.81);
      glass.rotation.y = s * 0.12;
      this.add(glass);
      const arm = rbox(0.12, 0.03, 0.06, 0.01, m.plastic);
      arm.position.set(s * 0.92, 1.0, -0.86);
      this.add(arm);
    }
    // Invisible body panels that only cast shadows (roof, doors, pillars), so
    // moonlight and passing streetlights fall into the cabin through the glass.
    const shadow = (w, h, d, x, y, z, rx = 0, rz = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.shadowOnly);
      b.position.set(x, y, z);
      b.rotation.set(rx, 0, rz);
      b.castShadow = true;
      this.add(b);
    };
    shadow(1.7, 0.05, 1.65, 0, 1.44, 0.4);
    for (const s of [-1, 1]) {
      shadow(0.05, 0.75, 4.4, s * 0.93, 0.6, 0.0);
      shadow(0.06, 0.45, 0.14, s * 0.84, 1.17, 0.0, 0, -s * 0.24);
      shadow(0.06, 0.45, 0.45, s * 0.83, 1.17, 1.15, -0.35, -s * 0.22);
      shadow(0.08, 0.84, 0.08, s * 0.75, 1.17, -0.73, 0.98, 0);
    }
    shadow(1.7, 0.4, 0.8, 0, 0.8, 2.0);
  }

  _buildPlayer() {
    // The passenger's own legs (seen when looking down) — follows lean a little.
    const m = this.m;
    const g = new THREE.Group();
    this.add(g);
    for (const s of [-1, 1]) {
      const hip = V(CAR.eye.x + s * 0.11, 0.58, 1.08);
      const knee = V(CAR.eye.x + s * 0.13, 0.64, 0.6);
      const ankle = V(CAR.eye.x + s * 0.12, 0.27, 0.5);
      g.add(capsule(hip, knee, 0.075, m.denim));
      g.add(capsule(knee, ankle, 0.058, m.denim));
      const shoe = rbox(0.1, 0.08, 0.26, 0.04, m.rubber);
      shoe.position.set(ankle.x, 0.24, ankle.z - 0.08);
      g.add(shoe);
    }
    const torso = capsule(V(CAR.eye.x, 0.66, 1.12), V(CAR.eye.x, 0.92, 1.1), 0.17, m.jacket);
    torso.scale.set(1.15, 1, 0.75);
    g.add(torso);
    // Hands resting on the thighs, sleeves pulled down.
    for (const s of [-1, 1]) {
      const sleeve = capsule(V(CAR.eye.x + s * 0.21, 0.8, 1.02), V(CAR.eye.x + s * 0.15, 0.7, 0.78), 0.045, m.jacket);
      g.add(sleeve);
      const hand = rbox(0.07, 0.03, 0.1, 0.014, new THREE.MeshStandardMaterial({ color: 0x5a4034, roughness: 0.62 }));
      hand.position.set(CAR.eye.x + s * 0.13, 0.69, 0.72);
      hand.rotation.y = s * 0.3;
      g.add(hand);
    }
    this.playerBody = g;
  }

  _buildFreshener() {
    // Pine-tree air freshener hanging from the mirror stem; swings with the car.
    const pivot = new THREE.Group();
    pivot.position.set(0.0, 1.285, -0.33);
    this.add(pivot);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.11, 4), this.m.rubber);
    string.position.y = -0.055;
    pivot.add(string);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#1f5b2e';
    g.beginPath();
    g.moveTo(32, 4);
    for (let i = 0; i < 4; i++) {
      const y = 10 + i * 24;
      const w = 10 + i * 6;
      g.lineTo(32 + w, y + 22);
      g.lineTo(32 + w * 0.45, y + 20);
    }
    g.lineTo(38, 108);
    g.lineTo(38, 124);
    g.lineTo(26, 124);
    g.lineTo(26, 108);
    for (let i = 3; i >= 0; i--) {
      const y = 10 + i * 24;
      const w = 10 + i * 6;
      g.lineTo(32 - w * 0.45, y + 20);
      g.lineTo(32 - w, y + 22);
    }
    g.closePath();
    g.fill();
    g.fillStyle = '#e6e2c8';
    g.font = '700 10px Arial';
    g.textAlign = 'center';
    g.fillText('PINE', 32, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.1),
      new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }),
    );
    card.position.y = -0.155;
    card.castShadow = true;
    pivot.add(card);
    this.freshener = { pivot, angleX: 0, angleZ: 0, velX: 0, velZ: 0 };
  }

  /** Swing the air freshener like a damped pendulum driven by the car's acceleration. */
  updateFreshener(dt, accelLat, accelLong, twist) {
    const f = this.freshener;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const g = 9.81 / 0.15;
      f.velZ += (-g * Math.sin(f.angleZ) + accelLat * 6.5 - f.velZ * 0.9) * h;
      f.velX += (-g * Math.sin(f.angleX) - accelLong * 6.5 - f.velX * 0.9) * h;
      f.angleZ += f.velZ * h;
      f.angleX += f.velX * h;
    }
    f.pivot.rotation.set(f.angleX, twist, f.angleZ);
  }

  /** Steering wheel angle in radians (positive = turning left). */
  setSteering(angle) {
    this.wheel.rotation.z = angle;
  }

  setWipers(angles) {
    this.wipers.forEach((w, i) => {
      w.pivot.rotation.z = angles[i];
    });
  }

  setDomeLight(on) {
    this.domeLens.material.emissiveIntensity = on ? 2.5 : 0;
  }
}
