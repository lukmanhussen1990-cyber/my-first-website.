#!/usr/bin/env python3
"""Minimal Molang evaluator (Bedrock semantics) used by the Giant Spider Hunter client tools.

Only what the add-on's client files use is implemented, with Bedrock behaviour:
  * numbers, 'strings', v./variable., t./temp., q./query., c./context. and math. names
  * operators  ! - (unary)  * /  + -  < <= > >=  == !=  &&  ||  ?: (and binary ?)  ??  =
  * complex expressions: statements separated by ';', 'return', '{ }' scopes are not used
  * booleans are 1.0 / 0.0, an unset variable reads as 0.0, 'a ?? b' returns b when a is unset
  * trigonometry in DEGREES (math.sin/cos take degrees, math.atan2/acos/asin/atan return degrees)
  * math.mod is C fmod, math.hermite_blend(t) = 3t^2 - 2t^3, math.min_angle wraps to [-180, 180)

Usage (library):
    ev = Molang(queries={'delta_time': 0.016, 'property': lambda name: ...})
    ev.run("v.a = 1; v.b = v.a + 2;")      # complex expression (statements)
    ev.eval("math.sin(v.b * 90)")           # simple expression -> float
The variable store ev.vars persists between calls (like v.* on an entity).
"""
import math
import re

__all__ = ["Molang", "MolangError", "parse"]


class MolangError(Exception):
    pass


_TOKEN = re.compile(r"""
    (?P<ws>\s+)
  | (?P<num>\d+\.\d*|\.\d+|\d+)f?
  | (?P<str>'[^']*')
  | (?P<name>[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)
  | (?P<op>\?\?|==|!=|<=|>=|&&|\|\||->|[-+*/()<>!?:;,=\[\]{}])
""", re.X)

_NS = {"v": "v", "variable": "v", "t": "t", "temp": "t", "q": "q", "query": "q",
       "c": "c", "context": "c", "math": "math"}


def tokenize(src):
    pos, out = 0, []
    while pos < len(src):
        m = _TOKEN.match(src, pos)
        if not m:
            raise MolangError(f"bad character at {pos}: {src[pos:pos + 20]!r}")
        pos = m.end()
        kind = m.lastgroup
        if kind == "ws":
            continue
        text = m.group(kind)
        if kind == "num":
            out.append(("num", float(text.rstrip("f"))))
        elif kind == "str":
            out.append(("str", text[1:-1]))
        elif kind == "name":
            out.append(("name", text))
        else:
            out.append(("op", text))
    out.append(("eof", None))
    return out


