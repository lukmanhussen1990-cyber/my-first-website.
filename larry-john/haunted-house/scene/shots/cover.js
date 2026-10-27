// The reel's cover (1080x1920 still): Larry in his $1 bedsheet, chips in hand, in front of the glowing
// haunted mansion at night. The title is drawn by the overlay page.
import * as THREE from 'three';
import { P, place } from '../acting.js';

export function coverFrame(W) {
  const C = W.cast, L = C.larry, M = W.MANSION.pos;
  W.show('backyard', 'estate');
  const e = W.sets.estate.userData;
  e.mansion.visible = true; e.graveyard.visible = true; e.gate.visible = true; e.showFence(true);
  W.sets.backyard.userData.estateMode(true);
  e.gate.userData.doors.forEach((d, i) => { d.rotation.y = (i ? -1 : 1) * 0.75; });     // the gate stands open
  e.searchlights.forEach((s, i) => { s.visible = true; s.userData.pivot.rotation.set([0.35, -0.1, -0.4][i], 0, [-0.3, 0.12, 0.38][i]); });
  W.look('night');
  // Larry in front of the open iron gate, proudly holding out his chips; the whole mansion glows behind
  const lp = [M[0] - 0.35, 0, e.gateZ + 3.4];
  place(L, lp, [M[0] + 0.6, 0, e.gateZ + 10]);
  L.setSheet(true);
  L.sheet.set({ drape: 1, sway: 0.9, wingL: 0.6, wingY: 0.92 });
  L.sheet.face.set('happy');
  L.applyPose(P({ armL: { fwd: 62, out: 28, elbow: 35 }, lean: -3 }));
  // the moon above the clock tower, a few bats, low fog
  W.moonAt([M[0] + 70, 150, M[2] - 330], 40);
  const cp = [M[0] + 0.5, 0.75, e.gateZ + 7.4];
  W.fx.bats.swarm([M[0] - 12, 30, M[2] + 4], [M[0] + 14, 36, M[2] + 2], 0.55, { spread: 10, size: 1.5, dur: 1.0, camPos: cp, seed: 9, count: 9, stagger: 0.5 });
  W.fog.show({ center: [M[0], 0.2, e.gateZ - 5], size: [16, 0.5, 8] }, 3.0, { density: 0.45, color: '#b9a8ff', opacity: 0.12, floor: 1, minS: 1.4, maxS: 2.6 });
  W.cam.set(cp, [M[0] - 0.1, 6.6, e.gateZ - 12], 58);
  W.shadow(lp, 5);
}
