// interpreter.js — a tree-walking interpreter that executes the AST directly.
//
// It walks each node, evaluating expressions to values and running statements
// for their effects. Variable scopes are modeled with a chain of Environments;
// functions capture the environment where they were defined (lexical scope /
// closures). `return` unwinds via a small sentinel exception.

import { RuntimeError } from "./errors.js";
import { makeStdlib, stringify, typeName } from "./stdlib.js";

// A single lexical scope: a map of names to values, plus a link to the parent.
class Environment {
  constructor(parent = null) {
    this.vars = new Map();
    this.parent = parent;
  }

  // Declare a new variable in this scope.
  define(name, value) {
    this.vars.set(name, value);
  }

  // Look up a variable, walking outward through enclosing scopes.
  get(name, node) {
    let env = this;
    while (env) {
      if (env.vars.has(name)) return env.vars.get(name);
      env = env.parent;
    }
    throw new RuntimeError(`Undefined variable '${name}'`, node?.line, node?.col);
  }

  // Assign to an existing variable in the nearest scope that declares it.
  assign(name, value, node) {
    let env = this;
    while (env) {
      if (env.vars.has(name)) {
        env.vars.set(name, value);
        return value;
      }
      env = env.parent;
    }
    throw new RuntimeError(
      `Cannot assign to undefined variable '${name}' (did you mean 'let ${name} = ...'?)`,
      node?.line,
      node?.col,
    );
  }
}

// Sentinel thrown to unwind the stack when a function returns.
class ReturnSignal {
  constructor(value) {
    this.value = value;
  }
}

export class Interpreter {
  // `io` provides print/input; defaults collect output into an array.
  constructor(io) {
    this.io = io ?? { print: () => {}, input: () => "" };
    this.global = new Environment();
    // Install the standard library into the global scope.
    const lib = makeStdlib(this.io);
    for (const [name, fn] of Object.entries(lib)) this.global.define(name, fn);
  }

  run(program) {
    let last = null;
    for (const stmt of program.body) last = this.execute(stmt, this.global);
    return last;
  }

  // ---- statements ---------------------------------------------------------

  execute(node, env) {
    switch (node.type) {
      case "Let":
        env.define(node.name, this.evaluate(node.value, env));
        return null;

      case "Function": {
        // A user function value carries its parameters, body, and the
        // environment it was defined in (for closures).
        const fn = {
          __fn__: true,
          name: node.name,
          params: node.params,
          body: node.body,
          closure: env,
        };
        env.define(node.name, fn);
        return null;
      }

      case "If": {
        if (this.truthy(this.evaluate(node.condition, env))) {
          return this.execute(node.consequent, env);
        } else if (node.alternate) {
          return this.execute(node.alternate, env);
        }
        return null;
      }

      case "While": {
        let guard = 0;
        while (this.truthy(this.evaluate(node.condition, env))) {
          this.execute(node.body, env);
          // Cheap protection against runaway loops in the web playground.
          if (++guard > 10_000_000) {
            throw new RuntimeError("Loop ran too many times (possible infinite loop)", node.line, node.col);
          }
        }
        return null;
      }

      case "Block": {
        // Blocks introduce a new scope so inner `let`s don't leak out.
        const inner = new Environment(env);
        let last = null;
        for (const stmt of node.body) last = this.execute(stmt, inner);
        return last;
      }

      case "Return":
        throw new ReturnSignal(node.value ? this.evaluate(node.value, env) : null);

      case "ExpressionStatement":
        return this.evaluate(node.expression, env);

      default:
        return this.evaluate(node, env);
    }
  }

  // ---- expressions --------------------------------------------------------

  evaluate(node, env) {
    switch (node.type) {
      case "Number":
      case "String":
      case "Boolean":
        return node.value;
      case "Null":
        return null;

      case "Array":
        return node.elements.map((el) => this.evaluate(el, env));

      case "Variable":
        return env.get(node.name, node);

      case "Assign":
        return env.assign(node.name, this.evaluate(node.value, env), node);

      case "Index":
        return this.evalIndex(node, env);

      case "IndexAssign":
        return this.evalIndexAssign(node, env);

      case "Unary":
        return this.evalUnary(node, env);

      case "Binary":
        return this.evalBinary(node, env);

      case "Call":
        return this.evalCall(node, env);

      default:
        throw new RuntimeError(`Cannot evaluate node of type '${node.type}'`, node.line, node.col);
    }
  }

  evalIndex(node, env) {
    const obj = this.evaluate(node.object, env);
    const idx = this.evaluate(node.index, env);
    if (Array.isArray(obj) || typeof obj === "string") {
      if (typeof idx !== "number" || !Number.isInteger(idx)) {
        throw new RuntimeError(`Index must be an integer, got ${typeName(idx)}`, node.line, node.col);
      }
      if (idx < 0 || idx >= obj.length) {
        throw new RuntimeError(`Index ${idx} out of range (length ${obj.length})`, node.line, node.col);
      }
      return obj[idx];
    }
    throw new RuntimeError(`Cannot index into a ${typeName(obj)}`, node.line, node.col);
  }

