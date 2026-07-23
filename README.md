# 🌱 Sprout

**A tiny programming language built entirely from scratch in JavaScript** — no
parser generators, no dependencies. Sprout has its own lexer, recursive‑descent
parser, and tree‑walking interpreter, and it runs both in **Node.js** (as a CLI
and REPL) and **in the browser** (as an interactive playground).

> This started as `my-first-website`, so the language ships with a web
> playground: open [`index.html`](index.html) and run Sprout code right in the
> page.

---

## What's inside

Everything the language needs, each stage in its own small, commented file:

| Stage | File | Job |
| --- | --- | --- |
| **Lexer** (tokenizer) | [`src/lexer.js`](src/lexer.js) | Turns source text into tokens, tracking line/column. |
| **Parser** | [`src/parser.js`](src/parser.js) | Builds an Abstract Syntax Tree with proper operator precedence. |
| **Interpreter** | [`src/interpreter.js`](src/interpreter.js) | Walks the AST and executes it (scopes, closures, control flow). |
| **Standard library** | [`src/stdlib.js`](src/stdlib.js) | Built‑ins: `print`, `input`, `length`, and more. |
| **Errors** | [`src/errors.js`](src/errors.js) | Friendly error messages that point at the offending line. |
| **Public API** | [`src/index.js`](src/index.js) | `run(source, io)` — wires the pipeline together. |
| **CLI / REPL** | [`bin/sprout.js`](bin/sprout.js) | Run `.spr` files or start an interactive prompt. |
| **Playground** | [`index.html`](index.html) | Write and run Sprout in the browser. |

The pipeline:

```
source text ──tokenize──▶ tokens ──parse──▶ AST ──interpret──▶ output
```

---

## Feature checklist

- ✅ **Lexer (tokenizer)** with line/column tracking
- ✅ **Parser** (hand‑written recursive descent)
- ✅ **Variables** — `let name = value`, with reassignment
- ✅ **Arithmetic** — `+ - * /` (plus `%`) with correct precedence and grouping
- ✅ **`if` / `else`** (and `else if` chains)
- ✅ **`while` loops**
- ✅ **Functions** — `fn`, parameters, `return`, **recursion**, and **closures**
- ✅ **Error messages** — syntax and runtime errors that show the exact spot
- ✅ **An interpreter that runs the code** — tree‑walking evaluator
- ✅ **A standard library** — `print()`, `input()`, `length()`, and more
- ➕ Bonus: strings, booleans, `null`, arrays with indexing, logical `&& || !`,
  short‑circuit evaluation, and a REPL

---

## Quick start

No install or build step — it's plain JavaScript.

### Run a program

```bash
node bin/sprout.js examples/functions.spr
```

### Start the REPL

```bash
node bin/sprout.js
```

```
sprout> let x = 21
sprout> print(x * 2)
42
```

### Run the test suite

```bash
node tests/run_tests.js      # or: npm test
```

### Open the playground

Open [`index.html`](index.html) in a browser (or serve the folder with any
static server), pick an example, and press **Ctrl/Cmd+Enter** to run.

---

## The language in one screen

```sprout
// Comments start with two slashes.

// Variables
let name = "Sprout"
let count = 3

// Arithmetic (+ - * / %), with precedence and grouping
let total = 2 + 3 * 4        // 14
let grouped = (2 + 3) * 4    // 20

// Strings concatenate with +
print("Hello, " + name + "!")

// if / else if / else
if count > 5 {
  print("big")
} else if count == 3 {
  print("three")
} else {
  print("small")
}

// while loops
let i = 0
while i < count {
  print(i)
  i = i + 1
}

// Functions, recursion, and closures
fn factorial(n) {
  if n <= 1 { return 1 }
  return n * factorial(n - 1)
}
print("6! =", factorial(6))

// Arrays and indexing
let nums = [10, 20, 30]
nums[0] = 99
print(nums[0], length(nums))     // 99 3
```

### Types

`number` (floats), `string`, `boolean` (`true`/`false`), `null`, `array`, and
`function`.

### Operators

| Kind | Operators |
| --- | --- |
| Arithmetic | `+` `-` `*` `/` `%` |
| Comparison | `<` `<=` `>` `>=` `==` `!=` |
| Logical | `&&` `\|\|` `!` (short‑circuiting) |
| Assignment | `=` |

Precedence, low → high: assignment → `\|\|` → `&&` → equality → comparison →
`+ -` → `* / %` → unary `! -` → calls & indexing → literals.

---

## Standard library

| Function | Description |
| --- | --- |
| `print(...args)` | Print a space‑separated line. |
| `input(prompt?)` | Read a line of text (returns a string). |
| `length(x)` | Length of a string or array. |
| `str(x)` | Convert any value to a string. |
| `num(x)` | Parse a string/boolean into a number. |
| `type(x)` | The value's type name as a string. |
| `push(arr, x)` | Append to an array; returns the array. |
| `range(n)` / `range(a, b)` | Build an array of consecutive integers. |
| `abs`, `floor`, `sqrt` | Math helpers. |
| `min(...)`, `max(...)` | Smallest / largest of the arguments. |

---

## Error messages

Sprout reports the stage, a clear message, and points at the source:

```
$ node bin/sprout.js broken.spr
RuntimeError: Division by zero

3 | print(10 / 0)
              ^

  at line 3, column 11
```

---

## Examples

Runnable programs live in [`examples/`](examples/):

- [`basics.spr`](examples/basics.spr) — variables, arithmetic, booleans
- [`control_flow.spr`](examples/control_flow.spr) — FizzBuzz + a countdown
- [`functions.spr`](examples/functions.spr) — recursion and closures
- [`arrays_and_stdlib.spr`](examples/arrays_and_stdlib.spr) — arrays and built‑ins

---

## A note on syntax

Newlines are not significant, so no semicolons are needed. The one edge case:
if a statement ends with an expression and the **next** line begins with `(`,
the two are read as a function call. Keep such lines separate (or add a
grouping paren) if you hit it.

## License

MIT
