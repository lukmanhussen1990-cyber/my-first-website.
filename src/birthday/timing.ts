// Every scene, shot and caption of the Birthday video is timed from words.json
// (Whisper word timestamps of the voiceover). The voiceover is the boss.
import wordsJson from './words.json';
import ampJson from './amp.json';

export const FPS = 30;
export type Word = {i: number; word: string; raw: string; start: number; end: number};
export const WORDS = wordsJson as Word[];

/** exact length of the voiceover (ffprobe) */
export const VOICE_SECONDS = 108.826063;
/** video = voiceover + 1 second */
export const TOTAL_FRAMES = Math.ceil((VOICE_SECONDS + 1) * FPS);

/** frame at which word i starts / ends */
export const wf = (i: number) => Math.round(WORDS[i].start * FPS);
export const we = (i: number) => Math.round(WORDS[i].end * FPS);

/** first word of each of the 19 scenes */
export const SCENE_FIRST_WORD = [
	0, // 1  Nobody in my town knows what a birthday is.
	9, // 2  People just get older. One year, then another, and nobody says anything.
	21, // 3  My grandpa is 90 years old, and he has never had a cake. Not once.
	36, // 4  Then one day, I found an old photo in our attic.
	47, // 5  People were wearing funny little hats. ... And everyone was smiling.
	70, // 6  I asked mom what it was. She didn't know. I asked the neighbors. Nobody knew.
	85, // 7  But on the back of the photo, it said where it was taken.
	98, // 8  The old bakery at the end of our street. It's been closed for years.
	112, // 9 So I squeezed in through a broken window.
	120, // 10 Inside, everything was dust and spiderwebs. And on the counter, there was one old book. It said cake.
	138, // 11 I tried to make it. My first cake was burnt. ... Flour everywhere.
	159, // 12 But on the 10th try, it was perfect.
	167, // 13 Then I went to every house in town, and I whispered a secret plan.
	181, // 14 That night, I covered grandpa's eyes and walked him to the town square. Ready?
	195, // 15 The lights came on. The whole town was there. And in the middle was a cake with 90 little candles.
	215, // 16 Nobody knew any birthday songs, so we made one up. Happy grandpa day to you. You are 90, and we love you.
	237, // 17 Grandpa didn't say anything. He just stood there. Then he took a big breath and blew. It took him six tries.
	258, // 18 When the last candle went out, grandpa hugged me really tight. And he whispered, I waited 90 years for this.
	278, // 19 Now everyone in town has a birthday. And every year, the first slice goes to grandpa.
];

/** visuals arrive a few frames before the first word of a scene */
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

/** which shot is active, given the frames where each new shot starts */
export const shotIndex = (f: number, cuts: number[]) => {
	let i = 0;
	while (i < cuts.length && f >= cuts[i]) i++;
	return i;
};

const AMP = ampJson as number[];
/** voice loudness (0..1) at a global frame: drives the mouths of whoever is talking */
export const amp = (g: number) => AMP[Math.max(0, Math.min(AMP.length - 1, Math.round(g)))] ?? 0;
/** true while word i..j is being spoken (global frame) */
export const speaking = (g: number, i: number, j: number) => g >= wf(i) - 1 && g <= we(j) + 1;
