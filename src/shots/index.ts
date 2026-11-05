import {ACT1} from './act1';
import {ACT2} from './act2';
import {ShotDef} from './common';

export const SHOTS: ShotDef[] = [...ACT1, ...ACT2].sort((a, b) => a.start - b.start);
