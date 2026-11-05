import React, {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {loadDogFace} from './characters/dogFace';
import {loadMe} from './characters/Me';
import {fontsReady} from './lib/fonts';

/** Waits for fonts + the dog face image before anything 3D is drawn (textures need them). */
export const AssetGate: React.FC<{children: React.ReactNode}> = ({children}) => {
	const [ready, setReady] = useState(false);
	const [handle] = useState(() => delayRender('Loading fonts and dog face'));
	useEffect(() => {
		Promise.all([fontsReady(), loadDogFace(), loadMe()])
			.then(() => {
				setReady(true);
				continueRender(handle);
			})
			.catch((e) => {
				console.error(e);
				continueRender(handle);
				throw e;
			});
	}, [handle]);
	return ready ? <>{children}</> : null;
};
