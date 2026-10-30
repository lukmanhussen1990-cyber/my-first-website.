// Episode props drawn in code: the serpent, snake eyes in the dark, guards and disciples
// as torch-lit silhouettes, a tear, small ghost tags and the "sent" message bubble.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { noise1 } from '../../kit-storybook/core/random';
import { clamp01, easeInOut, easeOut } from '../../kit-storybook/core/time';
import { SANS, SERIF } from '../../kit-storybook/text/fonts';

// a sleek emerald + gold serpent along a curve; `slide` 0..1 pulls it back into the dark
export const Serpent: React.FC<{ x: number; y: number; scale?: number; slide?: number; glint?: number }> = ({ x, y, scale = 1, slide = 0, glint = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const W = 760;
  const H = 520;
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const t = frame / 30;
    // the branch it rests on, with a few leaves
    ctx.strokeStyle = '#120d12';
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, 350);
    ctx.quadraticCurveTo(340, 290, 790, 380);
    ctx.stroke();
    // body centre line: head raised on the left, coils draped over the branch
    const N = 160;
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const s = u + slide * 1.2;
      const lift = Math.max(0, 1 - s * 5);
      pts.push([150 + s * 620 + Math.sin(s * 8 + t * 0.7) * 22, 318 + Math.sin(s * 6.5 + 0.8) * 34 - lift * lift * 140 + noise1(t * 0.5 + s * 3, 2) * 5]);
    }
    const width = (u: number) => 26 * (u < 0.1 ? 0.7 + u * 3 : 1 - Math.max(0, u - 0.55) * 2.1);
    const pass = (fn: (px: number, py: number, w: number, u: number, i: number) => void) => {
      for (let i = N; i >= 1; i--) fn(pts[i][0], pts[i][1], Math.max(2, width(i / N)), i / N, i);
    };
    pass((px, py, w) => { ctx.fillStyle = '#04110b'; ctx.beginPath(); ctx.arc(px, py, w + 3, 0, Math.PI * 2); ctx.fill(); });
    pass((px, py, w) => { ctx.fillStyle = '#145a3a'; ctx.beginPath(); ctx.arc(px, py, w, 0, Math.PI * 2); ctx.fill(); });
    pass((px, py, w) => { ctx.fillStyle = '#2f8f5c'; ctx.beginPath(); ctx.arc(px - w * 0.15, py - w * 0.35, w * 0.55, 0, Math.PI * 2); ctx.fill(); });
    pass((px, py, w, u, i) => {
      if (i % 3) return;
      ctx.fillStyle = 'rgba(236,196,92,0.7)';
      ctx.beginPath();
      ctx.ellipse(px, py - w * 0.5, w * 0.22, w * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    pass((px, py, w) => { ctx.fillStyle = 'rgba(190,255,210,0.18)'; ctx.beginPath(); ctx.arc(px - w * 0.3, py - w * 0.6, w * 0.22, 0, Math.PI * 2); ctx.fill(); });
    // head: a smooth wedge with clever narrow eyes
    const [hx, hy] = pts[0];
    const [nx, ny] = pts[4];
    const ang = Math.atan2(hy - ny, hx - nx);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = '#04110b';
    ctx.beginPath();
    ctx.ellipse(6, 0, 40, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, -24, 0, 24);
    g.addColorStop(0, '#3aa36a');
    g.addColorStop(0.6, '#165c3b');
    g.addColorStop(1, '#0b2d1d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-28, -18);
    ctx.quadraticCurveTo(26, -26, 44, -2);
    ctx.quadraticCurveTo(26, 22, -28, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,212,104,${0.95 * glint})`;
    ctx.shadowColor = 'rgba(255,200,90,0.95)';
    ctx.shadowBlur = 16 * glint;
    for (const sy of [-9, 9]) {
      ctx.beginPath();
      ctx.ellipse(16, sy, 8, 2.6, sy < 0 ? -0.25 : 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, [frame, slide, glint]);
  return <canvas ref={ref} width={W} height={H} style={{ position: 'absolute', left: x - (W / 2) * scale, top: y - (H / 2) * scale, width: W * scale, height: H * scale }} />;
};

// two narrow gold eye-glints in the branches (out of focus behind Adam)
export const SnakeEyes: React.FC<{ x: number; y: number; size?: number; open?: number }> = ({ x, y, size = 1, open = 1 }) => {
  const frame = useCurrentFrame();
  const blink = frame % 70 < 3 ? 0.15 : 1;
  const a = open * blink * (0.75 + 0.25 * Math.sin(frame * 0.2));
  const eye = (dx: number) => (
    <div style={{ position: 'absolute', left: x + dx * size - 14 * size, top: y - 4 * size, width: 28 * size, height: 8 * size * a, borderRadius: '50%', background: 'radial-gradient(ellipse, #fff3c4 0%, #ffcf5a 45%, rgba(255,180,60,0) 100%)', boxShadow: `0 0 ${24 * size}px rgba(255,200,90,${0.8 * a})` }} />
  );
  return (
    <>
      {eye(-22)}
      {eye(22)}
    </>
  );
};

// a temple guard: hooded cloak, one arm raised to hold a torch (no weapons)
const CLOAK = 'M60 34 C 86 34 100 50 102 72 C 128 84 142 108 144 146 L 150 300 L 136 420 L 98 420 L 92 330 L 84 420 L 40 420 L 30 330 L 22 420 L 4 420 L -2 300 L 4 146 C 6 108 22 84 34 72 C 34 50 40 34 60 34 Z';
const HOOD = 'M60 8 C 92 8 108 34 106 66 C 104 90 92 100 60 100 C 28 100 14 88 14 64 C 14 34 30 8 60 8 Z';
export const Guards: React.FC<{ x: number; y: number; h: number; count?: number; spacing?: number; walk?: number; light?: number }> = ({ x, y, h, count = 5, spacing = 150, walk = 0, light = 1 }) => {
  const frame = useCurrentFrame();
  const s = h / 420;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const bob = Math.abs(Math.sin((frame + i * 7) * 0.21)) * 6 * walk;
        const gx = x + i * spacing + (i % 2) * 30;
        const gy = y + (i % 2) * 40 - bob;
        const sc = s * (1 - (i % 2) * 0.12);
        const warm = `rgba(255,150,70,${0.75 * light})`;
        return (
          <svg key={i} width={170 * sc} height={440 * sc} viewBox="-10 0 170 440" style={{ position: 'absolute', left: gx - 70 * sc, top: gy - 420 * sc, overflow: 'visible' }}>
            <defs>
              <linearGradient id={`gc${i}`} x1="0" y1="0" x2="1" y2="0.2">
                <stop offset="0%" stopColor="#141620" />
                <stop offset="55%" stopColor="#22191a" />
                <stop offset="100%" stopColor={`rgb(${90 + 50 * light},${52 + 20 * light},${36})`} />
              </linearGradient>
              <radialGradient id={`gh${i}`} cx="0.62" cy="0.75" r="0.6">
                <stop offset="0%" stopColor={`rgba(150,90,50,${0.55 * light})`} />
                <stop offset="100%" stopColor="#0d0b10" />
              </radialGradient>
            </defs>
            {/* raised arm to the torch */}
            <path d="M118 120 C 132 90 136 60 132 20" stroke="#1d1618" strokeWidth={20} strokeLinecap="round" fill="none" />
            <path d="M126 118 C 140 90 144 60 140 22" stroke={warm} strokeWidth={3} fill="none" />
            <path d={CLOAK} fill={`url(#gc${i})`} />
            <path d="M48 120 C 44 220 46 320 40 418 M74 118 C 78 230 76 330 82 418 M100 140 C 106 230 108 320 114 418" stroke="rgba(255,255,255,0.06)" strokeWidth={3} fill="none" />
            <path d={HOOD} fill={`url(#gh${i})`} />
            <path d="M102 72 C 128 84 142 108 144 146 L 150 300 L 136 420" stroke={warm} strokeWidth={3.5} fill="none" />
            <path d="M14 64 C 14 34 30 8 60 8" stroke="rgba(150,175,230,0.35)" strokeWidth={2.5} fill="none" />
          </svg>
        );
      })}
    </>
  );
};

