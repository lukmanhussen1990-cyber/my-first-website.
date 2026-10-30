import timelineJson from '../audio/timeline.json';
import type {Timeline} from '../../../src/shared/timeline.ts';
import {makeAnchors} from './anchors.ts';

export const TL = timelineJson as unknown as Timeline;
export const A = makeAnchors(TL);