class _Parser:
    """Recursive-descent parser producing nested tuples."""

    def __init__(self, tokens):
        self.toks = tokens
        self.i = 0

    def peek(self, k=0):
        return self.toks[self.i + k]

    def take(self, op=None):
        tok = self.toks[self.i]
        if op is not None and tok != ("op", op):
            raise MolangError(f"expected {op!r}, got {tok}")
        self.i += 1
        return tok

    def accept(self, op):
        if self.peek() == ("op", op):
            self.i += 1
            return True
        return False

    # program := statement (';' statement)* [';']
    def program(self):
        stmts = []
        while self.peek()[0] != "eof":
            if self.accept(";"):
                continue
            stmts.append(self.statement())
            if self.peek()[0] != "eof":
                self.take(";")
        return ("prog", stmts)

    def statement(self):
        if self.peek() == ("name", "return"):
            self.i += 1
            return ("return", self.expr())
        return self.expr()

    def expr(self):
        return self.assign()

    def assign(self):
        left = self.coalesce()
        if self.peek() == ("op", "="):
            self.i += 1
            if left[0] != "var":
                raise MolangError("assignment to non-variable")
            return ("set", left[1], left[2], self.assign())
        return left

    def coalesce(self):
        left = self.ternary()
        while self.accept("??"):
            left = ("??", left, self.ternary())
        return left

    def ternary(self):
        cond = self.or_()
        if self.accept("?"):
            a = self.ternary()
            if self.accept(":"):
                b = self.ternary()
                return ("?:", cond, a, b)
            return ("?", cond, a)
        return cond

    def _binary(self, sub, ops):
        left = sub()
        while self.peek()[0] == "op" and self.peek()[1] in ops:
            op = self.take()[1]
            left = (op, left, sub())
        return left

    def or_(self):
        return self._binary(self.and_, ("||",))

    def and_(self):
        return self._binary(self.eq, ("&&",))

    def eq(self):
        return self._binary(self.rel, ("==", "!="))

    def rel(self):
        return self._binary(self.add, ("<", "<=", ">", ">="))

    def add(self):
        return self._binary(self.mul, ("+", "-"))

    def mul(self):
        return self._binary(self.unary, ("*", "/"))

    def unary(self):
        if self.accept("-"):
            return ("neg", self.unary())
        if self.accept("!"):
            return ("not", self.unary())
        if self.accept("+"):
            return self.unary()
        return self.primary()

    def primary(self):
        kind, val = self.take()
        if kind == "num":
            return ("num", val)
        if kind == "str":
            return ("str", val)
        if kind == "op" and val == "(":
            e = self.expr()
            self.take(")")
            return e
        if kind == "name":
            low = val.lower()
            if low == "this":
                return ("num", 0.0)
            if low == "true":
                return ("num", 1.0)
            if low == "false":
                return ("num", 0.0)
            parts = low.split(".")
            if len(parts) < 2 or parts[0] not in _NS:
                raise MolangError(f"unknown identifier {val!r}")
            ns, name = _NS[parts[0]], ".".join(parts[1:])
            if ns in ("q", "math"):
                args = []
                if self.accept("("):
                    if not self.accept(")"):
                        args.append(self.expr())
                        while self.accept(","):
                            args.append(self.expr())
                        self.take(")")
                return ("call", ns, name, args)
            return ("var", ns, name)
        raise MolangError(f"unexpected token {kind} {val!r}")


_CACHE = {}


def parse(src):
    src = str(src)
    tree = _CACHE.get(src)
    if tree is None:
        tree = _Parser(tokenize(src)).program()
        _CACHE[src] = tree
    return tree


class _Return(Exception):
    def __init__(self, value):
        self.value = value


def _num(x):
    if isinstance(x, str):
        return 0.0
    return float(x)


def _fmod(a, b):
    if b == 0:
        return 0.0
    return math.fmod(a, b)


def _min_angle(a):
    a = math.fmod(a + 180.0, 360.0)
    if a < 0:
        a += 360.0
    return a - 180.0


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


MATH = {
    "abs": abs,
    "acos": lambda x: math.degrees(math.acos(_clamp(x, -1.0, 1.0))),
    "asin": lambda x: math.degrees(math.asin(_clamp(x, -1.0, 1.0))),
    "atan": lambda x: math.degrees(math.atan(x)),
    "atan2": lambda y, x: math.degrees(math.atan2(y, x)),
    "ceil": math.ceil,
    "clamp": _clamp,
    "copy_sign": math.copysign,
    "cos": lambda d: math.cos(math.radians(d)),
    "exp": math.exp,
    "floor": math.floor,
    "hermite_blend": lambda t: 3 * t * t - 2 * t * t * t,
    "lerp": lambda a, b, t: a + (b - a) * t,
    "lerprotate": lambda a, b, t: a + _min_angle(b - a) * t,
    "ln": math.log,
    "max": max,
    "min": min,
    "min_angle": _min_angle,
    "mod": _fmod,
    "pi": lambda: math.pi,
    "pow": math.pow,
    "round": lambda x: math.floor(x + 0.5),
    "sign": lambda x: 1.0 if x >= 0 else -1.0,
    "sin": lambda d: math.sin(math.radians(d)),
    "sqrt": lambda x: math.sqrt(max(0.0, x)),
    "trunc": math.trunc,
}


