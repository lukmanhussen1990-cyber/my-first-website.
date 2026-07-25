/* Bundles the game into one self-contained HTML file.
 *   node build.js            → dist/crossy-road.html  (double-clickable)
 *   node build.js --fragment → dist/fragment.html     (no <html>/<head>/<body>,
 *                              for hosts that supply their own document shell)
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const index = read('index.html');
const css = read('css/style.css');

// Keep the script order declared in index.html.
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(f => `/* ==== ${f} ==== */\n${read(f)}`).join('\n');

// Body markup, minus the tags we are replacing.
const body = index
  .slice(index.indexOf('<canvas id="game">'), index.indexOf('<script src='))
  .trim();

const head = `<title>Crossy Road</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#7ec850">
<meta name="description" content="Crossy Road — an endless hop-across-the-traffic arcade game. Pure HTML5 canvas, no dependencies.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐔</text></svg>">
<style>
${css}
</style>`;

const content = `${head}
${body}
<script>
${js}
</script>`;

const fragment = process.argv.includes('--fragment');
const out = fragment
  ? content
  : `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
${head}
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>`;

const dir = path.join(root, 'dist');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, fragment ? 'fragment.html' : 'crossy-road.html');
fs.writeFileSync(file, out);
console.log(`${path.relative(root, file)}  ${(out.length / 1024).toFixed(1)} KB  (${scripts.length} scripts inlined)`);
