// parser.js — turns a flat token list into an Abstract Syntax Tree (AST).
//
// This is a hand-written recursive-descent parser. Each grammar rule is a
// method that consumes tokens and returns an AST node (a plain object with a
// `type` field). Operator precedence is encoded by the call chain: lower
// precedence rules call higher precedence ones.
//
// Grammar (roughly, lowest precedence first):
//   program    := statement*
//   statement  := letStmt | ifStmt | whileStmt | fnStmt | returnStmt | exprStmt
//   letStmt    := 'let' IDENT '=' expression
//   ifStmt     := 'if' expression block ('else' (ifStmt | block))?
//   whileStmt  := 'while' expression block
//   fnStmt     := 'fn' IDENT '(' params? ')' block
//   returnStmt := 'return' expression?
//   block      := '{' statement* '}'
//   expression := assignment
//   assignment := logicOr ('=' assignment)?          // target must be assignable
//   logicOr    := logicAnd ('||' logicAnd)*
//   logicAnd   := equality ('&&' equality)*
//   equality   := comparison (('==' | '!=') comparison)*
//   comparison := term (('<' | '<=' | '>' | '>=') term)*
//   term       := factor (('+' | '-') factor)*
//   factor     := unary (('*' | '/' | '%') unary)*
//   unary      := ('!' | '-') unary | call
//   call       := primary ( '(' args? ')' | '[' expression ']' )*
//   primary    := NUMBER | STRING | IDENT | 'true' | 'false' | 'null'
//               | '(' expression ')' | '[' args? ']'

import { T } from "./lexer.js";
import { ParseError } from "./errors.js";

