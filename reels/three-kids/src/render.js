const {chromium}=require('playwright');
const fs=require('fs'); const path=require('path');
const mode=process.argv[2]; const OUT=process.argv[3]; fs.mkdirSync(OUT,{recursive:true});
const FPS=30;
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  async function mkPage(){const p=await b.newPage({viewport:{width:1080,height:1920}});
    p.on('pageerror',e=>console.log('pageerror',e.message)); p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('console',m.text())});
    await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForFunction(()=>window.READY,null,{timeout:60000}); return p;}
  if(mode==='test'){
    const times=process.argv[4].split(',').map(Number); const p=await mkPage();
    for(const [i,t] of times.entries()){await p.evaluate(t=>renderAt(t),t); await p.screenshot({path:path.join(OUT,`t_${String(i).padStart(3,'0')}.jpg`),type:'jpeg',quality:88});}
  } else {
    const dur=await (await mkPage()).evaluate(()=>window.DURATION);
    const N=Math.ceil(dur*FPS); const W=+process.argv[4]||3; console.log('frames',N);
    let next=0; const t0=Date.now();
    await Promise.all(Array.from({length:W},async()=>{const p=await mkPage();
      while(true){const i=next++; if(i>=N)break; await p.evaluate(t=>renderAt(t),i/FPS);
        await p.screenshot({path:path.join(OUT,`f_${String(i).padStart(5,'0')}.jpg`),type:'jpeg',quality:94});
        if(i%60===0)console.log('frame',i,((Date.now()-t0)/1000).toFixed(0)+'s');}}));
  }
  await b.close();
})();
