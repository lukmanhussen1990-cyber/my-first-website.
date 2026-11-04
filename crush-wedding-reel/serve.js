// Serve local project files to Playwright via request interception
const fs=require('fs'),path=require('path');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.css':'text/css'};
module.exports=async function route(page, root){
  await page.route('http://local/**', async (route)=>{
    const u=new URL(route.request().url()); const p=path.join(root, decodeURIComponent(u.pathname));
    if(!fs.existsSync(p)) return route.fulfill({status:404,body:'nf'});
    route.fulfill({status:200, body:fs.readFileSync(p), headers:{'content-type':types[path.extname(p)]||'application/octet-stream'}});
  });
};
