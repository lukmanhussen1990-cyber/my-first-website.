import {SceneDef} from './kit';
import {TOWN_SCENES} from './s01_06_town';
import {SCHOOL_SCENES} from './s07_11_school';
import {GRANDPA_SCENES} from './s12_17_grandpa';
import {QUEST_SCENES} from './s18_24_quest';
import {RETURN_SCENES} from './s25_32_return';

export const SCENE_DEFS: SceneDef[] = [...TOWN_SCENES, ...SCHOOL_SCENES, ...GRANDPA_SCENES, ...QUEST_SCENES, ...RETURN_SCENES];
if (SCENE_DEFS.length !== 32) throw new Error(`expected 32 scenes, got ${SCENE_DEFS.length}`);
