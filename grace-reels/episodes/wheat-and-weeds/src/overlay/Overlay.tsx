// Everything drawn over the 3D picture, in 1080x1920 layout pixels (scaled down for the animatic).
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import type {ShotDef, Transition} from '../render/types';
import {CaptionScrim, Captions} from './Captions';
import {Cards} from './Card';
import {CallToAction, EndCard} from './Cta';
import {FieldMeter} from './FieldMeter';
import {Header} from './Header';
import {HookTitle} from './HookTitle';
import {Labels} from './Labels';
import {useFontsReady} from './theme';

// how bright the picture behind the captions is (0 = night, 1 = full sun): the scrim deepens over it
const brightness = (t: number) => {
	const on = (a: number, b: number, fade = 0.4) => smooth((t - a) / fade) * (1 - smooth((t - b) / fade));
	return Math.max(on(B.s2, B.s4, 0.3) * 0.9, on(B.s5, B.s7 + 6.5) * 0.8, on(B.s8, B.s11) * 0.85, on(B.s11, B.paulCut) * 1, on(B.s12, B.s13) * 0.8);
};

export const Overlay: React.FC<{shots: ShotDef[]; transitions: Transition[]}> = ({shots, transitions}) => {
	useFontsReady();
	const frame = useCurrentFrame();
	const {fps, width} = useVideoConfig();
	const t = frame / fps;
	// the header steps aside for the end card (which carries the logo) and comes back for the loop
	const headerOn = 1 - smooth((t - (B.s14 - 0.3)) / 0.3) + smooth((t - B.loopOut) / 0.5);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${width / 1080})`, transformOrigin: '0 0'}}>
				<CaptionScrim t={t} strength={1 + 1.1 * brightness(t)} />
				<Header opacity={headerOn} />
				<Labels t={t} shots={shots} transitions={transitions} />
				<FieldMeter t={t} />
				<Cards t={t} />
				<CallToAction t={t} />
				<Captions t={t} />
				<HookTitle t={t} />
				<EndCard t={t} />
			</div>
		</AbsoluteFill>
	);
};
