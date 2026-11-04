// Shared helpers for the Birthday scenes.
import React from 'react';
import {PostProps} from '../lib/Post';

export type SceneProps = {f: number; dur: number; g: number};
export type SceneDef = {
	Comp: React.FC<SceneProps>;
	post?: (f: number) => PostProps;
	overlay?: (f: number, dur: number) => React.ReactNode;
};