// three frightened disciples huddled low (soft silhouettes with a moonlit edge)
export const Disciples: React.FC<{ x: number; y: number; h: number; opacity?: number }> = ({ x, y, h, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const s = h / 300;
  const fig = (dx: number, scale: number, lean: number, i: number) => {
    const shiver = Math.sin(frame * 0.5 + i * 2) * 1.2;
    return (
      <svg key={i} width={200 * s * scale} height={320 * s * scale} viewBox="0 0 200 320" style={{ position: 'absolute', left: x + dx * s - 100 * s * scale + shiver, top: y - 300 * s * scale, overflow: 'visible', transform: `rotate(${lean}deg)`, transformOrigin: '50% 100%', opacity }}>
        <path d="M100 30 C 124 30 136 50 134 72 C 133 90 124 100 116 106 C 150 116 172 150 178 200 L 186 300 L 14 300 L 22 200 C 28 150 50 116 84 106 C 76 100 67 90 66 72 C 64 50 76 30 100 30 Z" fill="#100e16" stroke="rgba(170,190,240,0.4)" strokeWidth={2.4} />
      </svg>
    );
  };
  return (
    <>
      {fig(0, 1, -6, 0)}
      {fig(130, 0.86, 4, 1)}
      {fig(250, 0.94, -3, 2)}
    </>
  );
};

// a single glistening tear sliding from an eye
export const Tear: React.FC<{ x: number; y: number; from: number; len?: number; size?: number }> = ({ x, y, from, len = 50, size = 1 }) => {
  const frame = useCurrentFrame();
  const t = clamp01((frame - from) / len);
  if (frame < from) return null;
  const glint = Math.min(1, (frame - from) / 8);
  return (
    <>
      <div style={{ position: 'absolute', left: x - 9 * size, top: y - 6 * size, width: 18 * size, height: 10 * size, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.95), rgba(200,220,255,0))', opacity: glint * (1 - t * 0.6) }} />
      <div style={{ position: 'absolute', left: x - 3 * size, top: y + easeInOut(t) * 120 * size, width: 6 * size, height: 14 * size, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: 'radial-gradient(ellipse at 40% 35%, #ffffff, rgba(190,210,255,0.55) 60%, rgba(190,210,255,0))', opacity: glint * (t < 0.9 ? 1 : 1 - (t - 0.9) * 10) }} />
    </>
  );
};

export const GhostTag: React.FC<{ text: string; x: number; y: number; from: number; dim?: number }> = ({ text, x, y, from, dim = 1 }) => {
  const frame = useCurrentFrame();
  const a = easeOut(clamp01((frame - from) / 10)) * dim;
  if (a <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: x - 200, top: y, width: 400, textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: 34, letterSpacing: '0.16em', color: 'rgba(236,232,255,0.95)', textShadow: '0 0 14px rgba(190,184,240,0.8), 0 2px 6px rgba(0,0,0,0.6)', opacity: a, transform: `translateY(${(1 - a) * 8}px)` }}>
      {text}
    </div>
  );
};

