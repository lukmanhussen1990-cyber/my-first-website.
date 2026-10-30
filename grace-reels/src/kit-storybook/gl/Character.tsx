// A painted character cutout brought to life on a WebGL mesh:
// breathing, sway, "bones" (head tilt, arm lift), hair flutter, blinks drawn as eyelids,
// colour grade + rim light to match each scene, depth blur, and a blend into glowing line art.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadImage, program, setUniforms, texture } from './glUtil';
import { hash } from '../core/random';

export type Eye = { c: [number, number]; r: [number, number]; a?: number }; // image px, degrees
export type Bone = { pivot: [number, number]; center: [number, number]; radius: [number, number]; angle: number }; // image px
export type Flutter = { center: [number, number]; radius: [number, number]; amp: number; freq?: number };
export type CharacterSpec = {
  src: string; // path in public/
  line?: string; // matching line-art png in public/
  size: [number, number]; // image px
  eyes?: Eye[];
  skin?: [number, number, number]; // eyelid colour 0..1
  lash?: [number, number, number];
  flutter?: Flutter[];
  breathBand?: [number, number]; // image y range (px) of chest that breathes
};
export type Look = {
  tint?: [number, number, number];
  lift?: [number, number, number];
  sat?: number;
  exposure?: number;
  rim?: [number, number, number];
  rimDir?: [number, number]; // direction light comes FROM (screen space, y down)
  rimStrength?: number;
  rimWidth?: number; // image px
};

const VS = `attribute vec2 aUv;
uniform vec2 uSize; uniform float uPad, uTime, uBreath, uSway, uSeed;
uniform vec2 uBreathBand;
uniform vec4 uB0a, uB0b, uB1a, uB1b, uB2a, uB2b; // pivot.xy center.xy | radius.xy angle on
varying vec2 vUv;
vec2 bone(vec2 p, vec4 a, vec4 b){
  if (b.w < .5) return p;
  vec2 q = (p - a.zw) / b.xy;
  float w = 1. - smoothstep(.65, 1., length(q));
  float ang = b.z * w;
  vec2 d = p - a.xy; float c = cos(ang), s = sin(ang);
  return a.xy + vec2(c*d.x - s*d.y, s*d.x + c*d.y);
}
void main(){
  vec2 p = aUv * uSize; // image px, y down
  p = bone(p, uB0a, uB0b); p = bone(p, uB1a, uB1b); p = bone(p, uB2a, uB2b);
  float v = aUv.y;
  // breathing: chest band rises a touch, shoulders follow
  float band = smoothstep(uBreathBand.x - 120., uBreathBand.x, p.y) * (1. - smoothstep(uBreathBand.y, uBreathBand.y + 220., p.y));
  float br = sin(uTime * 1.55 + uSeed) * .5 + .5;
  p.y -= uBreath * br * (band * 6. + smoothstep(uBreathBand.y, 0., p.y) * 4.);
  p.x += (p.x - uSize.x*.5) * uBreath * br * band * .004;
  // whole-body sway, anchored at the bottom
  float sw = sin(uTime * .7 + uSeed * 3.) * .6 + sin(uTime * 1.13 + uSeed) * .4;
  p.x += uSway * sw * pow(1. - v, 1.6) * 10.;
  vUv = aUv;
  vec2 full = uSize * (1. + 2.*uPad);
  vec2 n = (p + uSize*uPad) / full;
  gl_Position = vec4(n.x*2.-1., 1.-n.y*2., 0., 1.);
}`;

