// Global counters. Exported so the headless simulator (and /scriptevent nd:status) can assert budgets.
// "Tick" counters are reset by the manager at the start of every tick; "Peak" counters keep the max seen.

export const stats = {
  tick: 0,
  // per-tick (reset every tick)
  particlesTick: 0,
  soundsTick: 0,
  blockOpsTick: 0,
  jobOpsTick: 0,
  restoreOpsTick: 0,
  commandsTick: 0,
  // peaks
  particlesPeak: 0,
  soundsPeak: 0,
  blockOpsPeak: 0,
  jobOpsPeak: 0,
  restoreOpsPeak: 0,
  commandsPeak: 0,
  tempEntitiesPeak: 0,
  activePeak: 0,
  // totals
  particlesTotal: 0,
  particlesDropped: 0,
  soundsTotal: 0,
  blockOpsTotal: 0,
  blockOpsRefused: 0,
  blocksRestored: 0,
  blocksRestoreSkipped: 0,
  entitiesSpawned: 0,
  entitiesRefused: 0,
  entitiesRemoved: 0,
  commandsTotal: 0,
  commandFailures: 0,
  errors: 0,
  updateErrors: 0,
  disastersStarted: 0,
  disastersFinished: 0,
  disastersRejected: 0,
  // gauges
  journalSize: 0,
  trackedEntities: 0,
  activeDisasters: 0,
  activeJobs: 0,
};

/** Called by the manager at the start of every tick. */
export function resetTickStats(tick) {
  stats.tick = tick;
  stats.particlesTick = 0;
  stats.soundsTick = 0;
  stats.blockOpsTick = 0;
  stats.jobOpsTick = 0;
  stats.restoreOpsTick = 0;
  stats.commandsTick = 0;
}

/** Called after work of a tick is done; folds tick counters into peaks. */
export function foldPeaks() {
  if (stats.particlesTick > stats.particlesPeak) stats.particlesPeak = stats.particlesTick;
  if (stats.soundsTick > stats.soundsPeak) stats.soundsPeak = stats.soundsTick;
  if (stats.blockOpsTick > stats.blockOpsPeak) stats.blockOpsPeak = stats.blockOpsTick;
  if (stats.jobOpsTick > stats.jobOpsPeak) stats.jobOpsPeak = stats.jobOpsTick;
  if (stats.restoreOpsTick > stats.restoreOpsPeak) stats.restoreOpsPeak = stats.restoreOpsTick;
  if (stats.commandsTick > stats.commandsPeak) stats.commandsPeak = stats.commandsTick;
  if (stats.trackedEntities > stats.tempEntitiesPeak) stats.tempEntitiesPeak = stats.trackedEntities;
  if (stats.activeDisasters > stats.activePeak) stats.activePeak = stats.activeDisasters;
}

/** Test helper: zero everything. */
export function resetAllStats() {
  for (const k of Object.keys(stats)) stats[k] = 0;
}