export function parse(tokens) {
  let pos = 0;

  const peek = () => tokens[pos];
  const previous = () => tokens[pos - 1];
  const atEnd = () => peek().type === T.EOF;
  const advance = () => tokens[pos++];

  const check = (type, value = null) => {
    const t = peek();
    if (t.type !== type) return false;
    return value === null || t.value === value;
  };

  // If the next token matches, consume and return it; otherwise return null.
  const match = (type, value = null) => (check(type, value) ? advance() : null);

  // Consume a required token or fail with a helpful message.
  const expect = (type, value, what) => {
    if (check(type, value)) return advance();
    const t = peek();
    const got = t.type === T.EOF ? "end of input" : `'${t.value}'`;
    throw new ParseError(`Expected ${what} but got ${got}`, t.line, t.col);
  };

  // ---- statements ---------------------------------------------------------

  function parseProgram() {
    const body = [];
    while (!atEnd()) body.push(parseStatement());
    return { type: "Program", body };
  }

  function parseStatement() {
    if (check(T.KEYWORD, "let")) return parseLet();
    if (check(T.KEYWORD, "if")) return parseIf();
    if (check(T.KEYWORD, "while")) return parseWhile();
    if (check(T.KEYWORD, "fn")) return parseFn();
    if (check(T.KEYWORD, "return")) return parseReturn();
    return parseExpressionStatement();
  }

  function parseLet() {
    const kw = advance(); // 'let'
    const name = expect(T.IDENT, null, "a variable name after 'let'");
    expect(T.OP, "=", "'=' after variable name");
    const value = parseExpression();
    return { type: "Let", name: name.value, value, line: kw.line, col: kw.col };
  }

  function parseIf() {
    const kw = advance(); // 'if'
    const condition = parseExpression();
    const consequent = parseBlock();
    let alternate = null;
    if (match(T.KEYWORD, "else")) {
      // `else if` chains into another if statement; otherwise a plain block.
      alternate = check(T.KEYWORD, "if") ? parseIf() : parseBlock();
    }
    return { type: "If", condition, consequent, alternate, line: kw.line, col: kw.col };
  }

  function parseWhile() {
    const kw = advance(); // 'while'
    const condition = parseExpression();
    const body = parseBlock();
    return { type: "While", condition, body, line: kw.line, col: kw.col };
  }

  function parseFn() {
    const kw = advance(); // 'fn'
    const name = expect(T.IDENT, null, "a function name after 'fn'");
    expect(T.LPAREN, null, "'(' after function name");
    const params = [];
    if (!check(T.RPAREN)) {
      do {
        const p = expect(T.IDENT, null, "a parameter name");
        params.push(p.value);
      } while (match(T.COMMA));
    }
    expect(T.RPAREN, null, "')' after parameters");
    const body = parseBlock();
    return { type: "Function", name: name.value, params, body, line: kw.line, col: kw.col };
  }

  function parseReturn() {
    const kw = advance(); // 'return'
    // A return with no value: the next token starts a new block/statement.
    let value = null;
    if (!check(T.RBRACE) && !atEnd() && !startsNewLikelyStatement()) {
      value = parseExpression();
    }
    return { type: "Return", value, line: kw.line, col: kw.col };
  }

  // Heuristic: a bare `return` is followed by `}` or another statement keyword.
  function startsNewLikelyStatement() {
    return (
      check(T.KEYWORD, "let") ||
      check(T.KEYWORD, "if") ||
      check(T.KEYWORD, "while") ||
      check(T.KEYWORD, "fn") ||
      check(T.KEYWORD, "return")
    );
  }

  function parseBlock() {
    const open = expect(T.LBRACE, null, "'{' to start a block");
    const body = [];
    while (!check(T.RBRACE) && !atEnd()) body.push(parseStatement());
    expect(T.RBRACE, null, "'}' to close the block");
    return { type: "Block", body, line: open.line, col: open.col };
  }

  function parseExpressionStatement() {
    const expr = parseExpression();
    return { type: "ExpressionStatement", expression: expr, line: expr.line, col: expr.col };
  }

  // ---- expressions --------------------------------------------------------

  function parseExpression() {
    return parseAssignment();
  }

  function parseAssignment() {
    const target = parseLogicOr();
    if (check(T.OP, "=")) {
      const eq = advance();
      const value = parseAssignment(); // right-associative
      if (target.type === "Variable") {
        return { type: "Assign", name: target.name, value, line: target.line, col: target.col };
      }
      if (target.type === "Index") {
        return {
          type: "IndexAssign",
          object: target.object,
          index: target.index,
          value,
          line: target.line,
          col: target.col,
        };
      }
      throw new ParseError("Invalid assignment target", eq.line, eq.col);
    }
    return target;
  }

  // Helper to build a left-associative chain of binary operators.
  function binaryChain(next, ops) {
    let left = next();
    while (peek().type === T.OP && ops.includes(peek().value)) {
      const op = advance();
      const right = next();
      left = {
        type: "Binary",
        operator: op.value,
        left,
        right,
        line: op.line,
        col: op.col,
      };
    }
    return left;
  }

  const parseLogicOr = () => binaryChain(parseLogicAnd, ["||"]);
  const parseLogicAnd = () => binaryChain(parseEquality, ["&&"]);
  const parseEquality = () => binaryChain(parseComparison, ["==", "!="]);
  const parseComparison = () => binaryChain(parseTerm, ["<", "<=", ">", ">="]);
  const parseTerm = () => binaryChain(parseFactor, ["+", "-"]);
  const parseFactor = () => binaryChain(parseUnary, ["*", "/", "%"]);

  function parseUnary() {
    if (peek().type === T.OP && (peek().value === "!" || peek().value === "-")) {
      const op = advance();
      const operand = parseUnary();
      return { type: "Unary", operator: op.value, operand, line: op.line, col: op.col };
    }
    return parseCall();
  }

  function parseCall() {
    let expr = parsePrimary();
    // Chain of calls and index accesses: foo(1)[2](3)
    while (true) {
      if (check(T.LPAREN)) {
        const paren = advance();
        const args = [];
        if (!check(T.RPAREN)) {
          do {
            args.push(parseExpression());
          } while (match(T.COMMA));
        }
        expect(T.RPAREN, null, "')' after arguments");
        expr = { type: "Call", callee: expr, args, line: paren.line, col: paren.col };
      } else if (check(T.LBRACKET)) {
        const bracket = advance();
        const index = parseExpression();
        expect(T.RBRACKET, null, "']' after index");
        expr = { type: "Index", object: expr, index, line: bracket.line, col: bracket.col };
      } else {
        break;
      }
    }
    return expr;
  }

  function parsePrimary() {
    const t = peek();

    if (t.type === T.NUMBER) {
      advance();
      return { type: "Number", value: t.value, line: t.line, col: t.col };
    }
    if (t.type === T.STRING) {
      advance();
      return { type: "String", value: t.value, line: t.line, col: t.col };
    }
    if (t.type === T.KEYWORD && (t.value === "true" || t.value === "false")) {
      advance();
      return { type: "Boolean", value: t.value === "true", line: t.line, col: t.col };
    }
    if (t.type === T.KEYWORD && t.value === "null") {
      advance();
      return { type: "Null", value: null, line: t.line, col: t.col };
    }
    if (t.type === T.IDENT) {
      advance();
      return { type: "Variable", name: t.value, line: t.line, col: t.col };
    }
    if (t.type === T.LPAREN) {
      advance();
      const expr = parseExpression();
      expect(T.RPAREN, null, "')' to close the group");
      return expr;
    }
    if (t.type === T.LBRACKET) {
      advance();
      const elements = [];
      if (!check(T.RBRACKET)) {
        do {
          elements.push(parseExpression());
        } while (match(T.COMMA));
      }
      expect(T.RBRACKET, null, "']' to close the array");
      return { type: "Array", elements, line: t.line, col: t.col };
    }

    const got = t.type === T.EOF ? "end of input" : `'${t.value}'`;
    throw new ParseError(`Unexpected ${got}`, t.line, t.col);
  }

  const program = parseProgram();
  return program;
}