const FS = `precision highp float;
varying vec2 vUv;
uniform sampler2D uTex, uLine;
uniform vec2 uSize; uniform float uTime, uSeed;
uniform vec3 uTint, uLift, uRim, uSkin, uLash; uniform float uSat, uExp, uRimStr, uRimW; uniform vec2 uRimDir;
uniform float uBlur, uOpacity, uLineMix, uGhost, uHasLine, uReveal; uniform vec2 uRevealC;
uniform vec4 uE0, uE1; uniform float uE0a, uE1a, uBlink, uEyesOn;
uniform vec4 uF0, uF1, uF2; uniform vec3 uFa;
vec4 samp(vec2 uv){ return texture2D(uTex, uv); }
vec2 flutter(vec2 uv){
  vec2 p = uv*uSize; vec2 off = vec2(0.);
  vec4 F[3]; F[0]=uF0; F[1]=uF1; F[2]=uF2;
  for (int i=0;i<3;i++){
    if (F[i].z < 1.) continue;
    float w = 1. - smoothstep(.5, 1., length((p - F[i].xy)/F[i].zw));
    float a = i==0 ? uFa.x : (i==1 ? uFa.y : uFa.z);
    off.x += w * a * (sin(uTime*1.3 + p.y*.012 + float(i)*2. + uSeed) + .4*sin(uTime*2.3 + p.y*.031));
    off.y += w * a * .35 * sin(uTime*1.1 + p.x*.01 + float(i));
  }
  return uv - off/uSize;
}
vec4 blurred(vec2 uv){
  if (uBlur < .3) return samp(uv);
  vec2 px = uBlur / uSize;
  vec4 acc = vec4(0.);
  acc += samp(uv);
  acc += samp(uv + px*vec2( .53, .85)); acc += samp(uv + px*vec2(-.85, .53));
  acc += samp(uv + px*vec2(-.53,-.85)); acc += samp(uv + px*vec2( .85,-.53));
  acc += samp(uv + px*vec2( .25,-.4 )); acc += samp(uv + px*vec2(-.4 ,-.25));
  acc += samp(uv + px*vec2(-.25, .4 )); acc += samp(uv + px*vec2( .4 , .25));
  acc += samp(uv + px*vec2( 1.,  0. )); acc += samp(uv + px*vec2(-1., 0.));
  acc += samp(uv + px*vec2( 0.,  1. )); acc += samp(uv + px*vec2( 0.,-1.));
  return acc / 13.;
}
vec3 lid(vec3 c, vec2 p, vec4 E, float ang){
  vec2 d = p - E.xy; float cs = cos(ang), sn = sin(ang);
  vec2 q = vec2(cs*d.x + sn*d.y, -sn*d.x + cs*d.y) / (E.zw*1.18);
  if (abs(q.x) > 1. || abs(q.y) > 1.25) return c;
  float inside = 1. - smoothstep(.72, 1.04, length(q*vec2(1., .9)));
  float edge = -1.05 + 2.0*uBlink - .2*q.x*q.x*uBlink;
  float cover = smoothstep(edge+.08, edge-.06, q.y) * inside;
  vec3 skin = uSkin * (.9 + .1*smoothstep(edge, -1., q.y));
  vec3 o = mix(c, skin, cover * step(.02, uBlink));
  float lash = smoothstep(.11, .02, abs(q.y - edge)) * inside * step(.15, uBlink) * smoothstep(1., .55, abs(q.x));
  return mix(o, uLash, lash*.9);
}
void main(){
  vec2 uv = flutter(vUv);
  vec4 t = blurred(uv);
  vec3 c = t.a > 0. ? t.rgb : vec3(0.);
  float a = t.a;
  if (uEyesOn > .5 && uBlink > 0.) { vec2 p = vUv*uSize; c = lid(c, p, uE0, uE0a); if (uE1.z > 0.) c = lid(c, p, uE1, uE1a); }
  // grade
  c = c * uExp * uTint + uLift;
  float l = dot(c, vec3(.299,.587,.114));
  c = mix(vec3(l), c, uSat);
  // rim light from alpha gradient
  vec2 px = uRimW / uSize;
  float ax = texture2D(uTex, uv + vec2(px.x,0.)).a - texture2D(uTex, uv - vec2(px.x,0.)).a;
  float ay = texture2D(uTex, uv + vec2(0.,px.y)).a - texture2D(uTex, uv - vec2(0.,px.y)).a;
  vec2 g = vec2(ax, ay);
  float edge = clamp(length(g)*1.2, 0., 1.);
  vec2 nrm = length(g) > .001 ? -normalize(g) : vec2(0.);
  float facing = clamp(dot(nrm, -normalize(uRimDir)), 0., 1.);
  c += uRim * edge * facing * uRimStr * a;
  vec4 painted = vec4(c * a, a);
  // line art (premultiplied)
  if (uHasLine > .5 && uLineMix > 0.) {
    vec4 ln = texture2D(uLine, uv);
    float rv = uReveal >= 1.4 ? 1. : smoothstep(uReveal, uReveal - .14, length((vUv - uRevealC)*vec2(uSize.x/uSize.y, 1.)));
    vec4 lp = vec4(ln.rgb*ln.a, ln.a) * uLineMix * rv;
    vec4 under = uGhost > .5 ? vec4(0.) : painted * (1. - uLineMix);
    painted = lp + under * (1. - lp.a);
  }
  gl_FragColor = painted * uOpacity;
}`;

