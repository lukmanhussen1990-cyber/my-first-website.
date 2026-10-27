// Everything drawn over the 3D picture, in 1080x1920 layout pixels (scaled down for the animatic).
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import type {ShotDef, Transition} from '../render/types';
import {CaptionScrim, Captions} from './Captions';
import {Cards} from './Card';
import {CoinCounter} from './CoinCounter';
import {CallToAction, EndCard} from './Cta';
import {FriendWord} from './FriendWord';
import {Header} from './Header';
import {HookTitle} from './HookTitle';
import {Labels} from './Labels';
import {Tag} from './Tag';
import {useFontsReady} from './theme';
import {Tracker} from './Tracker';

export const Overlay: React.FC<{shots: ShotDef[]; transitions: Transition[]}> = ({shots, transitions}) => {
	useFontsReady();
	const frame = useCurrentFrame();
	const {fps, width} = useVideoConfig();
	const t = frame / fps;
	// the header steps aside for the end card (which carries the logo) and comes back for the loop
	const headerOn = 1 - smooth((t - (B.s16 - 0.3)) / 0.3) + smooth((t - B.loopOut) / 0.5);
	// a deeper scrim over the bright pictures: the dawn behind the olive trees and the sunlit feast
	const bright = Math.max(smooth((t - (B.s13 + 0.5)) / 1.5) * (1 - smooth((t - B.s14) / 0.4)) * 0.7, smooth((t - (B.s14 - 0.3)) / 0.6) * (1 - smooth((t - (B.s15 - 0.3)) / 0.5)));
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${width / 1080})`, transformOrigin: '0 0'}}>
				<CaptionScrim t={t} strength={1 + 1.6 * bright} />
				<Header opacity={headerOn} />
				<Labels t={t} shots={shots} transitions={transitions} />
				<Tag t={t} />
				<Tracker t={t} />
				<CoinCounter t={t} />
				<FriendWord t={t} />
				<Cards t={t} />
				<CallToAction t={t} />
				<Captions t={t} />
				<HookTitle t={t} />
				<EndCard t={t} />
			</div>
		</AbsoluteFill>
	);
};
