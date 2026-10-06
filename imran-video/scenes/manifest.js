// Scene files, loaded in this order after fonts + timeline.json. Each registers itself with SCENE({...}).
window.SCENE_FILES = [
  'intro.js',
  'chatpage.js',   // chat page for the whole video: chat 0.5–3.4, dot anticipation, home 12.27–15.3 (chip, dot return, heart, word wave)
  'drop.js',       // screen flyer: dot pop-off + fall 3.52–4.20
  'thoughts.js',   // thought page 4.20–8.21
  'merge.js',      // thought page 8.21–9.60
  'blob.js',       // thought page 9.60–12.42 (+ confetti until 13.12)
  'flight.js',     // screen flyer: thumbs-up flight home 12.42–13.12
  'outro.js',      // overlay: black wipe 15.30–16.30
];
