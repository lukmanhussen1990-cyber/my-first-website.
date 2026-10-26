// Gold numbers for the math beats (S5-S8): big bevelled 3D digits in real gold PBR (metalness 1,
// roughness ~0.25) lit by a generated PMREM studio environment so they gleam even in dark moods, plus
// pure-function motion helpers: rise from the ground (anticipation dip -> rise -> overshoot -> settle),
// fly-together arcs, the slam into 969 with a gold-dust burst and a camera-shake hint.
// Digit outlines: Droid Serif Bold (Apache 2.0), digits/+/= only, from three's bundled typeface fonts.
//
//   const n = makeGoldNumber('187', { renderer: ctx.world.gl, size: 1.4 });  g.add(n.group);
//   update(t):  n.rise(t - plan.ev.n187, { cam });           // or n.pose({ pos, rotY, scale }) for your own motion
import * as THREE from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { makeSprites } from './fx.js';
import { hash01, clamp, smooth, invLerp, lerp, easeOut, easeIn, easeInOut, noise2 } from '../lib/util.js';

export const DIGIT_FONT_DATA = {"resolution":1000,"boundingBox":{"yMin":-387,"xMin":-289.125,"yMax":1359,"xMax":1773},"underlineThickness":102,"familyName":"Droid Serif","glyphs":{"0":{"ha":777,"x_min":47,"x_max":730,"o":"m 730 497 q 710 288 730 382 q 650 126 691 193 q 544 22 609 59 q 388 -14 479 -14 q 228 22 293 -14 q 122 126 163 59 q 64 288 82 193 q 47 498 47 383 q 64 707 47 613 q 122 867 82 801 q 228 970 163 934 q 390 1006 294 1006 q 545 970 480 1006 q 650 867 609 934 q 710 707 691 801 q 730 497 730 613 m 262 497 q 267 319 262 397 q 286 187 272 241 q 325 104 300 133 q 388 76 349 76 q 452 104 427 76 q 490 187 476 133 q 509 319 504 241 q 515 497 515 397 q 509 674 515 596 q 491 805 504 752 q 452 887 477 859 q 390 915 428 915 q 326 887 351 915 q 287 805 301 859 q 267 674 272 752 q 262 497 262 596 "},"1":{"ha":777,"x_min":58.234375,"x_max":707.96875,"o":"m 134 0 l 134 73 l 248 73 q 279 78 266 73 q 301 92 292 82 q 313 120 309 103 q 318 164 318 137 l 318 860 q 268 801 291 827 q 223 755 244 774 q 180 726 201 736 q 138 716 159 716 q 107 723 121 716 q 81 743 92 730 q 64 776 71 757 q 58 818 58 795 q 102 831 79 823 q 151 851 125 839 q 207 882 177 864 q 271 925 237 900 l 369 997 l 524 997 l 524 164 q 527 125 524 142 q 538 96 530 108 q 560 79 546 85 q 596 73 574 73 l 707 73 l 707 0 l 134 0 "},"2":{"ha":777,"x_min":49,"x_max":713,"o":"m 678 775 q 670 712 678 742 q 647 649 663 681 q 603 580 630 616 q 536 500 576 544 q 442 403 496 456 q 319 284 389 350 l 180 152 l 504 152 q 577 177 546 152 q 619 248 607 202 l 630 291 l 713 291 l 705 0 l 49 0 l 49 143 l 254 352 q 360 471 319 418 q 425 572 401 524 q 458 667 449 620 q 468 768 468 715 q 439 884 468 847 q 359 921 410 921 q 260 860 289 921 q 232 681 232 799 q 159 688 192 681 q 103 712 127 696 q 67 754 80 728 q 54 818 54 780 q 73 890 54 856 q 131 949 93 923 q 226 990 169 975 q 359 1006 283 1006 q 497 990 437 1006 q 596 944 556 974 q 657 871 637 914 q 678 775 678 828 "},"3":{"ha":777,"x_min":39,"x_max":713,"o":"m 338 -14 q 202 0 259 -14 q 109 36 146 13 q 56 89 73 59 q 39 152 39 119 q 48 198 39 178 q 74 233 57 219 q 111 253 90 247 q 157 260 133 260 q 169 183 157 216 q 204 127 182 150 q 258 94 226 105 q 327 82 289 82 q 392 92 361 82 q 447 125 423 101 q 484 187 470 148 q 498 287 498 227 q 484 360 498 327 q 443 417 470 393 q 376 455 416 441 q 284 468 336 468 l 198 468 l 198 555 l 289 555 q 367 569 334 555 q 422 611 400 584 q 454 676 444 638 q 465 759 465 714 q 436 878 465 835 q 350 921 407 921 q 289 902 313 921 q 253 854 266 884 q 235 784 240 823 q 230 705 230 746 q 97 735 144 705 q 50 829 50 765 q 69 898 50 866 q 127 954 89 930 q 223 992 166 978 q 357 1006 281 1006 q 490 991 431 1006 q 591 946 549 976 q 655 875 633 917 q 678 779 678 833 q 661 692 678 732 q 616 622 645 653 q 549 567 588 591 q 465 528 511 544 q 551 504 507 521 q 631 459 595 487 q 689 388 666 430 q 713 285 713 345 q 681 143 713 200 q 597 50 649 85 q 477 0 544 15 q 338 -14 409 -14 "},"4":{"ha":777,"x_min":18,"x_max":750.453125,"o":"m 606 258 l 606 173 q 615 121 606 141 q 639 91 624 101 q 675 77 654 80 q 719 73 696 73 l 737 73 l 737 0 l 250 0 l 250 73 l 289 73 q 333 77 313 73 q 369 91 354 80 q 394 121 384 101 q 403 173 403 141 l 403 258 l 18 258 l 18 343 l 412 992 l 606 992 l 606 350 l 750 350 l 750 258 l 606 258 m 403 593 q 405 724 403 654 q 412 860 407 795 q 390 815 405 844 q 359 756 376 787 q 326 699 342 726 q 302 660 310 673 l 114 350 l 403 350 l 403 593 "},"5":{"ha":777,"x_min":56,"x_max":703,"o":"m 319 82 q 385 93 354 82 q 439 130 416 104 q 476 198 462 155 q 490 305 490 241 q 441 460 490 409 q 301 511 391 511 q 253 509 275 511 q 214 503 232 507 q 179 495 195 499 q 147 486 163 491 l 83 511 l 127 992 l 653 992 l 660 739 l 580 739 l 569 786 q 562 808 566 798 q 551 825 558 818 q 533 835 544 831 q 505 839 522 839 l 216 839 q 215 827 216 838 q 213 797 214 816 q 209 756 212 779 q 205 709 207 733 l 195 581 q 223 589 205 586 q 260 596 240 593 q 303 601 281 599 q 347 603 326 603 q 493 584 428 603 q 605 528 559 565 q 677 436 652 491 q 703 305 703 380 q 670 153 703 215 q 584 55 637 92 q 468 1 532 17 q 340 -14 403 -14 q 208 0 262 -14 q 120 37 154 13 q 71 90 86 60 q 56 153 56 120 q 86 226 56 202 q 167 249 116 249 q 175 190 167 219 q 200 136 182 160 q 247 97 218 112 q 319 82 277 82 "},"6":{"ha":777,"x_min":62,"x_max":728,"o":"m 445 923 q 371 899 404 923 q 314 828 338 875 q 276 712 290 781 q 258 556 262 644 q 290 575 272 565 q 332 591 308 584 q 385 603 355 599 q 450 608 414 608 q 564 588 513 608 q 652 531 615 568 q 708 441 688 494 q 728 320 728 388 q 707 184 728 245 q 646 78 687 123 q 546 10 606 34 q 406 -14 486 -14 q 266 14 329 -14 q 157 100 202 42 q 87 247 112 159 q 62 458 62 336 q 86 672 62 573 q 159 846 110 772 q 283 963 208 920 q 458 1006 357 1006 q 572 993 525 1006 q 648 958 619 980 q 690 910 677 937 q 704 852 704 882 q 695 812 704 831 q 666 777 686 792 q 615 753 647 762 q 537 744 583 744 q 533 807 537 776 q 519 865 529 839 q 491 907 509 891 q 445 923 473 923 m 398 523 q 358 517 379 523 q 318 502 337 511 q 282 480 298 492 q 258 456 266 468 q 270 285 258 357 q 303 167 282 213 q 351 99 323 120 q 410 77 379 77 q 495 132 464 77 q 526 306 526 186 q 492 471 526 419 q 398 523 458 523 "},"7":{"ha":777,"x_min":61,"x_max":731,"o":"m 228 0 l 599 840 l 233 840 q 176 822 195 840 q 152 770 156 804 l 144 700 l 61 700 l 67 992 l 731 992 l 731 924 l 346 0 l 228 0 "},"8":{"ha":777,"x_min":41,"x_max":735,"o":"m 41 252 q 55 333 41 297 q 97 398 70 369 q 162 453 124 428 q 245 501 200 478 q 118 610 162 549 q 74 752 74 671 q 90 846 74 801 q 145 927 107 892 q 244 984 183 963 q 396 1006 306 1006 q 524 987 469 1006 q 617 936 580 969 q 673 859 654 904 q 692 762 692 815 q 678 689 692 720 q 641 631 665 657 q 582 582 616 604 q 504 537 547 560 q 610 476 566 507 q 682 411 654 445 q 722 341 709 378 q 735 262 735 304 q 710 145 735 196 q 640 58 686 93 q 529 4 595 23 q 379 -14 463 -14 q 228 7 292 -14 q 122 64 164 28 q 61 148 81 100 q 41 252 41 197 m 385 64 q 450 77 422 64 q 500 113 479 90 q 531 168 520 136 q 542 238 542 200 q 530 299 542 272 q 494 351 519 327 q 431 398 469 375 q 339 445 393 421 q 295 411 316 430 q 260 367 275 391 q 237 313 245 343 q 228 247 228 283 q 240 172 228 206 q 272 115 251 139 q 321 77 292 91 q 385 64 350 64 m 517 765 q 508 823 517 794 q 483 875 500 852 q 443 911 467 897 q 387 925 419 925 q 336 913 358 925 q 299 880 314 901 q 277 831 284 860 q 269 769 269 803 q 279 706 269 733 q 308 657 289 679 q 354 618 327 636 q 419 584 382 601 q 463 616 445 599 q 493 655 481 633 q 511 703 505 676 q 517 765 517 730 "},"9":{"ha":777,"x_min":49,"x_max":715,"o":"m 316 -14 q 209 0 252 -14 q 138 34 166 12 q 99 84 111 56 q 88 142 88 112 q 104 193 88 173 q 155 222 120 214 q 180 163 166 190 q 214 116 194 136 q 261 85 234 96 q 322 73 288 73 q 467 174 416 73 q 524 476 517 275 q 488 438 508 455 q 442 409 468 422 q 387 389 417 396 q 321 382 357 382 q 211 400 261 382 q 125 455 161 419 q 69 545 89 491 q 49 669 49 599 q 70 806 49 744 q 133 912 92 868 q 233 981 174 957 q 367 1006 292 1006 q 506 978 442 1006 q 616 894 570 951 q 689 749 663 837 q 715 539 715 661 q 692 323 715 424 q 622 147 670 222 q 498 29 574 72 q 316 -14 423 -14 m 380 482 q 467 507 431 482 q 524 575 503 533 q 512 727 523 664 q 481 832 501 791 q 435 893 462 873 q 375 913 408 913 q 283 854 315 913 q 250 677 250 795 q 283 531 250 581 q 380 482 315 482 "},"+":{"ha":777,"x_min":90.453125,"x_max":686.609375,"o":"m 437 446 l 437 198 l 338 198 l 338 446 l 90 446 l 90 546 l 338 546 l 338 794 l 437 794 l 437 546 l 686 546 l 686 446 l 437 446 "},"=":{"ha":777,"x_min":87,"x_max":690,"o":"m 690 409 l 690 313 l 87 313 l 87 409 l 690 409 m 690 679 l 690 582 l 87 582 l 87 679 l 690 679 "}}};

