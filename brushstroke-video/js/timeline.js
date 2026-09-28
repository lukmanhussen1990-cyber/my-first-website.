/* timeline.js - everything you might want to edit lives here.
   Times are in seconds from the start of the video and are matched to the
   reference clip, so the original audio lines up when laid underneath. */
(function () {
  'use strict';
  const BV = window.BV;

  BV.config = {
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 27.0,

    // Written in brush lettering on the end card, e.g. '@yourname'.
    // Leave empty for no handle.
    handle: '',

    // Each phrase is a stack of words; each word is [text, time it starts
    // being written]. `end` is when the phrase has faded out. `dy` nudges
    // the stack up (negative) or down in px.
    phrases: [
      { words: [['what', 0.9], ['could', 1.2], ['this', 1.45], ['be', 1.7]], end: 3.35 },
      { words: [['between', 3.4], ['you', 4.0], ['and', 4.45], ['me?', 4.85]], end: 5.55 },
      { words: [['oh', 5.45]], end: 7.98 },
      { words: [['all', 7.9], ['i', 8.6], ['dream', 9.1], ['of', 9.9]], end: 10.85 },
      { words: [['is', 10.82], ['your', 11.1], ['eyes', 11.42]], end: 12.45 },
      { words: [['all', 12.36], ['i', 12.75], ['long', 13.0], ['for', 13.4]], end: 14.3 },
      { words: [['is', 14.25], ['your', 14.5], ['touch', 14.75]], end: 16.5, dy: -70 },
      { words: [['and', 16.42], ['darlin', 16.62], ['something', 17.4]], end: 18.5 },
      { words: [['tells', 18.5], ['me', 19.05], ['tells', 19.38], ['me', 19.7]], end: 20.45 },
      { words: [["it's", 20.42], ['enough', 20.65]], end: 999 },
    ],

    // Illustrated interludes (see art.js). The band widens from 16:9 to 3:2
    // and the paper warms to sepia while the drawing paints itself in.
    scenes: [
      { art: 'couple', t0: 3.0, t1: 5.6 },
      { art: 'faces', t0: 10.45, t1: 12.62 },
      { art: 'hands', t0: 13.95, t1: 16.72 },
    ],

    introEnd: 0.42, // brush-ring intro, then the paper is swept in
    dimAt: 22.6, // paper dims
    endAt: 23.1, // dark end card with the ensō
  };
})();
