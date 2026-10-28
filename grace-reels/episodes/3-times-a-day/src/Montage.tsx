import React from 'react';
import {BRAND, SANS} from '../../../src/shared/text/brand';
import {clamp, ease, lerp, rng} from '../../../src/shared/math';
import {BLUE} from './texts';

// S3 "too busy": five flat, fast icon shots (about 0.56 s each) with whip cuts, on a dark
// warm backdrop like the reference's icon scenes. Generic UI only: no app names or logos.

const N = 5;
const CX = 540;
const CY = 1040;

const Notifications: React.FC<{k: number}> = ({k}) => {
	const cards = Math.floor(k * 9) + 1;
	const r = rng(3);
	const cols = ['#E2533C', BLUE, '#F2B544', '#7BC67E', '#B784E8'];
	return (
		<svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
			<rect x={CX - 230} y={CY - 420} width={460} height={840} rx={64} fill="#11131C" stroke="#3A3F52" strokeWidth={10} />
			<rect x={CX - 206} y={CY - 396} width={412} height={792} rx={46} fill="#18263F" />
			{Array.from({length: Math.min(cards, 7)}, (_, i) => {
				const j = cards - 1 - i;
				const y = CY - 360 + i * 104;
				const pop = i === 0 ? ease.outBack(clamp((k * 9 - (cards - 1)) * 1.6)) : 1;
				return (
					<g key={j} transform={`translate(${CX}, ${y + 46}) scale(${pop}) translate(${-CX}, ${-(y + 46)})`}>
						<rect x={CX - 186} y={y} width={372} height={92} rx={22} fill="#F3ECDF" opacity={0.96} />
						<circle cx={CX - 146} cy={y + 46} r={22} fill={cols[(j + Math.floor(r() * 3)) % cols.length]} />
						<rect x={CX - 108} y={y + 26} width={170 + (j % 3) * 30} height={14} rx={7} fill="#7A6A58" />
						<rect x={CX - 108} y={y + 52} width={110 + (j % 2) * 60} height={12} rx={6} fill="#B9AC98" />
					</g>
				);
			})}
			<circle cx={CX + 196} cy={CY - 410} r={44} fill="#E2533C" />
			<text x={CX + 196} y={CY - 396} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={40} fill="#FFFFFF">{cards + 20}</text>
		</svg>
	);
};

const Calendar: React.FC<{k: number}> = ({k}) => {
	const filled = Math.floor(k * 30);
	const flip = ease.in(clamp((k - 0.78) / 0.22));
	const r = rng(8);
	const cols = ['#E2533C', '#4F7BD8', '#E09A2C', '#4E9E62'];
	return (
		<svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
			<g transform={`translate(${CX}, ${CY - 330}) scale(1, ${1 - flip * 0.95}) translate(${-CX}, ${-(CY - 330)})`}>
				<rect x={CX - 330} y={CY - 330} width={660} height={700} rx={30} fill="#F3ECDF" />
				<rect x={CX - 330} y={CY - 330} width={660} height={120} rx={30} fill="#C0392B" />
				<rect x={CX - 330} y={CY - 250} width={660} height={40} fill="#C0392B" />
				{[-200, 200].map((dx) => (
					<rect key={dx} x={CX + dx - 12} y={CY - 360} width={24} height={70} rx={12} fill="#2A1A10" />
				))}
				{Array.from({length: 35}, (_, i) => {
					const cx = CX - 300 + (i % 7) * 86;
					const cy = CY - 180 + Math.floor(i / 7) * 106;
					const busy = i < filled;
					return (
						<g key={i}>
							<rect x={cx} y={cy} width={76} height={94} rx={10} fill={busy ? '#E9DFCF' : '#EFE6D8'} />
							{busy ? <rect x={cx + 6} y={cy + 40} width={64} height={22} rx={8} fill={cols[Math.floor(r() * 4)]} /> : null}
							{busy && i % 3 === 0 ? <rect x={cx + 6} y={cy + 66} width={44} height={18} rx={7} fill={cols[Math.floor(r() * 4)]} /> : null}
						</g>
					);
				})}
			</g>
		</svg>
	);
};

const Coffee: React.FC<{k: number}> = ({k}) => {
	const drop = ease.outBack(clamp(k / 0.35), 1.6);
	const squash = 1 + 0.08 * Math.exp(-Math.max(0, k - 0.35) * 30) * (k > 0.35 ? 1 : 0);
	const y = lerp(-500, 0, drop);
	return (
		<svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
			<ellipse cx={CX} cy={CY + 260} rx={300} ry={60} fill="#2B2019" />
			<g transform={`translate(0, ${y}) translate(${CX}, ${CY + 240}) scale(${squash}, ${1 / squash}) translate(${-CX}, ${-(CY + 240)})`}>
				<ellipse cx={CX} cy={CY + 230} rx={250} ry={52} fill="#E9E2D5" />
				<path d={`M ${CX - 190} ${CY - 160} L ${CX + 190} ${CY - 160} L ${CX + 160} ${CY + 200} Q ${CX} ${CY + 250} ${CX - 160} ${CY + 200} Z`} fill="#F3ECDF" stroke="#2A1A10" strokeWidth={10} />
				<path d={`M ${CX + 180} ${CY - 90} q 130 10 110 130 q -14 90 -130 90`} fill="none" stroke="#F3ECDF" strokeWidth={42} strokeLinecap="round" />
				<ellipse cx={CX} cy={CY - 160} rx={190} ry={40} fill="#5A3622" stroke="#2A1A10" strokeWidth={10} />
				<rect x={CX - 190} y={CY - 60} width={380} height={46} fill="#C0392B" opacity={0.85} />
			</g>
			{[0, 1, 2].map((i) => {
				const ph = k * 2.2 + i * 0.33;
				const o = clamp(k * 3 - 0.6) * (1 - ((ph % 1) * 0.9));
				const yy = CY - 260 - (ph % 1) * 260;
				return <path key={i} d={`M ${CX - 70 + i * 70} ${yy + 120} q 40 -40 0 -80 q -40 -40 0 -80`} fill="none" stroke="#FFFFFF" strokeWidth={16} strokeLinecap="round" opacity={o * 0.7} />;
			})}
		</svg>
	);
};

