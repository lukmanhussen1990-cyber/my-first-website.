/* Shared animation runtime for every scene.
 *
 * Preview: open scenes/sceneNN.html in a browser - CSS animations play in real time
 *          (click to replay).
 * Render:  scenes/sceneNN.html?render=1 freezes the page; render.py calls
 *          window.__seek(t) before every frame, so each frame is exact and the
 *          video never drops or doubles frames.
 *
 * All motion lives in CSS keyframes with explicit delays (written by make_scenes.py).
 * JS is only used for things CSS can't do: counting numbers up.
 */
(function () {
  const RENDER = /[?&]render\b/.test(location.search);
  if (RENDER) document.documentElement.classList.add("render");

  const ticks = [];
  let anims = null;

  // <b data-count="+6" data-at="0.8" data-dur="0.6"> counts 0 -> 6 from t=0.8s
  function setupCounters() {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const m = el.dataset.count.match(/^([+\-−]?)(\d+)(.*)$/);
      if (!m) return;
      const [, sign, num, suffix] = m;
      const at = parseFloat(el.dataset.at || "0");
      const dur = parseFloat(el.dataset.dur || "0.6");
      ticks.push((t) => {
        const k = Math.min(1, Math.max(0, (t - at) / dur));
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = sign + Math.round(Number(num) * eased) + suffix;
      });
    });
  }

  // Jump every animation on the page to time t (seconds since scene start).
  window.__seek = function (t) {
    if (!anims) anims = document.getAnimations();
    for (const a of anims) {
      a.pause();
      a.currentTime = t * 1000;
    }
    for (const f of ticks) f(t);
  };

  function start() {
    setupCounters();
    if (RENDER) {
      anims = document.getAnimations(); // collect once, while every animation is still alive
      window.__seek(0);
      window.__ready = true;
      return;
    }
    const t0 = performance.now();
    (function loop() {
      const t = (performance.now() - t0) / 1000;
      for (const f of ticks) f(t);
      requestAnimationFrame(loop);
    })();
    document.addEventListener("click", () => location.reload());
  }

  window.addEventListener("load", () =>
    document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(start))));
})();
