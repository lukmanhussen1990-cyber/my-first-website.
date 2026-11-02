// usage: node render.js out_dir W H [mode] [args]
//   mode=frames a:b[:step]  | mode=times t1,t2,...
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=__dirname; const [out,W,H,mode,arg]=process.argv.slice(2);
const TL=JSON.parse(fs.readFileSync(path.join(root,'timeline.json')));
fs.mkdirSync(out,{recursive:true});
const types={'.js':'text/javascript','.html':'text/html','.ttf':'font/ttf','.json':'application/json'};
const port=8800+Math.floor(Math.random()*500);
const srv=http.createServer((q,s)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});s.end(d);});}).listen(port);
(async()=>{
 const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const pg=await b.newPage({viewport:{width:+W,height:+H}});
 pg.on('console',m=>{const t=m.text(); if(!/GPU stall|WebGL-/.test(t)) console.log('PAGE',t)});pg.on('pageerror',e=>console.log('ERR',e.message));
 await pg.goto(`http://localhost:${port}/index.html?w=${W}&h=${H}`);await pg.waitForFunction('window.ready===true',null,{timeout:60000});
 let jobs=[];
 if(mode==='frames'){const [a,bb,st]=arg.split(':').map(Number);for(let f=a;f<bb;f+=(st||1))jobs.push([f,...TL.frames[f]]);}
 else {for(const ts of arg.split(',')){const t=+ts;const f=Math.min(TL.frames.length-1,Math.round(t*TL.fps));jobs.push([f,...TL.frames[f]]);}}
 const t0=Date.now();let n=0;
 for(const [f,id,lt,d,gt] of jobs){
   const u=await pg.evaluate(([id,lt,d,gt])=>window.renderFrame(id,lt,d,gt),[id,lt,d,gt]);
   fs.writeFileSync(path.join(out,`f${String(f).padStart(5,'0')}.jpg`),Buffer.from(u.split(',')[1],'base64'));n++;
   if(n%60===0)console.log(`${n}/${jobs.length} ${((Date.now()-t0)/n).toFixed(0)}ms/f`);
 }
 console.log('done',n,'frames',((Date.now()-t0)/Math.max(1,n)).toFixed(0),'ms/f');
 await b.close();srv.close();
})();
