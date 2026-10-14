// The closing sky: the client's sunset photograph (tools/sky_plate.py), shared by S12 and S13 so the ending reads as
// one continuous shot. The camera pushes slowly toward the sun while the statement and the Claude lockup play; through
// the finale the sun goes down (a crossfade to the dusk grade of the same photograph, the camera tilting up as the sun
// sinks out of frame), and at the very end night falls from the top of the frame to the opening's navy, so the last
// frame meets the first and the film loops. Pure function of the frame number.
const SKY = { src: '../../plates/S12_closing_lines/sunset.jpg', dusk: '../../plates/S12_closing_lines/sunset_dusk.jpg',
  W: 2006, H: 1128, sun: [1215.6, 1082.4] };
const SKY_NAVY = '1,3,19';                                            // = S01 background
const skySmooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
async function skyCam(stage, f, o = {}) {                            // o.shade: scale the type shade (0 hides it)
  let st = stage._sky;
  if (!st) {
    st = stage._sky = {};
    const box = st.box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;background:rgb(' + SKY_NAVY + ')';
    const mk = src => { const im = document.createElement('img'); im.src = src;
      im.style.cssText = `position:absolute;left:0;top:0;width:${SKY.W}px;height:${SKY.H}px;transform-origin:${SKY.sun[0]}px ${SKY.sun[1]}px`;
      box.appendChild(im); return im; };
    st.a = mk(SKY.src); st.b = mk(SKY.dusk);
    // a broad, feathered shade behind the type (the clouds are bright where the lines sit), then the night layer
    st.shade = document.createElement('div'); st.shade.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px';
    st.night = document.createElement('div'); st.night.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px';
    box.append(st.shade, st.night);
    stage.insertBefore(box, stage.firstChild);
    await Promise.all([st.a.decode(), st.b.decode()]).catch(() => {});
  }
  // camera: slow push toward the sun across both scenes; the sun sinks out of frame as night falls (1400-1440)
  const e = skySmooth(1168, 1446, f);
  const s = 1 + 0.045 * e, sx = 1132 - 27 * e;
  const sy = 1060 + 62 * ease.inOutCubic(clamp((f - 1400) / 40));
  const tf = `translate(${(sx - SKY.sun[0]).toFixed(2)}px, ${(sy - SKY.sun[1]).toFixed(2)}px) scale(${s.toFixed(5)})`;
  st.a.style.transform = st.b.style.transform = tf;
  // light: the sky settles in as S12 opens, a breath of light as the Claude mark turns in, then the sun goes down
  const expo = 0.84 + 0.08 * skySmooth(1168, 1258, f) + 0.05 * Math.exp(-Math.pow((f - 1272) / 10, 2));
  st.a.style.filter = st.b.style.filter = `brightness(${expo.toFixed(4)})`;
  const sh = kf(f, [[1168, 0.5], [1262, 0.5], [1272, 0.36], [1336, 0.36], [1350, 0.44], [1400, 0.44], [1416, 0]]) * (o.shade ?? 1);
  st.shade.style.background = `radial-gradient(ellipse 1050px 330px at 960px 556px, rgba(2,7,26,${sh.toFixed(3)}) 0%, rgba(2,7,26,${(0.62 * sh).toFixed(3)}) 46%, rgba(2,7,26,0) 100%)`;
  const dusk = 0.35 * skySmooth(1290, 1400, f) + 0.65 * skySmooth(1398, 1428, f);
  st.b.style.opacity = dusk.toFixed(4);
  // night falls from the top of the frame to the navy of the opening frame (complete at 1446)
  const nt = skySmooth(1408, 1436, f), nb = skySmooth(1418, 1446, f);
  st.night.style.background = `linear-gradient(to bottom, rgba(${SKY_NAVY},${nt.toFixed(4)}) 0%, rgba(${SKY_NAVY},${(0.5 * (nt + nb)).toFixed(4)}) 55%, rgba(${SKY_NAVY},${nb.toFixed(4)}) 100%)`;
  const done = f >= 1446;
  st.a.style.visibility = st.b.style.visibility = done ? 'hidden' : 'visible';
}