const GRID_X = 56;
const GRID_Y = 84;

export type CharacterProps = {
  spec: CharacterSpec;
  // placement in layer/world px: image point anchor -> (x, y); displayed image height h
  x: number;
  y: number;
  h: number;
  anchor?: [number, number]; // 0..1 of image, default bottom centre
  mirror?: boolean;
  breath?: number;
  sway?: number;
  seed?: number;
  bones?: Bone[];
  blink?: number | 'auto'; // 0..1 forced lid closure, or seeded automatic blinking
  look?: Look;
  blur?: number; // display px
  opacity?: number;
  lineMix?: number;
  ghost?: boolean;
  reveal?: number; // line-art reveal radius (0..1.5), 1+ = fully drawn
  revealCenter?: [number, number];
  res?: number;
  style?: React.CSSProperties;
};

// seeded blink schedule: one ~4 frame blink every 2-5 s
export function autoBlink(frame: number, fps: number, seed: number) {
  let t = 0.6 + hash(seed, 0) * 1.5;
  for (let i = 1; i < 200; i++) {
    const start = Math.round(t * fps);
    const d = frame - start;
    if (d >= 0 && d < 5) return [0.55, 1, 1, 0.6, 0.2][d];
    if (start > frame) break;
    t += 2 + hash(seed, i) * 3;
  }
  return 0;
}

