// Render quality switch (full quality for the final video, cheaper for quick previews).
export const QUALITY = {dpr: 1, shadowMap: 2048};
export const setQuality = (q: {dpr: number; shadowMap: number}) => {
	QUALITY.dpr = q.dpr;
	QUALITY.shadowMap = q.shadowMap;
};
