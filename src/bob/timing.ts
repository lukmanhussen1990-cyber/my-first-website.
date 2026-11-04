// Every scene, shot and caption of the Bob video is timed from words.json (Whisper word timestamps).
import wordsJson from './words.json';
import ampJson from './amp.json';

export const FPS = 30;
export type Word = {i: number; word: string; raw: string; start: number; end: number};
export const WORDS = wordsJson as Word[];
export const VOICE_SECONDS = 100.5975;
export const TOTAL_FRAMES = Math.ceil((VOICE_SECONDS + 1) * FPS);
export const wf = (i: number) => Math.round(WORDS[i].start * FPS);
export const we = (i: number) => Math.round(WORDS[i].end * FPS);

export const SCENE_FIRST_WORD = [
	0, // 1  In my town, everyone is named Bob.
	7, // 2  My mom is Bob, my dad is Bob, my teacher is Bob.
	19, // 3  Even my dog is Bob.
	24, // 4  Everyone has the same haircut, the same gray shirt, the same face.
	36, // 5  And every day at 12 o'clock,
	42, // 6  everyone eats the same sandwich at the same time. Crunch.
	52, // 7  I'm the only one who isn't Bob.
	59, // 8  I have curly orange hair, I wear a red jacket, and when I walk down the street,
	76, // 9  everyone stares.
	78, // 10 At school, the teacher does roll call. Bob, here. Bob, here. Bob, here.
	91, // 11 Then she gets to me, and she just stops.
	100, // 12 So I tried to be like them. I put on a gray shirt, I pushed my hair down flat. It popped right back up.
	124, // 13 That night, Grandpa Bob took me up to the attic. He opened an old photo album, and I couldn't believe it.
	145, // 14 Long ago, everyone in our town looked different. Hats, colors, crazy hair, different names.
	159, // 15 What happened, I asked.
	163, // 16 One day, someone laughed at someone for being different. And after that, everyone was scared to stand out.
	181, // 17 So the next day, I wore the wildest hat in the world to school. The whole class gasped.
	199, // 18 But the day after, one girl came to school wearing a yellow scarf.
	212, // 19 Then 10 people changed, then 100, then the whole town.
	222, // 20 Red shirts, blue hair, purple houses, nobody walked the same anymore.
	233, // 21 And everyone picked a new name. Rosa, Max, Captain Sparkles. My dog picked Pickles.
	247, // 22 Everyone changed their name except Grandpa.
	253, // 23 I'm keeping Bob. I actually like Bob. And you know what? That's okay too.
];
export const LEAD = 4;
export type SceneRange = {n: number; from: number; to: number; dur: number};
export const SCENES: SceneRange[] = SCENE_FIRST_WORD.map((wi, k) => {
	const from = k === 0 ? 0 : wf(wi) - LEAD;
	const to = k === SCENE_FIRST_WORD.length - 1 ? TOTAL_FRAMES : wf(SCENE_FIRST_WORD[k + 1]) - LEAD;
	return {n: k + 1, from, to, dur: to - from};
});
export const sceneIndexAt = (g: number) => {
	for (let i = 0; i < SCENES.length; i++) if (g >= SCENES[i].from && g < SCENES[i].to) return i;
	return SCENES.length - 1;
};
/** frame of word i relative to the start of scene n (1-based) */
export const W = (n: number, i: number) => wf(i) - SCENES[n - 1].from;
export const shotIndex = (f: number, cuts: number[]) => {
	let i = 0;
	while (i < cuts.length && f >= cuts[i]) i++;
	return i;
};
const AMP = ampJson as number[];
export const amp = (g: number) => AMP[Math.max(0, Math.min(AMP.length - 1, Math.round(g)))] ?? 0;
export const speaking = (g: number, i: number, j: number) => g >= wf(i) - 1 && g <= we(j) + 1;

/** global frames where a cut is done as a quick whip-pan (horizontal smear) */
export const WHIPS: {at: number; dir: 1 | -1}[] = [
	{at: wf(76) - LEAD, dir: 1}, // everyone stares
	{at: wf(91) - LEAD, dir: -1}, // then she gets to me
	{at: wf(119) - 3, dir: 1}, // it popped right back up
	{at: wf(195) - 3, dir: -1}, // the whole class gasped
];
export function whipAt(g: number): {x: number; blur: number} {
	for (const w of WHIPS) {
		const d = g - w.at;
		if (d >= -4 && d < 4) {
			const k = d < 0 ? (d + 4) / 4 : 1 - d / 4;
			return {x: w.dir * (d < 0 ? 1 : -1) * k * k * 60, blur: k * k * 18};
		}
	}
	return {x: 0, blur: 0};
}
