import {useThree} from '@react-three/fiber';
import React from 'react';
import {staticFile} from 'remotion';
import * as THREE from 'three';
import {V3} from '../lib/anim';
import {planeGeo} from '../three/cache';
import {canvasTex} from '../three/textures';

/*
 * "Me" (the narrator) = the user's own avatar picture, cut out with rembg.
 * Full body uses the 12-frame 360° turnaround (the frame is chosen from the camera angle);
 * close-ups use the high-res picture. Mouth/feelings are small code-drawn overlays.
 */

const texCache = new Map<string, THREE.Texture>();
let loading: Promise<void> | null = null;
const FILES = ['me/me_closeup.png', ...Array.from({length: 12}).map((_, i) => `me/turn_${String(i).padStart(2, '0')}.png`)];

export const loadMe = () => {
	if (!loading) {
		loading = Promise.all(
			FILES.map(async (f) => {
				const img = new Image();
				img.src = staticFile(f);
				await img.decode();
				const t = new THREE.Texture(img);
				t.colorSpace = THREE.SRGBColorSpace;
				t.anisotropy = 16;
				t.generateMipmaps = true;
				t.minFilter = THREE.LinearMipmapLinearFilter;
				t.needsUpdate = true;
				texCache.set(f, t);
			}),
		).then(() => undefined);
	}
	return loading;
};

// Full-body cut-out: 531 x 1026 px. Height in world units matches the code-built people (~5.3 + big hair).
const FULL_H = 5.9;
const FULL_W = (FULL_H * 531) / 1026;
// Close-up cut-out: 1254 x 1254 (upper body). Scaled so the head is the same size as in full body.
const CLOSE_S = 5.2;

const SKIN = '#edc5a6';

const mouthTex = (kind: 'talk' | 'sad' | 'smile') =>
	canvasTex(`me_mouth|${kind}`, 256, 128, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.48);
		g.addColorStop(0, SKIN);
		g.addColorStop(0.7, SKIN);
		g.addColorStop(1, 'rgba(237,197,166,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		ctx.lineCap = 'round';
		if (kind === 'talk') {
			ctx.fillStyle = '#3a1010';
			ctx.beginPath();
			ctx.moveTo(w * 0.36, h * 0.42);
			ctx.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.64, h * 0.42);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = '#ff7a8a';
			ctx.beginPath();
			ctx.ellipse(w * 0.5, h * 0.62, w * 0.06, h * 0.08, 0, 0, Math.PI * 2);
			ctx.fill();
		} else if (kind === 'sad') {
			ctx.strokeStyle = '#1d1410';
			ctx.lineWidth = 8;
			ctx.beginPath();
			ctx.moveTo(w * 0.38, h * 0.62);
			ctx.quadraticCurveTo(w * 0.5, h * 0.38, w * 0.62, h * 0.62);
			ctx.stroke();
		} else {
			ctx.strokeStyle = '#1d1410';
			ctx.lineWidth = 8;
			ctx.beginPath();
			ctx.moveTo(w * 0.34, h * 0.4);
			ctx.quadraticCurveTo(w * 0.5, h * 0.78, w * 0.66, h * 0.4);
			ctx.stroke();
		}
	});

const tearTex = () =>
	canvasTex('me_tear', 64, 96, (ctx, w, h) => {
		ctx.fillStyle = 'rgba(120,205,255,0.95)';
		ctx.beginPath();
		ctx.moveTo(w / 2, 4);
		ctx.bezierCurveTo(w * 0.9, h * 0.5, w * 0.9, h * 0.9, w / 2, h - 4);
		ctx.bezierCurveTo(w * 0.1, h * 0.9, w * 0.1, h * 0.5, w / 2, 4);
		ctx.fill();
	});

export type MeProps = {
	position: V3;
	yaw?: number; // which way I'm facing (radians, 0 = +z)
	t: number;
	view?: 'full' | 'close';
	talking?: boolean;
	mood?: 'normal' | 'sad' | 'happy';
	bob?: number;
	lean?: number;
	glow?: number;
	scale?: number;
	frameOverride?: number;
};

export const Me: React.FC<MeProps> = ({position, yaw = 0, t, view = 'full', talking, mood = 'normal', bob = 0, lean = 0, glow = 0.45, scale = 1, frameOverride}) => {
	const camera = useThree((s) => s.camera);
	const dx = camera.position.x - position[0];
	const dz = camera.position.z - position[2];
	// Billboard turns to face the camera around the vertical axis.
	const face = Math.atan2(dx, dz);
	// Camera direction in my own frame → pick the matching turnaround frame (30° steps).
	const local = face - yaw;
	const idx = frameOverride ?? (((Math.round(-local / (Math.PI / 6)) % 12) + 12) % 12);
	const breathe = Math.sin(t * 2.2) * 0.012;

	if (view === 'close') {
		const tex = texCache.get('me/me_closeup.png');
		if (!tex) return null;
		const mouthOpen = talking && Math.sin(t * 15) + 0.6 * Math.sin(t * 23.7) > 0.1;
		const mk = mouthOpen ? 'talk' : mood === 'sad' ? 'sad' : mood === 'happy' ? 'smile' : null;
		return (
			<group position={position} rotation={[0, face, lean]} scale={scale}>
				<group position={[0, bob + breathe, 0]}>
					<mesh geometry={planeGeo(CLOSE_S, CLOSE_S)} position={[0, CLOSE_S / 2, 0]} castShadow>
						<meshStandardMaterial map={tex} transparent alphaTest={0.08} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={glow} roughness={0.7} side={THREE.DoubleSide} />
					</mesh>
					{mk ? (
						<mesh geometry={planeGeo(0.62, 0.31)} position={[(668 / 1254 - 0.5) * CLOSE_S, CLOSE_S * (1 - 524 / 1254), 0.01]}>
							<meshStandardMaterial map={mouthTex(mk)} transparent emissiveMap={mouthTex(mk)} emissive="#ffffff" emissiveIntensity={glow} roughness={0.7} depthWrite={false} />
						</mesh>
					) : null}
					{mood === 'sad'
						? [0, 1].map((j) => {
								const ph = (t * 0.8 + j * 0.5) % 1;
								return (
									<mesh key={j} geometry={planeGeo(0.09, 0.14)} position={[(585 / 1254 - 0.5) * CLOSE_S, CLOSE_S * (1 - (440 + ph * 110) / 1254), 0.012]}>
										<meshBasicMaterial map={tearTex()} transparent opacity={Math.min(1, ph * 6) * Math.min(1, (1 - ph) * 4)} depthWrite={false} />
									</mesh>
								);
							})
						: null}
				</group>
			</group>
		);
	}

	const tex = texCache.get(`me/turn_${String(idx).padStart(2, '0')}.png`);
	if (!tex) return null;
	return (
		<group position={position} rotation={[0, face, lean]} scale={scale}>
			<mesh geometry={planeGeo(FULL_W, FULL_H)} position={[0, FULL_H / 2 + bob + breathe, 0]} castShadow>
				<meshStandardMaterial map={tex} transparent alphaTest={0.08} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={glow} roughness={0.7} side={THREE.DoubleSide} />
			</mesh>
		</group>
	);
};
