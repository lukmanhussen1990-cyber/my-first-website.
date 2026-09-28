// Only the globals that exist in Bedrock's QuickJS script runtime are declared here.
// Anything else (setTimeout, setInterval, fetch, process, require, structuredClone, TextEncoder, ...)
// is intentionally undeclared so `tsc` reports it as an error.
declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
