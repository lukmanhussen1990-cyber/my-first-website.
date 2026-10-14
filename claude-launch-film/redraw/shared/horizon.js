// The closing sky (client-supplied photograph of the horizon at dawn), shared by S12 and S13 so the ending reads as
// one continuous shot: a slow camera drift and push, and the dawn warming as the statement and the Claude lockup play.
const HZ_SRC = '../../plates/S12_closing_lines/horizon.jpg';   // 2400x1350 canvas, horizon centre at (1200, 470)
async function horizonCam(img, f, fade = 1) {
  if (!img.dataset.hz) { img.src = HZ_SRC; await img.decode().catch(() => {}); Object.assign(img.style, { width: '2400px', height: '1350px', left: '0px', top: '0px', transformOrigin: '1200px 470px' }); img.dataset.hz = 1; }
  const t = clamp((f - 1168) / (1453 - 1168)), e = t * t * (3 - 2 * t);
  const s = 1.0 + 0.05 * e, hy = 318 + 40 * e;                         // horizon drifts down a touch as the camera rises
  img.style.transform = `translate(${960 - 1200}px, ${(hy - 470).toFixed(2)}px) scale(${s.toFixed(5)})`;
  const dawn = 0.84 + 0.16 * clamp((f - 1168) / 95) + 0.07 * Math.exp(-Math.pow((f - 1272) / 9, 2));
  img.style.filter = `brightness(${(dawn * fade).toFixed(4)}) saturate(${(0.96 + 0.1 * e).toFixed(3)})`;
}
