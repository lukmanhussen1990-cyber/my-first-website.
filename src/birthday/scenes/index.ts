import {SceneDef} from '../kit';
import {SCENES_1_5} from './s01_05';
import {SCENES_6_10} from './s06_10';
import {SCENES_11_14} from './s11_14';
import {SCENES_15_19} from './s15_19';

export const SCENE_DEFS: SceneDef[] = [...SCENES_1_5, ...SCENES_6_10, ...SCENES_11_14, ...SCENES_15_19];
if (SCENE_DEFS.length !== 19) throw new Error(`expected 19 scenes, got ${SCENE_DEFS.length}`);
