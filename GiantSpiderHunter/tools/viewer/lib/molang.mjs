// Molang parser + evaluator (Bedrock semantics) used by the Giant Spider Hunter viewer.
//
// * Identifiers are case-insensitive; namespaces q./query., v./variable., t./temp.,
//   c./context., math., geometry., texture., material., array. are normalised.
// * Trig functions take/return DEGREES (Molang semantics).
// * Simple expressions return their value. Complex expressions (containing ';') return the
//   value of the first executed `return`, or 0.
// * Supports ?: ternary, binary conditional `a ? b`, `??`, && || !, comparisons (including
//   string equality), assignment, struct variables (v.a.b), {} blocks, loop(), for_each(),
//   break/continue, `this`, array.<name>[i], string literals in single quotes.
// * Unknown queries evaluate to 0 and are recorded as warnings by the context.

const NS_ALIAS = {
  q: 'query', query: 'query',
  v: 'variable', variable: 'variable',
  t: 'temp', temp: 'temp',
  c: 'context', context: 'context',
  math: 'math',
  geometry: 'geometry', texture: 'texture', material: 'material', array: 'array',
};

export class MolangSyntaxError extends Error {
  constructor(msg, src, pos) {
    super(`${msg} at ${pos} in: ${src}`);
    this.src = src;
    this.pos = pos;
  }
}

// ---------------------------------------------------------------- tokenizer
const SYMBOLS = ['??', '||', '&&', '==', '!=', '<=', '>=', '->', '(', ')', '[', ']', '{', '}', ',', ';', '?', ':', '<', '>', '+', '-', '*', '/', '!', '='];

function tokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    // number: 1, 1.5, .5, 1e3, 1.0f
    if ((ch >= '0' && ch <= '9') || (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      const m = /^(\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.)f?/.exec(src.slice(i));
      const txt = m[0];
      toks.push({ k: 'num', v: parseFloat(txt.replace(/f$/, '')), p: i });
      i += txt.length;
      continue;
    }
    if (ch === "'") {
      const j = src.indexOf("'", i + 1);
      if (j < 0) throw new MolangSyntaxError('unterminated string', src, i);
      toks.push({ k: 'str', v: src.slice(i + 1, j), p: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i));
      toks.push({ k: 'id', v: m[0].toLowerCase(), raw: m[0], p: i });
      i += m[0].length;
      continue;
    }
    let sym = null;
    for (const s of SYMBOLS) if (src.startsWith(s, i)) { sym = s; break; }
    if (!sym) throw new MolangSyntaxError(`unexpected character '${ch}'`, src, i);
    toks.push({ k: 'sym', v: sym, p: i });
    i += sym.length;
  }
  toks.push({ k: 'eof', v: '', p: n });
  return toks;
}

// ---------------------------------------------------------------- parser
class Parser {
  constructor(src) {
    this.src = src;
    this.toks = tokenize(src);
    this.i = 0;
  }
  peek(o = 0) { return this.toks[this.i + o]; }
  next() { return this.toks[this.i++]; }
  isSym(v) { const t = this.peek(); return t.k === 'sym' && t.v === v; }
  eatSym(v) { if (this.isSym(v)) { this.i++; return true; } return false; }
  expectSym(v) {
    if (!this.eatSym(v)) throw new MolangSyntaxError(`expected '${v}' but found '${this.peek().v || 'end'}'`, this.src, this.peek().p);
  }
  fail(msg) { throw new MolangSyntaxError(msg, this.src, this.peek().p); }

  parseProgram() {
    const stmts = [];
    let complex = false;
    while (this.peek().k !== 'eof') {
      if (this.eatSym(';')) { complex = true; continue; }
      stmts.push(this.parseStatement());
      if (this.eatSym(';')) complex = true;
      else if (this.peek().k !== 'eof' && !this.isSym('}')) {
        // statements following a block may omit ';' (e.g. "loop(2,{...}) return 1;")
        const prev = stmts[stmts.length - 1];
        if (!(prev && (prev.t === 'loop' || prev.t === 'foreach' || prev.t === 'block'))) this.fail(`unexpected token '${this.peek().v}'`);
      }
      if (this.isSym('}')) this.fail("unexpected '}'");
    }
    return { t: 'program', stmts, complex };
  }

