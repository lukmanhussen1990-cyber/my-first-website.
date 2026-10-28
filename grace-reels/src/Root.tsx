import React from 'react';
import {Composition} from 'remotion';
import {loadBrandFonts} from './brand/fonts';
import {T} from './thankyou/layout';
import {ThankYou1K} from './thankyou/ThankYou1K';

loadBrandFonts();

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="ThankYou1KVertical" component={ThankYou1K} width={1080} height={1920} fps={30} durationInFrames={T.total} />
		<Composition id="ThankYou1KSquare" component={ThankYou1K} width={1080} height={1080} fps={30} durationInFrames={T.total} />
	</>
);
