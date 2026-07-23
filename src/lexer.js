// lexer.js — turns raw source text into a flat list of tokens.
//
// The lexer walks the source one character at a time, grouping characters into
// meaningful chunks (numbers, strings, identifiers, operators) and recording
// the line/column of each so later stages can produce precise error messages.

import { LexError } from "./errors.js";

// Token type constants. Using plain strings keeps tokens easy to read/debug.
export const T = {
  NUMBER: "NUMBER",
  STRING: "STRING",
  IDENT: "IDENT",
  KEYWORD: "KEYWORD",
  OP: "OP",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  LBRACE: "LBRACE",
  RBRACE: "RBRACE",
  LBRACKET: "LBRACKET",
  RBRACKET: "RBRACKET",
  COMMA: "COMMA",
  EOF: "EOF",
};

// Words that are part of the language, not variable names.
const KEYWORDS = new Set([
  "let",
  "if",
  "else",
  "while",
  "fn",
  "return",
  "true",
  "false",
  "null",
]);

const isDigit = (c) => c >= "0" && c <= "9";
const isAlpha = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isAlphaNum = (c) => isAlpha(c) || isDigit(c);

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const peek = (offset = 0) => source[i + offset];
  const atEnd = () => i >= source.length;

  // Consume one character, keeping line/column counters in sync.
  const advance = () => {
    const c = source[i++];
    if (c === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return c;
  };

  const push = (type, value, startLine, startCol) =>
    tokens.push({ type, value, line: startLine, col: startCol });

  while (!atEnd()) {
    const c = peek();
    const startLine = line;
    const startCol = col;

    // Whitespace (including newlines) has no meaning between tokens.
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      advance();
      continue;
    }

    // Line comments: `// ...` runs to the end of the line.
    if (c === "/" && peek(1) === "/") {
      while (!atEnd() && peek() !== "\n") advance();
      continue;
    }

    // Numbers: one or more digits, with an optional single decimal point.
    if (isDigit(c)) {
      let num = "";
      while (!atEnd() && isDigit(peek())) num += advance();
      if (peek() === "." && isDigit(peek(1))) {
        num += advance(); // the '.'
        while (!atEnd() && isDigit(peek())) num += advance();
      }
      push(T.NUMBER, parseFloat(num), startLine, startCol);
      continue;
    }

    // Strings: double-quoted, with a handful of escape sequences.
    if (c === '"') {
      advance(); // opening quote
      let str = "";
      while (!atEnd() && peek() !== '"') {
        let ch = advance();
        if (ch === "\n") {
          throw new LexError("Unterminated string (line breaks not allowed)", startLine, startCol);
        }
        if (ch === "\\") {
          const esc = advance();
          const map = { n: "\n", t: "\t", '"': '"', "\\": "\\", r: "\r" };
          if (!(esc in map)) {
            throw new LexError(`Unknown escape sequence '\\${esc}'`, line, col);
          }
          ch = map[esc];
        }
        str += ch;
      }
      if (atEnd()) {
        throw new LexError("Unterminated string", startLine, startCol);
      }
      advance(); // closing quote
      push(T.STRING, str, startLine, startCol);
      continue;
    }

    // Identifiers and keywords.
    if (isAlpha(c)) {
      let name = "";
      while (!atEnd() && isAlphaNum(peek())) name += advance();
      push(KEYWORDS.has(name) ? T.KEYWORD : T.IDENT, name, startLine, startCol);
      continue;
    }

    // Punctuation with dedicated token types.
    const singles = {
      "(": T.LPAREN,
      ")": T.RPAREN,
      "{": T.LBRACE,
      "}": T.RBRACE,
      "[": T.LBRACKET,
      "]": T.RBRACKET,
      ",": T.COMMA,
    };
    if (c in singles) {
      advance();
      push(singles[c], c, startLine, startCol);
      continue;
    }

    // Multi-character operators must be matched before their single-char forms.
    const two = c + (peek(1) ?? "");
    const twoCharOps = new Set(["==", "!=", "<=", ">=", "&&", "||"]);
    if (twoCharOps.has(two)) {
      advance();
      advance();
      push(T.OP, two, startLine, startCol);
      continue;
    }

    const singleOps = new Set(["+", "-", "*", "/", "%", "=", "<", ">", "!"]);
    if (singleOps.has(c)) {
      advance();
      push(T.OP, c, startLine, startCol);
      continue;
    }

    throw new LexError(`Unexpected character '${c}'`, startLine, startCol);
  }

  tokens.push({ type: T.EOF, value: null, line, col });
  return tokens;
}