  evalIndexAssign(node, env) {
    const obj = this.evaluate(node.object, env);
    const idx = this.evaluate(node.index, env);
    if (!Array.isArray(obj)) {
      throw new RuntimeError(`Cannot assign to an index of ${typeName(obj)}`, node.line, node.col);
    }
    if (typeof idx !== "number" || !Number.isInteger(idx)) {
      throw new RuntimeError(`Index must be an integer, got ${typeName(idx)}`, node.line, node.col);
    }
    if (idx < 0 || idx >= obj.length) {
      throw new RuntimeError(`Index ${idx} out of range (length ${obj.length})`, node.line, node.col);
    }
    const value = this.evaluate(node.value, env);
    obj[idx] = value;
    return value;
  }

  evalUnary(node, env) {
    const value = this.evaluate(node.operand, env);
    if (node.operator === "-") {
      if (typeof value !== "number") {
        throw new RuntimeError(`Cannot negate a ${typeName(value)}`, node.line, node.col);
      }
      return -value;
    }
    // '!'
    return !this.truthy(value);
  }

  evalBinary(node, env) {
    const op = node.operator;

    // Logical operators short-circuit, so evaluate the right side lazily.
    if (op === "&&") {
      const left = this.evaluate(node.left, env);
      return this.truthy(left) ? this.evaluate(node.right, env) : left;
    }
    if (op === "||") {
      const left = this.evaluate(node.left, env);
      return this.truthy(left) ? left : this.evaluate(node.right, env);
    }

    const left = this.evaluate(node.left, env);
    const right = this.evaluate(node.right, env);

    switch (op) {
      case "+":
        // `+` adds numbers or concatenates when either side is a string.
        if (typeof left === "string" || typeof right === "string") {
          return stringify(left) + stringify(right);
        }
        this.assertNumbers(left, right, op, node);
        return left + right;
      case "-":
        this.assertNumbers(left, right, op, node);
        return left - right;
      case "*":
        this.assertNumbers(left, right, op, node);
        return left * right;
      case "/":
        this.assertNumbers(left, right, op, node);
        if (right === 0) throw new RuntimeError("Division by zero", node.line, node.col);
        return left / right;
      case "%":
        this.assertNumbers(left, right, op, node);
        if (right === 0) throw new RuntimeError("Modulo by zero", node.line, node.col);
        return left % right;
      case "==":
        return this.equals(left, right);
      case "!=":
        return !this.equals(left, right);
      case "<":
      case "<=":
      case ">":
      case ">=":
        return this.compare(op, left, right, node);
      default:
        throw new RuntimeError(`Unknown operator '${op}'`, node.line, node.col);
    }
  }

  evalCall(node, env) {
    const callee = this.evaluate(node.callee, env);
    const args = node.args.map((a) => this.evaluate(a, env));

    // Native (built-in) functions.
    if (callee && callee.__native__) {
      if (callee.arity >= 0 && args.length !== callee.arity) {
        throw new RuntimeError(
          `${callee.name}() expects ${callee.arity} argument(s), got ${args.length}`,
          node.line,
          node.col,
        );
      }
      return callee.call(args, node);
    }

    // User-defined functions.
    if (callee && callee.__fn__) {
      if (args.length !== callee.params.length) {
        throw new RuntimeError(
          `${callee.name || "function"}() expects ${callee.params.length} argument(s), got ${args.length}`,
          node.line,
          node.col,
        );
      }
      // Each call gets a fresh scope chained to where the function was defined.
      const local = new Environment(callee.closure);
      callee.params.forEach((param, i) => local.define(param, args[i]));
      try {
        for (const stmt of callee.body.body) this.execute(stmt, local);
      } catch (signal) {
        if (signal instanceof ReturnSignal) return signal.value;
        throw signal;
      }
      return null; // functions with no explicit return yield null
    }

    throw new RuntimeError(`Cannot call a ${typeName(callee)}`, node.line, node.col);
  }

  // ---- value helpers ------------------------------------------------------

  // Sprout truthiness: false and null are falsy; everything else is truthy.
  truthy(value) {
    return value !== false && value !== null;
  }

  assertNumbers(left, right, op, node) {
    if (typeof left !== "number" || typeof right !== "number") {
      throw new RuntimeError(
        `Operator '${op}' needs two numbers, got ${typeName(left)} and ${typeName(right)}`,
        node.line,
        node.col,
      );
    }
  }

  equals(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => this.equals(v, b[i]));
    }
    return a === b;
  }

  compare(op, left, right, node) {
    const bothNumbers = typeof left === "number" && typeof right === "number";
    const bothStrings = typeof left === "string" && typeof right === "string";
    if (!bothNumbers && !bothStrings) {
      throw new RuntimeError(
        `Cannot compare ${typeName(left)} and ${typeName(right)} with '${op}'`,
        node.line,
        node.col,
      );
    }
    switch (op) {
      case "<":
        return left < right;
      case "<=":
        return left <= right;
      case ">":
        return left > right;
      case ">=":
        return left >= right;
    }
  }
}
