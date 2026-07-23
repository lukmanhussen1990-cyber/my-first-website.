// run_tests.js — a tiny, dependency-free test runner for the language.
//
// Run with:  node tests/run_tests.js
//
// Each test runs a snippet of Sprout source and checks the captured output or
// the reported error. No test framework required.

import { run } from "../src/index.js";

let passed = 0;
let failed = 0;
const failures = [];

// Assert that `source` runs successfully and prints exactly `expectedLines`.
function expectOutput(name, source, expectedLines, input = []) {
  const queue = [...input];
  const result = run(source, { input: () => (queue.length ? queue.shift() : "") });
  if (!result.ok) {
    fail(name, `expected success but got error:\n${result.message}`);
    return;
  }
  const got = result.output.join("\n");
  const want = expectedLines.join("\n");
  if (got !== want) {
    fail(name, `output mismatch\n  expected: ${JSON.stringify(want)}\n  got:      ${JSON.stringify(got)}`);
    return;
  }
  pass(name);
}

// Assert that `source` fails, and that the error message contains `needle`.
function expectError(name, source, needle) {
  const result = run(source);
  if (result.ok) {
    fail(name, "expected an error but the program succeeded");
    return;
  }
  if (needle && !result.error.message.includes(needle)) {
    fail(name, `error message did not contain ${JSON.stringify(needle)}\n  got: ${JSON.stringify(result.error.message)}`);
    return;
  }
  pass(name);
}

function pass(name) {
  passed++;
  console.log(`  [32m✓[0m ${name}`);
}
function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  [31m✗[0m ${name}`);
}

// ---- lexer / parser -------------------------------------------------------

expectOutput("comments are ignored", `// a comment\nprint(1) // trailing`, ["1"]);
expectError("unterminated string", `print("oops)`, "Unterminated string");
expectError("unexpected character", `let x = @`, "Unexpected character");
expectError("missing paren", `print(1`, "Expected ')'");
expectError("invalid assignment target", `1 = 2`, "Invalid assignment target");

// ---- variables & arithmetic ----------------------------------------------

expectOutput("variables", `let x = 5\nlet y = 10\nprint(x + y)`, ["15"]);
expectOutput("reassignment", `let x = 1\nx = x + 4\nprint(x)`, ["5"]);
expectOutput("precedence", `print(2 + 3 * 4)`, ["14"]);
expectOutput("grouping", `print((2 + 3) * 4)`, ["20"]);
expectOutput("subtraction & unary minus", `print(10 - 3 - 2)\nprint(-5 + 2)`, ["5", "-3"]);
expectOutput("division", `print(20 / 4)`, ["5"]);
expectOutput("modulo", `print(17 % 5)`, ["2"]);
expectOutput("string concat", `print("a" + "b" + "c")`, ["abc"]);
expectOutput("number + string", `print("n = " + 42)`, ["n = 42"]);
expectError("divide by zero", `print(1 / 0)`, "Division by zero");
expectError("type error in math", `print("a" - 1)`, "needs two numbers");

// ---- comparisons & booleans ----------------------------------------------

expectOutput("comparisons", `print(3 < 5)\nprint(5 <= 5)\nprint(9 > 2)\nprint(2 == 2)\nprint(2 != 3)`, [
  "true",
  "true",
  "true",
  "true",
  "true",
]);
expectOutput("logical and/or", `print(true && false)\nprint(true || false)\nprint(!false)`, [
  "false",
  "true",
  "true",
]);
expectOutput("short-circuit and", `fn boom() { return 1 / 0 }\nprint(false && boom())`, ["false"]);

// ---- if / else ------------------------------------------------------------

expectOutput("if true branch", `if 1 < 2 { print("yes") } else { print("no") }`, ["yes"]);
expectOutput("if false branch", `if 1 > 2 { print("yes") } else { print("no") }`, ["no"]);
expectOutput("else if chain", `let x = 5\nif x < 0 { print("neg") } else if x == 0 { print("zero") } else { print("pos") }`, [
  "pos",
]);

// ---- while ----------------------------------------------------------------

expectOutput("while loop sums", `let i = 1\nlet s = 0\nwhile i <= 5 { s = s + i\ni = i + 1 }\nprint(s)`, ["15"]);

// ---- functions ------------------------------------------------------------

expectOutput("function call", `fn add(a, b) { return a + b }\nprint(add(3, 4))`, ["7"]);
expectOutput("recursion", `fn fact(n) { if n <= 1 { return 1 }\nreturn n * fact(n - 1) }\nprint(fact(5))`, ["120"]);
expectOutput("closures", `fn adder(x) { fn f(y) { return x + y }\nreturn f }\nprint(adder(10)(5))`, ["15"]);
expectOutput("no explicit return yields null", `fn noop() { let x = 1 }\nprint(noop())`, ["null"]);
expectError("wrong arg count", `fn f(a) { return a }\nprint(f(1, 2))`, "expects 1 argument");
expectError("calling a number", `let x = 5\nprint(x())`, "Cannot call");
expectError("undefined variable", `print(nope)`, "Undefined variable");

// ---- arrays & indexing ----------------------------------------------------

expectOutput("array literal & index", `let a = [10, 20, 30]\nprint(a[1])`, ["20"]);
expectOutput("array assign", `let a = [1, 2, 3]\na[0] = 99\nprint(a)`, ["[99, 2, 3]"]);
expectOutput("array equality", `print([1, 2] == [1, 2])\nprint([1] == [2])`, ["true", "false"]);
expectError("index out of range", `let a = [1]\nprint(a[5])`, "out of range");

// ---- standard library -----------------------------------------------------

expectOutput("length", `print(length("hello"))\nprint(length([1, 2, 3]))`, ["5", "3"]);
expectOutput("str & num", `print(str(42))\nprint(num("3.5") + 1)`, ["42", "4.5"]);
expectOutput("type", `print(type(1))\nprint(type("s"))\nprint(type([1]))\nprint(type(true))`, [
  "number",
  "string",
  "array",
  "boolean",
]);
expectOutput("push & range", `let a = range(3)\npush(a, 9)\nprint(a)`, ["[0, 1, 2, 9]"]);
expectOutput("math helpers", `print(abs(-4))\nprint(floor(3.9))\nprint(sqrt(81))\nprint(min(3, 1, 2))\nprint(max(3, 1, 2))`, [
  "4",
  "3",
  "9",
  "1",
  "3",
]);
expectOutput("input()", `let name = input("Name: ")\nprint("Hi " + name)`, ["Hi World"], ["World"]);

// ---- summary --------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`\n• ${f.name}\n  ${f.detail}`);
  process.exit(1);
}
