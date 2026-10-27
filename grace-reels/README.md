# Grace in Motion — reels

Code-made Instagram Reels for @GraceINMotion616: flat paper-cut people, a warm low-poly diorama world and italic serif captions. Everything is built and rendered in code: Remotion + Three.js (React Three Fiber) + postprocessing, rendered on the CPU through SwiftShader.

```
src/                    Remotion entry (index.ts, Root.tsx) and shared engine
  shared/               sun + sky, post effects, low-poly kit, paper-cut character rig, text overlay
episodes/<slug>/        one folder per episode
  MASTER_PROMPT.md      the full brief, verbatim, plus the owner's later instructions
  src/                  timeline, sets, scenes
  audio/                voice (input), timeline, music, sound effects, final mix
reference/              reference reels + style_notes.md (the .mp4 files and frames/ stay local, not in git)
tools/                  helpers (contact sheets, word-timestamp transcription, timeline builder)
```

Render a still: `npx remotion still src/index.ts SunsetRule out/still.png --frame=30`

## Episodes

| # | Episode | Mode | Status |
|---|---|---|---|
| 49 | The Sunset Rule (`episodes/sunset-rule`) | CODE | Building scenes; one still per scene goes to the owner for review first |
