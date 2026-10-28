// Writes timeline/events.json (scene + event times) for the sound-effects mix.
const fs = require('fs');
const TLB = require('./js/timeline.js');
const T = TLB.build(require('./timeline/words.json'));
const out = { OFFSET: T.OFFSET, END: T.END, scenes: T.scenes, E: T.E };
fs.writeFileSync(__dirname + '/timeline/events.json', JSON.stringify(out, null, 1));
console.log('events.json written, END =', T.END);
