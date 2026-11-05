import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {AssetGate} from './AssetGate';
import {Captions} from './captions/Captions';
import {FPS} from './lib/timing';
import {SHOTS} from './shots';
import {Stage3D} from './three/Stage3D';

const WHIP = 0.14; // seconds of blur on each side of a whip-pan cut

export const findShot = (gt: number) => SHOTS.find((s) => gt >= s.start && gt < s.end) ?? SHOTS[SHOTS.length - 1];

export const Video: React.FC<{captions?: boolean; audio?: boolean}> = ({captions = true, audio = true}) => {
	const frame = useCurrentFrame();
	const gt = frame / FPS;
	const shot = findShot(gt);
	const d = shot.end - shot.start;
	const t = gt - shot.start;
	const sp = {t, d, p: Math.min(1, t / d), gt};
	const idx = SHOTS.indexOf(shot);
	const next = SHOTS[idx + 1];
	let whip = 0;
	let dir = 1;
	if (shot.whipIn && t < WHIP) {
		whip = 1 - t / WHIP;
		dir = 1;
	}
	if (next?.whipIn && shot.end - gt < WHIP) {
		whip = Math.max(whip, 1 - (shot.end - gt) / WHIP);
		dir = -1;
	}
	const flash = shot.flash ? shot.flash(sp) : 0;
	const Overlay = shot.overlay;
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<svg width={0} height={0} style={{position: 'absolute'}}>
				<filter id="whipblur" x="-20%" y="0" width="140%" height="100%">
					<feGaussianBlur stdDeviation={`${(whip * 46).toFixed(1)} 0`} />
				</filter>
			</svg>
			<AbsoluteFill style={{filter: whip > 0.02 ? 'url(#whipblur)' : undefined, transform: whip > 0.02 ? `translateX(${dir * whip * 90}px) scale(1.06)` : undefined}}>
				<AssetGate>
					<Stage3D fx={shot.fx}>
						<shot.C key={shot.id} {...sp} />
					</Stage3D>
				</AssetGate>
			</AbsoluteFill>
			{flash > 0.01 ? <AbsoluteFill style={{backgroundColor: '#ffffff', opacity: flash}} /> : null}
			{Overlay ? <Overlay {...sp} /> : null}
			{captions ? <Captions /> : null}
			{audio ? (
				<>
					<Audio src={staticFile('voiceover.mp3')} volume={1} />
				</>
			) : null}
		</AbsoluteFill>
	);
};