let _font = null, _digitH = 0;
export const digitFont = () => _font || (_font = new Font(DIGIT_FONT_DATA));
// height of a lining digit ('0') in font units of size 1 -> we size digits by their real height
function digitUnit() {
  if (_digitH) return _digitH;
  const pts = digitFont().generateShapes('0', 1)[0].getPoints(6);
  let lo = Infinity, hi = -Infinity; for (const p of pts) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  return (_digitH = hi - lo);
}

// bevelled extruded glyph (cached). Local origin: horizontal centre of the advance, baseline y = 0, z centred.
const _geo = new Map();
export function digitGeometry(ch, { size = 1, depth = 0.24, bevel = 0.035, curve = 7 } = {}) {
  const key = [ch, size, depth, bevel, curve].join('|');
  if (_geo.has(key)) return _geo.get(key);
  const fs = size / digitUnit();
  const shapes = digitFont().generateShapes(ch, fs);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, curveSegments: curve, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 3 });
  const g = DIGIT_FONT_DATA.glyphs[ch];
  const adv = (g ? g.ha : 777) / DIGIT_FONT_DATA.resolution * fs;
  geo.translate(-adv / 2, 0, -depth / 2);
  geo.userData.adv = adv;
  _geo.set(key, geo);
  return geo;
}

