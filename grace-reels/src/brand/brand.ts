// GRACE IN MOTION — brand tokens shared by every reel.

export const PALETTE = {
	warmBlack: '#0E0B09',
	ink: '#1E1A16',
	cream: '#F3ECDF',
	gold: '#F2B544',
	deepGold: '#9A5B0C',
	amberGlow: '#FFD27A',
} as const;

export const BRAND = {
	name: 'GRACE IN MOTION',
	handle: '@GraceINMotion618',
	verse: 'I thank my God upon every remembrance of you',
	verseRef: 'PHILIPPIANS 1:3',
} as const;

export const FONT = {
	serif: '"Cormorant Garamond", Georgia, serif',
	sans: 'Inter, "Helvetica Neue", Arial, sans-serif',
} as const;

/** `rgba()` string from a #RRGGBB token. */
export const alpha = (hex: string, a: number): string => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Gold gradient used for fills (text, icons, logo strokes). */
export const GOLD_GRADIENT = `linear-gradient(180deg, ${PALETTE.amberGlow} 0%, ${PALETTE.gold} 48%, ${PALETTE.deepGold} 100%)`;
