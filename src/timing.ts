// Every scene and caption is timed from words.json (Whisper word timestamps, fixed with the script).
import wordsJson from './data/words.json';

export const FPS = 30;
export type Word = {i: number; word: string; start: number; end: number};
export const WORDS = wordsJson as Word[];

/** voice length + 1 second */
export const VOICE_SECONDS = 123.01;
export const TOTAL_FRAMES = Math.ceil((VOICE_SECONDS + 1) * FPS);

/** frame at which word i starts */
export const wf = (i: number) => Math.round(WORDS[i].start * FPS);
/** frame at which word i ends */
export const we = (i: number) => Math.round(WORDS[i].end * FPS);

/** first word index of each of the 32 scenes (matches the scene list) */
export const SCENE_FIRST_WORD = [
	0, // 1  My town doesn't have toilets.
	5, // 2  Not one. Not even a tiny one.
	12, // 3  Every morning at 6 AM, the Bucket Man walks down our street.
	24, // 4  BUCKETS OUT!
	26, // 5  And everyone runs outside with their bucket.
	33, // 6  Every house has a bucket. Big families have five.
	42, // 7  At school, we have a class called How To Hold It.
	53, // 8  Our teacher can hold it for three whole days. She's a legend.
	65, // 9  Everyone thinks buckets are normal. Everyone except me.
	73, // 10 I keep asking, Isn't there something better?
	80, // 11 So the kids call me Weird Bucket Boy.
	88, // 12 But one night, I heard Grandpa talking in his sleep.
	98, // 13 The Golden Throne... the Golden Throne...
	104, // 14 The next morning... Grandpa closed the curtains, looked around... and whispered:
	120, // 15 Long ago, there was a magic seat. You sit. You go.
	131, // 16 And with one push of a button... WHOOSH. It's gone. Forever.
	142, // 17 Where is it?!
	145, // 18 In the old castle on top of Stinky Hill.
	154, // 19 Nobody who went there ever came back... because nobody can hold it that long.
	168, // 20 So I packed my bag. Snacks. A flashlight. And my bucket... just in case.
	182, // 21 I walked for two days. I crossed the Swamp of Smells.
	193, // 22 I climbed Stinky Hill.
	197, // 23 And there, inside the castle, under all the dust and spiderwebs... was the Golden Throne.
	212, // 24 I pressed the button. WHOOSH. I cried a little.
	221, // 25 I dragged it all the way home. It took four days.
	232, // 26 I used it twice on the way.
	239, // 27 When I got back, the whole town was waiting.
	248, // 28 Grandpa went first. He sat down... pressed the button... WHOOSH.
	258, // 29 Nobody said anything. Then Grandpa started crying. Then EVERYONE started crying.
	269, // 30 Oh, and the castle basement? It had a thousand more.
	279, // 31 Now every house has a Golden Throne. The Bucket Man runs a toilet shop.
	293, // 32 And the kids don't call me Weird Bucket Boy anymore. They call me... the Flush King.
];

/** visuals arrive a few frames before the first word of a scene */
export const LEAD = 4;

export type SceneRange = {n: number; from: number; to: number; dur: number};
export const SCENES: SceneRange[] = SCENE_FIRST_WORD.map((wi, k) => {
	const from = k === 0 ? 0 : wf(wi) - LEAD;
	const to = k === SCENE_FIRST_WORD.length - 1 ? TOTAL_FRAMES : wf(SCENE_FIRST_WORD[k + 1]) - LEAD;
	return {n: k + 1, from, to, dur: to - from};
});

/** frame of word i relative to the start of scene n (1-based) */
export const rel = (n: number, wordIndex: number) => wf(wordIndex) - SCENES[n - 1].from;

// ------------------------------------------------------------------ whip pans
/** global frames where a cut is done as a fast whip-pan (camera swings + motion blur) */
export const WHIPS: {at: number; dir: 1 | -1}[] = [];
export const registerWhip = (at: number, dir: 1 | -1 = 1) => {
	if (!WHIPS.find((w) => w.at === at)) WHIPS.push({at, dir});
};
const WHIP_LEN = 5;
/** yaw offset (radians) and blur (px) for a global frame */
export function whipState(g: number): {yaw: number; blur: number} {
	for (const w of WHIPS) {
		const d = g - w.at;
		if (d >= -WHIP_LEN && d < 0) {
			const k = (d + WHIP_LEN) / WHIP_LEN; // 0..1 approaching the cut
			return {yaw: w.dir * k * k * 0.55, blur: k * k * 16};
		}
		if (d >= 0 && d < WHIP_LEN) {
			const k = 1 - d / WHIP_LEN; // 1..0 after the cut
			return {yaw: -w.dir * k * k * 0.55, blur: k * k * 16};
		}
	}
	return {yaw: 0, blur: 0};
}

export const sceneIndexAt = (g: number) => {
	for (let i = 0; i < SCENES.length; i++) if (g >= SCENES[i].from && g < SCENES[i].to) return i;
	return SCENES.length - 1;
};