// ---------------------------------------------------------------- studio environment for the gold
// A dark warm room with big soft boxes (key top-left, two rim strips, warm floor bounce, a few hot
// glints), pre-filtered with PMREM once per renderer. Strong contrast in the reflections = it reads as gold.
const _envs = new WeakMap();
export function goldEnvironment(renderer, { key = [7.5, 6.2, 4.6], rim = [5.0, 3.6, 2.0], floor = [0.55, 0.3, 0.12], ambient = [0.05, 0.035, 0.022] } = {}) {
  let per = _envs.get(renderer); if (!per) { per = new Map(); _envs.set(renderer, per); }
  const ck = JSON.stringify([key, rim, floor, ambient]);
  if (per.has(ck)) return per.get(ck);
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { amb: { value: new THREE.Vector3(...ambient) }, flo: { value: new THREE.Vector3(...floor) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 amb; uniform vec3 flo; varying vec3 vD;
      void main(){ float y = vD.y; vec3 c = amb * (0.6 + 0.8 * smoothstep(-0.2, 0.6, y));
        c += vec3(0.42, 0.26, 0.12) * exp(-pow(y / 0.12, 2.0)) * 0.6;            // warm horizon band
        c += flo * smoothstep(0.0, -0.5, y) * (0.6 + 0.4 * smoothstep(0.0, 1.0, vD.z));   // floor bounce, stronger in front
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(dome);
  const panel = (w, h, rgb, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); scene.add(m); return m;
  };
  panel(16, 9, key, [-12, 14, 14], [0, 0, 0]);                       // key soft box (top-left-front)
  panel(2.2, 22, rim, [-17, 3, -10], [0, 2, 0]);                       // rim strips behind
  panel(2.2, 22, rim.map((v) => v * 0.8), [17, 3, -9], [0, 2, 0]);
  panel(26, 1.6, key.map((v) => v * 0.55), [0, 18, -4], [0, 0, 0]);   // top strip (catches the bevels)
  panel(8, 4, [1.6, 0.9, 0.42], [14, 1, 12], [0, 0, 0]);              // warm fill right-front
  for (let i = 0; i < 6; i++) {                                         // hot glints (sparkle on the bevel edges)
    const a = i * 1.7 + 0.4, e = 0.25 + 0.5 * hash01(i, 77);
    panel(0.9, 0.9, [30, 26, 20], [Math.cos(a) * 20 * Math.cos(e), 20 * Math.sin(e), Math.sin(a) * 20 * Math.cos(e)], [0, 0, 0]);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.025, 0.1, 100);
  pm.dispose();
  scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  per.set(ck, rt.texture);
  return rt.texture;
}

// gold: linear F0 ~ (1.0, 0.71, 0.29) -> a rich yellow gold (a touch deeper than physical gold)
export const GOLD = new THREE.Color().setRGB(1.0, 0.7, 0.28);

// face + side materials (ExtrudeGeometry group 0 = caps, 1 = sides & bevels), with a world-space shine sweep
export function goldMaterials(env, { color = GOLD, roughness = 0.24, envK = 1.35, sideRough = 0.3, clipY = null } = {}) {
  const sweep = { uSweepO: { value: new THREE.Vector3() }, uSweepD: { value: new THREE.Vector3(1, 1, 0) }, uSweep: { value: -9 }, uSweepK: { value: 0 }, uSweepW: { value: 0.12 } };
  const mk = (rough, col) => {
    const m = new THREE.MeshStandardMaterial({ color: col, metalness: 1, roughness: rough, envMap: env, envMapIntensity: envK });
    if (clipY != null) m.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -clipY)];
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, sweep);
      sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vGW; uniform vec3 uSweepO; uniform vec3 uSweepD; uniform float uSweep; uniform float uSweepK; uniform float uSweepW;\n' +
        sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float sw = dot(vGW - uSweepO, uSweepD) - uSweep;
          totalEmissiveRadiance += vec3(1.0, 0.82, 0.5) * uSweepK * exp(-sw * sw / (uSweepW * uSweepW));`);
    };
    m.customProgramCacheKey = () => 'gold-sweep' + (clipY != null ? '-clip' : '');
    return m;
  };
  const face = mk(roughness, color), side = mk(sideRough, color.clone().multiplyScalar(0.9));
  return { face, side, list: [face, side], sweep };
}

// ---------------------------------------------------------------- motion curves (pure functions)
// Rise from the ground: peek (top shows) -> anticipation dip -> fast rise with stretch -> overshoot ->
// damped settle with a squash on first contact. age = t - ev (s). y is in units of the number's height
// (-1.08 = fully buried, 0 = standing on the ground).
export function riseCurve(age, { peek = 0.14, dip = 0.06, up = 0.3, over = 0.13, freq = 2.3, damp = 5.2 } = {}) {
  if (age < -0.5) return { y: -1.08, sx: 1, sy: 1, rotX: 0, vis: false, impact: 0 };
  let y, sx = 1, sy = 1, rotX = 0, impact = 0;
  if (age < -0.22) { const u = easeOut(invLerp(-0.5, -0.22, age)); y = lerp(-1.08, -1 + peek, u); }
  else if (age < 0) { const u = easeInOut(invLerp(-0.22, 0, age)); y = lerp(-1 + peek, -1 - dip, u); sy = 1 - 0.07 * Math.sin(Math.PI * u); sx = 1 + 0.04 * Math.sin(Math.PI * u); }
  else if (age < up) {
    const u = invLerp(0, up, age); const e = 1 - Math.pow(1 - u, 2.6);
    y = lerp(-1 - dip, over, e);
    const v = Math.pow(1 - u, 1.6);                         // speed -> stretch
    sy = 1 + 0.16 * v; sx = 1 - 0.08 * v; rotX = -0.12 * v;
  } else {
    const a = age - up;
    y = over * Math.exp(-damp * a) * Math.cos(2 * Math.PI * freq * a);
    const c = Math.exp(-(((a - 0.11) / 0.07) ** 2));          // first contact squash
    sy = 1 - 0.1 * c + 0.02 * Math.exp(-damp * a) * Math.sin(2 * Math.PI * freq * a); sx = 1 + 0.06 * c;
    impact = c;
  }
  return { y, sx, sy, rotX, vis: true, impact };
}

// Fly along an arc from a to b (u 0..1, eased): { pos, rotY, rotZ, scale }
export function flyPath(u, a, b, { arc = 1.4, spin = 0.6, scaleTo = 1, lift = [0, 1, 0], side = 0 } = {}) {
  const e = easeInOut(u), s = Math.sin(Math.PI * e);
  const pos = [0, 1, 2].map((i) => lerp(a[i], b[i], e) + lift[i] * arc * s);
  pos[2] += side * s;
  return { pos, rotY: spin * Math.sin(Math.PI * 2 * e) * (1 - e), rotZ: -0.25 * spin * s * Math.sign(b[0] - a[0] || 1), scale: lerp(1, scaleTo, e) };
}

// The slam: age = t - ev.slam. Before 0 the parts converge (use flyPath with u = convergeU(age));
// at 0 the result punches in big and settles. { scale, z, flash, shake, glow, bloomK }
export const convergeU = (age, dur = 0.55) => clamp(easeIn(invLerp(-dur, 0, age)));
export function slamCurve(age, { punch = 0.32, freq = 3.1, damp = 6.5 } = {}) {
  if (age < 0) return { scale: 0, z: 0, flash: 0, shake: 0, glow: 0, vis: false };
  const scale = 1 + punch * Math.exp(-damp * age) * Math.cos(2 * Math.PI * freq * age) - 0.06 * Math.exp(-(((age - 0.07) / 0.05) ** 2));
  return {
    scale, z: -0.6 * Math.exp(-age / 0.08), vis: true,
    flash: Math.exp(-age / 0.09) * 0.9,                     // add to mood.post.flash (x ~0.4)
    shake: Math.exp(-age / 0.22),                           // pass to camShake
    glow: 0.35 + 0.65 * Math.exp(-age / 0.35),              // halo/bloom boost
  };
}

// Seeded camera shake (decays with k): add .pos to the camera position and .look to its look point; .roll in radians.
export function camShake(t, k, { amp = 0.09, freq = 17, seed = 5 } = {}) {
  if (k <= 1e-4) return { pos: [0, 0, 0], look: [0, 0, 0], roll: 0 };
  const n = (s) => noise2(t * freq, s * 3.7, seed + s);
  const a = amp * k;
  return { pos: [n(1) * a, n(2) * a * 0.8, n(3) * a * 0.5], look: [n(4) * a * 0.6, n(5) * a * 0.6, 0], roll: n(6) * 0.012 * k };
}

// ---------------------------------------------------------------- gold dust burst / ground dust
// Additive sparkling motes thrown out radially, slowed by drag, pulled down, twinkling out. Pure fn of age.
export function makeGoldDust(N = 220, { seed = 21 } = {}) {
  const sp = makeSprites(N, { additive: true, fog: false, order: 11 });
  return {
    group: sp.group,
    // bursts: [{ pos:[x,y,z] (parent space), age, k=1, radius=2.2, up=1.2, ring=0 (0 sphere .. 1 flat ring), n=N, color=[2.4,1.7,0.6] }]
    set(bursts) {
      sp.begin();
      let base = 0;
      for (const B of bursts) {
        const n = Math.min(B.n ?? N, N - base); const age = B.age; const k = B.k ?? 1;
        if (age == null || age < 0 || age > (B.life ?? 2.6)) { base += n; continue; }
        const R = B.radius ?? 2.2, upK = B.up ?? 1.2, ring = B.ring ?? 0, col = B.color ?? [2.4, 1.7, 0.6], size = B.size ?? 0.05;
        for (let i = 0; i < n; i++) {
          const id = base + i, h1 = hash01(id, seed), h2 = hash01(id, seed + 1), h3 = hash01(id, seed + 2), h4 = hash01(id, seed + 3);
          const az = h1 * Math.PI * 2, el = lerp(Math.asin(h2 * 2 - 1), 0, ring) + ring * (h2 - 0.5) * 0.3;
          const sp0 = R * (0.35 + 0.65 * h3);
          const drag = 3.2, travel = (1 - Math.exp(-drag * age)) / drag * sp0 * 3.2;
          const dx = Math.cos(az) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(az) * Math.cos(el);
          const x = B.pos[0] + dx * travel, z = B.pos[2] + dz * travel;
          const y = B.pos[1] + dy * travel + upK * travel * 0.25 - 0.55 * age * age;
          const life = 0.9 + 1.5 * h4, u = age / life; if (u >= 1) continue;
          const tw = 0.55 + 0.45 * Math.sin(age * (14 + 10 * h1) + id);
          const b = k * (1 - u) * (1 - u) * tw * (0.6 + 0.8 * h2);
          sp.add(x, y, z, size * (0.5 + h4) * (1 + 0.6 * Math.exp(-age / 0.15)), col[0] * b, col[1] * b, col[2] * b, 1);
        }
        base += n;
      }
      sp.end();
    },
  };
}

// ---------------------------------------------------------------- the number
// makeGoldNumber(text, opts) -> { group, digits, width, height, materials, pose, rise, fly, slam, set }
//   group: origin = bottom centre of the number, +y up, digits face +z. Put it in your set and move it freely.
//   opts: renderer (needed for the environment; pass ctx.world.gl), size = digit height (m), depth, bevel,
//         tracking (em fraction), env (reuse another env texture), roughness, envK, clipY (world y: hide
//         everything below, e.g. the ground; needs renderer), dust (ground dust + gold motes on rise), halo
export function makeGoldNumber(text, { renderer = null, size = 1.4, depth = null, bevel = null, tracking = -0.06, env = null, roughness = 0.24, envK = 1.35,
  clipY = null, dust = true, halo = true, seed = 3, color = GOLD } = {}) {
  depth = depth ?? size * 0.2; bevel = bevel ?? size * 0.026;
  const envMap = env || (renderer ? goldEnvironment(renderer) : null);
  if (clipY != null && renderer) renderer.localClippingEnabled = true;
  const mats = goldMaterials(envMap, { roughness, envK, clipY, color });
  const group = new THREE.Group(); group.name = 'gold' + text;
  const chars = [...String(text)];
  const geos = chars.map((ch) => digitGeometry(ch, { size, depth, bevel }));
  const advs = geos.map((g) => g.userData.adv * (1 + tracking));
  const width = advs.reduce((a, b) => a + b, 0);
  let x = -width / 2;
  const digits = chars.map((ch, i) => {
    const hold = new THREE.Group(); hold.position.x = x + advs[i] / 2; x += advs[i];
    const mesh = new THREE.Mesh(geos[i], [mats.face, mats.side]); mesh.castShadow = true; mesh.receiveShadow = false;
    hold.add(mesh); group.add(hold);
    return { ch, hold, mesh, x: hold.position.x };
  });
  // warm halo behind (reads as glow + feeds the bloom); dust/sparkles in the PARENT's space
  const glow = halo ? makeSprites(2, { additive: true, fog: false, order: 4 }) : null;
  const fx = dust ? makeGoldDust(160, { seed: seed * 13 + 1 }) : null;
  const puffs = dust ? makeSprites(40, { order: 5 }) : null;
  const fxGroup = new THREE.Group(); if (fx) fxGroup.add(fx.group, puffs.group); if (glow) fxGroup.add(glow.group);
  const _o = new THREE.Vector3(), _q = new THREE.Quaternion(), _d = new THREE.Vector3();
  const api = {
    group, digits, width, height: size, materials: mats, fx: fxGroup, envMap,
    // put api.fx in the SAME parent as group (dust lives in parent space so it does not move with the number)
    // low-level: whole-number transform + per-digit offsets [{ y, sx, sy, rotX }] (y in units of height)
    pose({ pos = null, rotY = 0, rotX = 0, rotZ = 0, scale = 1, per = null, visible = true } = {}) {
      group.visible = visible;
      if (pos) group.position.set(...pos);
      group.rotation.set(rotX, rotY, rotZ); group.scale.setScalar(Math.max(1e-4, scale));
      digits.forEach((d, i) => {
        const P = per ? per[i] : null;
        d.hold.position.y = P ? P.y * size : 0; d.hold.scale.set(P ? P.sx : 1, P ? P.sy : 1, P ? P.sx : 1); d.hold.rotation.x = P ? P.rotX : 0;
        d.hold.visible = P ? P.vis !== false : true;
      });
      return api;
    },
    // gleam: drifting env reflections + an optional shine sweep (k 0..1) running diagonally across the digits
    set(t, { sweepAge = null, sweepK = 1.6, halo: haloK = 0.35, haloColor = [1.0, 0.62, 0.22] } = {}) {
      const r = 0.35 * Math.sin(t * 0.37) + 0.25 * Math.sin(t * 0.21 + 1.3);
      for (const m of mats.list) { m.envMapRotation.set(0.12 * Math.sin(t * 0.29), r, 0); }
      group.updateMatrixWorld();
      const s = mats.sweep;
      if (sweepAge != null && sweepAge >= 0 && sweepAge < 1.2) {
        group.getWorldPosition(_o); group.getWorldQuaternion(_q);
        const sc = group.scale.x;
        s.uSweepO.value.copy(_o).add(_d.set(-width / 2, 0, 0).applyQuaternion(_q).multiplyScalar(sc));
        s.uSweepD.value.set(1, 0.6, 0).normalize().applyQuaternion(_q);
        s.uSweep.value = lerp(-0.3 * size, (width + size) * 1.05, easeInOut(sweepAge / 0.9)) * sc;
        s.uSweepW.value = 0.16 * size * sc; s.uSweepK.value = sweepK * Math.sin(Math.PI * clamp(sweepAge / 0.9));
      } else s.uSweepK.value = 0;
      // warm halo behind the number (parent space, like the dust)
      if (glow) {
        glow.begin();
        if (haloK > 0.001 && group.visible) {
          const P = group.position, sc = group.scale.x, hk = haloK, hc = haloColor;
          const bx = P.x, by = P.y + size * 0.5 * sc, bz = P.z - depth * sc * Math.cos(group.rotation.y);
          glow.add(bx, by, bz, width * 2.1 * sc, hc[0] * hk, hc[1] * hk, hc[2] * hk, 0.5);
          glow.add(bx, by, bz, width * 1.0 * sc, hc[0] * hk * 0.9, hc[1] * hk * 0.8, hc[2] * hk * 0.6, 0.5);
        }
        glow.end();
      }
      return api;
    },
    // rise from the ground at local position pos (age = t - ev). Returns the curve state of the middle digit.
    rise(age, { pos = null, rotY = 0, stagger = 0.06, t = age, dustColor = [0.62, 0.5, 0.36], groundY = null, sweep = true, haloK = 0.35, curve = {} } = {}) {
      const per = digits.map((_, i) => riseCurve(age - i * stagger, curve));
      api.pose({ pos, rotY, per, visible: per.some((p) => p.vis) });
      api.set(t, { sweepAge: sweep ? age - 0.42 : null, halo: haloK * smooth(invLerp(-0.1, 0.4, age)) });
      if (fx) {
        const P = group.position, gy = groundY ?? P.y;
        const bursts = digits.map((d, i) => ({ pos: [P.x + d.x * Math.cos(rotY), gy + 0.05, P.z - d.x * Math.sin(rotY)], age: age - i * stagger, n: 40, radius: size * 0.55, up: 2.2, ring: 0.6, size: size * 0.035, life: 2 }));
        fx.set(bursts);
        puffs.begin();
        digits.forEach((d, i) => {
          const a = age - i * stagger; if (a < 0 || a > 2.2) return;
          for (let j = 0; j < 10; j++) {
            const h1 = hash01(i * 10 + j, seed + 5), h2 = hash01(i * 10 + j, seed + 6);
            const ang = h1 * Math.PI * 2, out = size * (0.35 + 0.5 * h2) * (1 - Math.exp(-a * 3.5));
            const u = a / 2.2;
            puffs.add(P.x + d.x * Math.cos(rotY) + Math.cos(ang) * out, gy + 0.08 + size * 0.25 * (1 - Math.exp(-a * 2.5)) * (0.4 + h2), P.z - d.x * Math.sin(rotY) + Math.sin(ang) * out * 0.6,
              size * (0.25 + 0.35 * h2) * (0.6 + 0.8 * u), dustColor[0], dustColor[1], dustColor[2], 0.42 * (1 - u) * (1 - u) * smooth(invLerp(0, 0.06, a)), h1 * 6);
          }
        });
        puffs.end();
      }
      return per[Math.floor(per.length / 2)];
    },
    // fly along an arc (u 0..1) between two parent-space points (clears the dust; call set() after it for gleam/halo)
    fly(u, a, b, opts = {}) { const F = flyPath(u, a, b, opts); api.pose({ pos: F.pos, rotY: (opts.rotY ?? 0) + F.rotY, rotZ: F.rotZ, scale: F.scale * (opts.scale ?? 1) }); api.quiet(); return F; },
    // empty the dust / puffs / halo (frames render in any order: every frame must define the fx state —
    // rise(), fly() and slam() do it; if you only call pose(), call quiet() too)
    quiet() { if (fx) { fx.set([]); puffs.begin(); puffs.end(); } if (glow) { glow.begin(); glow.end(); } return api; },
    // appear with the slam punch at pos (age = t - ev.slam); returns slamCurve (feed .flash/.shake to the mood/camera)
    slam(age, { pos = null, rotY = 0, scale = 1, t = age, haloK = 0.6, burst = true } = {}) {
      const S = slamCurve(age);
      api.pose({ pos, rotY, scale: S.scale * scale, visible: S.vis });
      if (pos && S.vis) group.position.z += S.z * scale;
      api.set(t, { sweepAge: age - 0.15, halo: haloK * S.glow });
      if (fx) {
        const P = group.position;
        fx.set(burst && S.vis ? [{ pos: [P.x, P.y + size * 0.5 * scale, P.z + 0.1], age, n: 160, radius: size * 1.6 * scale, up: 0.8, ring: 0.15, size: size * 0.04 * scale, life: 2.6 }] : []);
        puffs.begin(); puffs.end();
      }
      return S;
    },
  };
  api.pose({});
  return api;
}
