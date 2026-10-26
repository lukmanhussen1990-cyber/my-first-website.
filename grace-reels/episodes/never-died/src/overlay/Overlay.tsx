// Everything drawn over the 3D picture, in 1080x1920 layout pixels (scaled down for the animatic).
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import type {ShotDef, Transition} from '../render/types';
import {CaptionScrim, Captions} from './Captions';
import {Cards} from './Card';
import {Header} from './Header';
import {HookTitle} from './HookTitle';
import {Labels} from './Labels';
import {MythFrame} from './Myth';
import {useFontsReady} from './theme';
import {Tracker} from './Tracker';

export const Overlay: React.FC<{shots: ShotDef[]; transitions: Transition[]}> = ({shots, transitions}) => {
	useFontsReady();
	const frame = useCurrentFrame();
	const {fps, width} = useVideoConfig();
	const t = frame / fps;
	const headerOn = 1 - smooth((t - (B.s11 - 0.3)) / 0.3);
	const ctaHide = smooth((t - (B.s10 - 0.2)) / 0.4);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${width / 1080})`, transformOrigin: '0 0'}}>
				<CaptionScrim t={t} />
				<Header opacity={headerOn} />
				<Labels t={t} shots={shots} transitions={transitions} />
				<Tracker t={t} hide={ctaHide} />
				<MythFrame t={t} />
				<Cards t={t} />
				<Captions t={t} />
				<HookTitle t={t} />
			</div>
		</AbsoluteFill>
	);
};
