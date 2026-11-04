// Render quality switch (full quality for the final video, cheaper for quick previews).
// `whips` turns the Flush King whip-pan camera swings on or off (the Birthday video uses plain cuts).
export const QUALITY = {dpr: 1, shadowMap: 2048, whips: true};
export const setQuality = (q: {dpr: number; shadowMap: number; whips?: boolean}) => {
	QUALITY.dpr = q.dpr;
	QUALITY.shadowMap = q.shadowMap;
	QUALITY.whips = q.whips ?? true;
};
