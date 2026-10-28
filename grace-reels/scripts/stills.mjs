// Renders the 8 check stills for one composition into out/stills/.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const comp = process.argv[2] ?? 'ThankYou1KVertical';
const times = [0.3, 0.9, 1.3, 2.0, 2.45, 3.0, 4.0, 4.9];
fs.mkdirSync('out/stills', {recursive: true});
for (const t of times) {
	const frame = Math.round(t * 30);
	execFileSync('npx', ['remotion', 'still', comp, `out/stills/${comp}_${t.toFixed(2)}s.png`, `--frame=${frame}`, '--gl=swangle'], {stdio: 'inherit'});
}
