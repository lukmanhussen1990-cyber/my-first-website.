import React from 'react';
import {Stage, LOOKS} from '../lib/Stage';
import {CameraRig} from '../lib/CameraRig';
import {SceneDef, SceneProps} from './kit';
import {ComicText} from '../props/Effects';

export const placeholder = (n: number): SceneDef => ({
	Comp: ({f}: SceneProps) => (
		<Stage look={LOOKS.day} sky>
			<ComicText text={`SCENE ${n}`} position={[0, 3, 0]} scale={2} />
			<CameraRig pos={[0, 3, 12]} target={[0, 3, 0]} fov={45} sway={0} />
		</Stage>
	),
});
