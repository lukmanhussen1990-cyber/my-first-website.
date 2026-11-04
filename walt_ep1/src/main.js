// ---------- frame renderer ----------
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
buildTimeline();
function sceneAt(t) { for (const s of SCENES) if (t >= s.a && t < s.b) return s; return SCENES[SCENES.length - 1]; }
function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const sc = sceneAt(t);
  let cam = camAt(t, sc.cam); if (sc.camFn) cam = sc.camFn(t, cam);
  window.CAM = cam;
  const z = cam.z * (1 + punchZ(t));
  const sh = shakeOffset(t);
  const wx = sc.whip ? (1 - E.out(P(t, sc.a, 0.24))) * -360 : 0;
  ctx.save();
  ctx.translate(360 + sh.x + wx, 640 + sh.y); ctx.rotate(cam.r + sh.r); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  sc.draw(ctx, t);
  ctx.restore();
  ctx.globalAlpha = 1;
  if (sc.grade && sc.grade[1] > 0) grade(ctx, sc.grade[0], sc.grade[1]);
  vignette(ctx, sc.vig);
  if (sc.overlay) { ctx.save(); sc.overlay(ctx, t); ctx.restore(); }
  if (sc.whip) whip(ctx, P(t, sc.a, 0.24), 1);
  if (sc.capY) drawCaption(ctx, t, sc.capY);
  drawHUD(ctx, t);
}
window.READY = true;
