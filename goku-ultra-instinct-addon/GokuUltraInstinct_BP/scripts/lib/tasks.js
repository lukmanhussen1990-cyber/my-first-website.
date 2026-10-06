// A tiny scheduler for multi-tick moves written as generator functions.
// `yield n` waits n ticks (plain `yield` waits one tick).

const tasks = [];

export function startTask(owner, name, generator) {
  tasks.push({ owner, name, generator, wait: 0 });
}

export function runTasks() {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const task = tasks[i];
    if (task.wait > 0) {
      task.wait--;
      continue;
    }
    let finished = false;
    try {
      if (task.owner && !task.owner.isValid()) {
        finished = true;
      } else {
        const step = task.generator.next();
        if (step.done) finished = true;
        else task.wait = Math.max(0, (typeof step.value === 'number' ? step.value : 1) - 1);
      }
    } catch (error) {
      console.warn(`[goku] ${task.name} stopped: ${error}`);
      finished = true;
      try {
        task.generator.return(undefined);
      } catch {
        // already closed
      }
    }
    if (finished) {
      tasks.splice(i, 1);
      if (task.owner && !task.owner.isValid()) {
        try {
          task.generator.return(undefined);
        } catch {
          // ignore
        }
      }
    }
  }
}

export function taskCount() {
  return tasks.length;
}