  parseBlockBody() {
    // after '{'
    const stmts = [];
    while (!this.isSym('}')) {
      if (this.peek().k === 'eof') this.fail("missing '}'");
      if (this.eatSym(';')) continue;
      stmts.push(this.parseStatement());
      if (!this.eatSym(';') && !this.isSym('}')) {
        const prev = stmts[stmts.length - 1];
        if (!(prev && (prev.t === 'loop' || prev.t === 'foreach' || prev.t === 'block'))) this.fail(`unexpected token '${this.peek().v}'`);
      }
    }
    this.expectSym('}');
    return { t: 'block', stmts };
  }

  parseStatement() {
    const t = this.peek();
    if (t.k === 'id') {
      if (t.v === 'return') { this.next(); return { t: 'return', e: this.parseExpr() }; }
      if (t.v === 'break') { this.next(); return { t: 'break' }; }
      if (t.v === 'continue') { this.next(); return { t: 'continue' }; }
    }
    return this.parseExpr();
  }

  parseExpr() { return this.parseAssign(); }

  parseAssign() {
    const lhs = this.parseTernary();
    if (this.isSym('=')) {
      this.next();
      if (!(lhs.t === 'name' && (lhs.ns === 'variable' || lhs.ns === 'temp' || lhs.ns === 'context'))) this.fail('invalid assignment target');
      const rhs = this.parseAssign();
      return { t: 'assign', target: lhs, e: rhs };
    }
    return lhs;
  }

  parseTernary() {
    const c = this.parseCoalesce();
    if (this.eatSym('?')) {
      const a = this.parseTernary();
      if (this.eatSym(':')) {
        const b = this.parseTernary();
        return { t: 'tern', c, a, b };
      }
      return { t: 'cond', c, a };
    }
    return c;
  }

