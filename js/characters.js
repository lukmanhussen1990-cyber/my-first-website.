/* Crossy Road — playable characters.
 * Each one is the same voxel skeleton with different colours and add-ons,
 * drawn in local space (front = +y) and rotated to face the hop direction. */
(function (global) {
  'use strict';

  var CR = global.CR;
  var util = CR.util;

  var CHARACTERS = [
    {
      id: 'chicken', name: 'Chicken', cost: 0,
      body: '#f5f6f8', head: '#ffffff', accent: '#ff9d1e', feet: '#ff9d1e',
      eye: '#1a1e26', comb: '#e8433a', wattle: true, tail: '#e9ebef', wings: true
    },
    {
      id: 'duck', name: 'Duckling', cost: 20,
      body: '#ffd93d', head: '#ffe066', accent: '#ff8a1e', feet: '#ff8a1e',
      eye: '#1a1e26', tail: '#f5c92e', wings: true
    },
    {
      id: 'frog', name: 'Frog', cost: 40,
      body: '#57c257', head: '#63d063', accent: '#2f8f3e', feet: '#3fa14b',
      eye: '#1a1e26', bigEyes: true, wide: true, mouth: '#2f8f3e'
    },
    {
      id: 'cat', name: 'Alley Cat', cost: 60,
      body: '#98a1ab', head: '#a4adb7', accent: '#ff9db1', feet: '#8a939d',
      eye: '#2b8f4f', ears: true, tail: '#98a1ab', stripes: '#7c858f'
    },
    {
      id: 'penguin', name: 'Penguin', cost: 90,
      body: '#2f3542', head: '#39404f', accent: '#ffb02e', feet: '#ffb02e',
      eye: '#f2f4f8', belly: '#f2f4f8', wings: true, wingColor: '#262c37'
    },
    {
      id: 'robot', name: 'Rusty Bot', cost: 120,
      body: '#b7c1cb', head: '#c6d0d9', accent: '#4dd0ff', feet: '#8d97a1',
      eye: '#4dd0ff', antenna: true, panel: '#8d97a1', metal: true
    }
  ];

  /** Rotate a local offset/size pair into world space for a facing. */
  function place(r, f, lx, ly, lz, w, d, h, color, light) {
    var x, y, sw, sd;
    switch (f) {
      case 1: x = ly; y = -lx; sw = d; sd = w; break;   // facing +x
      case 2: x = -lx; y = -ly; sw = w; sd = d; break;  // facing −y
      case 3: x = -ly; y = lx; sw = d; sd = w; break;   // facing −x
      default: x = lx; y = ly; sw = w; sd = d;          // facing +y
    }
    return { x: x, y: y, z: lz, w: sw, d: sd, h: h, c: color, l: light };
  }

  /**
   * Draw a character.
   * @param st {x,y,z,facing,squash,stretch,alpha,flat,spin}
   */
  function draw(r, ch, st) {
    var f = st.facing || 0;
    var sxy = st.squash == null ? 1 : st.squash;     // horizontal scale
    var sz = st.stretch == null ? 1 : st.stretch;    // vertical scale
    var ox = st.x, oy = st.y, oz = st.z || 0;
    var wide = ch.wide ? 1.14 : 1;
    var parts = [];

    function P(lx, ly, lz, w, d, h, color, light) {
      parts.push(place(r, f, lx * sxy * wide, ly * sxy, lz * sz, w * sxy * wide, d * sxy, h * sz, color, light));
    }

    // feet
    P(-0.16, 0.08, 0, 0.17, 0.24, 0.09, ch.feet);
    P(0.16, 0.08, 0, 0.17, 0.24, 0.09, ch.feet);
    // body
    P(0, 0, 0.08, 0.58, 0.54, 0.4, ch.body);
    if (ch.belly) P(0, 0.28, 0.14, 0.36, 0.04, 0.3, ch.belly);
    if (ch.stripes) {
      P(0, -0.1, 0.47, 0.5, 0.1, 0.02, ch.stripes);
      P(0, 0.1, 0.47, 0.5, 0.1, 0.02, ch.stripes);
    }
    if (ch.panel) P(0, 0.28, 0.16, 0.3, 0.03, 0.16, ch.panel);
    if (ch.wings) {
      P(-0.31, -0.02, 0.14, 0.07, 0.4, 0.26, ch.wingColor || ch.body, 0.93);
      P(0.31, -0.02, 0.14, 0.07, 0.4, 0.26, ch.wingColor || ch.body, 0.93);
    }
    if (ch.tail) P(0, -0.31, 0.26, 0.22, 0.14, 0.26, ch.tail, 0.95);

    // head
    var headZ = ch.wide ? 0.44 : 0.47;
    P(0, 0.03, headZ, 0.46, 0.42, ch.wide ? 0.3 : 0.34, ch.head);
    var topZ = headZ + (ch.wide ? 0.3 : 0.34);

    if (ch.bigEyes) {
      P(-0.16, 0.1, topZ - 0.02, 0.2, 0.2, 0.16, ch.head);
      P(0.16, 0.1, topZ - 0.02, 0.2, 0.2, 0.16, ch.head);
      P(-0.16, 0.06, topZ + 0.1, 0.14, 0.14, 0.06, '#ffffff');
      P(0.16, 0.06, topZ + 0.1, 0.14, 0.14, 0.06, '#ffffff');
      P(-0.16, 0.04, topZ + 0.15, 0.08, 0.08, 0.04, ch.eye);
      P(0.16, 0.04, topZ + 0.15, 0.08, 0.08, 0.04, ch.eye);
      if (ch.mouth) P(0, 0.24, headZ + 0.04, 0.34, 0.02, 0.05, ch.mouth);
    } else {
      P(-0.13, 0.22, headZ + 0.14, 0.08, 0.03, 0.09, ch.eye);
      P(0.13, 0.22, headZ + 0.14, 0.08, 0.03, 0.09, ch.eye);
      P(0, 0.25, headZ + 0.05, 0.16, 0.14, 0.1, ch.accent);   // beak / muzzle
    }

    if (ch.comb) {
      P(0, 0.12, topZ, 0.07, 0.09, 0.11, ch.comb);
      P(0, 0.0, topZ, 0.07, 0.1, 0.14, ch.comb);
      P(0, -0.11, topZ, 0.07, 0.09, 0.1, ch.comb);
    }
    if (ch.wattle) P(0, 0.24, headZ - 0.04, 0.07, 0.07, 0.09, ch.comb);
    if (ch.ears) {
      P(-0.15, 0.05, topZ, 0.13, 0.11, 0.13, ch.head);
      P(0.15, 0.05, topZ, 0.13, 0.11, 0.13, ch.head);
      P(-0.15, 0.1, topZ + 0.03, 0.07, 0.04, 0.07, ch.accent);
      P(0.15, 0.1, topZ + 0.03, 0.07, 0.04, 0.07, ch.accent);
    }
    if (ch.antenna) {
      P(0, 0, topZ, 0.05, 0.05, 0.16, '#8d97a1');
      P(0, 0, topZ + 0.16, 0.12, 0.12, 0.12, ch.accent);
    }

    var ctx = r.ctx, restore = false;
    if (st.alpha != null && st.alpha < 1) { ctx.save(); ctx.globalAlpha = st.alpha; restore = true; }
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      r.part(ox + p.x, oy + p.y, oz + p.z, p.w, p.d, p.h, p.c, p.l);
    }
    r.drawParts();
    if (restore) ctx.restore();
  }

  CR.characters = CHARACTERS;
  CR.byId = function (id) {
    for (var i = 0; i < CHARACTERS.length; i++) if (CHARACTERS[i].id === id) return CHARACTERS[i];
    return CHARACTERS[0];
  };
  CR.drawCharacter = draw;
})(window);
