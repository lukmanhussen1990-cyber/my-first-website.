// errors.js — error types with source-position info for friendly messages.

// Base class for every error the language can raise. Carries an optional
// line/column so the runner can point at the exact spot in the source.
export class SproutError extends Error {
  constructor(message, line = null, col = null) {
    super(message);
    this.name = "SproutError";
    this.line = line;
    this.col = col;
  }
}

// Raised while turning source text into tokens (e.g. an unterminated string).
export class LexError extends SproutError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = "SyntaxError";
    this.stage = "lexer";
  }
}

// Raised while building the AST (e.g. a missing `)` or an unexpected token).
export class ParseError extends SproutError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = "SyntaxError";
    this.stage = "parser";
  }
}

// Raised while running the program (e.g. dividing by zero, unknown variable).
export class RuntimeError extends SproutError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = "RuntimeError";
    this.stage = "runtime";
  }
}

// Build a multi-line, human-friendly report that underlines the offending
// token within its source line. Works for any SproutError with a position.
export function formatError(err, source = "") {
  if (!(err instanceof SproutError)) {
    return `InternalError: ${err.message}`;
  }
  const header = `${err.name}: ${err.message}`;
  if (err.line == null || !source) {
    return header;
  }
  const lines = source.split("\n");
  const srcLine = lines[err.line - 1] ?? "";
  const gutter = `${err.line} | `;
  const caretPad = " ".repeat(gutter.length + Math.max(0, (err.col ?? 1) - 1));
  return [
    header,
    "",
    `${gutter}${srcLine}`,
    `${caretPad}^`,
    "",
    `  at line ${err.line}, column ${err.col ?? 1}`,
  ].join("\n");
}
