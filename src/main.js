/**
 * Touchline — entry point. Owns the frame loop, the mode state machine
 * (menu / match / cup) and the glue between UI, input, audio and simulation.
 */

import { STATE } from './constants.js';
import { AudioEngine } from './audio.js';
import { InputManager, attachTouchControls } from './input.js';
import { Match } from './match.js';
import { Renderer } from './renderer.js';
import { Shootout } from './shootout.js';
import { UI } from './ui.js';
import { Cup } from './cup.js';
import { TEAMS, getTeam } from './teams.js';

const STEP = 1 / 60;
const SETTINGS_KEY = 'touchline.settings.v1';

const app = document.getElementById('app');
const canvas = document.getElementById('pitch');

const settings = loadSettings();
const audio = new AudioEngine();
const input = new InputManager();

function loadSettings() {
  const defaults = { sound: true, volume: 70, radar: true, forceTouch: false, lastTeams: {} };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage can be unavailable in private modes — not worth failing over */
  }
}

class Game {
  constructor() {
    this.mode = 'menu';
    this.match = null;
    this.shootout = null;
    this.cup = null;
    this.pendingCupTie = null;
    this.selection = {
      home: settings.lastTeams.home || TEAMS[0].id,
      away: settings.lastTeams.away || TEAMS[2].id,
    };
    this.setupMode = 'quick';
    this.helpReturn = 'menu';

    this.ui = new UI(app, {
      onAction: (action, el) => this.handleAction(action, el),
      onTeamPick: (side, id) => this.pickTeam(side, id),
    });

    this.renderer = new Renderer(canvas, null);
    this.startDemoMatch();
    this.renderer.setMatch(this.match);
    this.ui.showScreen('menu');
    this.ui.setHudVisible(false);
    this.applySettings();

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.renderer.resize(), 250));

    input.onAnyKey((e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyM') this.toggleSound();
    });

    const touchRoot = app.querySelector('[data-touch-root]');
    attachTouchControls(app.querySelector('#hud'), input);
    this.touchRoot = touchRoot;
    this.updateTouchVisibility();
  }

  /* ---------------------------------------------------------------- */
  /* Settings                                                          */
  /* ---------------------------------------------------------------- */

  applySettings() {
    const q = (s) => app.querySelector(s);
    q('[data-setting="sound"]').checked = settings.sound;
    q('[data-setting="volume"]').value = settings.volume;
    q('[data-setting="radar"]').checked = settings.radar;
    q('[data-setting="touch"]').checked = settings.forceTouch;

    q('[data-setting="sound"]').addEventListener('change', (e) => {
      settings.sound = e.target.checked;
      audio.setEnabled(settings.sound);
      saveSettings();
      this.updateSoundLabel();
    });
    q('[data-setting="volume"]').addEventListener('input', (e) => {
      settings.volume = Number(e.target.value);
      audio.setVolume(settings.volume / 100);
      saveSettings();
    });
    q('[data-setting="radar"]').addEventListener('change', (e) => {
      settings.radar = e.target.checked;
      this.renderer.showRadar = settings.radar;
      saveSettings();
    });
    q('[data-setting="touch"]').addEventListener('change', (e) => {
      settings.forceTouch = e.target.checked;
      saveSettings();
      this.updateTouchVisibility();
    });

    audio.setVolume(settings.volume / 100);
    audio.setEnabled(settings.sound);
    this.renderer.showRadar = settings.radar;
    this.updateSoundLabel();
  }

  updateSoundLabel() {
    const el = app.querySelector('[data-sound-label]');
    if (el) el.textContent = `Sound: ${settings.sound ? 'On' : 'Off'}`;
  }

  updateTouchVisibility() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const show = (coarse || settings.forceTouch) && this.mode === 'match';
    this.touchRoot.hidden = !show;
  }

  toggleSound() {
    settings.sound = !settings.sound;
    audio.setEnabled(settings.sound);
    app.querySelector('[data-setting="sound"]').checked = settings.sound;
    this.updateSoundLabel();
    saveSettings();
  }

  /* ---------------------------------------------------------------- */
  /* Match lifecycle                                                   */
  /* ---------------------------------------------------------------- */

  startDemoMatch() {
    // An AI-vs-AI game runs behind the menus so the pitch is never empty.
    const pool = [...TEAMS].sort(() => Math.random() - 0.5);
    this.match = new Match({
      homeTeam: pool[0],
      awayTeam: pool[1],
      difficulty: 'hard',
      halfSeconds: 600,
      userSides: [],
      controllers: [],
      audio,
      rules: { offside: true, fouls: true },
      onFinish: () => this.startDemoMatch(),
    });
    this.shootout = null;
    if (this.renderer) this.renderer.setMatch(this.match);
  }

  startMatch(options) {
    const {
      homeId,
      awayId,
      difficulty,
      halfSeconds,
      formationHome,
      formationAway,
      offside,
      fouls,
      twoPlayer,
      userIsAway = false,
      context = null,
    } = options;

    const home = getTeam(homeId);
    const away = getTeam(awayId);
    const userSides = twoPlayer ? [0, 1] : userIsAway ? [1] : [0];

    this.match = new Match({
      homeTeam: formationHome ? { ...home, formation: formationHome } : home,
      awayTeam: formationAway ? { ...away, formation: formationAway } : away,
      difficulty,
      halfSeconds,
      userSides,
      controllers: userSides.map((_, i) => input.controllers[i]),
      audio,
      rules: { offside, fouls },
      onFinish: (m) => this.onMatchFinished(m),
    });
    this.matchContext = context;
    this.shootout = null;
    this.mode = 'match';
    input.twoPlayer = twoPlayer;
    this.renderer.setMatch(this.match);
    this.ui.bindMatch(this.match);
    this.ui.hideScreens();
    this.ui.setHudVisible(true);
    this.updateTouchVisibility();
    audio.start();
    audio.resume();
    audio.play('whistle');
  }

  onMatchFinished(match) {
    const drawn = match.home.score === match.away.score;
    const needsWinner = this.matchContext && this.matchContext.type === 'cup';
    if (drawn && needsWinner) {
      // Cup ties cannot end level.
      setTimeout(() => this.beginShootout(), 2200);
      return;
    }
    setTimeout(() => this.showFullTime(), 2000);
  }

  beginShootout() {
    if (!this.match || this.shootout) return;
    this.shootout = new Shootout(this.match, (winner, scores) => {
      this.shootoutResult = { winner, scores };
      setTimeout(() => this.showFullTime(), 2600);
    });
    this.match.state = STATE.SHOOTOUT;
  }

  showFullTime() {
    const match = this.match;
    const context = this.matchContext;
    let title = 'Full Time';
    const userTeam = match.users.length ? match.users[0].team : match.home;
    const otherTeam = match.opponentOf(userTeam);
    const won =
      this.shootoutResult
        ? this.shootoutResult.winner === userTeam
        : userTeam.score > otherTeam.score;
    const lost =
      this.shootoutResult
        ? this.shootoutResult.winner !== userTeam
        : userTeam.score < otherTeam.score;

    if (match.users.length === 2) {
      title = won ? `${userTeam.name} win` : lost ? `${otherTeam.name} win` : 'Honours even';
    } else if (won) title = 'You win!';
    else if (lost) title = 'You lose';
    else title = 'Draw';

    let actions;
    if (context && context.type === 'cup') {
      const winnerTeam = this.shootoutResult ? this.shootoutResult.winner : won ? userTeam : otherTeam;
      const pensText = this.shootoutResult
        ? `${this.shootoutResult.scores[0]}–${this.shootoutResult.scores[1]} pens`
        : null;
      this.cup.recordUserResult(
        context.tie,
        match.home.score,
        match.away.score,
        pensText,
        winnerTeam.data
      );
      this.cup.simulateRest();
      this.cup.advance();
      actions = [{ id: 'cup-bracket', label: 'To the bracket', primary: true }];
      if (this.cup.eliminated) title = 'Knocked out';
      else if (this.cup.finished) title = 'Champions!';
    } else {
      actions = [
        { id: 'rematch', label: 'Rematch', primary: true },
        { id: 'change-teams', label: 'Change teams' },
        { id: 'main-menu', label: 'Main menu' },
      ];
    }

    this.ui.showFullTime(match, {
      title,
      actions,
      shootoutScores: this.shootoutResult ? this.shootoutResult.scores : null,
    });
    this.ui.setHudVisible(false);
    this.mode = 'fulltime';
    this.updateTouchVisibility();
  }

  quitToMenu() {
    this.mode = 'menu';
    this.shootout = null;
    this.shootoutResult = null;
    this.matchContext = null;
    input.twoPlayer = false;
    this.startDemoMatch();
    this.ui.setHudVisible(false);
    this.ui.showScreen('menu');
    this.updateTouchVisibility();
  }

  togglePause() {
    if (this.mode !== 'match') return;
    if (this.ui.current === 'pause') {
      this.ui.hideScreens();
      this.match.paused = false;
    } else if (!this.ui.current) {
      this.ui.showScreen('pause');
      this.match.paused = true;
      this.updateSoundLabel();
    }
  }

  /* ---------------------------------------------------------------- */
  /* UI actions                                                        */
  /* ---------------------------------------------------------------- */

  pickTeam(side, id) {
    if (this.selection[side] === id) return;
    // Both sides can't field the same team.
    const other = side === 'home' ? 'away' : 'home';
    if (this.selection[other] === id) {
      this.selection[other] = this.selection[side];
    }
    this.selection[side] = id;
    settings.lastTeams = { ...this.selection };
    saveSettings();
    this.ui.refreshSelection(this.selection);
    audio.play('ui');
  }

  openSetup(mode) {
    this.setupMode = mode;
    const config = {
      quick: { title: 'Quick Match', awayLabel: 'CPU', lockAway: false },
      two: { title: 'Two Players', awayLabel: 'P2', lockAway: false },
      cup: { title: 'Cup Run — pick your side', awayLabel: 'DRAW', lockAway: true },
    }[mode];
    this.ui.setSetupMode({ ...config, selection: this.selection });
    this.ui.showScreen('setup');
  }

  handleAction(action, el) {
    audio.start();
    audio.resume();
    if (action !== 'toggle-sound') audio.play('ui');

    switch (action) {
      case 'quick-match':
        this.openSetup('quick');
        break;
      case 'two-player':
        this.openSetup('two');
        break;
      case 'cup':
        this.openSetup('cup');
        break;
      case 'start-match':
        this.beginFromSetup();
        break;
      case 'back-to-menu':
        this.ui.showScreen('menu');
        break;
      case 'help':
        this.helpReturn = this.ui.current || 'menu';
        this.ui.showScreen('help');
        break;
      case 'close-help':
        this.ui.showScreen(this.helpReturn === 'pause' ? 'pause' : this.helpReturn);
        break;
      case 'settings':
        this.ui.showScreen('settings');
        break;
      case 'pause':
        this.togglePause();
        break;
      case 'resume':
        this.togglePause();
        break;
      case 'toggle-sound':
        this.toggleSound();
        break;
      case 'abandon':
        this.match.paused = false;
        this.quitToMenu();
        break;
      case 'rematch':
        this.startMatch({ ...this.lastMatchOptions });
        break;
      case 'change-teams':
        this.ui.setHudVisible(false);
        this.openSetup(this.setupMode === 'cup' ? 'quick' : this.setupMode);
        break;
      case 'main-menu':
        this.quitToMenu();
        break;
      case 'cup-bracket':
        this.ui.showBracket(this.cup);
        break;
      case 'cup-continue':
        this.continueCup();
        break;
      default:
        break;
    }
  }

  beginFromSetup() {
    const opts = this.ui.readOptions();
    if (this.setupMode === 'cup') {
      this.cup = new Cup(this.selection.home);
      this.cupOptions = opts;
      this.ui.showBracket(this.cup);
      return;
    }
    this.lastMatchOptions = {
      homeId: this.selection.home,
      awayId: this.selection.away,
      difficulty: opts.difficulty,
      halfSeconds: opts.halfSeconds,
      formationHome: opts.formationHome,
      formationAway: opts.formationAway,
      offside: opts.offside,
      fouls: opts.fouls,
      twoPlayer: this.setupMode === 'two',
    };
    this.shootoutResult = null;
    this.startMatch(this.lastMatchOptions);
  }

  continueCup() {
    if (!this.cup) {
      this.quitToMenu();
      return;
    }
    if (this.cup.finished || this.cup.eliminated) {
      this.cup = null;
      this.quitToMenu();
      return;
    }
    const tie = this.cup.userTie();
    if (!tie) {
      this.cup.simulateRest();
      this.cup.advance();
      this.ui.showBracket(this.cup);
      return;
    }
    const opts = this.cupOptions;
    this.shootoutResult = null;
    this.lastMatchOptions = {
      homeId: tie.home.id,
      awayId: tie.away.id,
      difficulty: opts.difficulty,
      halfSeconds: opts.halfSeconds,
      formationHome: tie.home.id === this.cup.userTeamId ? opts.formationHome : null,
      formationAway: tie.away.id === this.cup.userTeamId ? opts.formationHome : null,
      offside: opts.offside,
      fouls: opts.fouls,
      twoPlayer: false,
      context: { type: 'cup', tie },
    };
    // The human always controls their own club, home or away.
    const userIsAway = tie.away.id === this.cup.userTeamId;
    this.startMatch({ ...this.lastMatchOptions, userIsAway });
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                             */
  /* ---------------------------------------------------------------- */

  update(dt) {
    if (!this.match) return;
    if (this.shootout && !this.shootout.finished) {
      this.shootout.update(dt);
      this.match.updateTimers(dt);
      this.match.updateEffects(dt);
      this.match.updateAtmosphere(dt);
    } else {
      this.match.update(dt);
    }
  }

  render(dt) {
    this.renderer.updateCamera(dt);
    this.renderer.draw();
    if (this.mode === 'match') this.ui.updateHUD(this.match, this.shootout);
  }
}

/* -------------------------------------------------------------------- */
/* Boot                                                                  */
/* -------------------------------------------------------------------- */

const game = new Game();
app.querySelector('[data-loading]').hidden = true;

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;
  accumulator += elapsed;

  input.update(elapsed);

  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    game.update(STEP);
    accumulator -= STEP;
    steps++;
    // Consume edge-triggered presses exactly once.
    input.clearEdges();
  }

  audio.update(elapsed);
  game.render(elapsed);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Kick the audio context awake on the first interaction of any kind.
const wake = () => {
  audio.start();
  audio.resume();
};
window.addEventListener('pointerdown', wake, { once: true });
window.addEventListener('keydown', wake, { once: true });

// Expose a little for debugging in the console without polluting globals.
window.touchline = { game, input, audio };
