// Minimal typing for the `console` object that Minecraft's script engine provides.
// (@minecraft/server does not declare it, and no DOM/Node lib is loaded on purpose.)
declare const console: {
  warn(...data: unknown[]): void;
};