  parseCoalesce() {
    let a = this.parseOr();
    while (this.isSym('??')) { this.next(); const b = this.parseOr(); a = { t: 'coalesce', a, b }; }
    return a;
  }
  parseOr() {
    let a = this.parseAnd();
    while (this.isSym('||')) { this.next(); const b = this.parseAnd(); a = { t: 'bin', op: '||', a, b }; }
    return a;
  }
  parseAnd() {
    let a = this.parseEq();
    while (this.isSym('&&')) { this.next(); const b = this.parseEq(); a = { t: 'bin', op: '&&', a, b }; }
    return a;
  }
  parseEq() {
    let a = this.parseRel();
    while (this.isSym('==') || this.isSym('!=')) { const op = this.next().v; const b = this.parseRel(); a = { t: 'bin', op, a, b }; }
    return a;
  }
  parseRel() {
    let a = this.parseAdd();
    while (this.isSym('<') || this.isSym('<=') || this.isSym('>') || this.isSym('>=')) {
      const op = this.next().v; const b = this.parseAdd(); a = { t: 'bin', op, a, b };
    }
    return a;
  }
  parseAdd() {
    let a = this.parseMul();
    while (this.isSym('+') || this.isSym('-')) { const op = this.next().v; const b = this.parseMul(); a = { t: 'bin', op, a, b }; }
    return a;
  }
  parseMul() {
    let a = this.parseUnary();
    while (this.isSym('*') || this.isSym('/')) { const op = this.next().v; const b = this.parseUnary(); a = { t: 'bin', op, a, b }; }
    return a;
  }
  parseUnary() {
    if (this.isSym('!') || this.isSym('-') || this.isSym('+')) {
      const op = this.next().v;
      const a = this.parseUnary();
      if (op === '-' && a.t === 'num') return { t: 'num', v: -a.v };
      if (op === '+') return a;
      return { t: 'un', op, a };
    }
    return this.parsePostfix();
  }
  parsePostfix() {
    let e = this.parsePrimary();
    for (;;) {
      if (this.isSym('[')) {
        this.next();
        const idx = this.parseExpr();
        this.expectSym(']');
        e = { t: 'index', obj: e, idx };
      } else if (this.isSym('->')) {
        this.next();
        const rhs = this.parsePostfix();
        e = { t: 'arrow', a: e, b: rhs };
      } else break;
    }
    return e;
  }
  parsePrimary() {
    const t = this.next();
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'str') return { t: 'str', v: t.v };
    if (t.k === 'sym') {
      if (t.v === '(') { const e = this.parseExpr(); this.expectSym(')'); return e; }
      if (t.v === '{') return this.parseBlockBody();
      this.i--;
      this.fail(`unexpected '${t.v}'`);
    }
    if (t.k === 'id') {
      const v = t.v;
      if (v === 'true') return { t: 'num', v: 1 };
      if (v === 'false') return { t: 'num', v: 0 };
      if (v === 'this') return { t: 'this' };
      if (v === 'loop') {
        this.expectSym('(');
        const n = this.parseExpr();
        this.expectSym(',');
        const body = this.parseExpr();
        this.expectSym(')');
        return { t: 'loop', n, body };
      }
      if (v === 'for_each') {
        this.expectSym('(');
        const variable = this.parseExpr();
        this.expectSym(',');
        const arr = this.parseExpr();
        this.expectSym(',');
        const body = this.parseExpr();
        this.expectSym(')');
        return { t: 'foreach', variable, arr, body };
      }
      const dot = v.indexOf('.');
      const nsRaw = dot < 0 ? v : v.slice(0, dot);
      const ns = NS_ALIAS[nsRaw];
      if (!ns || dot < 0) this.fail(`unknown identifier '${t.raw}'`);
      const path = v.slice(dot + 1);
      if (this.isSym('(')) {
        this.next();
        const args = [];
        if (!this.isSym(')')) {
          do { args.push(this.parseExpr()); } while (this.eatSym(','));
        }
        this.expectSym(')');
        return { t: 'call', ns, path, args, raw: t.raw };
      }
      return { t: 'name', ns, path, raw: t.raw };
    }
    this.i--;
    this.fail('unexpected end of expression');
  }
}

const parseCache = new Map();
export function parseMolang(src) {
  const key = String(src);
  let ast = parseCache.get(key);
  if (!ast) {
    ast = new Parser(key).parseProgram();
    parseCache.set(key, ast);
  }
  return ast;
}

// ---------------------------------------------------------------- name collection (check mode)
export function collectNames(ast, out = { query: new Set(), math: new Set(), variable: new Set(), temp: new Set(), context: new Set(), other: new Set(), assigned: new Set() }) {
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    switch (n.t) {
      case 'name':
      case 'call':
        if (out[n.ns]) out[n.ns].add(n.path);
        else out.other.add(`${n.ns}.${n.path}`);
        if (n.args) n.args.forEach(visit);
        return;
      case 'assign':
        out.assigned.add(`${n.target.ns}.${n.target.path}`);
        visit(n.target); visit(n.e); return;
      default:
        for (const k of Object.keys(n)) {
          const val = n[k];
          if (Array.isArray(val)) val.forEach(visit);
          else if (val && typeof val === 'object') visit(val);
        }
    }
  };
  visit(ast);
  return out;
}

// ---------------------------------------------------------------- math
const D2R = Math.PI / 180;
function cRound(x) { return x < 0 ? -Math.round(-x) : Math.round(x); } // half away from zero
function fmod(a, b) { return b === 0 ? 0 : a % b; }

