// stdlib.js — the small built-in standard library.
//
// Each entry is a native function: a plain JS function tagged so the
// interpreter knows it is callable from Sprout code. Native functions receive
// already-evaluated argument values plus an `io` object for input/output, and
// a `raise` helper to report runtime errors with a proper message.

import { RuntimeError } from "./errors.js";

// Convert a Sprout runtime value into its printable text form.
export function stringify(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    // Show integers without a trailing ".0".
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return "[" + value.map((v) => (typeof v === "string" ? `"${v}"` : stringify(v))).join(", ") + "]";
  }
  if (value && value.__native__) return `<native fn ${value.name}>`;
  if (value && value.__fn__) return `<fn ${value.name || "anonymous"}>`;
  return String(value);
}

// Human-readable type name, exposed to programs via type().
export function typeName(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (value && (value.__native__ || value.__fn__)) return "function";
  return "unknown";
}

// Wrap a plain JS function as a Sprout-callable native function.
function native(name, arity, fn) {
  return { __native__: true, name, arity, call: fn };
}

// Build the standard library. `io` supplies print/input hooks so the same
// library works in Node, the browser, and tests.
export function makeStdlib(io) {
  const raise = (msg, node) => {
    throw new RuntimeError(msg, node?.line ?? null, node?.col ?? null);
  };

  const lib = {};

  // print(...args) — write a space-separated line to output. Returns null.
  lib.print = native("print", -1, (args) => {
    io.print(args.map(stringify).join(" "));
    return null;
  });

  // input(prompt?) — read a line of text from the user. Returns a string.
  lib.input = native("input", -1, (args) => {
    const prompt = args.length > 0 ? stringify(args[0]) : "";
    return io.input(prompt);
  });

  // length(x) — number of characters in a string or items in an array.
  lib.length = native("length", 1, (args, node) => {
    const v = args[0];
    if (typeof v === "string" || Array.isArray(v)) return v.length;
    raise(`length() expects a string or array, got ${typeName(v)}`, node);
  });

  // str(x) — convert any value to its string form.
  lib.str = native("str", 1, (args) => stringify(args[0]));

  // num(x) — parse a string/boolean into a number, or fail clearly.
  lib.num = native("num", 1, (args, node) => {
    const v = args[0];
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "string") {
      const n = Number(v.trim());
      if (Number.isNaN(n)) raise(`Cannot convert "${v}" to a number`, node);
      return n;
    }
    raise(`num() cannot convert ${typeName(v)}`, node);
  });

  // type(x) — the name of a value's type as a string.
  lib.type = native("type", 1, (args) => typeName(args[0]));

  // push(array, value) — append to an array and return the array.
  lib.push = native("push", 2, (args, node) => {
    const arr = args[0];
    if (!Array.isArray(arr)) raise(`push() expects an array, got ${typeName(arr)}`, node);
    arr.push(args[1]);
    return arr;
  });

  // range(n) or range(start, end) — build an array of consecutive integers.
  lib.range = native("range", -1, (args, node) => {
    let start = 0;
    let end;
    if (args.length === 1) {
      end = args[0];
    } else if (args.length === 2) {
      start = args[0];
      end = args[1];
    } else {
      raise(`range() expects 1 or 2 arguments, got ${args.length}`, node);
    }
    if (typeof start !== "number" || typeof end !== "number") {
      raise("range() arguments must be numbers", node);
    }
    const out = [];
    for (let i = start; i < end; i++) out.push(i);
    return out;
  });

  // A few handy math helpers.
  lib.abs = native("abs", 1, (args, node) => {
    if (typeof args[0] !== "number") raise("abs() expects a number", node);
    return Math.abs(args[0]);
  });
  lib.floor = native("floor", 1, (args, node) => {
    if (typeof args[0] !== "number") raise("floor() expects a number", node);
    return Math.floor(args[0]);
  });
  lib.sqrt = native("sqrt", 1, (args, node) => {
    if (typeof args[0] !== "number") raise("sqrt() expects a number", node);
    if (args[0] < 0) raise("sqrt() of a negative number", node);
    return Math.sqrt(args[0]);
  });
  lib.min = native("min", -1, (args, node) => {
    if (args.length === 0) raise("min() needs at least one argument", node);
    return args.reduce((a, b) => (b < a ? b : a));
  });
  lib.max = native("max", -1, (args, node) => {
    if (args.length === 0) raise("max() needs at least one argument", node);
    return args.reduce((a, b) => (b > a ? b : a));
  });

  return lib;
}