class Molang:
    def __init__(self, queries=None, variables=None, context=None):
        self.queries = queries if queries is not None else {}
        self.vars = variables if variables is not None else {}
        self.context = context if context is not None else {}
        self.temps = {}
        self.used_queries = set()
        self.used_math = set()

    # -- public API ---------------------------------------------------------
    def run(self, src):
        """Evaluate a (possibly complex) expression. Temps are scoped to this call."""
        self.temps = {}
        tree = parse(src)
        try:
            value = 0.0
            stmts = tree[1]
            for st in stmts:
                value = self._ev(st)
            # A simple (single statement, no ';') expression returns its value.
            if len(stmts) == 1 and ";" not in str(src):
                return value
            return 0.0
        except _Return as r:
            return r.value

    def eval(self, src):
        if isinstance(src, (int, float)):
            return float(src)
        return _num(self.run(src))

    # -- evaluation ---------------------------------------------------------
    def _store(self, ns):
        return {"v": self.vars, "t": self.temps, "c": self.context}[ns]

    def _ev(self, n):
        k = n[0]
        if k == "num" or k == "str":
            return n[1]
        if k == "var":
            store = self._store(n[1])
            return store.get(n[2], 0.0)
        if k == "set":
            val = self._ev(n[3])
            self._store(n[1])[n[2]] = val
            return val
        if k == "call":
            ns, name, args = n[1], n[2], n[3]
            if ns == "math":
                fn = MATH.get(name)
                if fn is None:
                    raise MolangError(f"unknown math.{name}")
                self.used_math.add(name)
                return float(fn(*[_num(self._ev(a)) for a in args]))
            self.used_queries.add(name)
            q = self.queries.get(name)
            if q is None:
                raise MolangError(f"query.{name} not provided by the simulation")
            if callable(q):
                return q(*[self._ev(a) for a in args])
            return q
        if k == "??":
            left = n[1]
            if left[0] == "var":
                store = self._store(left[1])
                if left[2] in store:
                    return store[left[2]]
                return self._ev(n[2])
            return self._ev(left)
        if k == "?:":
            return self._ev(n[2]) if _num(self._ev(n[1])) != 0 else self._ev(n[3])
        if k == "?":
            return self._ev(n[2]) if _num(self._ev(n[1])) != 0 else 0.0
        if k == "neg":
            return -_num(self._ev(n[1]))
        if k == "not":
            return 0.0 if _num(self._ev(n[1])) != 0 else 1.0
        if k == "return":
            raise _Return(self._ev(n[1]))
        if k == "&&":
            return 1.0 if (_num(self._ev(n[1])) != 0 and _num(self._ev(n[2])) != 0) else 0.0
        if k == "||":
            return 1.0 if (_num(self._ev(n[1])) != 0 or _num(self._ev(n[2])) != 0) else 0.0
        a, b = self._ev(n[1]), self._ev(n[2])
        if k == "==":
            if isinstance(a, str) or isinstance(b, str):
                return 1.0 if a == b else 0.0
            return 1.0 if abs(a - b) < 1e-9 else 0.0
        if k == "!=":
            if isinstance(a, str) or isinstance(b, str):
                return 1.0 if a != b else 0.0
            return 0.0 if abs(a - b) < 1e-9 else 1.0
        a, b = _num(a), _num(b)
        if k == "+":
            return a + b
        if k == "-":
            return a - b
        if k == "*":
            return a * b
        if k == "/":
            return a / b if b != 0 else 0.0
        if k == "<":
            return 1.0 if a < b else 0.0
        if k == "<=":
            return 1.0 if a <= b else 0.0
        if k == ">":
            return 1.0 if a > b else 0.0
        if k == ">=":
            return 1.0 if a >= b else 0.0
        raise MolangError(f"unknown node {k}")


def names_in(src):
    """Return (queries, math functions) referenced by a Molang source string."""
    qs, ms = set(), set()
    for kind, val in tokenize(str(src)):
        if kind == "name":
            parts = val.lower().split(".")
            if parts[0] in ("q", "query") and len(parts) > 1:
                qs.add(parts[1])
            elif parts[0] == "math" and len(parts) > 1:
                ms.add(parts[1])
    return qs, ms


if __name__ == "__main__":
    m = Molang(queries={"delta_time": 0.05})
    m.run("v.a = (v.a ?? 3) + 1; v.b = v.a > 3 ? math.atan2(1, 1) : -1;")
    assert m.vars["a"] == 4 and abs(m.vars["b"] - 45) < 1e-9, m.vars
    assert abs(m.eval("math.mod(5.5, 1) + math.hermite_blend(0.5)") - 1.0) < 1e-9
    assert m.eval("'a' == 'a' && !(2 < 1)") == 1.0
    assert abs(m.eval("math.min_angle(350)") + 10) < 1e-9
    print("molang self-test ok")
