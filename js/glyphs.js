/*
 * Glyph outlines for the "imran" wordmark.
 *
 * Source: Instrument Sans Bold (wght 700, wdth 100), overlaps removed,
 * y-axis flipped for canvas (baseline at y = 0, x-height at y = -510).
 * Advances include the font's own kerning (r + a = -19).
 *
 * Copyright 2022 The Instrument Sans Project Authors
 * (https://github.com/Instrument/instrument-sans)
 * Licensed under the SIL Open Font License, Version 1.1 — https://openfontlicense.org
 */
window.IMRAN_GLYPHS = {
  unitsPerEm: 1000,
  xHeight: 510,
  // shaped advances for the sequence i-m-r-a-n (kerning applied)
  advances: { i: 270, m: 950, r: 379, a: 571, n: 619 },
  glyphs: {
    i: {
      bbox: [55, 0, 215, 740], // xMin, yMin, xMax, yMax (font units, y-up)
      d: 'M60 0V-510H210V0ZM55 -578V-740H215V-578Z'
    },
    m: {
      bbox: [60, 0, 896, 520], // xMin, yMin, xMax, yMax (font units, y-up)
      d: 'M60 0V-510H207V-417Q231 -459 270 -487Q317 -520 384 -520Q464 -520 509 -475Q532 -451 543 -422Q566 -461 605 -487Q654 -520 724 -520Q807 -520 851.5 -473.5Q896 -427 896 -352V0H746V-324Q746 -363 725.5 -381.5Q705 -400 668 -400Q636 -400 609.5 -385.5Q583 -371 568 -344.5Q553 -318 553 -282V0H403V-324Q403 -363 382.5 -381.5Q362 -400 325 -400Q293 -400 266.5 -385.5Q240 -371 225 -344.5Q210 -318 210 -282V0Z'
    },
    r: {
      bbox: [60, 0, 386, 520], // xMin, yMin, xMax, yMax (font units, y-up)
      d: 'M60 0V-510H207V-417Q225 -460 256 -486Q297 -520 358 -520Q377 -520 386 -516V-376Q381 -378 372 -378.5Q363 -379 350 -379Q278 -379 244 -353.5Q210 -328 210 -266V0Z'
    },
    a: {
      bbox: [37, -10, 531, 520], // xMin, yMin, xMax, yMax (font units, y-up)
      d: 'M381 0Q375 -22 373 -47Q371 -63 370 -83Q349 -42 313 -19Q268 10 203 10Q127 10 82 -28.5Q37 -67 37 -131Q37 -202 90.5 -245.5Q144 -289 240 -302L366 -320V-346Q366 -377 345.5 -394.5Q325 -412 285 -412Q247 -412 224.5 -399Q202 -386 195 -361H52Q62 -430 123 -475Q184 -520 290 -520Q400 -520 458 -471Q516 -422 516 -330V-105Q516 -80 519.5 -54.5Q523 -29 531 0ZM366 -232 265 -217Q225 -211 206 -195Q187 -179 187 -151Q187 -126 205 -113Q223 -100 253 -100Q300 -100 333 -125.5Q366 -151 366 -185Z'
    },
    n: {
      bbox: [60, 0, 565, 520], // xMin, yMin, xMax, yMax (font units, y-up)
      d: 'M60 0V-510H207V-417Q231 -459 271 -487Q319 -520 390 -520Q475 -520 520 -472.5Q565 -425 565 -345V0H415V-316Q415 -358 393.5 -379Q372 -400 331 -400Q296 -400 268.5 -384Q241 -368 225.5 -340Q210 -312 210 -274V0Z'
    },
  }
};
