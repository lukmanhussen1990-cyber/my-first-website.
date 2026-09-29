// Time-sliced job runner: replacement for system.runJob (not available in @minecraft/server 1.10.0).
// A job is a generator. Every `yield` is one unit of work ("op"); `yield n` (n >= 1) charges n ops.
// The manager calls stepJobs() once per tick with the tick's op budget; jobs are served round-robin.
import { stats } from './stats.js';
import { warn, errMsg } from './util.js';

/**
 * @typedef {Object} JobHandle
 * @property {number} id
 * @property {() => void} cancel stop the job (idempotent)
 * @property {() => boolean} isDone true once finished, cancelled or crashed
 */

/** @typedef {{id: number, owner: number, gen: Generator<number|undefined|void, any, any>, done: boolean}} Job */

/** @type {Job[]} */
let jobs = [];
let nextId = 1;
let rr = 0;

const RESERVE_BLOCK_OPS = 8; // stop stepping jobs when this close to the per-tick block budget

/**
 * Start a job.
 * @param {number} owner disaster instance id (0 = global); jobs of an owner are cancelled by cancelJobsOf()
 * @param {(() => Generator<any, any, any>) | Generator<any, any, any>} genOrFn
 * @returns {JobHandle}
 */
export function startJob(owner, genOrFn) {
  const gen = typeof genOrFn === 'function' ? genOrFn() : genOrFn;
  /** @type {Job} */
  const job = { id: nextId++, owner, gen, done: false };
  jobs.push(job);
  stats.activeJobs = jobs.length;
  return {
    id: job.id,
    cancel() { endJob(job); },
    isDone() { return job.done; },
  };
}

/** @param {Job} job */
function endJob(job) {
  if (job.done) return;
  job.done = true;
  try { job.gen.return(undefined); } catch (e) { /* generator already closed */ }
}

/** Cancel every job of an owner. @param {number} owner @returns {number} number of jobs cancelled */
export function cancelJobsOf(owner) {
  let n = 0;
  for (let i = 0; i < jobs.length; i++) {
    if (jobs[i].owner === owner && !jobs[i].done) { endJob(jobs[i]); n++; }
  }
  compact();
  return n;
}

/** Cancel everything (stopAll). */
export function cancelAllJobs() {
  for (let i = 0; i < jobs.length; i++) endJob(jobs[i]);
  jobs = [];
  stats.activeJobs = 0;
}

function compact() {
  if (jobs.some((j) => j.done)) jobs = jobs.filter((j) => !j.done);
  stats.activeJobs = jobs.length;
}

export function activeJobCount() { return jobs.length; }

/**
 * Run jobs for one tick.
 * @param {number} opBudget max ops this tick
 * @param {number} [blockBudget] per-tick block write budget (stepping stops when it is (nearly) used up)
 * @returns {number} ops executed
 */
export function stepJobs(opBudget, blockBudget) {
  if (jobs.length === 0) return 0;
  let budget = opBudget;
  let executed = 0;
  let guard = opBudget + jobs.length * 2 + 8; // hard cap on loop iterations
  while (budget > 0 && jobs.length > 0 && guard-- > 0) {
    if (blockBudget !== undefined && stats.blockOpsTick >= blockBudget - RESERVE_BLOCK_OPS) break;
    if (rr >= jobs.length) rr = 0;
    const job = jobs[rr];
    if (job.done) { jobs.splice(rr, 1); continue; }
    let cost = 1;
    try {
      const r = job.gen.next();
      if (r.done) {
        job.done = true;
        jobs.splice(rr, 1);
      } else {
        const v = r.value;
        if (typeof v === 'number' && v > 1) cost = v > budget ? budget : Math.floor(v);
        rr++;
      }
    } catch (e) {
      warn('job crashed: ' + errMsg(e));
      job.done = true;
      jobs.splice(rr, 1);
    }
    budget -= cost;
    executed += cost;
  }
  stats.jobOpsTick += executed;
  stats.activeJobs = jobs.length;
  return executed;
}