export function makeRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => {
    // mulberry32
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mathFn(name, a, rng) {
  const n = (i) => toNum(a[i]);
  switch (name) {
    case 'abs': return Math.abs(n(0));
    case 'acos': return Math.acos(Math.max(-1, Math.min(1, n(0)))) / D2R;
    case 'asin': return Math.asin(Math.max(-1, Math.min(1, n(0)))) / D2R;
    case 'atan': return Math.atan(n(0)) / D2R;
    case 'atan2': return Math.atan2(n(0), n(1)) / D2R;
    case 'ceil': return Math.ceil(n(0));
    case 'clamp': return Math.min(Math.max(n(0), n(1)), n(2));
    case 'copy_sign': { const m = Math.abs(n(0)); return (n(1) < 0 || Object.is(n(1), -0)) ? -m : m; }
    case 'cos': return Math.cos(n(0) * D2R);
    case 'sin': return Math.sin(n(0) * D2R);
    case 'die_roll': { let s = 0; const c = Math.floor(n(0)); for (let i = 0; i < c; i++) s += n(1) + rng() * (n(2) - n(1)); return s; }
    case 'die_roll_integer': { let s = 0; const c = Math.floor(n(0)); const lo = Math.round(n(1)); const hi = Math.round(n(2)); for (let i = 0; i < c; i++) s += lo + Math.floor(rng() * (hi - lo + 1)); return s; }
    case 'exp': return Math.exp(n(0));
    case 'floor': return Math.floor(n(0));
    case 'hermite_blend': { const t = n(0); return 3 * t * t - 2 * t * t * t; }
    case 'lerp': return n(0) + (n(1) - n(0)) * n(2);
    case 'lerprotate': {
      const wrap = (x) => { let y = ((x + 180) % 360 + 360) % 360 - 180; return y; };
      const s = wrap(n(0)); const e = wrap(n(1));
      let d = e - s;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      return s + d * n(2);
    }
    case 'ln': return Math.log(n(0));
    case 'max': return Math.max(n(0), n(1));
    case 'min': return Math.min(n(0), n(1));
    case 'min_angle': { let x = n(0); while (x >= 180) x -= 360; while (x < -180) x += 360; return x; }
    case 'mod': return fmod(n(0), n(1));
    case 'pi': return Math.PI;
    case 'pow': return Math.pow(n(0), n(1));
    case 'random': return n(0) + rng() * (n(1) - n(0));
    case 'random_integer': { const lo = Math.round(n(0)); const hi = Math.round(n(1)); return lo + Math.floor(rng() * (hi - lo + 1)); }
    case 'round': return cRound(n(0));
    case 'sign': return n(0) >= 0 ? 1 : -1;
    case 'sqrt': return Math.sqrt(n(0));
    case 'trunc': return Math.trunc(n(0));
    default: return undefined;
  }
}

export function toNum(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'boolean') return x ? 1 : 0;
  if (x === undefined || x === null) return 0;
  if (typeof x === 'string') return 0;
  return 0;
}
function truthy(x) {
  if (typeof x === 'string') return x.length > 0;
  return toNum(x) !== 0;
}

// ---------------------------------------------------------------- evaluation
const BREAK = { sig: 'break' };
const CONTINUE = { sig: 'continue' };

// Context interface (all optional):
//   variables: Map  (entity variables, persistent)
//   temps: Map      (temp variables; fresh per evaluation unless provided)
//   contextVars: Map
//   query(name, args) -> number|string|undefined   (undefined => unknown query)
//   thisValue: number
//   arrays: { name: [values] }
//   rng: () => [0,1)
//   warn(msg)
export function evaluate(src, ctx = {}) {
  if (typeof src === 'number') return src;
  if (typeof src === 'boolean') return src ? 1 : 0;
  if (src === undefined || src === null) return 0;
  let ast;
  try {
    ast = parseMolang(src);
  } catch (e) {
    if (ctx.warn) ctx.warn(`syntax error: ${e.message}`);
    return 0;
  }
  return runProgram(ast, ctx);
}

