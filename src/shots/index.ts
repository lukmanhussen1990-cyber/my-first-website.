import {ACT1} from './act1';
import {ACT2} from './act2';
import {ACT3} from './act3';
import {ACT4} from './act4';
import {ShotDef} from './common';

export const SHOTS: ShotDef[] = [...ACT1, ...ACT2, ...ACT3, ...ACT4].sort((a, b) => a.start - b.start);
