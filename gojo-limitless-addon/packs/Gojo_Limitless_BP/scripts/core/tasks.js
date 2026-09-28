import { logError } from "../lib/util.js";

/**
 * A running technique (a projectile in flight, a domain, a channel...).
 * `update` is called every tick and returns false when the task is finished.
 * `end` is always called exactly once when the task stops (finished,
 * cancelled, or crashed), so cleanup code always runs.
 *
 * @typedef {{
 *   name: string,
 *   ownerId: string,
 *   update: (tick: number) => boolean,
 *   end?: (reason: string) => void,
 * }} Task
 */

/** @type {Task[]} */
const tasks = [];

/** Hard cap so a bugged loop can never pile up tasks and tank the frame rate. */
const MAX_TASKS = 64;

/** @param {Task} task */
export function addTask(task) {
  if (tasks.length >= MAX_TASKS) {
    finish(tasks.shift(), "overflow");
  }
  tasks.push(task);
}

/**
 * @param {Task | undefined} task
 * @param {string} reason
 */
function finish(task, reason) {
  if (!task || !task.end) return;
  try {
    task.end(reason);
  } catch (e) {
    logError(`task.end:${task.name}`, e);
  }
}

/** @param {number} tick */
export function runTasks(tick) {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const task = tasks[i];
    let keep = false;
    try {
      keep = task.update(tick);
    } catch (e) {
      logError(`task:${task.name}`, e);
      keep = false;
    }
    if (!keep) {
      // The task may already have been removed by cancelTasks() inside update().
      const idx = tasks.indexOf(task);
      if (idx !== -1) {
        tasks.splice(idx, 1);
        finish(task, "done");
      }
    }
  }
}

/**
 * Stop tasks owned by a player (death, leaving, transformation release...).
 * @param {string} ownerId
 * @param {string} reason
 * @param {string} [name] only tasks with this name
 */
export function cancelTasks(ownerId, reason, name) {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const task = tasks[i];
    if (task.ownerId !== ownerId) continue;
    if (name && task.name !== name) continue;
    tasks.splice(i, 1);
    finish(task, reason);
  }
}

/**
 * @param {string} ownerId
 * @param {string} name
 */
export function hasTask(ownerId, name) {
  return tasks.some((t) => t.ownerId === ownerId && t.name === name);
}

export function taskCount() {
  return tasks.length;
}
