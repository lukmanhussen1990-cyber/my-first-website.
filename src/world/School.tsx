// The classroom: chalkboard, desks in rows, sunny windows, posters.
import React from 'react';
import * as THREE from 'three';
import {plastic, box, plane, glowMat, rbox, cyl, circle} from '../lib/materials';
import {woodTex, textTex, clockTex} from '../lib/textures';
import {StudentDesk, Chair, Chalkboard, TeacherDesk, WallWindow, WallFrame, PottedPlant} from '../props/Furniture';
import {Bucket} from '../props/Bucket';
import {POPPINS} from '../lib/fonts';

export const DESK_COLS = [-10, -5, 0, 5, 10];
export const DESK_ROWS = [-2, 4, 10];
/** where a student sits (world), facing the board (-z) */
export const seatPos = (col: number, row: number): [number, number, number] => [DESK_COLS[col], 0, DESK_ROWS[row] + 1.35];

let boardTex: THREE.Texture | null = null;
export function howToHoldItBoard() {
	if (boardTex) return boardTex;
	const w = 2048;
	const h = 900;
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d')!;
	const g = ctx.createLinearGradient(0, 0, 0, h);
	g.addColorStop(0, '#2f5d46');
	g.addColorStop(1, '#264d3a');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, w, h);
	// smudges
	for (let i = 0; i < 60; i++) {
		ctx.fillStyle = `rgba(255,255,255,${0.02 + ((i * 37) % 10) / 300})`;
		ctx.beginPath();
		ctx.ellipse(((i * 397) % w), ((i * 211) % h), 120 + ((i * 53) % 160), 30 + ((i * 17) % 50), (i % 7) * 0.4, 0, Math.PI * 2);
		ctx.fill();
	}
	// text block centred so it fits a vertical frame
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `900 132px ${POPPINS}, sans-serif`;
	ctx.fillText('HOW TO HOLD IT', w / 2, 140);
	ctx.fillRect(w / 2 - 520, 222, 1040, 9);
	ctx.font = `700 78px ${POPPINS}, sans-serif`;
	ctx.fillStyle = '#ffe9a8';
	ctx.fillText('Chapter 1: Squeeze.', w / 2, 360);
	ctx.fillText('Chapter 2: Squeeze harder.', w / 2, 500);
	ctx.fillStyle = '#ffb3c7';
	ctx.font = `800 70px ${POPPINS}, sans-serif`;
	ctx.fillText('Record: 3 DAYS!', w / 2, 650);
	// chalk bucket doodles on both sides
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 14;
	ctx.lineJoin = 'round';
	for (const bx of [240, 1808]) {
		ctx.beginPath();
		ctx.moveTo(bx - 150, 420);
		ctx.lineTo(bx + 150, 420);
		ctx.lineTo(bx + 112, 650);
		ctx.lineTo(bx - 112, 650);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(bx, 430, 140, Math.PI, 0);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(bx - 128, 500);
		ctx.lineTo(bx + 128, 500);
		ctx.stroke();
	}
	// chalk grain
	ctx.globalCompositeOperation = 'destination-out';
	for (let i = 0; i < 26000; i++) {
		const x = (i * 7919) % w;
		const y = (i * 104729) % h;
		ctx.fillStyle = `rgba(0,0,0,${0.15 + ((i * 13) % 10) / 25})`;
		ctx.fillRect(x, y, 2, 2);
	}
	ctx.globalCompositeOperation = 'destination-over';
	ctx.fillStyle = '#2b5641';
	ctx.fillRect(0, 0, w, h);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	boardTex = t;
	return t;
}

const Poster: React.FC<{position: [number, number, number]; rotation?: [number, number, number]; text: string; bg: string}> = ({position, rotation, text, bg}) => {
	const tex = textTex(`poster-${text}`, 512, 640, bg, [{text, size: 74, y: 320, color: '#ffffff', weight: 900}], {radius: 30});
	return (
		<mesh geometry={plane(2.6, 3.25)} material={plastic('#ffffff', {map: tex, rough: 0.7})} position={position} rotation={rotation} />
	);
};

