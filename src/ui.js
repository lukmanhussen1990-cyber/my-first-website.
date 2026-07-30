/**
 * DOM layer: menus, team selection, HUD and post-match screens.
 * The UI never touches simulation state directly — it reads a Match and emits
 * actions back to main.js.
 */

import { DIFFICULTY, MATCH, STATE } from './constants.js';
import { FORMATIONS, TEAMS } from './teams.js';

const HALF_LABELS = ['90 sec', '2½ min', '4 min'];

export class UI {
  constructor(root, handlers) {
    this.root = root;
    this.handlers = handlers;
    this.screens = new Map();
    for (const el of root.querySelectorAll('[data-screen]')) {
      this.screens.set(el.dataset.screen, el);
    }
    this.hud = root.querySelector('#hud');
    this.bannerEl = root.querySelector('[data-banner]');
    this.tickerEl = root.querySelector('[data-ticker]');
    this.current = null;
    this.lastTickerLength = -1;

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      this.handlers.onAction(action, btn);
    });

    this.buildSelects();
  }

  buildSelects() {
    const diff = this.root.querySelector('[data-option="difficulty"]');
    diff.innerHTML = '';
    for (const [key, value] of Object.entries(DIFFICULTY)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = value.label;
      diff.appendChild(opt);
    }
    diff.value = 'normal';

    const half = this.root.querySelector('[data-option="halfLength"]');
    half.innerHTML = '';
    MATCH.halfSecondsOptions.forEach((seconds, i) => {
      const opt = document.createElement('option');
      opt.value = String(seconds);
      opt.textContent = `${HALF_LABELS[i]} per half`;
      half.appendChild(opt);
    });
    half.value = String(MATCH.halfSecondsOptions[1]);

    for (const key of ['formationHome', 'formationAway']) {
      const sel = this.root.querySelector(`[data-option="${key}"]`);
      sel.innerHTML = '';
      const auto = document.createElement('option');
      auto.value = '';
      auto.textContent = 'Team default';
      sel.appendChild(auto);
      for (const [id, f] of Object.entries(FORMATIONS)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = f.label;
        sel.appendChild(opt);
      }
    }
  }

  showScreen(name) {
    for (const [key, el] of this.screens) el.hidden = key !== name;
    this.current = name || null;
  }

  hideScreens() {
    for (const el of this.screens.values()) el.hidden = true;
    this.current = null;
  }

  setHudVisible(visible) {
    this.hud.hidden = !visible;
  }

  readOptions() {
    const q = (sel) => this.root.querySelector(sel);
    return {
      difficulty: q('[data-option="difficulty"]').value,
      halfSeconds: Number(q('[data-option="halfLength"]').value),
      formationHome: q('[data-option="formationHome"]').value || null,
      formationAway: q('[data-option="formationAway"]').value || null,
      offside: q('[data-option="offside"]').checked,
      fouls: q('[data-option="fouls"]').checked,
    };
  }

  setSetupMode({ title, awayLabel, lockAway = false, selection }) {
    this.root.querySelector('[data-setup-title]').textContent = title;
    this.root.querySelector('[data-away-label]').textContent = awayLabel;
    this.renderTeamLists(selection, lockAway);
  }

  renderTeamLists(selection, lockAway) {
    for (const which of ['home', 'away']) {
      const list = this.root.querySelector(`[data-team-list="${which}"]`);
      list.innerHTML = '';
      for (const team of TEAMS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'team-option';
        btn.setAttribute('aria-pressed', String(selection[which] === team.id));
        btn.dataset.teamId = team.id;
        btn.dataset.side = which;
        btn.disabled = lockAway && which === 'away';
        btn.innerHTML = `
          <span class="shirt" style="background:${team.kit.shirt};border-color:${team.kit.shorts}"></span>
          <span class="name">${team.name}<br /><small style="color:var(--ink-dim)">${
            FORMATIONS[team.formation].label
          }</small></span>
          <span class="rating">${team.rating}</span>`;
        btn.addEventListener('click', () => this.handlers.onTeamPick(which, team.id));
        list.appendChild(btn);
      }
    }
    this.updateKitPreview(selection);
  }

  updateKitPreview(selection) {
    for (const which of ['home', 'away']) {
      const team = TEAMS.find((t) => t.id === selection[which]) || TEAMS[0];
      const el = this.root.querySelector(`[data-preview="${which}"]`);
      el.style.background = `linear-gradient(160deg, ${team.kit.shirt} 60%, ${team.kit.shorts} 60%)`;
      el.title = team.name;
    }
  }

  refreshSelection(selection) {
    for (const btn of this.root.querySelectorAll('.team-option')) {
      btn.setAttribute('aria-pressed', String(selection[btn.dataset.side] === btn.dataset.teamId));
    }
    this.updateKitPreview(selection);
  }

  /* ---------------------------------------------------------------- */
  /* HUD                                                               */
  /* ---------------------------------------------------------------- */

  bindMatch(match) {
    this.match = match;
    const set = (sel, value) => {
      this.root.querySelector(sel).textContent = value;
    };
    set('[data-abbr="home"]', match.home.short);
    set('[data-abbr="away"]', match.away.short);
    this.root.querySelector('[data-kit="home"]').style.background = match.home.activeKit.shirt;
    this.root.querySelector('[data-kit="away"]').style.background = match.away.activeKit.shirt;
    this.tickerEl.innerHTML = '';
    this.lastTickerLength = -1;
  }

  updateHUD(match, shootout) {
    if (!match) return;
    const scoreEl = this.root.querySelector('[data-score]');
    if (shootout) {
      const [h, a] = shootout.displayScores();
      scoreEl.textContent = `${match.home.score} – ${match.away.score}  (${h}–${a})`;
    } else {
      scoreEl.textContent = `${match.home.score} – ${match.away.score}`;
    }
    this.root.querySelector('[data-clock]').textContent = shootout
      ? 'PENS'
      : match.formattedClock();
    this.root.querySelector('[data-half]').textContent = shootout
      ? 'Shootout'
      : match.state === STATE.FULL_TIME
      ? 'FT'
      : match.state === STATE.HALF_TIME
      ? 'HT'
      : match.half === 1
      ? '1st'
      : '2nd';

    const banner = match.banner;
    if (banner) {
      this.bannerEl.hidden = false;
      this.bannerEl.textContent = banner.text;
      this.bannerEl.className = `banner ${banner.kind || ''}`;
    } else {
      this.bannerEl.hidden = true;
    }

    if (match.commentary.length !== this.lastTickerLength) {
      this.lastTickerLength = match.commentary.length;
      this.tickerEl.innerHTML = '';
      for (const item of match.commentary.slice(0, 4)) {
        const li = document.createElement('li');
        li.className = item.type;
        li.textContent = `${item.minute}' ${item.text}`;
        this.tickerEl.appendChild(li);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Full time                                                         */
  /* ---------------------------------------------------------------- */

  showFullTime(match, { title, actions, shootoutScores }) {
    this.root.querySelector('[data-ft-title]').textContent = title;
    const scoreLine = shootoutScores
      ? `${match.home.short} ${match.home.score} – ${match.away.score} ${match.away.short}
         <small style="display:block;font-size:0.4em;letter-spacing:0.1em;color:var(--ink-dim)">
         ${shootoutScores[0]}–${shootoutScores[1]} on penalties</small>`
      : `${match.home.short} ${match.home.score} – ${match.away.score} ${match.away.short}`;
    this.root.querySelector('[data-ft-score]').innerHTML = scoreLine;

    const [posHome, posAway] = match.possessionPercent();
    const stats = [
      ['Possession', posHome, posAway, '%'],
      ['Shots', match.home.stats.shots, match.away.stats.shots],
      ['On target', match.home.stats.onTarget, match.away.stats.onTarget],
      ['Corners', match.home.stats.corners, match.away.stats.corners],
      ['Fouls', match.home.stats.fouls, match.away.stats.fouls],
      ['Saves', match.home.stats.saves, match.away.stats.saves],
    ];
    const statsEl = this.root.querySelector('[data-ft-stats]');
    statsEl.innerHTML = stats
      .map(([label, a, b, unit = '']) => {
        const total = a + b || 1;
        const pa = Math.round((a / total) * 100);
        return `
        <div class="stat-label">${label}</div>
        <div class="stat-row">
          <span>${a}${unit}</span>
          <span class="stat-bar">
            <span style="width:${pa}%;background:${match.home.activeKit.shirt}"></span>
            <span class="away" style="width:${100 - pa}%;background:${match.away.activeKit.shirt}"></span>
          </span>
          <span style="text-align:right">${b}${unit}</span>
        </div>`;
      })
      .join('');

    const eventsEl = this.root.querySelector('[data-ft-events]');
    const notable = match.events.filter((e) =>
      ['goal', 'yellow', 'red', 'penalty', 'offside'].includes(e.type)
    );
    eventsEl.innerHTML = notable.length
      ? notable
          .map(
            (e) => `<div class="ft-event"><span class="minute">${e.minute}'</span><span>${e.text}</span></div>`
          )
          .join('')
      : '<div class="ft-event"><span class="minute">—</span><span>A quiet afternoon at the ground.</span></div>';

    const footer = this.root.querySelector('[data-ft-actions]');
    footer.innerHTML = '';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `btn ${action.primary ? 'primary large' : ''}`;
      btn.dataset.action = action.id;
      btn.textContent = action.label;
      footer.appendChild(btn);
    }

    this.showScreen('fulltime');
  }

  /* ---------------------------------------------------------------- */
  /* Cup bracket                                                       */
  /* ---------------------------------------------------------------- */

  showBracket(cup) {
    const el = this.root.querySelector('[data-bracket]');
    el.innerHTML = cup.rounds
      .map(
        (round) => `
        <div class="bracket-round">
          <h4>${round.name}</h4>
          ${round.ties
            .map((tie) => {
              const you = tie.home.id === cup.userTeamId || tie.away.id === cup.userTeamId;
              const result = tie.played
                ? `${tie.homeScore}–${tie.awayScore}${tie.pens ? ` (${tie.pens})` : ''}`
                : 'vs';
              return `
              <div class="bracket-tie ${you ? 'is-you' : ''}">
                <span class="side">
                  <span class="shirt" style="background:${tie.home.kit.shirt}"></span>${tie.home.name}
                </span>
                <span class="result">${result}</span>
                <span class="side right">
                  ${tie.away.name}<span class="shirt" style="background:${tie.away.kit.shirt}"></span>
                </span>
              </div>`;
            })
            .join('')}
        </div>`
      )
      .join('');
    const btn = this.root.querySelector('[data-action="cup-continue"]');
    btn.textContent = cup.finished ? 'Back to menu' : cup.nextLabel();
    this.showScreen('cup');
  }
}
