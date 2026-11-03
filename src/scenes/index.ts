import {SceneDef} from './kit';
import {TOWN_SCENES} from './s01_06_town';
import {SCHOOL_SCENES} from './s07_11_school';
import {GRANDPA_SCENES} from './s12_17_grandpa';
import {placeholder} from './placeholder';

const defs: SceneDef[] = [...TOWN_SCENES, ...SCHOOL_SCENES, ...GRANDPA_SCENES];
while (defs.length < 32) defs.push(placeholder(defs.length + 1));

export const SCENE_DEFS: SceneDef[] = defs;
