// Shared SVG illustrations used by the artifact cards and the main composition.
(function () {
  let UID = 0;
  const uid = (name) => `${name}${++UID}`;
  // Claude-style spark: irregular rounded rays radiating from a center.
  const RAYS = [
    [0, 1.0], [29, 0.7], [61, 0.9], [90, 0.78], [119, 1.0], [152, 0.72],
    [180, 0.94], [208, 0.76], [241, 0.88], [270, 0.71], [299, 0.97], [331, 0.8],
  ];
  function sparkSVG(color = '#D97757', opts = {}) {
    const R = 50, c = 50, hw0 = 3.6, hwT = 5.6;
    const grow = opts.grow == null ? 1 : opts.grow;      // 0..1 ray growth (for animation)
    const rot = opts.rot || 0;
    let paths = '';
    RAYS.forEach(([deg, len], i) => {
      const L = Math.max(hwT * 1.2, R * len * grow * (opts.lenScale ? opts.lenScale[i] : 1));
      const d = `M${c},${c - hw0} L${c + L - hwT},${c - hwT} A${hwT},${hwT} 0 0 1 ${c + L - hwT},${c + hwT} L${c},${c + hw0} Z`;
      paths += `<path d="${d}" transform="rotate(${deg - 90 + rot} ${c} ${c})"/>`;
    });
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="${color}">${paths}<circle cx="${c}" cy="${c}" r="${8}"/></g></svg>`;
  }

  function flameSVG(color = '#E0703A') {
    return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path fill="${color}" d="M16 2.5c.9 4.2-1.7 6.3-3.4 8.6-1.6 2.1-3.1 4.4-3.1 7.6 0 4.6 3.2 8.8 7.9 8.8 4.9 0 8.1-3.8 8.1-8.4 0-3.3-1.5-5.5-3-7.3-.3 1.9-1.2 3.3-2.6 4 .8-4.3-.3-9.6-3.9-13.3z"/>
      <path fill="#FBF6EE" opacity="0.9" d="M16.3 17.2c-.4 1.9-2.6 3-2.6 5.3 0 1.9 1.2 3.3 2.9 3.3 1.8 0 2.9-1.4 2.9-3.2 0-2.2-1.6-3.2-3.2-5.4z"/>
    </svg>`;
  }

  function cupSVG() {
    const id_coffee = uid('coffee');
    const id_cupbody = uid('cupbody');
    return `<svg viewBox="0 0 400 330" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="${id_coffee}" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#B98257"/><stop offset="1" stop-color="#8A5434"/></radialGradient>
        <linearGradient id="${id_cupbody}" x1="0" x2="1"><stop offset="0" stop-color="#F4ECE0"/><stop offset="0.45" stop-color="#FFFDF8"/><stop offset="1" stop-color="#EDE2D2"/></linearGradient>
      </defs>
      <ellipse cx="200" cy="292" rx="168" ry="30" fill="rgba(43,29,22,0.22)"/>
      <ellipse cx="200" cy="276" rx="170" ry="44" fill="#FFFDF8"/>
      <ellipse cx="200" cy="270" rx="122" ry="28" fill="#EFE4D3"/>
      <path d="M298 168c52-10 64 62 4 76" fill="none" stroke="#F4ECE0" stroke-width="22" stroke-linecap="round"/>
      <path d="M92 146h216c-4 82-36 128-108 128S96 228 92 146z" fill="url(#${id_cupbody})"/>
      <ellipse cx="200" cy="146" rx="108" ry="32" fill="#FFFDF8"/>
      <ellipse cx="200" cy="148" rx="95" ry="24" fill="url(#${id_coffee})"/>
      <path d="M200 166c-24-12-34-21-24-29 8-6 18-2 24 6 6-8 16-12 24-6 10 8 0 17-24 29z" fill="#F6E7D2"/>
      <path d="M200 160c-12-6-17-11-12-15 4-3 9-1 12 3 3-4 8-6 12-3 5 4 0 9-12 15z" fill="#B98257" opacity="0.55"/>
      <g fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" opacity="0.75">
        <path d="M168 104c-16-18 14-30-2-54"/><path d="M204 96c-16-22 16-34 0-62"/><path d="M240 104c-16-18 14-30-2-54"/>
      </g>
    </svg>`;
  }

  function glassSVG() {
    const id_brew = uid('brew');
    const id_gl = uid('gl');
    return `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${id_brew}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A2A"/><stop offset="1" stop-color="#2E1A10"/></linearGradient>
        <linearGradient id="${id_gl}" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.15"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.45"/></linearGradient>
      </defs>
      <ellipse cx="150" cy="384" rx="100" ry="14" fill="rgba(43,29,22,0.22)"/>
      <rect x="168" y="18" width="16" height="190" rx="8" transform="rotate(14 176 113)" fill="#FBF6EE"/>
      <rect x="168" y="18" width="16" height="40" rx="8" transform="rotate(14 176 113)" fill="#E0703A"/>
      <path d="M66 92h168l-20 270c-1 12-10 20-22 20h-104c-12 0-21-8-22-20z" fill="url(#${id_gl})"/>
      <path d="M74 150h152l-15 210c-1 9-8 15-17 15h-88c-9 0-16-6-17-15z" fill="url(#${id_brew})"/>
      <path d="M74 150c30 14 52-10 78 2s48 6 74-2l-2 22c-26 10-50 2-74-6s-50 10-74-2z" fill="#E9D3B8" opacity="0.9"/>
      <g fill="#ffffff" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.7" stroke-width="3">
        <rect x="92" y="118" width="54" height="50" rx="10" transform="rotate(-12 119 143)"/>
        <rect x="150" y="126" width="50" height="48" rx="10" transform="rotate(16 175 150)"/>
        <rect x="118" y="176" width="46" height="44" rx="9" transform="rotate(8 141 198)"/>
      </g>
      <path d="M84 104c4 80 6 170 12 250" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.55" fill="none"/>
      <ellipse cx="150" cy="92" rx="84" ry="9" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="3"/>
    </svg>`;
  }

  function cortadoSVG() {
    return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="150" cy="276" rx="96" ry="14" fill="rgba(43,29,22,0.2)"/>
      <path d="M70 92h160l-14 168c-1 10-9 17-19 17h-94c-10 0-18-7-19-17z" fill="#ffffff" fill-opacity="0.45" stroke="#fff" stroke-width="4"/>
      <path d="M78 186h144l-7 72c-1 8-7 13-15 13h-100c-8 0-14-5-15-13z" fill="#4A2A18"/>
      <path d="M76 142h148l-4 46h-140z" fill="#C79A72"/>
      <path d="M74 108h152l-2 36h-148z" fill="#F4E6D3"/>
      <ellipse cx="150" cy="104" rx="76" ry="10" fill="#FFF8EE"/>
      <path d="M86 112c2 50 4 100 10 150" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.6" fill="none"/>
    </svg>`;
  }

  function croissantSVG() {
    const id_cr = uid('cr');
    return `<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="${id_cr}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9A65A"/><stop offset="1" stop-color="#B8692C"/></linearGradient></defs>
      <ellipse cx="150" cy="178" rx="120" ry="12" fill="rgba(43,29,22,0.2)"/>
      <g fill="url(#${id_cr})" stroke="#9B5521" stroke-width="3">
        <ellipse cx="62" cy="128" rx="40" ry="24" transform="rotate(-38 62 128)"/>
        <ellipse cx="238" cy="128" rx="40" ry="24" transform="rotate(38 238 128)"/>
        <ellipse cx="100" cy="100" rx="44" ry="34" transform="rotate(-22 100 100)"/>
        <ellipse cx="200" cy="100" rx="44" ry="34" transform="rotate(22 200 100)"/>
        <ellipse cx="150" cy="92" rx="52" ry="44"/>
      </g>
      <path d="M128 64c8 18 8 40 0 60M172 64c-8 18-8 40 0 60" stroke="#9B5521" stroke-width="3" fill="none" opacity="0.7"/>
    </svg>`;
  }

  window.SHAPES = {
    spark: sparkSVG, flame: flameSVG, cup: cupSVG, glass: glassSVG, cortado: cortadoSVG, croissant: croissantSVG,
  };
  window.sparkSVG = sparkSVG;
})();
