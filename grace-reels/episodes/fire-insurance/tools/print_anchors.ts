import {readFileSync} from 'node:fs';
import {makeAnchors} from '../src/anchors.ts';
const tl = JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8'));
const A = makeAnchors(tl);
const out: Record<string, number> = {};
for (const [k, v] of Object.entries(A)) if (typeof v === 'number') out[k] = v;
console.log(JSON.stringify(out));
