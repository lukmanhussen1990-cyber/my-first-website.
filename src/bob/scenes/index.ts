import {SceneDef} from '../kit';
import {SCENES_1_6} from './s01_06';
import {SCENES_7_12} from './s07_12';
import {SCENES_13_17} from './s13_17';
import {SCENES_18_23} from './s18_23';

export const SCENE_DEFS: SceneDef[] = [...SCENES_1_6, ...SCENES_7_12, ...SCENES_13_17, ...SCENES_18_23];
if (SCENE_DEFS.length !== 23) throw new Error(`expected 23 scenes, got ${SCENE_DEFS.length}`);