export function runProgram(ast, ctx) {
  const state = { ret: undefined, ctx, temps: ctx.temps || new Map(), steps: 0 };
  if (!ast.complex) {
    if (ast.stmts.length === 0) return 0;
    const s = ast.stmts[0];
    if (s.t === 'return') return ev(s.e, state);
    return ev(s, state);
  }
  for (const s of ast.stmts) {
    const r = exec(s, state);
    if (state.ret !== undefined) return state.ret;
    if (r === BREAK || r === CONTINUE) break;
  }
  return 0;
}

function exec(s, st) {
  if (s.t === 'return') { st.ret = ev(s.e, st); return null; }
  if (s.t === 'break') return BREAK;
  if (s.t === 'continue') return CONTINUE;
  if (s.t === 'block') return execBlock(s, st);
  ev(s, st);
  return null;
}
function execBlock(b, st) {
  for (const s of b.stmts) {
    const r = exec(s, st);
    if (st.ret !== undefined) return null;
    if (r === BREAK || r === CONTINUE) return r;
  }
  return null;
}

function getVar(st, node) {
  const { ctx } = st;
  if (node.ns === 'variable') return ctx.variables ? ctx.variables.get(node.path) : undefined;
  if (node.ns === 'temp') return st.temps.get(node.path);
  if (node.ns === 'context') return ctx.contextVars ? ctx.contextVars.get(node.path) : undefined;
  return undefined;
}
function setVar(st, node, value) {
  const { ctx } = st;
  if (node.ns === 'variable') {
    if (!ctx.variables) ctx.variables = new Map();
    ctx.variables.set(node.path, value);
  } else if (node.ns === 'temp') st.temps.set(node.path, value);
  else if (node.ns === 'context') {
    if (!ctx.contextVars) ctx.contextVars = new Map();
    ctx.contextVars.set(node.path, value);
  }
}

function callQuery(st, path, args) {
  const { ctx } = st;
  let r;
  if (ctx.query) r = ctx.query(path, args);
  if (r === undefined) {
    if (ctx.warn) ctx.warn(`unknown/unmocked query.${path} -> 0`);
    return 0;
  }
  if (typeof r === 'boolean') return r ? 1 : 0;
  return r;
}

