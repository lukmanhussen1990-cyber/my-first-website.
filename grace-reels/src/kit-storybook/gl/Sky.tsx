// WebGL painted sky: vertical gradient, sun/moon glow, soft fbm clouds, twinkling stars.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { program, setUniforms, hex3 } from './glUtil';

export type SkyLook = {
  top: string;
  mid: string;
  horizon: string;
  horizonY?: number; // 0 top .. 1 bottom (where the horizon colour peaks)
  glow?: string;
  glowPos?: [number, number];
  glowSize?: number;
  glowStrength?: number;
  clouds?: number; // 0..1
  cloudDark?: string;
  cloudLit?: string;
  cloudY?: [number, number]; // band where clouds live
  stars?: number; // 0..1
  moon?: { pos: [number, number]; r: number; color: string } | null;
  drift?: number; // cloud drift speed
};

const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }`;
const FS = `precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime, uHorizonY, uGlowSize, uGlowStr, uClouds, uStars, uMoonR, uMoonOn, uDrift;
uniform vec3 uTop, uMid, uHor, uGlow, uCD, uCL, uMoonC; uniform vec2 uGlowPos, uMoonPos, uCloudY;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
void main(){
  vec2 uv = vUv;
  float asp = uRes.x/uRes.y;
  float y = uv.y;
  float h = uHorizonY;
  vec3 col = y < h*.55 ? mix(uTop, uMid, smoothstep(0., h*.55, y)) : mix(uMid, uHor, smoothstep(h*.55, h, y));
  if (y > h) col = mix(uHor, uMid*.8, smoothstep(h, 1., y)*.6);
  vec2 d = (uv - uGlowPos) * vec2(asp, 1.);
  float g = exp(-dot(d,d)/(uGlowSize*uGlowSize));
  col += uGlow * (g*uGlowStr + exp(-dot(d,d)/(uGlowSize*uGlowSize*.06))*uGlowStr*.6);
  // clouds: stretched fbm, lit toward the glow
  vec2 cp = vec2(uv.x*1.6*asp + uTime*uDrift, uv.y*7.);
  float c = fbm(cp + vec2(fbm(cp*.6+uTime*uDrift*.5)*1.4, 0.));
  float band = smoothstep(uCloudY.x-.06, uCloudY.x+.05, y) * (1.-smoothstep(uCloudY.y-.05, uCloudY.y+.04, y));
  float cm = smoothstep(.48, .78, c) * uClouds * band;
  vec3 cc = mix(uCD, uCL, clamp(g*1.8 + (c-.5), 0., 1.));
  col = mix(col, cc, cm*.85);
  // stars
  vec2 sp = uv*uRes/2.5; vec2 ip = floor(sp); float hs = hash(ip);
  float tw = .55+.45*sin(uTime*1.7 + hs*90.);
  float star = step(.9972, hs) * tw * uStars * (1.-smoothstep(h*.45, h*.95, y)) * (1.-cm);
  col += vec3(.95,.92,1.) * star * smoothstep(.45, 0., length(fract(sp)-.5)) * (.6 + hash(ip+3.)*.8);
  // moon
  if (uMoonOn > .5) {
    vec2 md = (uv - uMoonPos)*vec2(asp,1.);
    float r = length(md);
    float disc = smoothstep(uMoonR, uMoonR*.92, r);
    float crater = fbm(md*40./max(uMoonR*30.,.001)+3.)*.25;
    col = mix(col, uMoonC*(1.-crater), disc);
    col += uMoonC * exp(-r*r/(uMoonR*uMoonR*9.)) * .35 + uMoonC*exp(-r*r/(uMoonR*uMoonR*60.))*.12;
  }
  // soft painterly grain
  col += (hash(uv*uRes + 7.) - .5) * .018;
  gl_FragColor = vec4(col, 1.);
}`;

export const Sky: React.FC<{ look: SkyLook; res?: number; pad?: number }> = ({ look, res = 0.5, pad = 320 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGLRenderingContext; p: WebGLProgram } | null>(null);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const W = width + 2 * pad;
  const H = height + 2 * pad;
  const cw = Math.round(W * res);
  const ch = Math.round(H * res);
  useLayoutEffect(() => {
    if (!glRef.current) {
      const gl = ref.current!.getContext('webgl', { preserveDrawingBuffer: true, antialias: false })!;
      const p = program(gl, VS, FS);
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      glRef.current = { gl, p };
    }
    const { gl, p } = glRef.current;
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(p);
    const m = look.moon;
    setUniforms(gl, p, {
      uRes: [cw, ch],
      uTime: frame / fps,
      uHorizonY: look.horizonY ?? 0.55,
      uTop: hex3(look.top),
      uMid: hex3(look.mid),
      uHor: hex3(look.horizon),
      uGlow: hex3(look.glow ?? '#000000'),
      uGlowPos: look.glowPos ?? [0.5, 0.5],
      uGlowSize: look.glowSize ?? 0.3,
      uGlowStr: look.glowStrength ?? 0.6,
      uClouds: look.clouds ?? 0,
      uCD: hex3(look.cloudDark ?? '#000000'),
      uCL: hex3(look.cloudLit ?? '#ffffff'),
      uCloudY: look.cloudY ?? [0.1, 0.5],
      uStars: look.stars ?? 0,
      uMoonOn: m ? 1 : 0,
      uMoonPos: m?.pos ?? [0, 0],
      uMoonR: m?.r ?? 0.05,
      uMoonC: hex3(m?.color ?? '#ffffff'),
      uDrift: look.drift ?? 0.02,
    });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [frame, cw, ch, look]);
  useLayoutEffect(() => () => {
    glRef.current?.gl.getExtension('WEBGL_lose_context')?.loseContext();
    glRef.current = null;
  }, []);
  return <canvas ref={ref} width={cw} height={ch} style={{ position: 'absolute', left: -pad, top: -pad, width: W, height: H }} />;
};
