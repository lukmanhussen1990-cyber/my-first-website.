// Beat sheet for "Wheat and Weeds": every visual and sound hit, derived from the voice timeline.
// Plain JS so the Node audio synth uses exactly the same times as the picture.

// Walk cycles: one full cycle = two steps; a foot lands at phase 0 and 0.5.
export const WALKS = {
	farmer: {period: 1.24, phase: 0.0},
	enemy: {period: 1.6, phase: 0.1},
	saul: {period: 1.04, phase: 0.0},
	soldier: {period: 1.04, phase: 0.25},
	reaper: {period: 1.3, phase: 0.0},
	servant: {period: 1.1, phase: 0.0},
};

export function footsteps(walk, start, stop) {
	const {period, phase} = WALKS[walk];
	const out = [];
	let k = Math.ceil(((start + phase * period) / period) * 2);
	for (;;) {
		const t = (k * period) / 2 - phase * period;
		if (t > stop) break;
		if (t >= start) out.push(Math.round(t * 1000) / 1000);
		k++;
	}
	return out;
}

export function computeBeats(tl) {
	const c = tl.cues;
	const S = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));
	const word = (sid, text, nth = 0) => tl.words.filter((w) => w.sid === sid && w.text.toLowerCase().replace(/[^a-z']/g, '') === text)[nth].start;
	const total = tl.durationInSeconds;
	const b = {
		total,
		// ---- S1 the opening: the hooded hand throws black seed at night, weeds burst up ----
		s1: 0,
		throw1: 0.1, // the hand opens on frame 3
		seedsLand: 1.15,
		burst: 1.6, // black weeds burst up between the wheat (time-lapse)
		burstEnd: 2.7,
		pullBack: 1.95,
		titleOut: c.rightNow - 0.1,
		meterIn: 2.9,
		// ---- S2 the storyteller ----
		s2: S.S2.start,
		labelMt13: c.jesusTold + 0.5,
		// ---- S3 good seed ----
		s3: S.S3.start,
		sow1: c.farmer + 0.1,
		sow2: c.seed - 0.05,
		wheatStart: c.planted,
		// ---- S4 while men slept ----
		s4: S.S4.start,
		enemyIn: c.slept - 0.2,
		cardEnemyIn: c.enemy1 - 0.35,
		blackSow1: c.sowed,
		blackSow2: c.tares1 + 0.25,
		blackSow3: word('04', 'wheat') + 0.15,
		wentHisWay: c.wentHisWay,
		cardEnemyOut: S.S5.start - 0.15,
		// ---- S5 they look the same ----
		s5: S.S5.start,
		growStart: S.S5.start + 0.05,
		tareTurn: c.servantsAsked - 0.2, // the tares start to turn dark
		tareDark: c.servantsAsked + 1.3,
		weedsStart: c.servantsAsked,
		labelTaresIn: c.weedsCameUp + 0.2,
		labelTaresOut: c.sir - 0.2,
		servantsIn: c.sir - 0.5,
		cardSirIn: c.sir + 0.4,
		// ---- S6 an enemy hath done this ----
		s6: S.S6.start,
		tagWho: c.sir + 0.9,
		tagEnemy: c.enemy2,
		tagOut: S.S7.start - 0.2,
		cardSirOut: c.godDidnt - 0.1,
		farmerPoint: c.enemy2 - 0.25,
		// ---- S7 pull them up? ----
		s7: S.S7.start,
		servantLean: c.shouldWe - 0.55, // anticipation before the grab
		grab: c.pullUp + 0.05,
		buttonIn: c.shouldWe - 0.1,
		cursorIn: c.pullUp + 0.2,
		cursorHover: c.pullUp + 0.75,
		noHand: c.nay - 0.25,
		nay: c.nay,
		diveStart: c.nay + 0.35,
		underground: c.gatherUp - 0.35,
		pull: c.gatherUp,
		taresRip: word('09', 'tares') + 0.1,
		wheatRip: c.rootUp + 0.15,
		cardNayIn: c.nay + 0.8,
		cardNayOut: S.S8.start + 0.05,
		buttonOut: c.gatherUp + 0.4,
		// ---- S8 grow together ----
		s8: S.S8.start,
		cardHarvestIn: c.letBoth + 0.05,
		cardHarvestOut: c.hardTruth + 0.35,
		// ---- S9 the hard truth ----
		s9: S.S9.start,
		pushIn: c.hardTruth,
		spotsStart: c.pulledOut,
		spotsEnd: c.whoWouldBeLeft + 0.3,
		counterAll: c.all,
		cardSinnedIn: c.forAll - 0.15,
		cardSinnedOut: S.S10.start + 0.1,
		// ---- S10 patient ----
		s10: S.S10.start,
		hourglassIn: c.notSlow - 0.1,
		craneUp: S.S10.start,
		cardPerishIn: c.patient + 0.75,
		cardPerishOut: S.S11.start,
		// ---- S11 Saul ----
		s11: S.S11.start,
		labelActsIn: c.saul + 0.3,
		lightFlash: word('14b', 'jesus') - 0.05,
		whiteOut: word('14b', 'jesus') + 0.45,
		fall: word('14b', 'jesus') + 0.15,
		paulCut: c.became - 0.12,
		labelActsOut: c.became - 0.3,
		scrolls: [c.pulledHimUp, c.pulledHimUp + 0.6, c.pulledHimUp + 1.15, c.pulledHimUp + 1.7, c.letters + 0.05],
		// ---- S12 harvest ----
		s12: S.S12.start,
		harvestCrane: S.S12.start,
		barnGlow: c.harvest2,
		// ---- S13 call to action ----
		s13: S.S13.start,
		ctaBg: c.cta + 0.6,
		readyIn: c.cta + 0.25,
		buttonsIn: c.ready - 0.2,
		yesTap: c.yes + 0.05,
		notYetTap: c.notYet + 0.05,
		typingStart: c.voiceEnd + 0.15,
		typingCps: 12,
		commentText: 'Not yet… but I’m coming 🙏',
		// ---- S14 end card and the loop ----
		s14: S.S14.start,
		logoDraw: S.S14.start + 0.12,
		loopOut: total - 0.6,
	};
	b.typingEnd = b.typingStart + [...b.commentText].length / b.typingCps;
	b.hearts = b.typingEnd - 0.35;
	b.steps = {
		farmer: footsteps('farmer', b.s3 - 0.3, b.s4),
		enemy: footsteps('enemy', b.enemyIn, b.cardEnemyOut),
		saul: footsteps('saul', b.s11, b.lightFlash),
	};
	return b;
}