function ev(n, st) {
  if (++st.steps > 2000000) throw new Error('Molang evaluation step limit exceeded');
  switch (n.t) {
    case 'num': return n.v;
    case 'str': return n.v;
    case 'this': return st.ctx.thisValue ?? 0;
    case 'name': {
      if (n.ns === 'variable' || n.ns === 'temp' || n.ns === 'context') {
        const v = getVar(st, n);
        return v === undefined ? 0 : v;
      }
      if (n.ns === 'query') return callQuery(st, n.path, []);
      if (n.ns === 'math') {
        if (n.path === 'pi') return Math.PI;
        if (st.ctx.warn) st.ctx.warn(`math.${n.path} used without arguments`);
        return 0;
      }
      if (n.ns === 'geometry' || n.ns === 'texture' || n.ns === 'material') return `${n.ns}.${n.path}`;
      if (n.ns === 'array') return (st.ctx.arrays && st.ctx.arrays[n.path]) || [];
      return 0;
    }
    case 'call': {
      const args = n.args.map((a) => ev(a, st));
      if (n.ns === 'math') {
        const r = mathFn(n.path, args, st.ctx.rng || Math.random);
        if (r === undefined) { if (st.ctx.warn) st.ctx.warn(`unknown function math.${n.path} -> 0`); return 0; }
        return r;
      }
      if (n.ns === 'query') return callQuery(st, n.path, args);
      if (st.ctx.warn) st.ctx.warn(`cannot call ${n.ns}.${n.path}`);
      return 0;
    }
    case 'index': {
      const arr = ev(n.obj, st);
      const i = Math.floor(toNum(ev(n.idx, st)));
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      const k = ((i % arr.length) + arr.length) % arr.length;
      const el = arr[k];
      if (typeof el === 'string' && st.ctx.evalArrayElement) return st.ctx.evalArrayElement(el);
      return el;
    }
    case 'un': {
      const a = ev(n.a, st);
      if (n.op === '!') return truthy(a) ? 0 : 1;
      if (n.op === '-') return -toNum(a);
      return toNum(a);
    }
    case 'bin': {
      const op = n.op;
      if (op === '&&') return truthy(ev(n.a, st)) && truthy(ev(n.b, st)) ? 1 : 0;
      if (op === '||') return truthy(ev(n.a, st)) || truthy(ev(n.b, st)) ? 1 : 0;
      const a = ev(n.a, st);
      const b = ev(n.b, st);
      switch (op) {
        case '==':
          if (typeof a === 'string' || typeof b === 'string') return a === b ? 1 : 0;
          return toNum(a) === toNum(b) ? 1 : 0;
        case '!=':
          if (typeof a === 'string' || typeof b === 'string') return a !== b ? 1 : 0;
          return toNum(a) !== toNum(b) ? 1 : 0;
        case '<': return toNum(a) < toNum(b) ? 1 : 0;
        case '<=': return toNum(a) <= toNum(b) ? 1 : 0;
        case '>': return toNum(a) > toNum(b) ? 1 : 0;
        case '>=': return toNum(a) >= toNum(b) ? 1 : 0;
        case '+': return toNum(a) + toNum(b);
        case '-': return toNum(a) - toNum(b);
        case '*': return toNum(a) * toNum(b);
        case '/': return toNum(a) / toNum(b);
        default: return 0;
      }
    }
    case 'tern': return truthy(ev(n.c, st)) ? ev(n.a, st) : ev(n.b, st);
    case 'cond': return truthy(ev(n.c, st)) ? ev(n.a, st) : 0;
    case 'coalesce': {
      if (n.a.t === 'name' && (n.a.ns === 'variable' || n.a.ns === 'temp' || n.a.ns === 'context')) {
        const v = getVar(st, n.a);
        return v === undefined ? ev(n.b, st) : v;
      }
      const v = ev(n.a, st);
      return v === undefined || v === null ? ev(n.b, st) : v;
    }
    case 'assign': {
      const v = ev(n.e, st);
      setVar(st, n.target, v);
      return v;
    }
    case 'block': {
      const r = execBlock(n, st);
      return r && r.sig ? 0 : 0;
    }
    case 'loop': {
      const count = Math.min(1024, Math.max(0, Math.floor(toNum(ev(n.n, st)))));
      for (let i = 0; i < count; i++) {
        const r = n.body.t === 'block' ? execBlock(n.body, st) : (ev(n.body, st), null);
        if (st.ret !== undefined) return 0;
        if (r === BREAK) break;
      }
      return 0;
    }
    case 'foreach': {
      const arr = ev(n.arr, st);
      if (!Array.isArray(arr)) return 0;
      for (const el of arr) {
        if (n.variable.t === 'name') setVar(st, n.variable, el);
        const r = n.body.t === 'block' ? execBlock(n.body, st) : (ev(n.body, st), null);
        if (st.ret !== undefined) return 0;
        if (r === BREAK) break;
      }
      return 0;
    }
    case 'arrow': {
      if (st.ctx.warn) st.ctx.warn("'->' context switching is not supported by the viewer; evaluated as 0");
      return 0;
    }
    case 'return': {
      st.ret = ev(n.e, st);
      return st.ret;
    }
    default:
      throw new Error(`bad node ${n.t}`);
  }
}

// Helper: evaluate to number with NaN guard.
export function evalNum(src, ctx) {
  const r = evaluate(src, ctx);
  const x = toNum(r);
  if (!Number.isFinite(x)) {
    if (ctx.warn) ctx.warn(`non-finite result (${x}) from: ${String(src).slice(0, 120)}`);
    return 0;
  }
  return x;
}
