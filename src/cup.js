/**
 * An eight-team knockout cup. The player's ties are played; the rest of the
 * bracket is simulated from team ratings so the draw feels alive.
 */

import { TEAMS } from './teams.js';
import { clamp, rand } from './math.js';

const ROUND_NAMES = ['Quarter-finals', 'Semi-finals', 'Final'];

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Poisson sample, used for simulated scorelines. */
function poisson(lambda) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > l);
  return k - 1;
}

export class Cup {
  constructor(userTeamId) {
    this.userTeamId = userTeamId;
    const others = shuffle(TEAMS.filter((t) => t.id !== userTeamId)).slice(0, 7);
    const field = shuffle([TEAMS.find((t) => t.id === userTeamId), ...others]);
    this.rounds = [
      { name: ROUND_NAMES[0], ties: this.pairUp(field) },
      { name: ROUND_NAMES[1], ties: [] },
      { name: ROUND_NAMES[2], ties: [] },
    ];
    this.roundIndex = 0;
    this.finished = false;
    this.champion = null;
  }

  pairUp(teams) {
    const ties = [];
    for (let i = 0; i < teams.length; i += 2) {
      ties.push({
        home: teams[i],
        away: teams[i + 1],
        played: false,
        homeScore: 0,
        awayScore: 0,
        pens: null,
        winner: null,
      });
    }
    return ties;
  }

  get currentRound() {
    return this.rounds[this.roundIndex];
  }

  /** The tie the human is involved in this round, if they are still in. */
  userTie() {
    if (this.finished) return null;
    return this.currentRound.ties.find(
      (t) => !t.played && (t.home.id === this.userTeamId || t.away.id === this.userTeamId)
    );
  }

  nextLabel() {
    const tie = this.userTie();
    if (!tie) return this.eliminated ? 'Back to menu' : 'Continue';
    const opponent = tie.home.id === this.userTeamId ? tie.away : tie.home;
    return `Play ${this.currentRound.name.replace(/s$/, '')} vs ${opponent.short}`;
  }

  simulateTie(tie) {
    const diff = (tie.home.rating - tie.away.rating) * 0.045;
    let hs = poisson(clamp(1.3 + diff, 0.25, 3.6));
    let as = poisson(clamp(1.3 - diff, 0.25, 3.6));
    let pens = null;
    if (hs === as) {
      const homeWins = Math.random() < 0.5 + diff * 0.08;
      const winnerPens = 5 - Math.floor(Math.random() * 2);
      const loserPens = winnerPens - 1 - Math.floor(Math.random() * 2);
      pens = homeWins
        ? `${winnerPens}–${Math.max(0, loserPens)} pens`
        : `${Math.max(0, loserPens)}–${winnerPens} pens`;
      tie.winner = homeWins ? tie.home : tie.away;
    } else {
      tie.winner = hs > as ? tie.home : tie.away;
    }
    tie.homeScore = hs;
    tie.awayScore = as;
    tie.pens = pens;
    tie.played = true;
  }

  /** Play out every tie in this round except the human's. */
  simulateRest() {
    for (const tie of this.currentRound.ties) {
      if (tie.played) continue;
      if (tie.home.id === this.userTeamId || tie.away.id === this.userTeamId) continue;
      this.simulateTie(tie);
    }
  }

  recordUserResult(tie, homeScore, awayScore, pensText, winnerTeamData) {
    tie.homeScore = homeScore;
    tie.awayScore = awayScore;
    tie.pens = pensText;
    tie.winner = winnerTeamData;
    tie.played = true;
    if (winnerTeamData.id !== this.userTeamId) this.eliminated = true;
  }

  advance() {
    const round = this.currentRound;
    if (round.ties.some((t) => !t.played)) return false;
    if (this.roundIndex === this.rounds.length - 1) {
      this.finished = true;
      this.champion = round.ties[0].winner;
      return true;
    }
    const winners = round.ties.map((t) => t.winner);
    this.roundIndex++;
    this.currentRound.ties = this.pairUp(winners);
    return true;
  }
}
