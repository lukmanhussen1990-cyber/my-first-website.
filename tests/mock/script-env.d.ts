// Globals provided by the Bedrock scripting runtime (QuickJS) that are not part
// of the ES2020 standard library. Bedrock has no DOM and no Node APIs: there is
// no setTimeout/setInterval (use system.runTimeout/runInterval instead).
// Only `console` is declared here so that `tsc --checkJs` accepts it.
declare const console: {
  log(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
