// Save/reload harness: run the add-on in separate Node processes.
//
// ES modules are evaluated once per process, so "restart the game with the
// same world" means: process A plays and saves the mock world to JSON,
// process B loads that JSON *before* importing the add-on, then starts it.
//
// Parent (a node:test file):
//   import { runScenario } from "./mock/harness.mjs";
//   const a = await runScenario({ script: new URL("./scenarios/my_a.mjs", import.meta.url) });
//   const b = await runScenario({ script: new URL("./scenarios/my_b.mjs", import.meta.url), load: a.world });
//   assert.equal(b.result.something, 42);
//
// Child script (plain ES module run with the mock registered):
//   import { scenario } from "../mock/harness.mjs";
//   const sc = await scenario.begin();          // loads the input world (if any), imports main.js, mock.startup()
//   const { mock } = sc;
//   mock.tick(40);
//   sc.end({ something: 42 });                  // writes {result, world: mock.saveWorld()} for the parent
//
// Inline children are possible too: runScenario({ source: "..." }); inside the
// source import the harness with `await import(process.env.PAS_HARNESS)`.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REGISTER_URL = pathToFileURL(path.join(HERE, "register.mjs")).href;
export const HARNESS_URL = pathToFileURL(path.join(HERE, "harness.mjs")).href;
export const MAIN_URL = pathToFileURL(path.resolve(HERE, "..", "..", "addon", "behavior_pack", "scripts", "main.js")).href;

/**
 * Run a scenario script in a child Node process with the mock registered.
 * @param {{script?: string|URL, source?: string, load?: object|string, args?: string[], env?: Record<string,string>,
 *          timeoutMs?: number, allowFailure?: boolean}} opts
 *   load: a world snapshot object (from a previous run's `.world`) or a path to a JSON file with one.
 * @returns {Promise<{code: number|null, stdout: string, stderr: string, result: any, world: any}>}
 */
export async function runScenario(opts) {
  const { script, source, load, args = [], env = {}, timeoutMs = 120000, allowFailure = false } = opts;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pas-scenario-"));
  try {
    let scriptPath;
    if (source !== undefined) {
      scriptPath = path.join(dir, "scenario.mjs");
      fs.writeFileSync(scriptPath, source);
    } else if (script) {
      scriptPath = script instanceof URL ? fileURLToPath(script) : String(script);
    } else {
      throw new Error("runScenario: pass `script` or `source`");
    }
    let inFile = "";
    if (load !== undefined) {
      inFile = path.join(dir, "in.json");
      if (typeof load === "string") fs.copyFileSync(load, inFile);
      else fs.writeFileSync(inFile, JSON.stringify(load));
    }
    const outFile = path.join(dir, "out.json");
    const child = spawn(process.execPath, ["--import", REGISTER_URL, scriptPath, ...args], {
      env: { ...process.env, PAS_SCENARIO_IN: inFile, PAS_SCENARIO_OUT: outFile, PAS_HARNESS: HARNESS_URL, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`runScenario: timeout after ${timeoutMs} ms\n${stderr}`));
      }, timeoutMs);
      child.on("error", reject);
      child.on("close", (c) => {
        clearTimeout(timer);
        resolve(c);
      });
    });
    let out = { result: undefined, world: undefined };
    if (fs.existsSync(outFile)) out = JSON.parse(fs.readFileSync(outFile, "utf8"));
    if (code !== 0 && !allowFailure) {
      throw new Error(`scenario ${scriptPath} exited with ${code}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`);
    }
    return { code, stdout, stderr, result: out.result, world: out.world };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Helpers for the child side. */
export const scenario = {
  /**
   * @param {{importAddon?: boolean, startup?: boolean, before?: (mock: any) => void}} [opts]
   *   importAddon: import addon/behavior_pack/scripts/main.js (default true)
   *   startup: call mock.startup() afterwards (players rejoin, entityLoad, worldInitialize; default true)
   *   before: called with the mock after the world is loaded but before the add-on is imported
   */
  async begin({ importAddon = true, startup = true, before } = {}) {
    const server = await import("@minecraft/server");
    const ui = await import("@minecraft/server-ui");
    const mock = server.__mock;
    if (!mock) throw new Error("scenario.begin: @minecraft/server is not the mock (run with --import tests/mock/register.mjs)");
    const inFile = process.env.PAS_SCENARIO_IN;
    const loaded = !!inFile && fs.existsSync(inFile);
    if (loaded) mock.loadWorld(JSON.parse(fs.readFileSync(inFile, "utf8")));
    if (before) await before(mock);
    if (importAddon) await import(MAIN_URL);
    if (startup) mock.startup();
    return {
      mock,
      ui: ui.__ui,
      server,
      loaded,
      /** Write the result and the world snapshot for the parent. */
      end(result, { save = true } = {}) {
        const outFile = process.env.PAS_SCENARIO_OUT;
        const payload = { result, world: save ? mock.saveWorld() : undefined };
        if (outFile) fs.writeFileSync(outFile, JSON.stringify(payload));
        return payload;
      },
    };
  },
};
