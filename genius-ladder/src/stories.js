// Registry of videos built with this engine. Pick one with ?story=<id> (browser) or --story <id> (scripts).
export const STORIES = {
  ladder: { module: './timeline.js', narration: 'assets/narration.mp3', out: 'genius-ladder.mp4' },
  sneak: { module: './timeline-sneak.js', narration: 'assets/sneak_in.mp3', out: 'sneak-in.mp4' },
  double: { module: './timeline-double.js', narration: 'assets/double.mp3', out: 'double-every-minute.mp4' },
};
export async function loadStory(id = 'ladder') {
  const s = STORIES[id];
  if (!s) throw new Error(`unknown story "${id}" (have: ${Object.keys(STORIES).join(', ')})`);
  const mod = await import(s.module);
  return { id, ...s, TIMELINE: mod.TIMELINE, SET: mod.SET || {}, CAST: mod.CAST || null };
}
