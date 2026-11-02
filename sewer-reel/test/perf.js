import * as THREE from 'three';
const W=1080,H=1920;
const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setSize(W,H,false); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x88bbff);
const cam=new THREE.PerspectiveCamera(40,W/H,0.1,500); cam.position.set(0,5,15); cam.lookAt(0,1,0);
scene.add(new THREE.HemisphereLight(0xcfe8ff,0x5a8a3a,1.2));
const d=new THREE.DirectionalLight(0xffffff,2.5); d.position.set(10,20,8); d.castShadow=true; d.shadow.mapSize.set(2048,2048);
Object.assign(d.shadow.camera,{left:-20,right:20,top:20,bottom:-20}); scene.add(d);
const g=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x55aa44})); g.rotation.x=-Math.PI/2; g.receiveShadow=true; scene.add(g);
for(let i=0;i<300;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(0.3,32,16),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(Math.random(),0.6,0.6),roughness:0.4}));
m.position.set((Math.random()-0.5)*20,0.3+Math.random()*3,(Math.random()-0.5)*20); m.castShadow=m.receiveShadow=true; scene.add(m);}
const out=document.createElement('canvas'); out.width=W; out.height=H; const ctx=out.getContext('2d');
window.renderFrame=(f,type)=>{cam.position.x=Math.sin(f*0.05)*5; cam.lookAt(0,1,0); renderer.render(scene,cam); ctx.drawImage(renderer.domElement,0,0);
 ctx.font='700 90px Fredoka'; ctx.lineWidth=14; ctx.strokeStyle='#222'; ctx.strokeText('Hello',400,960); ctx.fillStyle='#fff'; ctx.fillText('Hello',400,960);
 return out.toDataURL(type,0.92);};
console.log(renderer.getContext().getParameter(renderer.getContext().VERSION), renderer.capabilities.maxSamples);
document.fonts.load('700 90px Fredoka').then(()=>{window.READY=true;});
