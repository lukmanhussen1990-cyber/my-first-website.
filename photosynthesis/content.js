(function () {
  'use strict';

  window.Photosynthesis = window.Photosynthesis || {};

  // All player-facing English. The game fills in {a}, {b}, {n} and {total}.
  window.Photosynthesis.content = {
    title: 'Sun to Sugar',
    equation: '6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂',
    intro: 'Plants turn sunlight, water (H₂O) and carbon dioxide (CO₂) into glucose, a simple sugar. This game walks you through the steps in a leaf. Catch light, split water, make energy, then build sugar.',
    levels: [
      {
        stage: 'Light',
        name: 'Catch the Light',
        place: 'Thylakoid membrane',
        goal: 'Capture {a} photons',
        hint: 'Tap falling photons before they reach the membrane.',
        intro: 'Sunlight arrives as photons, tiny packets of light energy. Chlorophyll, the green pigment that absorbs them, sits in thylakoid membranes, which are flat, disc-shaped sacs. Tap falling photons to catch them.',
        complete: 'The captured light now drives the next step: splitting water.',
        fact: 'Chlorophyll absorbs mostly red and blue light and reflects green light. That is why leaves look green.'
      },
      {
        stage: 'Water',
        name: 'Split the Water',
        place: 'Thylakoid membrane (photosystem II)',
        goal: 'Release {a} oxygen bubbles (O₂)',
        hint: 'Tap water to split it. Two splits release one O₂.',
        intro: 'Photosystem II, a protein complex in the thylakoid membrane, splits water. The oxygen it releases, O₂, is the oxygen we breathe. Tap water to split it; two splits release one O₂.',
        complete: 'Six O₂ bubbles are released. The electrons and protons (H⁺) left behind now move on.',
        fact: 'Splitting two water molecules gives one O₂, four protons and four electrons.'
      },
      {
        stage: 'Energy',
        name: 'Make Energy',
        place: 'Thylakoid membrane',
        goal: 'Make {a} ATP and {b} NADPH',
        hint: 'Tap electrons at NADPH. Tap ATP synthase when it glows.',
        intro: 'Electrons travel along the electron transport chain, a row of carriers, toward the NADPH station. Tap electrons there to make NADPH, which carries high-energy electrons. Tap ATP synthase, an enzyme, when it glows to make ATP, the energy currency of cells.',
        complete: 'ATP and NADPH are stocked. Next, they power the sugar-building steps.',
        fact: 'The electron transport chain pumps protons into the thylakoid interior. Their flow back out through ATP synthase makes ATP.'
      },
      {
        stage: 'Sugar',
        name: 'Fix the Carbon',
        place: 'Stroma',
        goal: 'Fix {a} CO₂ into sugar',
        hint: 'Tap CO₂ to fix it. Each fix needs 3 ATP and 2 NADPH.',
        intro: 'The Calvin cycle builds sugar in the stroma, the fluid around the thylakoids. RuBisCO, the enzyme that fixes CO₂, attaches it to a 5-carbon sugar. Tap CO₂ to fix it; each fix uses 3 ATP and 2 NADPH.',
        complete: 'All six CO₂ are fixed. Together they form one glucose molecule.',
        fact: 'Making one glucose splits 12 water molecules. The Calvin cycle makes 6 again, so the net equation shows 6H₂O.'
      }
    ],
    finale: {
      title: 'You made sugar!',
      text: 'Along the way, 6 O₂ were released, 18 ATP and 12 NADPH were used, and 6 CO₂ were fixed into one glucose. This game is a simplified model of the real process, which has many more steps.',
      stats: { o2: 'Oxygen released', atp: 'ATP used', nadph: 'NADPH used', co2: 'CO₂ fixed', score: 'Score', stars: 'Stars' }
    },
    ui: {
      eyebrow: 'A photosynthesis game',
      levelOf: 'Level {n} of {total}',
      levelComplete: 'Level complete',
      glucoseMade: 'Glucose made!',
      goal: 'Goal',
      didYouKnow: 'Did you know?',
      buttons: { play: 'Play', start: 'Start level', next: 'Next level', seeSugar: 'See your sugar', playAgain: 'Play again', restart: 'Restart' },
      labels: { atp: 'ATP', nadph: 'NADPH', o2: 'O₂', co2: 'CO₂' },
      scene: {
        light: 'LIGHT',
        thylakoid: 'THYLAKOID',
        stroma: 'STROMA',
        photosystemI: 'Photosystem I',
        photosystemII: 'Photosystem II',
        electronChain: 'Electron chain',
        nadphStation: 'NADPH station',
        atpSynthase: 'ATP synthase',
        calvinCycle: 'Calvin cycle'
      },
      messages: {
        photon: 'Photon captured',
        split: 'Water split',
        missed: 'Missed!',
        waitForGlow: 'Wait for the glow!',
        notEnough: 'Need 3 ATP and 2 NADPH first',
        o2: 'Oxygen released: {n} of {total}',
        co2: 'CO₂ fixed: {n} of {total}',
        atp: 'ATP made',
        nadph: 'NADPH made',
        progress: 'Progress: {n} of {total}'
      }
    }
  };
})();
