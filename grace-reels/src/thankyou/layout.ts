// Frame plan (30 fps, 150 frames) and per-format layout.

export const T = {
	sparkleEnd: 18, // 0.60 s
	revealEnd: 42, // 1.40 s
	countEnd: 75, // 2.50 s
	thanksEnd: 108, // 3.60 s
	youEnd: 132, // 4.40 s
	hold: 141, // 4.70 s — final frame held clean to 150
	total: 150,
} as const;

export type Layout = {
	vertical: boolean;
	s: number; // UI scale
	cx: number;
	cy: number; // sparkle / pill centre
	horizon: number;
	badgeY: number;
	titleSize: number;
	thankY: number;
	youY: number;
	subY: number;
	orbit: {cx: number; cy: number; rx: number; ry: number};
	logoY: number;
	endScale: number;
};

// Vertical safe area: everything important sits above y=1450 and left of x=960.
export const getLayout = (width: number, height: number): Layout => {
	const vertical = height > width;
	return vertical
		? {
				vertical,
				s: 1,
				cx: width / 2,
				cy: 880,
				horizon: 0.21,
				badgeY: 520,
				titleSize: 224,
				thankY: 835,
				youY: 1040,
				subY: 1200,
				orbit: {cx: width / 2, cy: 930, rx: 405, ry: 505},
				logoY: 700,
				endScale: 1,
			}
		: {
				vertical,
				s: 0.86,
				cx: width / 2,
				cy: 540,
				horizon: 0.17,
				badgeY: 215,
				titleSize: 168,
				thankY: 470,
				youY: 628,
				subY: 760,
				orbit: {cx: width / 2, cy: 545, rx: 440, ry: 345},
				logoY: 330,
				endScale: 0.86,
			};
};
