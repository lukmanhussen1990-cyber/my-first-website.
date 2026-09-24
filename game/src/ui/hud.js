// STUB — UI agent replaces the internals (keep the API from ARCHITECTURE.md).
export function createHUD(ctx) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:12px;bottom:12px;color:#fff;font:16px sans-serif;text-shadow:0 1px 2px #000;pointer-events:none';
  ctx.uiRoot.appendChild(el);
  const s = { hp: 1, musou: 0, chain: 0, ko: 0, target: null };
  let screenEl = null;
  const render = () => { el.textContent = `HP ${(s.hp * 100) | 0}%  MUSOU ${s.musou.toFixed(1)}  CHAIN ${s.chain}  KO ${s.ko}` + (s.target ? `  [${s.target.en} ${(s.target.frac * 100) | 0}%]` : ''); };
  return {
    update() { render(); },
    setHealth(f) { s.hp = f; }, setMusou(v) { s.musou = v; }, setChain(n) { s.chain = n; }, setKO(n) { s.ko = n; },
    setTarget(t) { s.target = t; }, setLabels() {},
    showDialogue(d) { console.log('[dialogue]', d.zh, d.en); },
    showBanner(b) { console.log('[banner]', b.zh, b.en); },
    showTitleCard() {}, musouCinematic() {}, toast(zh, en) { console.log('[toast]', zh, en); },
    flash() {}, setMorale() {}, minimap() {}, setVisible(b) { el.style.display = b ? '' : 'none'; },
    showScreen(name, data, handlers = {}) {
      if (screenEl) { screenEl.remove(); screenEl = null; }
      if (!name) return;
      screenEl = document.createElement('div');
      screenEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font:24px sans-serif;gap:16px';
      const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:22px sans-serif;padding:10px 30px'; b.onclick = fn; screenEl.appendChild(b); };
      const h = document.createElement('div'); h.textContent = name.toUpperCase(); screenEl.appendChild(h);
      if (name === 'title') btn('START', () => handlers.onStart && handlers.onStart());
      if (name === 'pause') { btn('RESUME', () => handlers.onResume && handlers.onResume()); btn('RESTART', () => handlers.onRestart && handlers.onRestart()); }
      if (name === 'victory' || name === 'defeat') btn('RETRY', () => handlers.onRestart && handlers.onRestart());
      screenEl.style.pointerEvents = 'auto';
      ctx.uiRoot.appendChild(screenEl);
    },
  };
}
