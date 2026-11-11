// node stills.cjs outdir f1,f2,...  -> jpgs + contact sheet
const {chromium}=require('playwright'); const http=require('http'); const fs=require('fs'); const path=require('path');
const root=path.join(__dirname,'web');
const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.ttf':'font/ttf'};
const srv=http.createServer((q,s)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});s.end(d);});}).listen(0);
(async()=>{const port=srv.address().port;const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1080,height:1920}}); p.on('console',m=>console.log('PAGE',m.text())); p.on('pageerror',e=>console.log('ERR',e.message, e.stack));
const t0=Date.now(); await p.goto(`http://localhost:${port}/index.html`); await p.waitForFunction('window.ready',null,{timeout:120000}); console.log('init ms',Date.now()-t0);
const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
for(const f of process.argv[3].split(',').map(Number)){ const t=Date.now(); const n=await p.evaluate(f=>window.renderFrame(f),f); fs.writeFileSync(path.join(out,`f${String(f).padStart(4,'0')}.jpg`), await p.screenshot({type:'jpeg',quality:90})); console.log(f,n,Date.now()-t,'ms'); }
await b.close(); srv.close();})();