export const Classroom: React.FC<{buckets?: boolean}> = ({buckets = true}) => {
	const wall = plastic('#fff1d6', {rough: 0.85});
	const wain = plastic('#8fc7ff', {rough: 0.7});
	const floor = plastic('#ffffff', {map: woodTex('#d29a62', [4, 4], 8, 11), rough: 0.55});
	const W = 32;
	const D = 30;
	const H = 12;
	return (
		<group>
			<mesh geometry={plane(W, D)} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} receiveShadow />
			{/* walls: front (board), back, left (windows), right */}
			<mesh geometry={box(W, H, 0.4)} material={wall} position={[0, H / 2, -14]} receiveShadow />
			<mesh geometry={box(W, 3.4, 0.5)} material={wain} position={[0, 1.7, -13.9]} receiveShadow />
			<mesh geometry={box(W, H, 0.4)} material={wall} position={[0, H / 2, 16]} receiveShadow />
			<mesh geometry={box(W, 3.4, 0.5)} material={wain} position={[0, 1.7, 15.9]} receiveShadow />
			{[-1, 1].map((sd) => (
				<group key={sd}>
					<mesh geometry={box(0.4, H, D)} material={wall} position={[sd * 16, H / 2, 1]} receiveShadow />
					<mesh geometry={box(0.5, 3.4, D)} material={wain} position={[sd * 15.9, 1.7, 1]} receiveShadow />
				</group>
			))}
			<mesh geometry={box(W + 1, 0.4, D + 1)} material={plastic('#ffffff', {rough: 0.9})} position={[0, H, 1]} />
			{[-6, 6].map((x) => [-6, 4].map((z) => <mesh key={`${x}${z}`} geometry={box(5, 0.1, 2.4)} material={glowMat('#fffaf0', 1.4)} position={[x, H - 0.25, z]} />))}
			{/* windows on the left wall */}
			{[-7, 1, 9].map((z) => (
				<group key={z} position={[-15.75, 6.6, z]} rotation={[0, Math.PI / 2, 0]}>
					<WallWindow w={5.4} h={5.2} />
				</group>
			))}
			{/* sunlight from the windows */}
			<directionalLight position={[-30, 22, 4]} intensity={1.4} color="#fff1d0" />
			{/* chalkboard + desk */}
			<Chalkboard position={[0, 6.3, -13.6]} tex={howToHoldItBoard()} w={17} h={7.4} />
			<TeacherDesk position={[-9.5, 0, -8.6]} rotation={0.15} />
			{buckets ? <Bucket position={[-11.0, 3.0, -8.8]} scale={0.7} handle={0.2} /> : null}
			{/* wall clock */}
			<group position={[11, 9.3, -13.75]}>
				<mesh geometry={cyl(1.15, 1.15, 0.25, 32)} material={plastic('#e63946')} rotation={[Math.PI / 2, 0, 0]} />
				<mesh geometry={circle(1.0, 32)} material={plastic('#ffffff', {map: clockTex(), rough: 0.5})} position={[0, 0, 0.14]} />
			</group>
			{/* posters + frames */}
			<Poster position={[15.75, 6.8, -6]} rotation={[0, -Math.PI / 2, 0]} text="HOLD ON!" bg="#ff5a5a" />
			<Poster position={[15.75, 6.8, 2]} rotation={[0, -Math.PI / 2, 0]} text="SQUEEZE" bg="#3d7bff" />
			<Poster position={[15.75, 6.8, 10]} rotation={[0, -Math.PI / 2, 0]} text="YOU CAN DO IT" bg="#2fbf71" />
			<WallFrame position={[-6, 9.6, 15.75]} />
			<WallFrame position={[6, 9.6, 15.75]} color="#ff6fc8" art="#ffe14a" />
			<PottedPlant position={[13.5, 0, -12]} />
			{/* desks and chairs */}
			{DESK_COLS.map((x, ci) =>
				DESK_ROWS.map((z, ri) => (
					<group key={`${ci}-${ri}`}>
						<StudentDesk position={[x, 0, z]} color={['#e9b87a', '#d9a066', '#f0c58c'][ri]} />
						<Chair position={[x, 0, z + 1.75]} rotation={Math.PI} color={['#ff5a5a', '#3a86ff', '#ffbe0b', '#2fbf71', '#8338ec'][(ci + ri) % 5]} />
					</group>
				)),
			)}
		</group>
	);
};
