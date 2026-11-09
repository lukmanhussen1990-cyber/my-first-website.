// Timeline of the farmer / lion / goat / grass riddle (Hindi voice, 82 s): word times from shorts/align_pauses.py,
// shots cut on words, Hindi one-word captions, and the seven boat trips of the answer.
import RAW from "./words.json";

export const FPS = 30;
export const TOTAL = 2475; // 82.5 s: voice ends at 81.7 s
export type V3 = [number, number, number];
export type Word = { w: string; r: string; s: number; e: number };
/** w = Devanagari (for word lookups), r = Hinglish spelling (for the captions) */
export const WORDS: Word[] = (RAW as Word[]).map((x) => ({ w: x.w, r: x.r, s: x.s, e: x.e }));
const norm = (w: string) => w.replace(/[।,?.…]/g, "");
export const at = (w: string, n = 1) => {
  let k = 0;
  for (const x of WORDS) if (norm(x.w) === w && ++k === n) return x.s;
  throw new Error(`word ${w} #${n} not in words.json`);
};

// ---------------- captions (short function words ride with the next word) ----------------
const RIDE = new Set(["ने", "में", "को", "की", "का", "है", "ही", "तो", "और", "ये", "कि", "वो", "से", "इस", "उस", "एक", "अब", "ले", "आप", "उसे", "इन", "जा", "रह", "सब"]);
export type Chunk = { text: string; s: number; e: number };
export const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i], nx = WORDS[i + 1];
    if (RIDE.has(norm(w.w)) && !/[।,?.…]$/.test(w.w) && nx && nx.s - w.e < 0.25) { out.push({ text: `${w.r} ${nx.r}`, s: w.s, e: nx.e }); i++; }
    else out.push({ text: w.r, s: w.s, e: w.e });
  }
  for (let i = 0; i < out.length; i++) { const nx = out[i + 1]; out[i].e = nx ? (nx.s - out[i].e < 0.7 ? nx.s : out[i].e + 0.3) : out[i].e + 0.5; }
  return out;
})();
export const captionAt = (t: number) => CHUNKS.find((c) => t >= c.s && t < c.e) ?? null;

// ---------------- shots ----------------
export type LookId = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; look: LookId; name: string };
const f = (s: number) => Math.round(s * FPS);
const CUTS: [number, LookId, string][] = [
  [0, "day", "hook"],                                   // एक किसान ने ... खरीद ली... और अब उसे इन तीनों को नदी पार ले जाना है।
  [at("दिक्कत") - 0.1, "day", "boat"],                  // दिक्कत ये है कि उसकी नाव इतनी छोटी है ...
  [at("अगर", 1) - 0.1, "day", "lionGoat"],             // अगर शेर और बकरी अकेले रह गए, तो शेर बकरी को खा जाएगा।
  [at("अगर", 2) - 0.3, "day", "goatGrass"],            // और अगर बकरी और घास अकेले रह गए, तो बकरी घास खा जाएगी।
  [at("किसान", 2) - 0.15, "day", "think1"],             // किसान पहले शेर को ले जाने की सोचता है... लेकिन तब बकरी घास खा जाएगी।
  [at("फिर", 1) - 0.1, "day", "think2"],               // फिर वो घास ले जाने की सोचता है... लेकिन तब शेर बकरी को खा जाएगा।
  [at("अब", 2) - 0.1, "day", "dizzy"],                 // अब किसान का सिर घूमने लगा है।
  [at("तो", 3) - 0.1, "day", "ask"],                   // तो आप बताइए, किसान क्या करे? वीडियो रोको और सोचो...
  [at("जवाब") - 0.1, "day", "wide1"],                  // जवाब ये है। सबसे पहले किसान बकरी को नदी पार ले जाता है,
  [at("क्योंकि") - 0.1, "day", "nearLionGrass"],        // क्योंकि शेर घास नहीं खाता।
  [at("फिर", 2) - 0.1, "day", "wide2"],                // फिर वो वापस आता है और शेर को ले जाता है।
  [at("लेकिन", 3) - 0.1, "day", "farLionGoat"],        // लेकिन वहाँ शेर और बकरी को अकेला नहीं छोड़ सकता...
  [at("तो", 4) - 0.1, "day", "wide3"],                 // तो वो बकरी को वापस नाव में बिठा लेता है। इस पार आकर ... घास लेकर चला जाता है।
  [at("अब", 3) - 0.1, "day", "farLionGrass"],          // अब उस पार शेर और घास हैं, और शेर को घास से कोई मतलब नहीं।
  [at("आख़िर") - 0.1, "day", "wide4"],                 // आख़िर में किसान वापस आता है, और बकरी को ले जाता है।
  [at("सब") - 0.1, "day", "allSafe"],                  // सब सही-सलामत पार।
  [at("किसान", 7) - 0.1, "golden", "tired"],            // किसान ने चार घंटे में सात चक्कर लगाए...
  [at("फिर", 3) - 0.4, "golden", "bridge"],            // और फिर उसे पता चला कि सौ मीटर आगे
  [at("पुल") - 0.15, "golden", "shock"],               // एक पुल था।
];
export const SHOTS: ShotDef[] = CUTS.map(([s, look, name], i) => ({ id: i + 1, a: f(s), b: i + 1 < CUTS.length ? f(CUTS[i + 1][0]) : TOTAL, look, name }));
export const shotAt = (fr: number) => SHOTS.find((s) => fr >= s.a && fr < s.b) ?? SHOTS[SHOTS.length - 1];
export const FLASH_AT = SHOTS[1].a;

// ---------------- the answer: seven trips [start, end, passenger, direction] ----------------
export type Who = "lion" | "goat" | "grass" | null;
export const TRIPS: { a: number; b: number; who: Who; toFar: boolean }[] = [
  { a: at("बकरी", 8), b: at("बकरी", 8) + 1.7, who: "goat", toFar: true },
  { a: at("वापस", 1) - 0.4, b: at("वापस", 1) + 1.0, who: null, toFar: false },
  { a: at("शेर", 7), b: at("शेर", 7) + 1.5, who: "lion", toFar: true },
  { a: at("वापस", 2), b: at("वापस", 2) + 1.6, who: "goat", toFar: false },
  { a: at("घास", 7), b: at("घास", 7) + 1.5, who: "grass", toFar: true },
  { a: at("वापस", 3) - 0.3, b: at("वापस", 3) + 1.0, who: null, toFar: false },
  { a: at("बकरी", 12), b: at("बकरी", 12) + 1.3, who: "goat", toFar: true },
];
