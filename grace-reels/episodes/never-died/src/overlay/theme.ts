// Brand and type settings for every on-screen text element.
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

export const C = {
	cream: '#F3ECDF',
	ink: '#1E1A16',
	gold: '#F2B544', // on dark
	deepGold: '#9A5B0C', // on light
	red: '#C0392B',
	tag: 'rgba(20,18,16,0.9)',
	night: '#14100D',
};

// Safe area: nothing important below y=1450 or right of x=960.
export const SAFE = {left: 72, right: 960, bottom: 1450};

const FACES = [
	'italic 500 66px "Cormorant Garamond"',
	'italic 600 60px "Cormorant Garamond"',
	'600 40px "Cormorant Garamond"',
	'700 66px "Cormorant Garamond"',
	'500 22px Inter',
	'600 22px Inter',
	'700 22px Inter',
];

let loading: Promise<unknown> | null = null;

// Holds the render until every font face used on screen has loaded.
export const useFontsReady = () => {
	const [handle] = useState(() => delayRender('Loading fonts'));
	useEffect(() => {
		loading ??= Promise.all(FACES.map((f) => document.fonts.load(f, 'Aa“”…’')));
		loading.then(() => continueRender(handle));
	}, [handle]);
};
