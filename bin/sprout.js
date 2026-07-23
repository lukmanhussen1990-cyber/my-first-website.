#!/usr/bin/env node
// sprout.js — command-line runner for Sprout programs.
//
// Usage:
//   sprout <file.spr>     run a program file
//   sprout                start an interactive REPL
//
// This is the only file that touches Node-specific APIs (fs, readline). The
// language core stays platform-neutral.

import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { Interpreter } from "../src/interpreter.js";
import { formatError, SproutError } from "../src/errors.js";

// Synchronous stdin reader so input() blocks like a normal prompt would.
function readLineSync(prompt) {
  process.stdout.write(prompt);
  const buf = Buffer.alloc(1);
  let line = "";
  while (true) {
    let bytes;
    try {
      bytes = fs.readSync(0, buf, 0, 1, null);
    } catch (e) {
      if (e.code === "EAGAIN") continue; // no data yet, retry
      throw e;
    }
    if (bytes === 0) break; // EOF
    const ch = buf.toString("utf8", 0, 1);
    if (ch === "\n") break;
    line += ch;
  }
  return line.replace(/\r$/, "");
}

const io = {
  print: (line) => process.stdout.write(line + "\n"),
  input: (prompt) => readLineSync(prompt),
};

function runFile(file) {
  let source;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch (e) {
    console.error(`Cannot read file '${file}': ${e.message}`);
    process.exit(1);
  }
  try {
    const ast = parse(tokenize(source));
    new Interpreter(io).run(ast);
  } catch (err) {
    if (err instanceof SproutError) {
      console.error(formatError(err, source));
      process.exit(1);
    }
    throw err;
  }
}

function repl() {
  console.log("Sprout REPL — type Ctrl+D or Ctrl+C to exit.");
  const interp = new Interpreter(io);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "sprout> " });
  rl.prompt();
  rl.on("line", (line) => {
    if (line.trim()) {
      try {
        const ast = parse(tokenize(line));
        const value = interp.run(ast);
        if (value !== null && value !== undefined) console.log(value);
      } catch (err) {
        if (err instanceof SproutError) console.error(formatError(err, line));
        else throw err;
      }
    }
    rl.prompt();
  });
  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  repl();
} else if (args[0] === "-h" || args[0] === "--help") {
  console.log("Usage: sprout [file.spr]\n\n  With a file, runs it. With no arguments, starts a REPL.");
} else {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(process.cwd(), args[0]);
  runFile(file);
}