export const Character: React.FC<CharacterProps> = (props) => {
  const { spec, x, y, h, anchor = [0.5, 1], mirror, breath = 1, sway = 0.5, seed = 1, bones = [], blink = 'auto', look = {}, blur = 0, opacity = 1, lineMix = 0, ghost, reveal = 1.5, revealCenter = [0.5, 0.3], res = 1, style } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<{ gl: WebGLRenderingContext; p: WebGLProgram; tex: WebGLTexture; line?: WebGLTexture; n: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender(`character ${spec.src}`));
  const released = useRef(false);
  const [iw, ih] = spec.size;
  const PAD = 0.12;
  const scale = h / ih;
  const dispW = iw * scale * (1 + 2 * PAD);
  const dispH = ih * scale * (1 + 2 * PAD);
  const cw = Math.min(2400, Math.round(dispW * res));
  const ch = Math.min(3600, Math.round(dispH * res));

  useLayoutEffect(() => {
    let dead = false;
    Promise.all([loadImage(staticFile(spec.src)), spec.line ? loadImage(staticFile(spec.line)) : Promise.resolve(null)])
      .then(([img, ln]) => {
        if (dead) return;
        const gl = ref.current!.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: true })!;
        const p = program(gl, VS, FS);
        const verts: number[] = [];
        for (let j = 0; j < GRID_Y; j++)
          for (let i = 0; i < GRID_X; i++) {
            const q = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
            for (const [a, b] of q) verts.push(a / GRID_X, b / GRID_Y);
          }
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(p, 'aUv');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        const tex = texture(gl, img);
        let line: WebGLTexture | undefined;
        if (ln) {
          gl.activeTexture(gl.TEXTURE1);
          line = texture(gl, ln);
        }
        st.current = { gl, p, tex, line, n: verts.length / 2 };
        setReady(true);
      })
      .catch((e) => {
        throw e;
      });
    return () => {
      dead = true;
      st.current?.gl.getExtension('WEBGL_lose_context')?.loseContext();
      st.current = null;
    };
  }, [spec.src, spec.line]);

  useLayoutEffect(() => {
    const s = st.current;
    if (!s) return;
    const { gl, p } = s;
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(gl.getUniformLocation(p, 'uTex'), 0);
    gl.uniform1i(gl.getUniformLocation(p, 'uLine'), 1);
    const t = frame / fps;
    const b = (i: number) => {
      const bo = bones[i];
      if (!bo) return { a: [0, 0, 0, 0], b: [1, 1, 0, 0] };
      return { a: [...bo.pivot, ...bo.center], b: [...bo.radius, (bo.angle * Math.PI) / 180, 1] };
    };
    const [b0, b1, b2] = [b(0), b(1), b(2)];
    const eyes = spec.eyes ?? [];
    const e = (i: number) => (eyes[i] ? [...eyes[i].c, ...eyes[i].r] : [0, 0, 0, 0]);
    const fl = spec.flutter ?? [];
    const f = (i: number) => (fl[i] ? [...fl[i].center, ...fl[i].radius] : [0, 0, 0, 0]);
    const blinkAmt = blink === 'auto' ? autoBlink(frame, fps, seed) : blink;
    setUniforms(gl, p, {
      uSize: [iw, ih],
      uPad: PAD,
      uTime: t,
      uSeed: seed,
      uBreath: breath,
      uSway: sway,
      uBreathBand: spec.breathBand ?? [ih * 0.55, ih * 0.8],
      uB0a: b0.a, uB0b: b0.b, uB1a: b1.a, uB1b: b1.b, uB2a: b2.a, uB2b: b2.b,
      uTint: look.tint ?? [1, 1, 1],
      uLift: look.lift ?? [0, 0, 0],
      uSat: look.sat ?? 1,
      uExp: look.exposure ?? 1,
      uRim: look.rim ?? [1, 0.8, 0.5],
      uRimDir: look.rimDir ?? [1, -0.4],
      uRimStr: look.rimStrength ?? 0,
      uRimW: look.rimWidth ?? 7,
      uBlur: blur / scale,
      uOpacity: opacity,
      uLineMix: lineMix,
      uGhost: ghost ? 1 : 0,
      uHasLine: s.line ? 1 : 0,
      uReveal: reveal,
      uRevealC: revealCenter,
      uE0: e(0), uE1: e(1),
      uE0a: ((eyes[0]?.a ?? 0) * Math.PI) / 180,
      uE1a: ((eyes[1]?.a ?? 0) * Math.PI) / 180,
      uBlink: blinkAmt,
      uEyesOn: eyes.length ? 1 : 0,
      uSkin: spec.skin ?? [0.85, 0.6, 0.45],
      uLash: spec.lash ?? [0.23, 0.14, 0.09],
      uF0: f(0), uF1: f(1), uF2: f(2),
      uFa: [fl[0]?.amp ?? 0, fl[1]?.amp ?? 0, fl[2]?.amp ?? 0],
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    if (s.line) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, s.line);
    }
    gl.drawArrays(gl.TRIANGLES, 0, s.n);
    if (ready && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  });

  const left = x - anchor[0] * iw * scale - PAD * iw * scale;
  const top = y - anchor[1] * ih * scale - PAD * ih * scale;
  return (
    <canvas
      ref={ref}
      width={cw}
      height={ch}
      style={{
        position: 'absolute',
        left,
        top,
        width: dispW,
        height: dispH,
        transform: mirror ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    />
  );
};