// a chat bubble rising from the phone: typing dots, the message, a soft "sent" lift
export const MessageBubble: React.FC<{ x: number; y: number; text: string; typeFrom: number; typeTo: number; sentAt: number }> = ({ x, y, text, typeFrom, typeTo, sentAt }) => {
  const frame = useCurrentFrame();
  if (frame < typeFrom - 6) return null;
  const appear = easeOut(clamp01((frame - typeFrom + 6) / 10));
  const typed = clamp01((frame - typeFrom) / (typeTo - typeFrom));
  const shown = text.slice(0, Math.round(text.length * typed));
  const sent = clamp01((frame - sentAt) / 14);
  const lift = easeOut(sent) * 70;
  return (
    <div style={{ position: 'absolute', left: x - 260, top: y - lift, width: 520, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', opacity: appear }}>
      <div style={{ padding: '22px 30px', borderRadius: 34, borderBottomRightRadius: 8, background: sent > 0 ? 'linear-gradient(180deg,#4b8dff,#2f6fe6)' : 'rgba(30,36,58,0.86)', color: '#fff', fontFamily: SANS, fontWeight: 500, fontSize: 40, boxShadow: `0 0 ${40 + 60 * sent}px rgba(120,170,255,${0.35 + 0.3 * sent})`, minHeight: 50, border: '1px solid rgba(255,255,255,0.12)' }}>
        {shown || <span style={{ letterSpacing: 6, opacity: 0.8 }}>{'•••'.slice(0, 1 + (Math.floor(frame / 6) % 3))}</span>}
      </div>
      {sent > 0.3 && <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 24, color: 'rgba(255,255,255,0.7)', opacity: sent }}>Sent ✓</div>}
    </div>
  );
};
