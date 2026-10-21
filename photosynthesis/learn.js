(function () {
  'use strict';
  window.Photosynthesis = window.Photosynthesis || {};

  // Player-facing copy for this feature. Definitions follow the Science section of SPEC.md.
  const copy = {
    button: 'Learn',
    title: 'Words to know',
    close: 'Close',
    terms: [
      {
        term: 'photon',
        definition: 'A packet of light energy. Chlorophyll absorbs photons, and their energy drives the light-dependent reactions.'
      },
      {
        term: 'chlorophyll',
        definition: 'The green pigment in thylakoid membranes that absorbs mostly red and blue light. It reflects green, which is why leaves look green.'
      },
      {
        term: 'thylakoid',
        definition: 'A flattened, membrane-bound sac inside a chloroplast, often stacked into grana. The light-dependent reactions take place in thylakoid membranes.'
      },
      {
        term: 'stroma',
        definition: 'The fluid inside a chloroplast that surrounds the thylakoids. The Calvin cycle, the light-independent reactions, takes place here.'
      },
      {
        term: 'photosystem II',
        definition: 'A protein complex in the thylakoid membrane that uses chlorophyll to absorb light. It splits water, releasing the oxygen we breathe, and sends electrons along the electron transport chain.'
      },
      {
        term: 'electron transport chain',
        definition: 'A row of carrier molecules in the thylakoid membrane that passes electrons along. As the electrons move down the chain, it pumps H⁺ into the thylakoid interior.'
      },
      {
        term: 'ATP synthase',
        definition: 'An enzyme in the thylakoid membrane that makes ATP. H⁺ flowing back out through it turns a rotor, and that motion makes ATP from ADP and phosphate.'
      },
      {
        term: 'ATP',
        definition: 'Adenosine triphosphate, the energy currency of the cell. The light-dependent reactions make it, and the Calvin cycle spends it to build sugar.'
      },
      {
        term: 'NADPH',
        definition: 'A carrier molecule that holds high-energy electrons. Electrons re-energized by photosystem I reduce NADP⁺ to make it, and the Calvin cycle uses it to build sugar.'
      },
      {
        term: 'RuBisCO',
        definition: 'The enzyme that fixes carbon in the Calvin cycle, in the stroma. It attaches CO₂ to a 5-carbon sugar, the first step toward making sugar.'
      },
      {
        term: 'Calvin cycle',
        definition: 'The light-independent reactions, which take place in the stroma. They fix CO₂ into sugar using ATP and NADPH from the light reactions: six CO₂ make one glucose, using 18 ATP and 12 NADPH in total.'
      },
      {
        term: 'glucose',
        definition: 'A 6-carbon sugar, C₆H₁₂O₆, that plants use for energy and to build other molecules. The Calvin cycle makes it from six CO₂ molecules.'
      }
    ]
  };

  // Dialog styles, palette from SPEC.md. No animation, so there is nothing to disable for reduced motion.
  const CSS = `
.learn-dialog {
  box-sizing: border-box;
  width: min(34rem, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  max-height: 85vh;
  overflow: auto;
  padding: 0;
  border: 1px solid #2d6a4f;
  border-radius: 16px;
  background: #13261f;
  color: #eaf5ee;
  color-scheme: dark;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}
.learn-dialog::backdrop { background: rgba(12, 26, 22, 0.82); }
.learn-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  background: #13261f;
  border-bottom: 1px solid #2d6a4f;
}
.learn-head h2 { margin: 0; font-size: 1.25rem; color: #ffd166; }
.learn-list { margin: 0; padding: 4px 20px 20px; }
.learn-item { padding: 12px 0; border-bottom: 1px solid #2d6a4f; }
.learn-item:last-child { border-bottom: 0; }
.learn-list dt { font-weight: 700; color: #ffd166; }
.learn-list dd { margin: 4px 0 0; line-height: 1.5; }
`;

  let learnButton = null;   // the HUD button, set by init()
  let dialog = null;        // built once, on first open
  let pausedHere = false;   // true only while this module holds the game's pause

  // Every game call is guarded: the game may be missing, or may lack the method.
  function hasGame(method) {
    const game = window.Photosynthesis && window.Photosynthesis.game;
    return Boolean(game) && typeof game[method] === 'function';
  }

  function callGame(method) {
    if (!hasGame(method)) return undefined;
    try {
      return window.Photosynthesis.game[method]();
    } catch (err) {
      return undefined;
    }
  }

  // Pauses only when the game is running. Returns true if this module did the pausing.
  function pauseGame() {
    const state = callGame('state');
    if (state && state.paused) return false;
    if (!hasGame('pause')) return false;
    callGame('pause');
    return true;
  }

  function resumeGame() {
    if (!pausedHere) return;
    pausedHere = false;
    callGame('resume');
  }

  function onDialogClose() {
    resumeGame();
    if (learnButton) learnButton.focus();
  }

  function buildDialog() {
    const modal = document.createElement('dialog');
    modal.className = 'learn-dialog';
    modal.setAttribute('aria-labelledby', 'learn-title');

    const head = document.createElement('div');
    head.className = 'learn-head';

    const title = document.createElement('h2');
    title.id = 'learn-title';
    title.textContent = copy.title;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn-primary';
    closeButton.textContent = copy.close;
    closeButton.addEventListener('click', function () {
      modal.close();
    });

    head.appendChild(title);
    head.appendChild(closeButton);

    const list = document.createElement('dl');
    list.className = 'learn-list';
    copy.terms.forEach(function (item) {
      const group = document.createElement('div');
      group.className = 'learn-item';
      const dt = document.createElement('dt');
      dt.textContent = item.term;
      const dd = document.createElement('dd');
      dd.textContent = item.definition;
      group.appendChild(dt);
      group.appendChild(dd);
      list.appendChild(group);
    });

    modal.appendChild(head);
    modal.appendChild(list);
    modal.addEventListener('close', onDialogClose);
    return modal;
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.setAttribute('data-feature', 'learn');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function openDialog() {
    if (!document.body) return;
    if (!dialog) {
      injectStyle();
      dialog = buildDialog();
      document.body.appendChild(dialog);
    }
    if (dialog.open) return;
    dialog.showModal();
    pausedHere = pauseGame();
  }

  // Inserts the button into .hud-meta, just before #btn-restart. Returns null if either is missing.
  function insertButton() {
    const meta = document.querySelector('.hud-meta');
    const restart = document.getElementById('btn-restart');
    if (!meta || !restart || !meta.contains(restart)) return null;
    const button = document.createElement('button');
    button.id = 'btn-learn';
    button.className = 'btn btn-ghost';
    button.type = 'button';
    button.textContent = copy.button;
    restart.parentNode.insertBefore(button, restart);
    return button;
  }

  function init() {
    // Without native dialog support there is nothing to open.
    if (typeof document.createElement('dialog').showModal !== 'function') return;
    learnButton = document.getElementById('btn-learn') || insertButton();
    if (!learnButton) return;
    learnButton.addEventListener('click', openDialog);
  }

  window.Photosynthesis.learn = { open: openDialog };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
