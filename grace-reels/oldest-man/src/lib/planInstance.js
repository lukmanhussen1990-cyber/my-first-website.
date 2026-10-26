// The one plan instance used by the browser bundle (video + overlay).
import T from '../../timeline.json';
import { buildPlan } from '../plan.js';

export const TIMELINE = T;
export const plan = buildPlan(T);
