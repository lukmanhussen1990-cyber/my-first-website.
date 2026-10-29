// Voice timeline helpers shared by the Remotion composition and the Node
// audio tools (plain TS, no Remotion imports).

export interface TimelineWord {
  text: string;
  start: number; // seconds from frame 0
  end: number;
  sentence: number;
  scene: string;
  page: number; // caption page inside the sentence
  keyword: boolean;
  tone?: 'gold' | 'red' | 'blue' | 'green';
}

export interface TimelineSentence {
  id: number;
  scene: string;
  start: number;
  end: number;
}

export interface Timeline {
  fps: number;
  voice: string; // voice description
  voiceEnd: number; // seconds, end of the last spoken word
  audio?: string | null; // final mix path inside public/, once it exists
  words: TimelineWord[];
  sentences: TimelineSentence[];
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9']/g, '').replace(/'$/, '');

export class TimelineIndex {
  tl: Timeline;
  constructor(tl: Timeline) {
    this.tl = tl;
  }

  get fps() {
    return this.tl.fps;
  }

  f(t: number) {
    return Math.round(t * this.tl.fps);
  }

  sentence(id: number) {
    const s = this.tl.sentences.find((x) => x.id === id);
    if (!s) throw new Error(`No sentence ${id}`);
    return s;
  }

  /** Start/end seconds of the nth word matching `text` in sentence `id`. */
  word(id: number, text: string, nth = 0) {
    const want = norm(text);
    const hits = this.tl.words.filter((w) => w.sentence === id && norm(w.text) === want);
    const w = hits[nth];
    if (!w) throw new Error(`No word "${text}" (#${nth}) in sentence ${id}`);
    return w;
  }

  /** Frame where a word starts. */
  wf(id: number, text: string, nth = 0) {
    return this.f(this.word(id, text, nth).start);
  }

  /** Frame where a sentence starts / ends. */
  sf(id: number) {
    return this.f(this.sentence(id).start);
  }
  ef(id: number) {
    return this.f(this.sentence(id).end);
  }

  /** First frame of a scene (start of its first sentence). */
  sceneStart(scene: string) {
    const s = this.tl.sentences.find((x) => x.scene === scene);
    if (!s) throw new Error(`No scene ${scene}`);
    return this.f(s.start);
  }

  /** Caption pages: groups of words shown together. */
  pages() {
    const pages: {sentence: number; page: number; words: TimelineWord[]; start: number; end: number}[] = [];
    for (const w of this.tl.words) {
      const last = pages[pages.length - 1];
      if (last && last.sentence === w.sentence && last.page === w.page) {
        last.words.push(w);
        last.end = w.end;
      } else {
        pages.push({sentence: w.sentence, page: w.page, words: [w], start: w.start, end: w.end});
      }
    }
    return pages;
  }
}
