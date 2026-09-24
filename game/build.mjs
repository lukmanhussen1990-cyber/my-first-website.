// Bundles the game into ONE self-contained HTML file (JS + CSS + fonts inlined).
//   node build.mjs                          → dist/index.html
//   node build.mjs --out dist/x.html        → custom output path
//   node build.mjs --entry src/foo.js       → alternative entry (test harness pages)
//   node build.mjs --dev                    → no minification, inline sourcemap
//   node build.mjs --release                → also copies to ../index.html (web) and ../android/assets/index.html (APK)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes(name);

const entry = path.resolve(root, opt('--entry', 'src/main.js'));
const out = path.resolve(root, opt('--out', 'dist/index.html'));
const dev = flag('--dev');
// --stubs: redirect imports of other teams' modules (chars/world/fx/audio/ui) to the frozen
// stub snapshots in src/_stubs so gameplay can be tested while those modules are in flux.
const stubPlugin = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /(^|\/)(chars|world|fx|audio|ui)\/[^/]+\.js$/ }, (a) => {
      if (a.importer.includes(`${path.sep}_stubs${path.sep}`)) return undefined;
      const abs = path.resolve(a.resolveDir, a.path);
      const rel = path.relative(path.join(root, 'src'), abs);
      const stub = path.join(root, 'src/_stubs', rel);
      return fs.existsSync(stub) ? { path: stub } : undefined;
    });
  },
};

function fontCSS() {
  const manifest = path.join(root, 'assets/fonts/fonts.json');
  if (!fs.existsSync(manifest)) return '';
  const list = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  return list.map((f) => {
    const b64 = fs.readFileSync(path.join(root, 'assets/fonts', f.file)).toString('base64');
    return `@font-face{font-family:'${f.family}';src:url(data:font/woff2;base64,${b64}) format('woff2');` +
      `font-weight:${f.weight || 400};font-style:${f.style || 'normal'};font-display:block;` +
      (f.unicodeRange ? `unicode-range:${f.unicodeRange};` : '') + '}';
  }).join('\n');
}

async function build() {
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    target: ['chrome90'],
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    write: false,
    legalComments: 'none',
    define: { 'import.meta.env.DEV': dev ? 'true' : 'false' },
    logLevel: 'warning',
    plugins: flag('--stubs') ? [stubPlugin] : [],
  });
  let js = result.outputFiles[0].text;
  if (/<\/script/i.test(js)) throw new Error('bundle contains "</script" — cannot inline safely');
  const css = fs.readFileSync(path.join(root, 'src/ui/style.css'), 'utf8');
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>趙雲 · 長坂無雙 — Zhao Yun: Changban Musou</title>
<style>
${fontCSS()}
${css}
</style>
</head>
<body>
<canvas id="game"></canvas>
<div id="ui"></div>
<script>
${js}
</script>
</body>
</html>
`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`built ${path.relative(root, out)} (${kb} KB) in ${Date.now() - t0} ms`);
  if (flag('--release')) {
    const targets = [path.resolve(root, '../index.html'), path.resolve(root, '../android/assets/index.html')];
    for (const t of targets) { fs.mkdirSync(path.dirname(t), { recursive: true }); fs.copyFileSync(out, t); console.log('copied →', path.relative(path.resolve(root, '..'), t)); }
  }
}

if (flag('--watch')) {
  await build();
  let timer = null;
  fs.watch(path.join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 150);
  });
  console.log('watching src/ …');
} else {
  await build();
}
