// STUB cast: a simple YOU (box body + box head) with the same API as the real cast.js. See CONTRACTS.md.
import * as THREE from 'three';
import { matNoisy } from '../lib.js';
const YOU_SPOT = { pos: [0, 0], rotY: 0 };
export function buildCast(world) {
  const root = new THREE.Group(); root.name = 'you'; world.scene.add(root);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.25), matNoisy('#c62828')); body.position.y = 1.1; root.add(body);
  const head = new THREE.Group(); head.position.set(0, 1.6, 0); root.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.22), matNoisy('#8d5a3b')));
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.2), matNoisy('#2b3a5a')); legs.position.y = 0.37; root.add(legs);
  const defaults = () => ({ pos: YOU_SPOT.pos.slice(), rotY: YOU_SPOT.rotY, visible: true, crouch: 0, lean: 0, leanSide: 0, headYaw: 0, headPitch: 0 });
  const you = { name: 'you', root, head, headRadius: 0.12, p: defaults(),
    headPos() { return head.getWorldPosition(new THREE.Vector3()); }, eyePos() { return head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.02, 0.11)); },
    mouthPos() { return head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.06, 0.11)); },
    handPos() { return root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.25, 1.0, 0.1)); } };
  return { characters: [you], you,
    reset() { you.p = defaults(); },
    commit() { const p = you.p; root.visible = p.visible; root.position.set(p.pos[0], -p.crouch * 0.4, p.pos[1]); root.rotation.y = p.rotY; head.rotation.set(-p.headPitch, p.headYaw, 0); } };
}
