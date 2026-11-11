// node render.cjs outdir workers [from] [to]  — interleaved, resumable
const {chromium}=require('playwright'); const http=require('http'); const fs=require('fs'); const path=require('path');
const root=path.join(__dirname,'web'); const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.ttf':'font/ttf'};
const srv=http.createServer((q,s)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});s.end(d);});}).listen(0);
const out=process.argv[2], N=+process.argv[3]||3, A=+(process.argv[4]||0), B=+(process.argv[5]||1711);
fs.mkdirSync(out,{recursive:true});
async function worker(k){
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:1080,height:1920}}); p.on('pageerror',e=>console.log('ERR',k,e.message));
  await p.goto(`http://localhost:${srv.address().port}/index.html`); await p.waitForFunction('window.ready',null,{timeout:120000});
  let n=0; const t0=Date.now();
  for(let f=A+k; f<=B; f+=N){
    const fn=path.join(out,`f${String(f).padStart(4,'0')}.jpg`); if(fs.existsSync(fn)) continue;
    await p.evaluate(f=>window.renderFrame(f),f);
    const buf=await p.screenshot({type:'jpeg',quality:95}); fs.writeFileSync(fn+'.tmp',buf); fs.renameSync(fn+'.tmp',fn); n++;
    if(n%50===0) console.log(`w${k} ${n} frames, ${((Date.now()-t0)/n).toFixed(0)} ms/f, at ${f}`);
  }
  await b.close();
}
(async()=>{ await Promise.all([...Array(N).keys()].map(worker)); srv.close(); console.log('done', fs.readdirSync(out).filter(f=>f.endsWith('.jpg')).length); })();
