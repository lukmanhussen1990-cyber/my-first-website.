import * as THREE from './three.module.js';
export function makePost(W, H) {
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const u = {
    tD: { value: rt.texture }, uTime: { value: 0 }, uSwirl: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) },
    uVig: { value: 0.35 }, uGrain: { value: 0.035 }, uCA: { value: 0 }, uSat: { value: 1.08 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uXray: { value: 0 }, uExp: { value: 1.0 }, uContrast: { value: 1.04 }, uLift: { value: 0.0 }, uDark: { value: 0 },
    uBlurR: { value: 0 }, uAspect: { value: H / W }, uZoomBlur: { value: 0 }, uDream: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `
      precision highp float;
      uniform sampler2D tD; uniform float uTime,uSwirl,uFlash,uVig,uGrain,uCA,uSat,uXray,uExp,uContrast,uLift,uDark,uAspect,uZoomBlur,uDream;
      uniform vec3 uTint,uFlashCol; varying vec2 vUv;
      vec3 rrt(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
      vec3 aces(vec3 c){ const mat3 IN=mat3(0.59719,0.07600,0.02840,0.35458,0.90834,0.13383,0.04823,0.01566,0.83777);
        const mat3 OUT=mat3(1.60475,-0.10208,-0.00327,-0.53108,1.10813,-0.07276,-0.07367,-0.00605,1.07602);
        c*=1.0/0.6; c=IN*c; c=rrt(c); c=OUT*c; return clamp(c,0.,1.); }
      vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1.0/2.4))-0.055, step(0.0031308,c)); }
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      vec3 tex(vec2 uv){ return texture2D(tD, clamp(uv,0.001,0.999)).rgb; }
      void main(){
        vec2 uv=vUv;
        vec2 p=(uv-0.5)*vec2(1.0,uAspect);
        float r=length(p);
        if(uSwirl!=0.0){ float a=uSwirl*smoothstep(1.1,0.0,r)*smoothstep(1.1,0.0,r); float c=cos(a),s=sin(a); p=mat2(c,-s,s,c)*p; uv=p/vec2(1.0,uAspect)+0.5; }
        vec3 col;
        if(uZoomBlur>0.0){ col=vec3(0.); vec2 d=(uv-0.5); for(int i=0;i<10;i++){ float k=1.0-uZoomBlur*float(i)/10.0*0.12; col+=tex(0.5+d*k);} col/=10.0; }
        else if(uCA>0.0){ vec2 d=(uv-0.5)*uCA; col=vec3(tex(uv+d).r, tex(uv).g, tex(uv-d).b); }
        else col=tex(uv);
        if(uDream>0.0){ vec3 b=vec3(0.); for(int i=0;i<8;i++){ float a=float(i)*0.785; b+=tex(uv+vec2(cos(a),sin(a)/uAspect)*0.012); } b/=8.0; col=mix(col, max(col,b)*1.05+vec3(0.04,0.02,0.05), uDream); }
        col=srgb(aces(col*uExp));
        col*=uTint;
        float l=dot(col,vec3(0.299,0.587,0.114));
        col=mix(vec3(l),col,uSat);
        col=(col-0.5)*uContrast+0.5+uLift;
        if(uXray>0.0){ vec3 xr=vec3(0.05,0.12,0.28)+vec3(0.35,0.8,1.0)*pow(l,1.2)*1.4; col=mix(col,xr,uXray); }
        float v=smoothstep(1.05,0.25,length((vUv-0.5)*vec2(1.0,0.9)*1.6));
        col*=mix(1.0-uVig,1.0,v);
        col*=1.0-uDark;
        col+=(h(vUv*vec2(1080.,1920.)+fract(uTime*7.13))-0.5)*uGrain;
        col=mix(col,uFlashCol,clamp(uFlash,0.,1.));
        gl_FragColor=vec4(clamp(col,0.,1.),1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { rt, u, scene, cam };
}
