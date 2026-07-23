// index.js — the public entry point that wires the pipeline together:
//
//   source text  ──tokenize──▶  tokens  ──parse──▶  AST  ──Interpreter──▶ result
//
// Everything here is environment-agnostic (no Node or browser specifics), so
// the same code powers the CLI, the web playground, and the test suite.

import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { Interpreter } from "./interpreter.js";
import { formatError, SproutError } from "./errors.js";

export { tokenize } from "./lexer.js";
export { parse } from "./parser.js";
export { Interpreter } from "./interpreter.js";
export { formatError, SproutError } from "./errors.js";

// Run Sprout source code.
//
//   run(source, { print, input }) => { ok, output, value, error }
//
// `io.print` receives each printed line; `io.input(prompt)` returns a string.
// If not provided, output is captured and returned in `result.output`.
export function run(source, io = {}) {
  const output = [];
  const effectiveIo = {
    print: io.print ?? ((line) => output.push(line)),
    input: io.input ?? (() => ""),
  };

  try {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const interp = new Interpreter(effectiveIo);
    const value = interp.run(ast);
    return { ok: true, output, value, error: null };
  } catch (err) {
    if (err instanceof SproutError) {
      return { ok: false, output, value: null, error: err, message: formatError(err, source) };
    }
    // Re-throw anything that isn't a language error — it's a real bug.
    throw err;
  }
}
