import {readFileSync} from 'node:fs';
import {makeAnchors} from '../src/anchors.ts';
const A = makeAnchors(JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8')));
console.log(JSON.stringify(Object.fromEntries(Object.entries(A).filter(([, v]) => typeof v === 'number'))));
