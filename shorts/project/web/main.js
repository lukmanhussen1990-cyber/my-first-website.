// Frame harness: loads a story module, renders any frame on demand, hands the image back to render.mjs.
// URL params: w, h (output size), story (module file, default story.js).
// A story module exports: TOTAL, FPS, async setup(ctx), frame(f) -> { scene, camera }.
import * as THREE from "three";

const q = new URLSearchParams(location.search);
const W = +q.get("w") || 1080, H = +q.get("h") || 1920;
const storyUrl = "./" + (q.get("story") || "story.js");

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const toB64 = (buf) => {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
};

try {
  const story = await import(storyUrl);
  await story.setup({ THREE, renderer, W, H });
  window.TOTAL = story.TOTAL;
  window.FPS = story.FPS ?? 30;
  window.renderFrame = async (f, type = "image/png", quality = 0.95) => {
    const t0 = performance.now();
    const out = story.frame(f);
    if (out.render) out.render(renderer); else renderer.render(out.scene, out.camera);
    const blob = await new Promise((r) => renderer.domElement.toBlob(r, type, quality));
    const b64 = toB64(new Uint8Array(await blob.arrayBuffer()));
    return { b64, ms: performance.now() - t0 };
  };
  window.READY = true;
} catch (e) {
  window.LOAD_ERROR = String(e && e.stack || e);
}
