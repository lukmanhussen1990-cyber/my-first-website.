/* Bundles index.html + css + js into a single self-contained neon-surge.html */
const fs = require('fs');
const path = require('path');

const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
html = html.replace(/\s*<link rel="stylesheet" href="css\/style\.css">/,
  '\n<style>\n' + css + '\n</style>');

const scripts = [];
html = html.replace(/\s*<script src="(js\/[^"]+)"><\/script>/g, (_, src) => {
  scripts.push(fs.readFileSync(path.join(root, src), 'utf8'));
  return '';
});

html = html.replace('</body>', '<script>\n' + scripts.join('\n') + '\n</script>\n</body>');

const out = path.join(root, 'neon-surge.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(1) + ' KB,', scripts.length, 'scripts inlined');
