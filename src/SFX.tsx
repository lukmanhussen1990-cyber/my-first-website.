// Sound effects (generated with ElevenLabs), timed from words.json and kept quieter than the voice.
import React from 'react';
import {Audio, Sequence, staticFile, interpolate} from 'remotion';
import {wf, TOTAL_FRAMES} from './timing';

type Cue = {file: 'bell' | 'whoosh' | 'pop' | 'cheer' | 'ding'; at: number; volume: number; fadeOutAt?: number};

export const CUES: Cue[] = [
	// Bucket Man ringing his hand bell as he walks down the street
	{file: 'bell', at: wf(18) - 4, volume: 0.32},
	{file: 'bell', at: wf(21) + 2, volume: 0.26},
	// flush whoosh on every WHOOSH
	{file: 'whoosh', at: wf(138) - 4, volume: 0.32},
	{file: 'whoosh', at: wf(216) - 4, volume: 0.32},
	{file: 'whoosh', at: wf(257) - 4, volume: 0.34},
	// small pops on funny reveals
	{file: 'pop', at: wf(10), volume: 0.3}, // not even a tiny one -> the bucket
	{file: 'pop', at: wf(41), volume: 0.3}, // big families have five
	{file: 'pop', at: wf(49), volume: 0.28}, // "How To Hold It" on the chalkboard
	{file: 'pop', at: wf(85), volume: 0.28}, // Weird Bucket Boy
	{file: 'pop', at: wf(98) + 2, volume: 0.26}, // dream bubble
	{file: 'pop', at: wf(161), volume: 0.28}, // pile of abandoned buckets
	{file: 'pop', at: wf(173), volume: 0.3}, // snacks
	{file: 'pop', at: wf(175), volume: 0.3}, // flashlight
	{file: 'pop', at: wf(178), volume: 0.3}, // bucket
	{file: 'pop', at: wf(232), volume: 0.28}, // used it twice on the way
	{file: 'pop', at: wf(277), volume: 0.3}, // a thousand more
	{file: 'ding', at: wf(286), volume: 0.34}, // toilet shop door bell
	// crowd cheer
	{file: 'cheer', at: wf(243), volume: 0.18}, // the whole town was waiting
	{file: 'cheer', at: wf(303), volume: 0.16}, // they call me...
	{file: 'cheer', at: wf(307), volume: 0.4, fadeOutAt: TOTAL_FRAMES - 12}, // the Flush King!
];

export const SFX: React.FC = () => (
	<>
		{CUES.map((c, i) => (
			<Sequence key={i} from={Math.max(0, c.at)} durationInFrames={Math.max(1, TOTAL_FRAMES - Math.max(0, c.at))} layout="none">
				<Audio
					src={staticFile(`sfx/${c.file}.mp3`)}
					volume={(f) => {
						if (c.fadeOutAt === undefined) return c.volume;
						const g = f + c.at;
						return interpolate(g, [c.fadeOutAt, c.fadeOutAt + 12], [c.volume, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
					}}
				/>
			</Sequence>
		))}
	</>
);
