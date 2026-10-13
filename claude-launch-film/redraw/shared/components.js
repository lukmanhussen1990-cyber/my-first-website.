// Shared UI components so recurring elements look identical in every scene.
// Icons are Lucide-style outline glyphs (24x24 viewBox, round caps), drawn as inline SVG.

const ICON_PATHS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  send: '<path d="M21.5 2.5 10.6 13.4"/><path d="M21.5 2.5 14.6 21.6l-4-8.2-8.1-4z"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  flask: '<path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  minus: '<path d="M5 12h14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  incognito: '<path d="M3 11h18"/><path d="M5 11l2-6h10l2 6"/><circle cx="7.5" cy="16" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M10 16h4"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  star: '<path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
};

function icon(name, size = 24, color = '#fff', stroke = 2, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICON_PATHS[name]}</svg>`;
}

// Four-point sparkle with concave sides (the opening symbol).
function sparkleSVG(size, color = '#fff') {
  const s = size / 2;
  const k = 0.22;  // how far the concave sides pull toward the centre
  const p = `M ${s} 0 Q ${s * (1 - k)} ${s * (1 - k)} 0 ${s} Q ${s * (1 - k)} ${s * (1 + k)} ${s} ${2 * s} Q ${s * (1 + k)} ${s * (1 + k)} ${2 * s} ${s} Q ${s * (1 + k)} ${s * (1 - k)} ${s} 0 Z`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${p}" fill="${color}"/></svg>`;
}

// Chat input pill used in the cloud scene, the symptom input and the anatomy response view.
// Proportions measured from the reference cloud scene (f200): pill 1226 x 140 px at x 345..1571,
// y 470..610; plus glyph 51 px; text 49 px Inter regular starting at x 482; mic glyph 48 x 76 px;
// black send disc 112 px whose right edge sits 14 px inside the pill. Everything scales with height.
function chatPill({ width = 1226, height = 140, text = '', textColor = '#fff', fontSize = null, caret = false,
                    surface = 'rgba(255,255,255,0.10)', border = 'rgba(255,255,255,0.55)', blur = 22,
                    iconColor = '#fff', showMic = true, showSend = true } = {}) {
  const h = height, fs = fontSize || 0.35 * h;
  const el = document.createElement('div');
  el.className = 'pill';
  Object.assign(el.style, {
    width: width + 'px', height: h + 'px', padding: `0 ${0.10 * h}px 0 ${0.13 * h}px`,
    background: surface, border: `1.5px solid ${border}`,
    backdropFilter: `blur(${blur}px) saturate(1.15)`, webkitBackdropFilter: `blur(${blur}px) saturate(1.15)`,
    boxShadow: '0 10px 40px rgba(10,8,40,0.16)',
  });
  el.innerHTML = `
    <div class="pill-plus" style="width:${0.62 * h}px;height:${0.62 * h}px;margin-right:${0.21 * h}px">${icon('plus', 0.62 * h, iconColor, 1.3)}</div>
    <div class="pill-text" style="font-size:${fs}px;color:${textColor}"><span class="t"></span><span class="caret" style="height:${fs * 1.0}px;margin-left:${fs * 0.06}px;display:${caret ? 'inline-block' : 'none'}"></span></div>
    <div class="pill-mic" style="width:${0.61 * h}px;height:${0.61 * h}px;margin:0 ${0.16 * h}px 0 ${0.12 * h}px;display:${showMic ? 'flex' : 'none'}">${icon('mic', 0.61 * h, iconColor, 1.2)}</div>
    <div class="pill-send" style="width:${0.8 * h}px;height:${0.8 * h}px;display:${showSend ? 'flex' : 'none'}">${icon('send', 0.42 * h, '#fff', 1.6)}</div>`;
  el.querySelector('.t').textContent = text;
  el.setText = (t) => { el.querySelector('.t').textContent = t; };
  el.setCaret = (on) => { el.querySelector('.caret').style.display = on ? 'inline-block' : 'none'; };
  return el;
}

// "Claude" in the brand-logo construction. Each glyph is its own span (.ch) so scenes can
// animate per-letter blur/brightness (the reference wordmark's letter-by-letter focus sweeps).
function claudeLogo({ size = 125, fill = null, gradient = false } = {}) {
  const el = document.createElement('div');
  el.className = 'logo' + (gradient ? ' gradient-fill' : '');
  el.style.fontSize = size + 'px';
  if (fill) el.style.color = fill;
  el.innerHTML = '<span class="ch cap">C</span><span class="ch">l</span><span class="ch">a</span><span class="ch">u</span><span class="ch">d</span><span class="ch">e</span>';
  el.letters = Array.from(el.querySelectorAll('.ch'));
  return el;
}

window.ICON_PATHS = ICON_PATHS; window.icon = icon; window.sparkleSVG = sparkleSVG; window.chatPill = chatPill; window.claudeLogo = claudeLogo;