const Traffic: React.FC<{k: number}> = ({k}) => {
	const r = rng(5);
	return (
		<svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
			<rect x={0} y={CY + 60} width={1080} height={520} fill="#1E1C24" />
			{[0, 1, 2].map((i) => (
				<rect key={i} x={((i * 420 - k * 900) % 1260) + 1260 - 1260} y={CY + 300} width={180} height={14} rx={7} fill="#F2B544" opacity={0.6} />
			))}
			{Array.from({length: 7}, (_, i) => {
				const lane = i % 3;
				const sp = 1400 + r() * 900;
				const x = ((r() * 1600 + k * sp) % 1800) - 360;
				const y = CY + 120 + lane * 140;
				const col = lane === 1 ? '#FFF1C9' : '#FF4A3A';
				return (
					<g key={i}>
						<rect x={x - 420} y={y + 30} width={420} height={18} rx={9} fill={col} opacity={0.35} />
						<rect x={x} y={y} width={230} height={86} rx={26} fill={['#4F7BD8', '#E09A2C', '#8C9096', '#C0392B'][i % 4]} />
						<rect x={x + 40} y={y - 34} width={140} height={50} rx={18} fill="#2E3446" />
						<circle cx={x + 204} cy={y + 40} r={14} fill={col} />
					</g>
				);
			})}
			<rect x={CX + 250} y={CY - 520} width={120} height={330} rx={30} fill="#15171E" stroke="#3A3F52" strokeWidth={8} />
			<rect x={CX + 302} y={CY - 190} width={16} height={250} fill="#3A3F52" />
			{['#FF4A3A', '#F2B544', '#7BC67E'].map((c, i) => (
				<circle key={i} cx={CX + 310} cy={CY - 460 + i * 100} r={38} fill={c} opacity={i === (k < 0.55 ? 0 : 2) ? 1 : 0.18} />
			))}
		</svg>
	);
};

const Buzz: React.FC<{k: number}> = ({k}) => {
	const shake = Math.sin(k * 120) * 12 * (Math.floor(k * 6) % 2 === 0 ? 1 : 0.2);
	return (
		<svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
			<ellipse cx={CX} cy={CY + 40} rx={520} ry={560} fill="#3A2C22" opacity={0.8} />
			<g transform={`translate(${shake}, 0) rotate(${shake * 0.15} ${CX} ${CY})`}>
				<rect x={CX - 200} y={CY - 380} width={400} height={760} rx={58} fill="#11131C" stroke="#3A3F52" strokeWidth={10} />
				<rect x={CX - 178} y={CY - 358} width={356} height={716} rx={42} fill="#20375C" />
				<circle cx={CX} cy={CY - 80} r={88} fill={BLUE} opacity={0.9} />
				<rect x={CX - 120} y={CY + 60} width={240} height={24} rx={12} fill="#CFE0FF" />
				<rect x={CX - 80} y={CY + 104} width={160} height={18} rx={9} fill="#8FB0E0" />
			</g>
			{[1, 2, 3].map((i) => (
				<g key={i} opacity={0.6 - i * 0.15}>
					<path d={`M ${CX - 250 - i * 34} ${CY - 120} q -20 120 0 240`} fill="none" stroke="#F3ECDF" strokeWidth={10} strokeLinecap="round" />
					<path d={`M ${CX + 250 + i * 34} ${CY - 120} q 20 120 0 240`} fill="none" stroke="#F3ECDF" strokeWidth={10} strokeLinecap="round" />
				</g>
			))}
		</svg>
	);
};

const SHOTS = [Notifications, Calendar, Coffee, Traffic, Buzz];

export const Montage: React.FC<{t: number; d: number}> = ({t, d}) => {
	const len = d / N;
	const i = Math.min(N - 1, Math.floor(t / len));
	const k = (t - i * len) / len;
	const Shot = SHOTS[i];
	// whip: the first 0.07 s of each shot slides in from the right with a horizontal blur
	const w = clamp((t - i * len) / 0.07);
	const dx = i > 0 ? (1 - ease.out(w)) * 700 : 0;
	const blur = i > 0 ? (1 - w) * 26 : 0;
	return (
		<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 54%, #3A2A20 0%, #1B1410 62%, #120D0A 100%)', overflow: 'hidden'}}>
			<svg width={0} height={0} style={{position: 'absolute'}}>
				<defs>
					<filter id="hblur" x="-20%" y="-5%" width="140%" height="110%">
						<feGaussianBlur stdDeviation={`${blur} 0`} />
					</filter>
				</defs>
			</svg>
			<div style={{position: 'absolute', inset: 0, transform: `translateX(${dx}px)`, filter: blur > 0.5 ? 'url(#hblur)' : undefined}}>
				<Shot k={k} />
			</div>
			<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
			<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: BRAND.gold, opacity: 0}} />
		</div>
	);
};
