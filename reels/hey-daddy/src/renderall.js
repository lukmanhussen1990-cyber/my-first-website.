const {chromium}=require('playwright');
const [,, wi, wn, total, out]=process.argv; const fps=30;
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
 const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+__dirname+'/index.html'); await p.waitForFunction(()=>window.READY);
 for(let f=+wi; f<+total; f+=+wn){ await p.evaluate(t=>render(t), f/fps); await p.screenshot({path:`${out}/f${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:93}); }
 await b.close(); console.log('worker',wi,'done');})();
