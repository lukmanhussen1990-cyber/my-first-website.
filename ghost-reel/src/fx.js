// Floating hearts and "Zzz" for the final shot (camera-facing sprites living in the 3D scene).
import * as THREE from 'three';
function tex(draw) { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const heartTex = () => tex((g) => {
  g.translate(64, 70); g.beginPath(); g.moveTo(0, 34);
  g.bezierCurveTo(-58, -6, -30, -58, 0, -24); g.bezierCurveTo(30, -58, 58, -6, 0, 34); g.closePath();
  g.fillStyle = '#ff4f8f'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.stroke();
});
const zTex = () => tex((g) => { g.font = '900 104px Poppins, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#17225a'; g.strokeText('Z', 64, 68); g.fillStyle = '#eaf4ff'; g.fillText('Z', 64, 68); });
export class FX {
  constructor(scene) {
    this.items = [];
    const ht = heartTex(), zt = zTex();
    const mk = (map, kind, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false })); s.renderOrder = 30; s.visible = false; scene.add(s); this.items.push({ s, kind, i }); };
    for (let i = 0; i < 7; i++) mk(ht, 'heart', i);
    for (let i = 0; i < 6; i++) mk(zt, 'z', i);
  }
  // t: seconds since the final shot started; origins: world Vector3
  update(t, heartOrigin, zOrigin, up = [0, 0, -1]) {
    for (const it of this.items) {
      const isH = it.kind === 'heart';
      const period = isH ? 1.9 : 1.35, delay = isH ? 0.75 + it.i * 0.27 : 0.25 + it.i * 0.33;
      const life = t - delay;
      if (t < 0 || life < 0) { it.s.visible = false; continue; }
      const u = (life % period) / period; const o = isH ? heartOrigin : zOrigin;
      const sway = Math.sin(life * 3 + it.i * 1.7) * 0.07, side = isH ? ((it.i % 3) - 1) * 0.22 : 0.16 + u * 0.3;
      // rise towards the camera (y up) and drift "up the frame"
      it.s.position.set(o.x + side + sway, o.y + 0.25 + u * 0.9, o.z + up[2] * u * (isH ? 0.45 : 0.55));
      const pop = Math.min(1, u * 7), fade = u > 0.7 ? (1 - u) / 0.3 : 1;
      const sc = (isH ? 0.2 : 0.14 + u * 0.16) * (0.4 + 0.6 * pop) * (1 + (pop < 1 ? 0.25 * Math.sin(pop * Math.PI) : 0));
      it.s.scale.set(sc, sc, 1); it.s.material.opacity = fade; it.s.material.rotation = isH ? sway * 2 : -0.25;
      it.s.visible = true;
    }
  }
  hide() { for (const it of this.items) it.s.visible = false; }
}
