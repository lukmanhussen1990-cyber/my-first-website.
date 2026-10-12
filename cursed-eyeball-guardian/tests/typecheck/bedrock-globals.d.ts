// Globals the Bedrock script runtime provides on top of plain ES2020.
// No DOM/Node typings are loaded, so accidental use of setTimeout, fetch,
// process, etc. is reported as an error.
declare const console: {
  log(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
